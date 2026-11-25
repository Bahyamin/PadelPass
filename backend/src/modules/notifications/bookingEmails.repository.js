import { prisma } from '../../config/db.js';

// Database queries of the booking emails. Only this layer talks to Prisma.
export const bookingEmailsRepository = {
  // The booking with everything the email shows: player, court, equipment.
  findBooking(id) {
    return prisma.booking.findUnique({
      where: { id },
      include: {
        user: true,
        court: { select: { name: true } },
        equipment: {
          include: { type: { select: { name: true } } },
          orderBy: { typeId: 'asc' },
        },
      },
    });
  },
};
