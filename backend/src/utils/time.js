// Dates and times of the club. Times are stored in UTC and the club works in
// the Europe/Paris time zone (SDD 4.1 and 11). Days are "YYYY-MM-DD" strings
// and times of the day are "HH:mm" strings.

export const CLUB_TIME_ZONE = 'Europe/Paris';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// True for a real calendar day such as "2026-11-20" (not "2026-02-30").
export function isValidDay(day) {
  if (typeof day !== 'string' || !DAY_PATTERN.test(day)) return false;
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

// 0 = Sunday ... 6 = Saturday, like the opening_hours table.
export function dayOfWeek(day) {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

export function addDays(day, count) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// The current day at the club, e.g. "2026-11-16".
export function clubToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLUB_TIME_ZONE }).format(
    now,
  );
}

// Offset of the club time zone at a given instant, in minutes (+60 or +120).
function clubOffsetMinutes(instant) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: CLUB_TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

// The UTC instant of a club day and time, e.g. ("2026-11-20", "18:00").
export function clubTime(day, time) {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  return new Date(guess.getTime() - clubOffsetMinutes(guess) * 60000);
}
