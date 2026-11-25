import { CLUB_TIME_ZONE, clubToday } from '../../utils/time.js';
import { myBookingsRepository } from './myBookings.repository.js';
import { formatPrice } from './pricing.js';

const MINUTE = 60 * 1000;

const toCents = (price) => Math.round(Number(price) * 100);

// "18:00", in the club time zone.
const clubClock = (instant) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: CLUB_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);

// One booking as the player sees it (FR-14): date, time, court, duration,
// equipment, prices, status and payment status. Prices are strings with two
// decimals ("60.00"), like in the rest of the API.
function toView(booking) {
  const equipmentCents = booking.equipment.reduce(
    (sum, e) => sum + e.quantity * toCents(e.unitPrice),
    0,
  );
  const totalCents =
    toCents(booking.courtPrice) + equipmentCents + toCents(booking.feesTotal);
  return {
    id: booking.id,
    date: clubToday(booking.startTime),
    start: clubClock(booking.startTime),
    end: clubClock(booking.endTime),
    duration: Math.round((booking.endTime - booking.startTime) / MINUTE),
    courtName: booking.court.name,
    equipment: booking.equipment.map((e) => ({
      name: e.type.name,
      quantity: e.quantity,
      unitPrice: formatPrice(toCents(e.unitPrice)),
    })),
    courtPrice: formatPrice(toCents(booking.courtPrice)),
    equipmentPrice: formatPrice(equipmentCents),
    feesTotal: formatPrice(toCents(booking.feesTotal)),
    totalPrice: formatPrice(totalCents),
    status: booking.status,
    paymentStatus: booking.paymentStatus,
  };
}

export const myBookingsService = {
  // The bookings of the logged-in player, split in two lists: upcoming
  // (not finished yet, soonest first), then past (most recent first).
  async list(userId, now = new Date()) {
    const bookings = await myBookingsRepository.findByUser(userId);
    const upcoming = bookings.filter((b) => b.endTime > now);
    const past = bookings.filter((b) => b.endTime <= now).reverse();
    return { upcoming: upcoming.map(toView), past: past.map(toView) };
  },
};
