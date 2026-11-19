import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { resetDb } from '../helpers/resetDb.js';

const PASSWORD = 'padel1234';
const INVALID = 'Invalid email or password';
const LOCKED = 'Too many failed attempts, try again in 15 minutes';

let passwordHash;

const createUser = (data = {}) =>
  prisma.user.create({
    data: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '0612345678',
      passwordHash,
      isVerified: true,
      ...data,
    },
  });

const login = (email, password, agent = request(app)) =>
  agent.post('/api/auth/login').send({ email, password });

const failLogins = async (email, times) => {
  for (let i = 0; i < times; i++) await login(email, 'wrong-password');
};

describe('POST /api/auth/login and /api/auth/logout', () => {
  beforeEach(async () => {
    passwordHash ??= await bcrypt.hash(PASSWORD, 4); // low cost: faster tests
    await resetDb();
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('logs in with valid credentials and sets an httpOnly cookie', async () => {
    await createUser();

    const res = await login(' ADA@example.com ', PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      firstName: 'Ada',
      email: 'ada@example.com',
      role: 'PLAYER',
    });
    expect(res.body.passwordHash).toBeUndefined();
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^token=[\w-]+\.[\w-]+\.[\w-]+;/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Max-Age=86400/);
  });

  it('gives the same generic message for a wrong password and an unknown email', async () => {
    await createUser();

    const wrongPassword = await login('ada@example.com', 'wrong-password');
    const unknownEmail = await login('nobody@example.com', PASSWORD);

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: INVALID,
      });
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('refuses an account whose email is not verified', async () => {
    await createUser({ isVerified: false });

    const res = await login('ada@example.com', PASSWORD);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('blocks the 6th attempt after 5 failures, even with the right password', async () => {
    await createUser();
    await failLogins('ada@example.com', 5);

    const res = await login('ada@example.com', PASSWORD);

    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({
      code: 'ACCOUNT_LOCKED',
      message: LOCKED,
    });
  });

  it('blocks an unknown email exactly like a real one', async () => {
    await failLogins('nobody@example.com', 5);

    const res = await login('nobody@example.com', PASSWORD);

    expect(res.status).toBe(429);
    expect(res.body.error.message).toBe(LOCKED);
  });

  it('only counts consecutive failures: a success resets the counter', async () => {
    await createUser();
    await failLogins('ada@example.com', 4);
    await login('ada@example.com', PASSWORD);
    await failLogins('ada@example.com', 4);

    const res = await login('ada@example.com', PASSWORD);

    expect(res.status).toBe(200);
  });

  it('lets the user log in again once the 15 minutes are over', async () => {
    await createUser();
    await failLogins('ada@example.com', 5);
    await prisma.loginAttempt.update({
      where: { email: 'ada@example.com' },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });

    const res = await login('ada@example.com', PASSWORD);

    expect(res.status).toBe(200);
  });

  it('gives access to the protected route until logout', async () => {
    const user = await createUser();
    const agent = request.agent(app); // keeps the cookie between requests

    await login('ada@example.com', PASSWORD, agent);
    const me = await agent.get('/api/users/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ id: user.id, email: 'ada@example.com' });

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie'][0]).toMatch(/^token=;/);

    const after = await agent.get('/api/users/me');
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('UNAUTHORIZED');
  });

  it('refuses the protected route without a token or with a fake one', async () => {
    const noToken = await request(app).get('/api/users/me');
    const fakeToken = await request(app)
      .get('/api/users/me')
      .set('Cookie', 'token=not-a-real-token');

    expect(noToken.status).toBe(401);
    expect(fakeToken.status).toBe(401);
  });
});
