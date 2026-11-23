import { prisma } from '../../config/db.js';
import { IN_SERVICE_STATUSES } from './equipmentAvailability.js';

// Turns the rows of a groupBy into { [typeId]: number }.
const byType = (rows, read) =>
  Object.fromEntries(rows.map((row) => [row.typeId, read(row)]));

// Database queries of the equipment module. Only this layer talks to Prisma.
export const equipmentRepository = {
  findActiveTypes() {
    return prisma.equipmentType.findMany({
      where: { isActive: true },
      select: { id: true, name: true, category: true, rentalPrice: true },
      orderBy: { id: 'asc' },
    });
  },

  // Number of items in service per type: 1 query for all the types.
  async countInService() {
    const rows = await prisma.equipmentItem.groupBy({
      by: ['typeId'],
      where: { status: { in: IN_SERVICE_STATUSES } },
      _count: { _all: true },
    });
    return byType(rows, (row) => row._count._all);
  },

  // Quantity per type reserved by the confirmed bookings overlapping [from, to).
  async sumReserved(from, to) {
    const rows = await prisma.bookingEquipment.groupBy({
      by: ['typeId'],
      where: {
        booking: {
          status: 'CONFIRMED',
          startTime: { lt: to },
          endTime: { gt: from },
        },
      },
      _sum: { quantity: true },
    });
    return byType(rows, (row) => row._sum.quantity ?? 0);
  },
};
