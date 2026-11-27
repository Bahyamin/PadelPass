import { prisma } from '../../config/db.js';
import { WITH_EQUIPMENT } from './bookingEquipment.repository.js';

// Database queries of the details of a booking. Only this layer talks to Prisma.
export const bookingDetailsRepository = {
  // The booking with its court, equipment, player and the items handed out.
  findBooking(id) {
    return prisma.booking.findUnique({
      where: { id },
      include: {
        ...WITH_EQUIPMENT,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        rentals: {
          include: {
            item: {
              select: { code: true, type: { select: { name: true } } },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
  },
};
