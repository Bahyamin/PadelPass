import { prisma } from '../../config/db.js';

// Type of the reminder rows in the notifications table.
export const REMINDER_TYPE = 'BOOKING_REMINDER';

// Database queries of the reminders. Only this layer talks to Prisma.
export const remindersRepository = {
  // Confirmed bookings of an active player that start in [from, to] and have
  // no reminder sent yet. A FAILED reminder does not count: it is tried again.
  // Guest bookings (no user) are left out: there is no email to write to.
  findBookingsToRemind(from, to) {
    return prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        startTime: { gte: from, lte: to },
        user: { isActive: true },
        notifications: { none: { type: REMINDER_TYPE, status: 'SENT' } },
      },
      include: { user: true, court: { select: { name: true } } },
      orderBy: { startTime: 'asc' },
    });
  },
};
