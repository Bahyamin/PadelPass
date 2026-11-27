import { ValidationError } from '../../utils/errors.js';
import {
  addDays,
  clubTime,
  clubToday,
  dayOfWeek,
  isValidDay,
} from '../../utils/time.js';
import { buildPlanning } from './planning.js';
import { planningRepository } from './planning.repository.js';

export const planningService = {
  // The planning of one day for the front desk (FR-27, UC-09). Any day can be
  // asked, past or future; without a day, today at the club.
  async getDay(date, now = new Date()) {
    const day = date ?? clubToday(now);
    if (!isValidDay(day)) {
      throw new ValidationError('date must be a valid day (YYYY-MM-DD)');
    }

    const dayStart = clubTime(day, '00:00');
    const dayEnd = clubTime(addDays(day, 1), '00:00');
    const [hours, courts, bookings, closures] = await Promise.all([
      planningRepository.findOpeningHours(dayOfWeek(day)),
      planningRepository.findCourts(dayStart, dayEnd),
      planningRepository.findBookings(dayStart, dayEnd),
      planningRepository.findClosures(dayStart, dayEnd),
    ]);
    return buildPlanning({
      date: day,
      hours,
      courts,
      bookings,
      closures,
      dayStart,
      dayEnd,
    });
  },
};
