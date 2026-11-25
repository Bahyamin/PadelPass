import { prisma } from '../../config/db.js';
import { config } from '../../config/index.js';
import { mailer } from './mailer.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Sends the email, trying again `retries` times after 1, 2, 4... times
// config.email.retryDelayMs (exponential back-off, SDD 6.5). Each failed
// attempt is logged. Returns null when sent, else the last error.
async function sendWithRetries(email, retries, label) {
  const attempts = retries + 1;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) {
      await wait(config.email.retryDelayMs * 2 ** (attempt - 2));
    }
    try {
      await mailer.send(email);
      return null;
    } catch (err) {
      lastError = err;
      console.error(
        `[notifications] ${label} failed (attempt ${attempt} of ${attempts})`,
        err,
      );
    }
  }
  return attempts > 1
    ? new Error(`${lastError.message} (after ${attempts} attempts)`)
    : lastError;
}

// Sends an email and records the result in the notifications table
// (SDD 4.1 and 6.5). A failed email never throws: it is logged as FAILED, so
// a provider problem never blocks a registration or a booking.
export const notificationsService = {
  async send({
    user,
    type,
    subject,
    text,
    html,
    bookingId = null,
    retries = 0,
  }) {
    const error = await sendWithRetries(
      { to: user.email, subject, text, html },
      retries,
      `${type} to user ${user.id}`,
    );
    await prisma.notification.create({
      data: error
        ? {
            userId: user.id,
            bookingId,
            type,
            status: 'FAILED',
            error: error.message,
          }
        : {
            userId: user.id,
            bookingId,
            type,
            status: 'SENT',
            sentAt: new Date(),
          },
    });
    return !error;
  },
};
