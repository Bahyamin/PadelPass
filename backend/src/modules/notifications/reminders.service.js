import { config } from '../../config/index.js';
import { CLUB_TIME_ZONE } from '../../utils/time.js';
import { notificationsService } from './notifications.service.js';
import { REMINDER_TYPE, remindersRepository } from './reminders.repository.js';

const MINUTE = 60 * 1000;

// Dates of the email in the club time zone, e.g. "Friday, 4 December 2026" and "18:00".
const formatDay = (date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: CLUB_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

const formatTime = (date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: CLUB_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);

// The first name comes from the user: escape it before putting it in HTML.
const escapeHtml = (text) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function reminderEmail(booking) {
  const { user, court } = booking;
  const slot =
    `${court.name}, ${formatDay(booking.startTime)}, ` +
    `from ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}`;
  const price = `${Number(booking.courtPrice).toFixed(2)} EUR`;
  return {
    subject: 'Reminder: your padel booking tomorrow',
    text:
      `Hello ${user.firstName},\n\n` +
      `This is a reminder of your booking tomorrow:\n${slot}.\n\n` +
      `Court price: ${price}.\n\nSee you at the club!`,
    html:
      `<p>Hello ${escapeHtml(user.firstName)},</p>` +
      `<p>This is a reminder of your booking tomorrow:<br>${slot}.</p>` +
      `<p>Court price: ${price}.</p><p>See you at the club!</p>`,
  };
}

// Reminder emails (FR-31, AC-13).
export const remindersService = {
  // Sends a reminder for each confirmed booking that starts in 24 hours
  // (± 15 minutes) and has not been reminded yet. Called every 15 minutes by
  // the scheduled job, so every booking falls into at least one run; the
  // check on the notifications table makes sure it is reminded only once.
  async sendDueReminders(now = new Date()) {
    const { leadHours, toleranceMinutes } = config.reminder;
    const target = now.getTime() + leadHours * 60 * MINUTE;
    const bookings = await remindersRepository.findBookingsToRemind(
      new Date(target - toleranceMinutes * MINUTE),
      new Date(target + toleranceMinutes * MINUTE),
    );

    let sent = 0;
    for (const booking of bookings) {
      // A failed email is logged as FAILED and does not stop the others.
      const ok = await notificationsService.send({
        user: booking.user,
        type: REMINDER_TYPE,
        bookingId: booking.id,
        ...reminderEmail(booking),
      });
      if (ok) sent++;
    }
    return { due: bookings.length, sent };
  },
};
