import { prisma } from '../../config/db.js';

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

  create(data) {
    return prisma.booking.create({
      data,
      include: { court: { select: { name: true } } },
    });
  },
};
