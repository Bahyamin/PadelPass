import { prisma } from '../../config/db.js';

// The bookings shown in the planning: every status but cancelled (a cancelled
// booking frees its slot).
const SHOWN = { status: { not: 'CANCELLED' } };

// Database queries of the daily planning (FR-27). Only this layer talks to
// Prisma. [from, to) is the whole day, in UTC instants.
export const planningRepository = {
  findOpeningHours(dayOfWeek) {
    return prisma.openingHours.findUnique({ where: { dayOfWeek } });
  },

  // The active courts, and an inactive court if it still has a booking that day.
  findCourts(from, to) {
    return prisma.court.findMany({
      where: {
        OR: [
          { isActive: true },
          {
            bookings: { some: { ...SHOWN, startTime: { gte: from, lt: to } } },
          },
        ],
      },
      orderBy: { id: 'asc' },
    });
  },

  // The bookings starting that day, with the player and the equipment.
  findBookings(from, to) {
    return prisma.booking.findMany({
      where: { ...SHOWN, startTime: { gte: from, lt: to } },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        equipment: {
          include: { type: { select: { name: true } } },
          orderBy: { typeId: 'asc' },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  },

  // The closures overlapping the day.
  findClosures(from, to) {
    return prisma.courtClosure.findMany({
      where: { startTime: { lt: to }, endTime: { gt: from } },
      orderBy: { startTime: 'asc' },
    });
  },
};
