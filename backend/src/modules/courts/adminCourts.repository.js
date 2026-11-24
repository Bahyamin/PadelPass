import { prisma } from '../../config/db.js';

// One line in audit_logs for every change made by an administrator.
const audit = (tx, userId, action, entity, entityId, details) =>
  tx.auditLog.create({ data: { userId, action, entity, entityId, details } });

// Database queries of the court management (FR-24). Only this layer talks to
// Prisma. Every change and its audit line are saved in one transaction.
export const adminCourtsRepository = {
  // Every court, active or not, with its closures not finished yet.
  findAll(now) {
    return prisma.court.findMany({
      include: {
        closures: {
          where: { endTime: { gt: now } },
          orderBy: { startTime: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    });
  },

  findById(id) {
    return prisma.court.findUnique({ where: { id } });
  },

  // Court names are unique, whatever the case ("Court 1" and "court 1").
  findByName(name) {
    return prisma.court.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
  },

  create(userId, data) {
    return prisma.$transaction(async (tx) => {
      const court = await tx.court.create({ data });
      await audit(tx, userId, 'CREATE', 'courts', court.id, data);
      return court;
    });
  },

  update(userId, id, data) {
    return prisma.$transaction(async (tx) => {
      const court = await tx.court.update({ where: { id }, data });
      await audit(tx, userId, 'UPDATE', 'courts', id, data);
      return court;
    });
  },

  // Confirmed bookings of the court that are not finished yet.
  countUpcomingBookings(courtId, now) {
    return prisma.booking.count({
      where: { courtId, status: 'CONFIRMED', endTime: { gt: now } },
    });
  },

  // Saves the closure and cancels, in the same transaction, the confirmed
  // bookings of the court that overlap it and are not finished yet. Returns
  // the closure and the cancelled bookings, with their player.
  closeCourt(userId, { courtId, startTime, endTime, reason }, now) {
    return prisma.$transaction(async (tx) => {
      const closure = await tx.courtClosure.create({
        data: { courtId, startTime, endTime, reason },
      });
      // UPDATE ... RETURNING: only the bookings really cancelled here.
      const cancelled = await tx.booking.updateManyAndReturn({
        where: {
          courtId,
          status: 'CONFIRMED',
          startTime: { lt: endTime },
          endTime: { gt: startTime > now ? startTime : now },
        },
        data: { status: 'CANCELLED' },
        select: { id: true },
      });
      const ids = cancelled.map((b) => b.id).sort((a, b) => a - b);
      await audit(tx, userId, 'CREATE', 'court_closures', closure.id, {
        courtId,
        startTime,
        endTime,
        reason,
        cancelledBookingIds: ids,
      });
      const bookings = await tx.booking.findMany({
        where: { id: { in: ids } },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { startTime: 'asc' },
      });
      return { closure, bookings };
    });
  },
};
