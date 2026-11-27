import { STAFF } from '../../middlewares/requireRole.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { clubToday } from '../../utils/time.js';
import { courtsRepository } from '../courts/courts.repository.js';
import {
  checkEquipment,
  clubClock,
  toBookingView,
} from './bookingEquipment.js';
import { bookingEquipmentRepository } from './bookingEquipment.repository.js';
import { formatPrice } from './pricing.js';

const DEFAULT_CHANGE_DEADLINE_HOURS = 2; // RULE-08, FR-18
const HOUR = 60 * 60 * 1000;

// The booking, if the user may change its equipment: its player, or staff
// (SDD 5.1: Owner, Staff). Anyone else gets 404, like an unknown booking:
// the answer does not reveal the bookings of the other players (NFR-08).
async function findOwnBooking(user, bookingId) {
  const booking = Number.isInteger(bookingId)
    ? await bookingEquipmentRepository.findBooking(bookingId)
    : null;
  const allowed =
    booking && (booking.userId === user.id || STAFF.includes(user.role));
  if (!allowed) {
    throw new NotFoundError('This booking does not exist', 'BOOKING_NOT_FOUND');
  }
  return booking;
}

// Last moment a player can change the equipment: 2 hours (setting of the
// admin) before the start (FR-18, RULE-08).
async function changeDeadline(booking) {
  const hours = Number(
    (await courtsRepository.findSetting('equipment_change_deadline_hours')) ??
      DEFAULT_CHANGE_DEADLINE_HOURS,
  );
  return { hours, deadline: new Date(booking.startTime - hours * HOUR) };
}

// Refuses the change of a booking that is not confirmed, or too close to its
// start for a player. Staff can still change it until the start.
function checkCanChange(user, booking, { hours, deadline }, now) {
  if (booking.status !== 'CONFIRMED') {
    throw new ConflictError(
      'BOOKING_NOT_ACTIVE',
      'The equipment of a cancelled or finished booking cannot be changed',
    );
  }
  const isStaff = STAFF.includes(user.role);
  if (now >= (isStaff ? booking.startTime : deadline)) {
    throw new ConflictError(
      'EQUIPMENT_CHANGE_CLOSED',
      `The equipment can be changed up to ${hours} hours before the start ` +
        `(${clubToday(deadline)} ${clubClock(deadline)})`,
    );
  }
}

export const bookingEquipmentService = {
  // GET /api/bookings/:id/equipment: the booking, until when its equipment
  // can be changed, and each type with its price, the quantity reserved by
  // this booking and the quantity it can have (FR-17, FR-18).
  async get(user, bookingId, now = new Date()) {
    const booking = await findOwnBooking(user, bookingId);
    const limit = await changeDeadline(booking);
    const reserved = Object.fromEntries(
      booking.equipment.map((e) => [e.typeId, e]),
    );
    const typeIds = [
      ...(await bookingEquipmentRepository.findActiveTypes()).map((t) => t.id),
      ...Object.keys(reserved).map(Number),
    ];
    const stock = await bookingEquipmentRepository.readStock(
      typeIds,
      booking.startTime,
      booking.endTime,
      booking.id,
    );

    let canChange = true;
    try {
      checkCanChange(user, booking, limit, now);
    } catch {
      canChange = false;
    }
    return {
      booking: toBookingView(booking),
      changeDeadline: `${clubToday(limit.deadline)}T${clubClock(limit.deadline)}`,
      canChange,
      equipment: stock
        .filter((type) => type.isActive || reserved[type.id])
        .map((type) => ({
          typeId: type.id,
          name: type.name,
          category: type.category,
          unitPrice: formatPrice(
            Math.round(
              Number(reserved[type.id]?.unitPrice ?? type.rentalPrice) * 100,
            ),
          ),
          quantity: reserved[type.id]?.quantity ?? 0,
          available: type.available,
        })),
    };
  },

  // PUT /api/bookings/:id/equipment: replaces the equipment of a booking
  // (FR-18, FR-19). The whole list is sent; a type left out or at 0 is
  // removed. Answers the booking with its new total price.
  async change(user, bookingId, equipment, now = new Date()) {
    const booking = await findOwnBooking(user, bookingId);
    checkCanChange(user, booking, await changeDeadline(booking), now);

    const updated = await bookingEquipmentRepository.replaceEquipment(
      booking,
      equipment,
      (stock, keptPrices) => checkEquipment(equipment, stock, keptPrices),
    );
    if (!updated) {
      throw new ConflictError(
        'BOOKING_NOT_ACTIVE',
        'The equipment of a cancelled or finished booking cannot be changed',
      );
    }
    return toBookingView(updated);
  },
};
