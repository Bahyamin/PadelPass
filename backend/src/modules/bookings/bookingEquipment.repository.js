import { prisma } from '../../config/db.js';
import { IN_SERVICE_STATUSES } from '../equipment/equipmentAvailability.js';

// What a booking is loaded with to show its equipment and its prices.
export const WITH_EQUIPMENT = {
  court: { select: { name: true } },
  equipment: {
    include: { type: { select: { name: true } } },
    orderBy: { typeId: 'asc' },
  },
};

// Stock of equipment types for the slot [from, to) (SDD 6.2, RULE-08): items
// in service minus the quantities of the other confirmed bookings overlapping
// the slot. ignoredBookingId: a booking whose own equipment is not counted
// (the one being changed). With lock = true (inside a transaction), the type
// rows are locked first (SELECT ... FOR UPDATE, always in id order): two
// requests for the same equipment then run one after the other, and the
// second one sees what the first one reserved.
// Returns [{ id, name, rentalPrice, isActive, available }].
export async function readEquipmentStock(
  db,
  typeIds,
  from,
  to,
  { ignoredBookingId, lock = false } = {},
) {
  const ids = [...new Set(typeIds)].sort((a, b) => a - b);
  if (lock) {
    for (const id of ids) {
      await db.$queryRaw`SELECT id FROM equipment_types WHERE id = ${id} FOR UPDATE`;
    }
  }
  const [types, inService, reserved] = await Promise.all([
    db.equipmentType.findMany({ where: { id: { in: ids } } }),
    db.equipmentItem.groupBy({
      by: ['typeId'],
      where: { typeId: { in: ids }, status: { in: IN_SERVICE_STATUSES } },
      _count: { _all: true },
    }),
    db.bookingEquipment.groupBy({
      by: ['typeId'],
      where: {
        typeId: { in: ids },
        booking: {
          status: 'CONFIRMED',
          startTime: { lt: to },
          endTime: { gt: from },
          ...(ignoredBookingId && { id: { not: ignoredBookingId } }),
        },
      },
      _sum: { quantity: true },
    }),
  ]);
  const count = (rows, typeId, read) =>
    read(rows.find((r) => r.typeId === typeId)) ?? 0;
  return types.map((type) => ({
    id: type.id,
    name: type.name,
    category: type.category,
    rentalPrice: type.rentalPrice,
    isActive: type.isActive,
    available: Math.max(
      0,
      count(inService, type.id, (r) => r?._count._all) -
        count(reserved, type.id, (r) => r?._sum.quantity),
    ),
  }));
}

// Database queries of the equipment of a booking (FR-18, FR-19). Only this
// layer talks to Prisma.
export const bookingEquipmentRepository = {
  findBooking(id) {
    return prisma.booking.findUnique({
      where: { id },
      include: WITH_EQUIPMENT,
    });
  },

  findActiveTypes() {
    return prisma.equipmentType.findMany({
      where: { isActive: true },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
  },

  readStock(typeIds, from, to, ignoredBookingId) {
    return readEquipmentStock(prisma, typeIds, from, to, { ignoredBookingId });
  },

  // Replaces the equipment of a booking in one transaction. The booking row
  // is locked first, so two changes of the same booking run one after the
  // other; then check(stock, keptPrices) gives the rows to save, or throws.
  // Returns the booking with its new equipment, or null if it is no longer
  // confirmed.
  replaceEquipment(booking, wanted, check) {
    return prisma.$transaction(async (tx) => {
      const [row] =
        await tx.$queryRaw`SELECT status FROM bookings WHERE id = ${booking.id} FOR UPDATE`;
      if (row?.status !== 'CONFIRMED') return null;

      const current = await tx.bookingEquipment.findMany({
        where: { bookingId: booking.id },
      });
      const keptPrices = Object.fromEntries(
        current.map((e) => [e.typeId, e.unitPrice]),
      );
      const stock = await readEquipmentStock(
        tx,
        wanted.map((w) => w.typeId),
        booking.startTime,
        booking.endTime,
        { ignoredBookingId: booking.id, lock: true },
      );
      const rows = check(stock, keptPrices);

      await tx.bookingEquipment.deleteMany({
        where: { bookingId: booking.id },
      });
      await tx.bookingEquipment.createMany({
        data: rows.map((r) => ({ bookingId: booking.id, ...r })),
      });
      return tx.booking.findUnique({
        where: { id: booking.id },
        include: WITH_EQUIPMENT,
      });
    });
  },
};
