import { prisma } from '../../config/db.js';
import {
  readEquipmentStock,
  WITH_EQUIPMENT,
} from './bookingEquipment.repository.js';

// True when PostgreSQL refused a booking because of the "no_overlap" exclusion
// constraint (error 23P01, RULE-05): another confirmed booking of the same
// court overlaps it. With the pg driver adapter, Prisma puts the PostgreSQL
// error in meta.driverAdapterError.cause.
export function isOverlapError(err) {
  const cause = err?.meta?.driverAdapterError?.cause;
  if (cause) {
    return cause.code === '23P01' && /no_overlap/.test(cause.message);
  }
  return /no_overlap/.test(err?.message ?? '');
}

// True when PostgreSQL stopped the transaction because of a deadlock or a
// write conflict (Prisma error P2034, "please retry your transaction"). It
// happens when two simultaneous inserts check no_overlap against each other:
// PostgreSQL cancels one of them, which can simply be tried again.
export function isWriteConflict(err) {
  return err?.code === 'P2034';
}

// Database queries of the bookings module. Only this layer talks to Prisma.
export const bookingsRepository = {
  findCourt(id) {
    return prisma.court.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });
  },

  findPricingRules(dayOfWeek) {
    return prisma.pricingRule.findMany({ where: { dayOfWeek } });
  },

  // A closure of the court that overlaps [from, to), if any.
  findClosure(courtId, from, to) {
    return prisma.courtClosure.findFirst({
      where: { courtId, startTime: { lt: to }, endTime: { gt: from } },
    });
  },

  // A confirmed booking of the court that overlaps [from, to), if any.
  // Cancelled bookings free their slot, like in the no_overlap constraint.
  findOverlappingBooking(courtId, from, to) {
    return prisma.booking.findFirst({
      where: {
        courtId,
        status: 'CONFIRMED',
        startTime: { lt: to },
        endTime: { gt: from },
      },
      select: { id: true },
    });
  },

  // Creates the booking of a player if they have fewer than maxActive active
  // bookings (RULE-04, SDD 6.2). Active = confirmed and starting after now:
  // cancelled and past bookings do not count.
  // The transaction first locks the player's row (SELECT ... FOR UPDATE), so
  // two requests of the same player run one after the other and cannot both
  // pass the limit. Returns { booking, active }; booking is null when the
  // limit is reached, and active lists the player's active bookings.
  // equipment: [{ typeId, quantity }] asked with the booking (FR-18); the
  // stock of the slot is read with the type rows locked, and check(stock)
  // gives the rows to save or throws (RULE-08, FR-19).
  createWithinLimit(data, maxActive, now, equipment = [], check = () => []) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${data.userId} FOR UPDATE`;
      const active = await tx.booking.findMany({
        where: {
          userId: data.userId,
          status: 'CONFIRMED',
          startTime: { gt: now },
        },
        include: { court: { select: { name: true } } },
        orderBy: { startTime: 'asc' },
      });
      if (active.length >= maxActive) return { booking: null, active };

      const rows = equipment.length
        ? check(
            await readEquipmentStock(
              tx,
              equipment.map((e) => e.typeId),
              data.startTime,
              data.endTime,
              { lock: true },
            ),
          )
        : [];
      const booking = await tx.booking.create({
        data: { ...data, equipment: { create: rows } },
        include: WITH_EQUIPMENT,
      });
      return { booking, active };
    });
  },
};
