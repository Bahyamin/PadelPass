import { prisma } from '../../config/db.js';

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

  create(data) {
    return prisma.booking.create({
      data,
      include: { court: { select: { name: true } } },
    });
  },
};
