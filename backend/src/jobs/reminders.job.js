import cron from 'node-cron';
import { config } from '../config/index.js';
import { remindersService } from '../modules/notifications/reminders.service.js';
import { CLUB_TIME_ZONE } from '../utils/time.js';

// One run of the job. It never throws: an error is logged and the next run
// tries again, so a database or email problem never stops the server.
export async function runRemindersJob(now = new Date()) {
  try {
    const { due, sent } = await remindersService.sendDueReminders(now);
    if (due > 0) console.log(`[reminders] ${sent} of ${due} reminder(s) sent`);
  } catch (err) {
    console.error('[reminders] job failed', err);
  }
}

// Scheduler (SDD 3.3 and 6.1): runs every 15 minutes, started by server.js.
// noOverlap skips a run if the previous one is still sending emails.
export function startRemindersJob() {
  return cron.schedule(config.reminder.cron, () => runRemindersJob(), {
    name: 'booking-reminders',
    timezone: CLUB_TIME_ZONE,
    noOverlap: true,
  });
}
