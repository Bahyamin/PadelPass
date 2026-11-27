import { z } from 'zod';
import { isValidDay } from '../../utils/time.js';

export const DURATIONS = [60, 90];

// A slot to price or to book (FR-09, RULE-01): a court, a day, a start time on
// the hour or on the half hour, and a duration of 60 or 90 minutes.
// Numbers are coerced because the quote reads them from the query string.
export const slotSchema = z.object({
  courtId: z.coerce
    .number({ error: 'courtId is required' })
    .int('courtId must be a positive integer')
    .positive('courtId must be a positive integer'),
  date: z
    .string({ error: 'date is required' })
    .refine(isValidDay, 'date must be a valid day (YYYY-MM-DD)'),
  start: z
    .string({ error: 'start is required' })
    .regex(
      /^([01]\d|2[0-3]):(00|30)$/,
      'start must be on the hour or on the half hour (HH:00 or HH:30)',
    ),
  duration: z.coerce
    .number({ error: 'duration is required' })
    .refine((d) => DURATIONS.includes(d), 'duration must be 60 or 90 minutes'),
});

// Equipment of a booking (FR-18): a quantity per equipment type. Each type
// appears once; a quantity of 0 means none of this type.
const equipmentSchema = z
  .array(
    z.object({
      typeId: z
        .number({ error: 'typeId is required' })
        .int('typeId must be a positive integer')
        .positive('typeId must be a positive integer'),
      quantity: z
        .number({ error: 'quantity is required' })
        .int('quantity must be a whole number')
        .min(0, 'quantity cannot be negative')
        .max(10, 'quantity cannot be more than 10'),
    }),
    { error: 'equipment must be a list of { typeId, quantity }' },
  )
  .refine(
    (list) => new Set(list.map((e) => e.typeId)).size === list.length,
    'Each equipment type can appear only once',
  );

// POST /api/bookings: the slot, and optionally the equipment (FR-09, FR-18).
export const bookingSchema = slotSchema.extend({
  equipment: equipmentSchema.default([]),
});

// PUT /api/bookings/:id/equipment: the whole new list (FR-18).
export const equipmentChangeSchema = z.object({ equipment: equipmentSchema });
