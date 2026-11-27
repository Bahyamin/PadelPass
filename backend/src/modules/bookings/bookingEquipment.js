import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { CLUB_TIME_ZONE, clubToday } from '../../utils/time.js';
import { formatPrice } from './pricing.js';

const MINUTE = 60 * 1000;

const toCents = (price) => Math.round(Number(price) * 100);

// Checks the equipment asked for a booking against the stock of its slot
// (RULE-08, FR-19) and returns the booking_equipment rows to save.
// - wanted: [{ typeId, quantity }]; a quantity of 0 means "none"
// - stock: [{ id, name, rentalPrice, isActive, available }] for the slot,
//   without what this booking itself already reserves
// - keptPrices: { [typeId]: unitPrice } of the equipment already reserved:
//   it keeps the price of the day it was reserved, like the court price.
// Pure function: it only uses its arguments, so it is easy to unit test.
export function checkEquipment(wanted, stock, keptPrices = {}) {
  return wanted
    .filter((w) => w.quantity > 0)
    .map((w) => {
      const type = stock.find((s) => s.id === w.typeId);
      if (!type || !type.isActive) {
        throw new NotFoundError(
          'This equipment does not exist',
          'EQUIPMENT_NOT_FOUND',
        );
      }
      if (w.quantity > type.available) {
        throw new ConflictError(
          'EQUIPMENT_UNAVAILABLE',
          `Only ${type.available} × ${type.name} available for this slot, ` +
            `you asked for ${w.quantity}`,
        );
      }
      return {
        typeId: type.id,
        quantity: w.quantity,
        unitPrice: keptPrices[type.id] ?? type.rentalPrice,
      };
    });
}

// Prices of a booking (FR-19): court + equipment (quantity x unit price)
// + fees, computed in cents, sent as strings with two decimals ("68.00").
// booking: loaded with equipment and the name of each type.
export function bookingPrices(booking) {
  const equipmentCents = booking.equipment.reduce(
    (sum, e) => sum + e.quantity * toCents(e.unitPrice),
    0,
  );
  const courtCents = toCents(booking.courtPrice);
  const feesCents = toCents(booking.feesTotal ?? 0);
  return {
    courtPrice: formatPrice(courtCents),
    equipment: booking.equipment.map((e) => ({
      typeId: e.typeId,
      name: e.type.name,
      quantity: e.quantity,
      unitPrice: formatPrice(toCents(e.unitPrice)),
    })),
    equipmentPrice: formatPrice(equipmentCents),
    feesTotal: formatPrice(feesCents),
    totalPrice: formatPrice(courtCents + equipmentCents + feesCents),
  };
}

// "18:00", in the club time zone.
export const clubClock = (instant) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: CLUB_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);

// A booking with its equipment and prices, as the API returns it.
export function toBookingView(booking) {
  return {
    id: booking.id,
    courtId: booking.courtId,
    courtName: booking.court.name,
    date: clubToday(booking.startTime),
    start: clubClock(booking.startTime),
    end: clubClock(booking.endTime),
    duration: Math.round((booking.endTime - booking.startTime) / MINUTE),
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    ...bookingPrices(booking),
  };
}
