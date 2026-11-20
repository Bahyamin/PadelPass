import { addMinutes } from '../../utils/time.js';

export const SEGMENT_MINUTES = 30;

const toCents = (price) => Math.round(Number(price) * 100);

// "60.00": prices are sent as strings with two decimals, like the database.
export const formatPrice = (cents) => (cents / 100).toFixed(2);

// Court price of a slot, in cents (SDD 6.2, FR-10). The slot is split into
// 30-minute segments; each segment costs half the hourly price of the pricing
// rule of its day and time. Example: Wednesday 18:00-19:30 at 40.00 EUR/h
// = 3 segments x 20.00 = 60.00 EUR.
// Returns null when a segment has no pricing rule.
// Pure function: it only uses its arguments, so it is easy to unit test.
export function computeCourtPrice({ dayOfWeek, start, duration, rules }) {
  let hourlyCentsSum = 0;
  for (let offset = 0; offset < duration; offset += SEGMENT_MINUTES) {
    const time = addMinutes(start, offset);
    const rule = rules.find(
      (r) =>
        r.dayOfWeek === dayOfWeek && r.startTime <= time && time < r.endTime,
    );
    if (!rule) return null;
    hourlyCentsSum += toCents(rule.pricePerHour);
  }
  // Each segment is half an hour: divide once at the end to round only once.
  return Math.round(hourlyCentsSum / 2);
}
