import { addMinutes, clubTime } from '../../utils/time.js';

export const SLOT_MINUTES = 30;

const overlaps = (period, start, end) =>
  period.startTime < end && period.endTime > start;

// Builds the availability grid of one day (SDD 6.2, FR-08): every active
// court and every 30-minute slot, with the status PAST, CLOSED, BOOKED or FREE.
// Pure function: it only uses its arguments, so it is easy to unit test.
export function buildAvailability({
  day,
  openingHours,
  courts,
  bookings,
  closures,
  now,
}) {
  const slots = [];
  if (openingHours) {
    for (
      let time = openingHours.openTime;
      time < openingHours.closeTime;
      time = addMinutes(time, SLOT_MINUTES)
    ) {
      slots.push(time);
    }
  }

  return {
    date: day,
    openTime: openingHours?.openTime ?? null,
    closeTime: openingHours?.closeTime ?? null,
    slots,
    courts: courts.map((court) => ({
      id: court.id,
      name: court.name,
      type: court.type,
      slots: slots.map((time) => {
        const start = clubTime(day, time);
        const end = clubTime(day, addMinutes(time, SLOT_MINUTES));
        const isCourt = (period) => period.courtId === court.id;

        let status = 'FREE';
        if (start < now) status = 'PAST';
        else if (closures.some((c) => isCourt(c) && overlaps(c, start, end)))
          status = 'CLOSED';
        else if (bookings.some((b) => isCourt(b) && overlaps(b, start, end)))
          status = 'BOOKED';

        return { time, status };
      }),
    })),
  };
}
