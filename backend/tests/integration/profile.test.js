import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { resetDb } from '../helpers/resetDb.js';

const PASSWORD = 'padel1234';

// FR-05: a player views and changes their name and phone; not their email.
describe('my profile (/api/users/me)', () => {
  let ada;
  let agent;

  const reload = () => prisma.user.findUnique({ where: { id: ada.id } });

  beforeAll(async () => {
    await resetDb();
    ada = await prisma.user.create({
      data: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '0612345678',
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        isVerified: true,
      },
    });
    agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: PASSWORD });
  });

  beforeEach(async () => {
    await prisma.user.update({
      where: { id: ada.id },
      data: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '0612345678',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('shows my first name, last name, email and phone', async () => {
    const res = await agent.get('/api/users/me');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: ada.id,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '0612345678',
      role: 'PLAYER',
      isVerified: true,
    });
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('changes my first name, last name and phone', async () => {
    const res = await agent.patch('/api/users/me').send({
      firstName: ' Augusta ',
      lastName: 'King',
      phone: '+33 6 98 76 54 32',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      firstName: 'Augusta',
      lastName: 'King',
      phone: '+33 6 98 76 54 32',
      email: 'ada@example.com',
    });
    expect(await reload()).toMatchObject({
      firstName: 'Augusta',
      lastName: 'King',
      phone: '+33 6 98 76 54 32',
    });
  });

  it('changes only the fields sent', async () => {
    const res = await agent
      .patch('/api/users/me')
      .send({ phone: '0700000000' });

    expect(res.status).toBe(200);
    expect(await reload()).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '0700000000',
    });
  });

  it('refuses to change the email, and says which field is wrong', async () => {
    const res = await agent
      .patch('/api/users/me')
      .send({ firstName: 'Augusta', email: 'other@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'The email cannot be changed',
      field: 'email',
    });
    expect(await reload()).toMatchObject({
      firstName: 'Ada',
      email: 'ada@example.com',
    });
  });

  it.each([
    ['firstName', { firstName: '  ' }, 'First name is required'],
    ['lastName', { lastName: 'x'.repeat(101) }, 'Last name is too long'],
    ['phone', { phone: 'call me' }, 'Phone number is not valid'],
  ])(
    'refuses an invalid %s with a message for that field',
    async (field, body, message) => {
      const res = await agent.patch('/api/users/me').send(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ message, field });
      expect(await reload()).toMatchObject({
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '0612345678',
      });
    },
  );

  it('refuses any other field, such as the role, and an empty change', async () => {
    const role = await agent.patch('/api/users/me').send({ role: 'ADMIN' });
    const empty = await agent.patch('/api/users/me').send({});

    expect(role.status).toBe(400);
    expect(role.body.error.message).toBe(
      'Only the first name, last name and phone can be changed',
    );
    expect(empty.status).toBe(400);
    expect(empty.body.error.message).toBe('Nothing to change');
    expect((await reload()).role).toBe('PLAYER');
  });

  it('needs a login, and an account still active', async () => {
    const anonymous = await request(app)
      .patch('/api/users/me')
      .send({ firstName: 'Eve' });
    await prisma.user.update({
      where: { id: ada.id },
      data: { isActive: false },
    });
    const inactive = await agent
      .patch('/api/users/me')
      .send({ firstName: 'Eve' });

    expect(anonymous.status).toBe(401);
    expect(inactive.status).toBe(401);
    expect((await reload()).firstName).toBe('Ada');
  });
});
