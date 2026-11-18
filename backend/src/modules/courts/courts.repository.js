import { prisma } from '../../config/db.js';

// Database queries of the courts module. Only this layer talks to Prisma.
export const courtsRepository = {
  findActiveCourts() {
    return prisma.court.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: { id: 'asc' },
    });
  },

  findOpeningHours(dayOfWeek) {
    return prisma.openingHours.findUnique({ where: { dayOfWeek } });
  },

  async findSetting(key) {
    const setting = await prisma.setting.findUnique({ where: { key } });
    return setting?.value;
  },

  // Confirmed bookings that overlap [from, to): 1 query for the whole day.
  findConfirmedBookings(from, to) {
    return prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        startTime: { lt: to },
        endTime: { gt: from },
      },
      select: { courtId: true, startTime: true, endTime: true },
    });
  },

  findClosures(from, to) {
    return prisma.courtClosure.findMany({
      where: { startTime: { lt: to }, endTime: { gt: from } },
      select: { courtId: true, startTime: true, endTime: true },
    });
  },
};
