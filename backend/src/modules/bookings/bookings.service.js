import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js';
import {
  addDays,
  addMinutes,
  CLUB_TIME_ZONE,
  clubTime,
  clubToday,
  dayOfWeek,
} from '../../utils/time.js';
import { courtsRepository } from '../courts/courts.repository.js';
import {
  bookingsRepository,
  isOverlapError,
  isWriteConflict,
} from './bookings.repository.js';
import { computeCourtPrice, formatPrice } from './pricing.js';

const DEFAULT_BOOKING_WINDOW_DAYS = 14; // RULE-03
const DEFAULT_MAX_ACTIVE_BOOKINGS = 3; // RULE-04
const SAVE_ATTEMPTS = 3;

// RULE-05, FR-11, AC-06: the slot is already taken on this court.
const slotUnavailable = () =>
  new ConflictError('SLOT_UNAVAILABLE', 'This court is already booked');

// Runs save(), the insert of a booking, and turns the refusals of the
// database into clear answers (409 instead of 500):
// - no_overlap: another request booked the slot between our check and our
//   insert -> SLOT_UNAVAILABLE;
// - deadlock / write conflict: PostgreSQL cancelled our insert because another
//   one was checking the same slot -> try again; the next attempt sees the
//   other booking (SLOT_UNAVAILABLE) or succeeds if it was rolled back.
async function saveBooking(save) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await save();
    } catch (err) {
      if (isOverlapError(err)) throw slotUnavailable();
      if (isWriteConflict(err) && attempt < SAVE_ATTEMPTS) continue;
      throw err;
    }
  }
}

// "18:00", in the club time zone.
const clubClock = (instant) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: CLUB_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);

// RULE-04, FR-12, AC-07: the message lists the active bookings, e.g.
// "... active bookings: Court 1 on 2026-11-25 from 18:00 to 19:30; ...".
function limitReached(maxActive, active) {
  const list = active
    .map(
      (b) =>
        `${b.court.name} on ${clubToday(b.startTime)} ` +
        `from ${clubClock(b.startTime)} to ${clubClock(b.endTime)}`,
    )
    .join('; ');
  return new ConflictError(
    'LIMIT_REACHED',
    `You already have ${active.length} active bookings, the maximum is ` +
      `${maxActive}. Your active bookings: ${list}`,
  );
}

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

  // RULE-05: the slot is free on this court. This check gives the answer
  // early (also for the quote); the no_overlap constraint of the database
  // still decides when two requests arrive at the same time.
  if (
    await bookingsRepository.findOverlappingBooking(
      court.id,
      startTime,
      endTime,
    )
  ) {
    throw slotUnavailable();
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
    // RULE-04: the limit is a booking parameter of the admin (default 3).
    const maxActive = Number(
      (await courtsRepository.findSetting('max_active_bookings')) ??
        DEFAULT_MAX_ACTIVE_BOOKINGS,
    );
    const result = await saveBooking(() =>
      bookingsRepository.createWithinLimit(
        {
          userId,
          createdById: userId,
          courtId: checked.court.id,
          startTime: checked.startTime,
          endTime: checked.endTime,
          courtPrice: checked.price,
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
        },
        maxActive,
        now,
      ),
    );
    if (!result.booking) throw limitReached(maxActive, result.active);

    const { booking } = result;
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
