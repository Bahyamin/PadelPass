import { describe, it, expect } from 'vitest';
import { registerSchema } from '../../src/modules/auth/auth.schemas.js';

describe('registerSchema', () => {
  it('cleans the input: trimmed names and phone, lower-case email', () => {
    const data = registerSchema.parse({
      firstName: '  Ada ',
      lastName: ' Lovelace',
      email: '  Ada@Example.COM ',
      password: 'padel1234',
      phone: ' 0612345678 ',
      acceptedTerms: true,
    });

    expect(data).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'padel1234',
      phone: '0612345678',
      acceptedTerms: true,
    });
  });

  it('drops unknown fields such as role', () => {
    const data = registerSchema.parse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'padel1234',
      phone: '0612345678',
      acceptedTerms: true,
      role: 'ADMIN',
    });

    expect(data.role).toBeUndefined();
  });
});
