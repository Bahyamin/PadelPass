import { ValidationError } from '../../utils/errors.js';
import {
  addDays,
  clubTime,
  clubToday,
  dayOfWeek,
  isValidDay,
} from '../../utils/time.js';
import { buildAvailability } from './availability.js';
import { courtsRepository } from './courts.repository.js';

const DEFAULT_BOOKING_WINDOW_DAYS = 14; // RULE-03

export const courtsService = {
  listCourts() {
    return courtsRepository.findActiveCourts();
  },

  // Availability grid of one day, from today up to the end of the booking window.
  async getAvailability(day, now = new Date()) {
    if (!isValidDay(day)) {
      throw new ValidationError('date must be a valid day (YYYY-MM-DD)');
    }

    const windowDays = Number(
      (await courtsRepository.findSetting('booking_window_days')) ??
        DEFAULT_BOOKING_WINDOW_DAYS,
    );
    const today = clubToday(now);
    const lastDay = addDays(today, windowDays);
    if (day < today || day > lastDay) {
      throw new ValidationError(
        `date must be between ${today} and ${lastDay}`,
        'OUTSIDE_BOOKING_WINDOW',
      );
    }

    const from = clubTime(day, '00:00');
    const to = clubTime(addDays(day, 1), '00:00');
    const [openingHours, courts, bookings, closures] = await Promise.all([
      courtsRepository.findOpeningHours(dayOfWeek(day)),
      courtsRepository.findActiveCourts(),
      courtsRepository.findConfirmedBookings(from, to),
      courtsRepository.findClosures(from, to),
    ]);

    return buildAvailability({
      day,
      openingHours,
      courts,
      bookings,
      closures,
      now,
    });
  },
};
