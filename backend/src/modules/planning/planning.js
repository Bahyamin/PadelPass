import { addMinutes } from '../../utils/time.js';
import { bookingPrices, clubClock } from '../bookings/bookingEquipment.js';

export const SLOT_MINUTES = 30;

const MINUTE = 60 * 1000;

// "HH:mm" of an instant of the day [dayStart, dayEnd): "00:00" at the start
// of the day or before, "24:00" at its end or after.
function clockOfDay(instant, dayStart, dayEnd) {
  if (instant <= dayStart) return '00:00';
  if (instant >= dayEnd) return '24:00';
  return clubClock(instant);
}

// The 30-minute rows of the timeline: from the opening to the closing time
// of the day, widened if a booking starts earlier or ends later (the opening
// hours may have changed after it was made). A closed day without bookings
// has no slot.
export function planningSlots(hours, bookings) {
  const starts = bookings.map((b) => b.start);
  const ends = bookings.map((b) => b.end);
  if (hours) {
    starts.push(hours.openTime);
    ends.push(hours.closeTime);
  }
  if (starts.length === 0) return [];

  const first = starts.sort()[0];
  const last = ends.sort().at(-1);
  const slots = [];
  for (let time = first; time < last; time = addMinutes(time, SLOT_MINUTES)) {
    slots.push(time);
  }
  return slots;
}

// One booking of the planning (FR-27, AC-16): time, player or guest, reserved
// equipment and payment status.
function toPlanningBooking(booking, dayStart, dayEnd) {
  const prices = bookingPrices(booking);
  return {
    id: booking.id,
    start: clockOfDay(booking.startTime, dayStart, dayEnd),
    end: clockOfDay(booking.endTime, dayStart, dayEnd),
    duration: Math.round((booking.endTime - booking.startTime) / MINUTE),
    status: booking.status,
    player: booking.user
      ? `${booking.user.firstName} ${booking.user.lastName}`
      : booking.guestName,
    isGuest: !booking.user,
    phone: booking.user ? booking.user.phone : booking.guestPhone,
    equipment: prices.equipment.map(({ name, quantity }) => ({
      name,
      quantity,
    })),
    paymentStatus: booking.paymentStatus,
    totalPrice: prices.totalPrice,
  };
}

// The daily planning (FR-27, UC-09): each court with its bookings and its
// closures of the day, in club time. Pure function: it only uses its
// arguments, so it is easy to unit test.
// - hours: the opening hours of the day, or null when the club is closed
// - courts, bookings (with user and equipment), closures: rows of the day
// - dayStart, dayEnd: the instants of 00:00 that day and the next day
export function buildPlanning({
  date,
  hours,
  courts,
  bookings,
  closures,
  dayStart,
  dayEnd,
}) {
  const views = bookings.map((b) => ({
    courtId: b.courtId,
    view: toPlanningBooking(b, dayStart, dayEnd),
  }));
  return {
    date,
    openTime: hours?.openTime ?? null,
    closeTime: hours?.closeTime ?? null,
    slots: planningSlots(
      hours,
      views.map((b) => b.view),
    ),
    courts: courts.map((court) => ({
      id: court.id,
      name: court.name,
      type: court.type,
      isActive: court.isActive,
      closures: closures
        .filter((c) => c.courtId === court.id)
        .map((c) => ({
          start: clockOfDay(c.startTime, dayStart, dayEnd),
          end: clockOfDay(c.endTime, dayStart, dayEnd),
          reason: c.reason,
        })),
      bookings: views
        .filter((b) => b.courtId === court.id)
        .map((b) => b.view)
        .sort((a, b) => (a.start < b.start ? -1 : 1)),
    })),
  };
}
