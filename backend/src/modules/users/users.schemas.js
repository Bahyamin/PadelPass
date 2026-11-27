import { z } from 'zod';
import { registerSchema } from '../auth/auth.schemas.js';

// PATCH /api/users/me (FR-05): the player changes their first name, last name
// or phone number, with the same rules as at registration. The email cannot
// be changed (it is the login), and any other field is refused.
export const profileSchema = z
  .strictObject(
    {
      firstName: registerSchema.shape.firstName,
      lastName: registerSchema.shape.lastName,
      phone: registerSchema.shape.phone,
      email: z.never({ error: 'The email cannot be changed' }),
    },
    { error: 'Only the first name, last name and phone can be changed' },
  )
  .partial()
  .refine((p) => Object.keys(p).length > 0, 'Nothing to change');
