import { z } from 'zod';

// "HH:mm" on the hour or on the half hour, like the booking slots. "24:00"
// is allowed as an end, for a club or a rule that ends at midnight.
const TIME = /^(([01]\d|2[0-3]):(00|30)|24:00)$/;
const time = (label) =>
  z
    .string({ error: `${label} is required` })
    .regex(TIME, `${label} must be on the hour or half hour (HH:00 or HH:30)`);

const dayOfWeek = z
  .number({ error: 'dayOfWeek is required' })
  .int()
  .min(0, 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)')
  .max(6, 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)');

// Opening hours of one day: open from openTime to closeTime, or closed.
const dayHours = z
  .object({
    dayOfWeek,
    closed: z.boolean().default(false),
    openTime: time('openTime').nullish(),
    closeTime: time('closeTime').nullish(),
  })
  .refine(
    (d) => d.closed || (d.openTime && d.closeTime && d.openTime < d.closeTime),
    'openTime must be before closeTime',
  );

// PUT /api/admin/opening-hours: the 7 days of the week, each once (FR-25).
export const openingHoursSchema = z
  .array(dayHours, { error: 'The 7 days of the week are required' })
  .length(7, 'The 7 days of the week are required')
  .refine(
    (days) => new Set(days.map((d) => d.dayOfWeek)).size === 7,
    'Each day of the week must appear once',
  );

// A pricing rule: a day, a time range and a price per hour (FR-25, RULE-07).
const pricingRuleFields = {
  dayOfWeek,
  startTime: time('startTime'),
  endTime: time('endTime'),
  pricePerHour: z
    .number({ error: 'pricePerHour is required' })
    .min(0, 'pricePerHour cannot be negative')
    .max(1000, 'pricePerHour is too high')
    .multipleOf(0.01, 'pricePerHour has at most 2 decimals'),
  label: z
    .string({ error: 'label is required' })
    .trim()
    .min(1, 'label is required')
    .max(50, 'label is too long'),
};

const startBeforeEnd = [
  (r) => r.startTime < r.endTime,
  'startTime must be before endTime',
];

export const pricingRuleSchema = z
  .object(pricingRuleFields)
  .refine(...startBeforeEnd);

// PATCH: any of the fields. The service checks the merged rule again.
export const pricingRulePatchSchema = z
  .object(pricingRuleFields)
  .partial()
  .refine((r) => Object.keys(r).length > 0, 'Nothing to change');

// Booking parameters, stored in the settings table (FR-25, RULE-03, 04, 06, 08).
const whole = (label, min, max) =>
  z
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be between ${min} and ${max}`)
    .max(max, `${label} must be between ${min} and ${max}`);

export const settingsSchema = z
  .strictObject(
    {
      maxActiveBookings: whole('maxActiveBookings', 1, 20),
      bookingWindowDays: whole('bookingWindowDays', 1, 90),
      cancellationDeadlineHours: whole('cancellationDeadlineHours', 0, 168),
      equipmentChangeDeadlineHours: whole(
        'equipmentChangeDeadlineHours',
        0,
        72,
      ),
    },
    { error: 'Unknown setting' },
  )
  .partial()
  .refine((s) => Object.keys(s).length > 0, 'Nothing to change');
