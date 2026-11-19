import { prisma } from '../../config/db.js';
import { mailer } from './mailer.js';

// Sends an email and records the result in the notifications table
// (SDD 4.1 and 6.5). A failed email never throws: it is logged as FAILED, so
// a provider problem never blocks a registration or a booking.
export const notificationsService = {
  async send({ user, type, subject, text, html, bookingId = null }) {
    try {
      await mailer.send({ to: user.email, subject, text, html });
      await prisma.notification.create({
        data: {
          userId: user.id,
          bookingId,
          type,
          status: 'SENT',
          sentAt: new Date(),
        },
      });
      return true;
    } catch (err) {
      console.error(`[notifications] ${type} to user ${user.id} failed`, err);
      await prisma.notification.create({
        data: {
          userId: user.id,
          bookingId,
          type,
          status: 'FAILED',
          error: err.message,
        },
      });
      return false;
    }
  },
};
