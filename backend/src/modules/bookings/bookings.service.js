import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js';
import {
  addDays,
  addMinutes,
  clubTime,
  clubToday,
  dayOfWeek,
} from '../../utils/time.js';
import { courtsRepository } from '../courts/courts.repository.js';
import { bookingsRepository } from './bookings.repository.js';
import { computeCourtPrice, formatPrice } from './pricing.js';

const DEFAULT_BOOKING_WINDOW_DAYS = 14; // RULE-03

// Checks that a slot can be booked and computes its price. Used by the quote
// and by the booking itself, so the summary shows exactly what will be saved.
async function checkSlot({ courtId, date, start, duration }, now) {
  const court = await bookingsRepository.findCourt(courtId);
  if (!court || !court.isActive) {
    throw new NotFoundError('This court does not exist', 'COURT_NOT_FOUND');
  }

  const end = addMinutes(start, duration);
  const startTime = clubTime(date, start);
  const endTime = clubTime(date, end);

  // RULE-03: from now up to the end of the booking window.
  if (startTime <= now) {
    throw new ValidationError('This slot is in the past', 'SLOT_IN_PAST');
  }
  const windowDays = Number(
    (await courtsRepository.findSetting('booking_window_days')) ??
      DEFAULT_BOOKING_WINDOW_DAYS,
  );
  if (date > addDays(clubToday(now), windowDays)) {
    throw new ValidationError(
      `Bookings can be made up to ${windowDays} days ahead`,
      'OUTSIDE_BOOKING_WINDOW',
    );
  }

  // RULE-02: the whole booking lies within the opening hours of the day.
  const hours = await courtsRepository.findOpeningHours(dayOfWeek(date));
  if (!hours) {
    throw new ValidationError(
      'The club is closed on this day',
      'OUTSIDE_OPENING_HOURS',
    );
  }
  if (start < hours.openTime || end > hours.closeTime) {
    throw new ValidationError(
      `The club is open from ${hours.openTime} to ${hours.closeTime} on this day`,
      'OUTSIDE_OPENING_HOURS',
    );
  }

  // RULE-05: a closed court cannot be booked.
  if (await bookingsRepository.findClosure(court.id, startTime, endTime)) {
    throw new ConflictError(
      'COURT_CLOSED',
      'This court is closed during this slot',
    );
  }

  const priceCents = computeCourtPrice({
    dayOfWeek: dayOfWeek(date),
    start,
    duration,
    rules: await bookingsRepository.findPricingRules(dayOfWeek(date)),
  });
  if (priceCents === null) {
    throw new ValidationError(
      'No price is defined for this slot',
      'NO_PRICING_RULE',
    );
  }

  return {
    court,
    date,
    start,
    end,
    duration,
    startTime,
    endTime,
    price: formatPrice(priceCents),
  };
}

export const bookingsService = {
  // Price of a slot, shown to the player before confirming (FR-10).
  async quote(slot, now = new Date()) {
    const checked = await checkSlot(slot, now);
    return {
      courtId: checked.court.id,
      courtName: checked.court.name,
      date: checked.date,
      start: checked.start,
      end: checked.end,
      duration: checked.duration,
      price: checked.price,
    };
  },

  // Books a court for the logged-in player (FR-09, FR-13). The price is copied
  // into the booking, so a later change of the pricing rules does not change it.
  async create(userId, slot, now = new Date()) {
    const checked = await checkSlot(slot, now);
    const booking = await bookingsRepository.create({
      userId,
      createdById: userId,
      courtId: checked.court.id,
      startTime: checked.startTime,
      endTime: checked.endTime,
      courtPrice: checked.price,
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID',
    });
    return {
      id: booking.id,
      courtId: booking.courtId,
      courtName: booking.court.name,
      date: checked.date,
      start: checked.start,
      end: checked.end,
      duration: checked.duration,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      courtPrice: checked.price,
    };
  },
};
