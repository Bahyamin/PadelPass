import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js';
import { adminRepository } from './admin.repository.js';
import { pricingRuleSchema } from './admin.schemas.js';

// Booking parameters: name in the API, key in the settings table, default
// value of the SRS (RULE-03, RULE-04, RULE-06, RULE-08).
const SETTINGS = {
  maxActiveBookings: { key: 'max_active_bookings', default: 3 },
  bookingWindowDays: { key: 'booking_window_days', default: 14 },
  cancellationDeadlineHours: {
    key: 'cancellation_deadline_hours',
    default: 24,
  },
  equipmentChangeDeadlineHours: {
    key: 'equipment_change_deadline_hours',
    default: 2,
  },
};

const toPricingRule = (rule) => ({
  id: rule.id,
  dayOfWeek: rule.dayOfWeek,
  startTime: rule.startTime,
  endTime: rule.endTime,
  pricePerHour: Number(rule.pricePerHour).toFixed(2),
  label: rule.label,
});

// Two rules of the same day cannot cover the same time: each 30-minute
// segment must have exactly one price (RULE-07).
async function checkNoOverlap(rule, ignoredId) {
  const sameDay = await adminRepository.findPricingRules({
    dayOfWeek: rule.dayOfWeek,
  });
  const other = sameDay.find(
    (r) =>
      r.id !== ignoredId &&
      r.startTime < rule.endTime &&
      r.endTime > rule.startTime,
  );
  if (other) {
    throw new ConflictError(
      'PRICING_RULE_OVERLAP',
      `This time range overlaps the rule "${other.label}" (${other.startTime}-${other.endTime})`,
    );
  }
}

async function findRuleOr404(id) {
  const rule = Number.isInteger(id)
    ? await adminRepository.findPricingRule(id)
    : null;
  if (!rule) throw new NotFoundError('Pricing rule not found');
  return rule;
}

// Club configuration by the administrator (FR-25, UC-15). The price of a
// booking is copied into the booking when it is created, so none of these
// changes alter existing bookings.
export const adminService = {
  // The 7 days, Sunday (0) to Saturday (6); a day without a row is closed.
  async getOpeningHours() {
    const rows = await adminRepository.findOpeningHours();
    return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
      const row = rows.find((r) => r.dayOfWeek === dayOfWeek);
      return {
        dayOfWeek,
        closed: !row,
        openTime: row?.openTime ?? null,
        closeTime: row?.closeTime ?? null,
      };
    });
  },

  async replaceOpeningHours(userId, days) {
    const openDays = days
      .filter((d) => !d.closed)
      .map(({ dayOfWeek, openTime, closeTime }) => ({
        dayOfWeek,
        openTime,
        closeTime,
      }));
    await adminRepository.replaceOpeningHours(userId, openDays);
    return this.getOpeningHours();
  },

  async listPricingRules() {
    return (await adminRepository.findPricingRules()).map(toPricingRule);
  },

  async createPricingRule(userId, data) {
    await checkNoOverlap(data);
    return toPricingRule(await adminRepository.createPricingRule(userId, data));
  },

  async updatePricingRule(userId, id, changes) {
    const current = await findRuleOr404(id);
    // The merged rule must still be valid (e.g. start before end).
    const result = pricingRuleSchema.safeParse({
      ...toPricingRule(current),
      pricePerHour: Number(current.pricePerHour),
      ...changes,
    });
    if (!result.success) {
      throw new ValidationError(result.error.issues[0].message);
    }
    await checkNoOverlap(result.data, id);
    return toPricingRule(
      await adminRepository.updatePricingRule(userId, id, changes),
    );
  },

  async deletePricingRule(userId, id) {
    await findRuleOr404(id);
    await adminRepository.deletePricingRule(userId, id);
  },

  // Settings missing from the table get their default value.
  async getSettings() {
    const rows = await adminRepository.findSettings();
    return Object.fromEntries(
      Object.entries(SETTINGS).map(([name, setting]) => {
        const row = rows.find((r) => r.key === setting.key);
        return [name, row ? Number(row.value) : setting.default];
      }),
    );
  },

  async updateSettings(userId, changes) {
    const values = Object.fromEntries(
      Object.entries(changes).map(([name, value]) => [
        SETTINGS[name].key,
        String(value),
      ]),
    );
    await adminRepository.saveSettings(userId, values);
    return this.getSettings();
  },
};
