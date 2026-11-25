import { prisma } from '../../config/db.js';

// Database queries of "My bookings". Only this layer talks to Prisma.
export const myBookingsRepository = {
  // Every booking of one player (NFR-08: only their own), with the court and
  // the reserved equipment.
  findByUser(userId) {
    return prisma.booking.findMany({
      where: { userId },
      include: {
        court: { select: { name: true } },
        equipment: {
          include: { type: { select: { name: true } } },
          orderBy: { typeId: 'asc' },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  },
};
