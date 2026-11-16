import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';

const valid = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  password: 'padel1234',
  phone: '+33 6 12 34 56 78',
  acceptedTerms: true,
};

const register = (body) => request(app).post('/api/auth/register').send(body);

const PASSWORD_RULE =
  'Password must be at least 8 characters with a letter and a digit';

describe('POST /api/auth/register', () => {
  beforeEach(async () => {
    await prisma.booking.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('creates a player account that is not verified yet', async () => {
    const before = new Date();

    const res = await register(valid);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: 'PLAYER',
      isVerified: false,
    });

    const user = await prisma.user.findUnique({
      where: { email: 'ada@example.com' },
    });
    expect(user.role).toBe('PLAYER');
    expect(user.isVerified).toBe(false);
    expect(user.phone).toBe('+33 6 12 34 56 78');
    expect(user.consentAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('stores the password hashed with bcrypt, never in clear', async () => {
    await register(valid);

    const user = await prisma.user.findUnique({
      where: { email: 'ada@example.com' },
    });
    expect(user.passwordHash).not.toBe(valid.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare(valid.password, user.passwordHash)).toBe(true);
  });

  it('refuses an email already used, whatever the letter case', async () => {
    await register(valid);

    const res = await register({ ...valid, email: ' ADA@Example.com ' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'EMAIL_ALREADY_USED',
      message: 'An account already exists with this email',
    });
    expect(await prisma.user.count()).toBe(1);
  });

  it.each([
    ['too short', 'abc1234'],
    ['without a digit', 'abcdefgh'],
    ['without a letter', '12345678'],
  ])('refuses a password %s', async (_label, password) => {
    const res = await register({ ...valid, password });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: PASSWORD_RULE,
    });
    expect(await prisma.user.count()).toBe(0);
  });

  it.each([
    ['a blank first name', { firstName: '  ' }, 'First name is required'],
    ['a missing last name', { lastName: undefined }, 'Last name is required'],
    ['an invalid email', { email: 'not-an-email' }, 'Email is not valid'],
    ['an invalid phone', { phone: 'abc' }, 'Phone number is not valid'],
    [
      'terms not accepted',
      { acceptedTerms: false },
      'You must accept the terms',
    ],
  ])('refuses %s', async (_label, override, message) => {
    const res = await register({ ...valid, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(message);
    expect(await prisma.user.count()).toBe(0);
  });

  it('ignores a role sent by the client', async () => {
    const res = await register({ ...valid, role: 'ADMIN' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('PLAYER');
  });
});
