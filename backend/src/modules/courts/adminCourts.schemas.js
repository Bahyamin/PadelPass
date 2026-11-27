import { z } from 'zod';
import { isValidDay } from '../../utils/time.js';

// A court: a name and indoor or outdoor (FR-24).
const courtFields = {
  name: z
    .string({ error: 'name is required' })
    .trim()
    .min(1, 'name is required')
    .max(50, 'name is too long'),
  type: z.enum(['INDOOR', 'OUTDOOR'], {
    error: 'type must be INDOOR or OUTDOOR',
  }),
};

// POST /api/admin/courts
export const courtSchema = z.object(courtFields);

// PATCH /api/admin/courts/:id: any of the fields, and isActive to deactivate
// (false) or reactivate (true) the court.
export const courtPatchSchema = z
  .object({
    ...courtFields,
    isActive: z.boolean({ error: 'isActive must be true or false' }),
  })
  .partial()
  .refine((c) => Object.keys(c).length > 0, 'Nothing to change');

// "2026-11-30T08:00": a day and a time at the club (Europe/Paris), the format
// of an <input type="datetime-local">.
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
const localDateTime = (label) =>
  z
    .string({ error: `${label} is required` })
    .regex(LOCAL_DATE_TIME, `${label} must be a date and a time`)
    .refine((v) => isValidDay(v.slice(0, 10)), `${label} must be a valid date`);

// POST /api/admin/courts/:id/closures: a period and a reason (FR-24).
// Both strings have the same format, so comparing them compares the times.
export const closureSchema = z
  .object({
    start: localDateTime('start'),
    end: localDateTime('end'),
    reason: z
      .string({ error: 'reason is required' })
      .trim()
      .min(1, 'reason is required')
      .max(200, 'reason is too long'),
  })
  .refine((c) => c.start < c.end, 'end must be after start');
