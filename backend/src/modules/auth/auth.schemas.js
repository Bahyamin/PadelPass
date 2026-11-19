import { z } from 'zod';

const requiredText = (label) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} is too long`);

// FR-01: first name, last name, email, password, phone and accepted terms.
export const registerSchema = z.object({
  firstName: requiredText('First name'),
  lastName: requiredText('Last name'),
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()
    .pipe(z.email('Email is not valid')),
  password: z
    .string({ error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters with a letter and a digit')
    .regex(
      /[A-Za-z]/,
      'Password must be at least 8 characters with a letter and a digit',
    )
    .regex(
      /[0-9]/,
      'Password must be at least 8 characters with a letter and a digit',
    ),
  phone: z
    .string({ error: 'Phone number is required' })
    .trim()
    .regex(/^\+?[0-9 ]{6,20}$/, 'Phone number is not valid'),
  acceptedTerms: z.literal(true, { error: 'You must accept the terms' }),
});

// FR-03: the password is not checked against the rules here, only compared.
export const loginSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()
    .min(1, 'Email is required'),
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required'),
});
