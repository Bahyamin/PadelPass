import { z } from 'zod';
import { isValidDay } from '../../utils/time.js';

// The slot of GET /api/equipment/availability, read from the query string:
// a day, a start time on the hour or half hour, and a duration of 60 or 90
// minutes, like a booking (RULE-01).
export const equipmentSlotSchema = z.object({
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
    .refine((d) => d === 60 || d === 90, 'duration must be 60 or 90 minutes'),
});
