import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js';
import { CLUB_TIME_ZONE, clubTime, clubToday } from '../../utils/time.js';
import { bookingEmailsService } from '../notifications/bookingEmails.service.js';
import { adminCourtsRepository } from './adminCourts.repository.js';

// "18:00", in the club time zone.
const clubClock = (instant) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: CLUB_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);

// "2026-11-30T08:00" (club time) <-> UTC instant.
const toLocal = (instant) => `${clubToday(instant)}T${clubClock(instant)}`;
const fromLocal = (local) => clubTime(local.slice(0, 10), local.slice(11));

const toClosure = (closure) => ({
  id: closure.id,
  courtId: closure.courtId,
  start: toLocal(closure.startTime),
  end: toLocal(closure.endTime),
  reason: closure.reason,
});

const toCourt = (court) => ({
  id: court.id,
  name: court.name,
  type: court.type,
  isActive: court.isActive,
  closures: (court.closures ?? []).map(toClosure),
});

// A cancelled booking, as shown to the administrator.
const toCancelled = (booking) => ({
  id: booking.id,
  date: clubToday(booking.startTime),
  start: clubClock(booking.startTime),
  end: clubClock(booking.endTime),
  player: booking.user
    ? `${booking.user.firstName} ${booking.user.lastName}`
    : booking.guestName,
});

async function findCourtOr404(id) {
  const court = Number.isInteger(id)
    ? await adminCourtsRepository.findById(id)
    : null;
  if (!court) throw new NotFoundError('Court not found', 'COURT_NOT_FOUND');
  return court;
}

async function checkNameFree(name, ignoredId) {
  const other = await adminCourtsRepository.findByName(name);
  if (other && other.id !== ignoredId) {
    throw new ConflictError(
      'COURT_NAME_TAKEN',
      `A court is already named "${other.name}"`,
    );
  }
}

// Court management by the administrator (FR-24, UC-14). An inactive court
// leaves the availability grid and cannot be booked; a closed court shows
// CLOSED in the grid during its closure (RULE-05).
export const adminCourtsService = {
  async list(now = new Date()) {
    return (await adminCourtsRepository.findAll(now)).map(toCourt);
  },

  async create(userId, data) {
    await checkNameFree(data.name);
    return toCourt(await adminCourtsRepository.create(userId, data));
  },

  async update(userId, id, changes, now = new Date()) {
    const court = await findCourtOr404(id);
    if (changes.name) await checkNameFree(changes.name, id);

    // A court with bookings to come is not deactivated: the administrator
    // first closes it for the period, which cancels them and warns the players.
    if (changes.isActive === false && court.isActive) {
      const count = await adminCourtsRepository.countUpcomingBookings(id, now);
      if (count > 0) {
        throw new ConflictError(
          'COURT_HAS_BOOKINGS',
          `This court still has ${count} upcoming booking(s). Close it for ` +
            'the period first: this cancels them and notifies the players.',
        );
      }
    }
    return toCourt(await adminCourtsRepository.update(userId, id, changes));
  },

  // Closes a court for a period with a reason (FR-24, AC-17). The confirmed
  // bookings during the closure are cancelled and their players get the
  // cancellation email (FR-32), sent after the commit without waiting for it.
  async close(userId, courtId, { start, end, reason }, now = new Date()) {
    await findCourtOr404(courtId);
    const startTime = fromLocal(start);
    const endTime = fromLocal(end);
    if (endTime <= now) {
      throw new ValidationError(
        'This period is already over',
        'CLOSURE_IN_PAST',
      );
    }

    const { closure, bookings } = await adminCourtsRepository.closeCourt(
      userId,
      { courtId, startTime, endTime, reason },
      now,
    );
    for (const booking of bookings) {
      bookingEmailsService.notify('CANCELLED', booking.id);
    }
    return {
      ...toClosure(closure),
      cancelledBookings: bookings.map(toCancelled),
    };
  },
};
