import { STAFF } from '../../middlewares/requireRole.js';
import { NotFoundError } from '../../utils/errors.js';
import { clubToday } from '../../utils/time.js';
import { clubClock, toBookingView } from './bookingEquipment.js';
import { bookingDetailsRepository } from './bookingDetails.repository.js';

// "2026-11-25T18:02", in club time.
const toLocal = (instant) =>
  instant ? `${clubToday(instant)}T${clubClock(instant)}` : null;

// The details of a booking (SDD 5.1, FR-27): the booking with its prices,
// the player or the guest, and the items handed out (pick-up and return).
function toDetails(booking) {
  return {
    ...toBookingView(booking),
    player: booking.user,
    guest: booking.user
      ? null
      : { name: booking.guestName, phone: booking.guestPhone },
    rentals: booking.rentals.map((rental) => ({
      id: rental.id,
      code: rental.item.code,
      typeName: rental.item.type.name,
      pickedUpAt: toLocal(rental.pickedUpAt),
      returnedAt: toLocal(rental.returnedAt),
      returnCondition: rental.returnCondition,
    })),
  };
}

export const bookingDetailsService = {
  // GET /api/bookings/:id: for the player of the booking, or staff (SDD 5.1:
  // Owner, Staff). Anyone else gets 404, like an unknown booking: the answer
  // does not reveal the bookings of the other players (NFR-08).
  async get(user, bookingId) {
    const booking = Number.isInteger(bookingId)
      ? await bookingDetailsRepository.findBooking(bookingId)
      : null;
    const allowed =
      booking && (booking.userId === user.id || STAFF.includes(user.role));
    if (!allowed) {
      throw new NotFoundError(
        'This booking does not exist',
        'BOOKING_NOT_FOUND',
      );
    }
    return toDetails(booking);
  },
};
