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
