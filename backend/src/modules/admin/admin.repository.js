import { prisma } from '../../config/db.js';

// One line in audit_logs for every change made by an administrator.
const audit = (tx, userId, action, entity, entityId, details) =>
  tx.auditLog.create({ data: { userId, action, entity, entityId, details } });

// Database queries of the club configuration (FR-25). Only this layer talks
// to Prisma. Every change and its audit line are saved in one transaction.
export const adminRepository = {
  findOpeningHours() {
    return prisma.openingHours.findMany({ orderBy: { dayOfWeek: 'asc' } });
  },

  // Replaces the opening hours of the whole week. A closed day has no row.
  replaceOpeningHours(userId, openDays) {
    return prisma.$transaction([
      prisma.openingHours.deleteMany(),
      prisma.openingHours.createMany({ data: openDays }),
      audit(prisma, userId, 'UPDATE', 'opening_hours', null, {
        openDays,
      }),
    ]);
  },

  findPricingRules(where = {}) {
    return prisma.pricingRule.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  },

  findPricingRule(id) {
    return prisma.pricingRule.findUnique({ where: { id } });
  },

  createPricingRule(userId, data) {
    return prisma.$transaction(async (tx) => {
      const rule = await tx.pricingRule.create({ data });
      await audit(tx, userId, 'CREATE', 'pricing_rules', rule.id, data);
      return rule;
    });
  },

  updatePricingRule(userId, id, data) {
    return prisma.$transaction(async (tx) => {
      const rule = await tx.pricingRule.update({ where: { id }, data });
      await audit(tx, userId, 'UPDATE', 'pricing_rules', id, data);
      return rule;
    });
  },

  deletePricingRule(userId, id) {
    return prisma.$transaction([
      prisma.pricingRule.delete({ where: { id } }),
      audit(prisma, userId, 'DELETE', 'pricing_rules', id),
    ]);
  },

  findSettings() {
    return prisma.setting.findMany();
  },

  // Saves the given settings: { key: value } with the keys of the table.
  saveSettings(userId, values) {
    return prisma.$transaction([
      ...Object.entries(values).map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      ),
      audit(prisma, userId, 'UPDATE', 'settings', null, values),
    ]);
  },
};
