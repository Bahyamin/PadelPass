import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { resetDb } from '../helpers/resetDb.js';
import { addDays, clubTime, clubToday } from '../../src/utils/time.js';

const PASSWORD = 'padel1234';
const today = clubToday();

// FR-12, RULE-04, AC-07: at most N active bookings per player (setting, default 3).
describe('POST /api/bookings limits the active bookings of a player', () => {
  let ada;
  let bob;
  let agent;
  let court;

  // The slot that Ada tries to book in each test.
  const newSlot = (data = {}) => ({
    courtId: court.id,
    date: addDays(today, 6),
    start: '18:00',
    duration: 60,
    ...data,
  });
  const book = (slot = newSlot()) => agent.post('/api/bookings').send(slot);

  // A booking saved directly in the database, `days` days from today.
  const existingBooking = (user, days, extra = {}) =>
    prisma.booking.create({
      data: {
        courtId: court.id,
        userId: user.id,
        createdById: user.id,
        startTime: clubTime(addDays(today, days), '10:00'),
        endTime: clubTime(addDays(today, days), '11:30'),
        courtPrice: 42,
        ...extra,
      },
    });

  const setLimit = (value) =>
    prisma.setting.upsert({
      where: { key: 'max_active_bookings' },
      update: { value },
      create: { key: 'max_active_bookings', value },
    });

  const createPlayer = async (firstName, email) =>
    prisma.user.create({
      data: {
        firstName,
        lastName: 'Test',
        email,
        phone: '0612345678',
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        isVerified: true,
      },
    });

  beforeAll(async () => {
    await resetDb();
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      await prisma.openingHours.create({
        data: { dayOfWeek, openTime: '08:00', closeTime: '23:00' },
      });
      await prisma.pricingRule.create({
        data: {
          dayOfWeek,
          startTime: '08:00',
          endTime: '23:00',
          pricePerHour: 28,
          label: 'Test',
        },
      });
    }
    court = await prisma.court.create({ data: { name: 'Court 1' } });
    ada = await createPlayer('Ada', 'ada@example.com');
    bob = await createPlayer('Bob', 'bob@example.com');
    agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: PASSWORD });
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany();
    await setLimit('3');
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('refuses a 4th booking and lists the 3 active ones', async () => {
    for (const days of [1, 2, 3]) await existingBooking(ada, days);

    const res = await book();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LIMIT_REACHED');
    const { message } = res.body.error;
    expect(message).toMatch(/You already have 3 active bookings/);
    expect(message).toMatch(/the maximum is 3/);
    for (const days of [1, 2, 3]) {
      expect(message).toContain(
        `Court 1 on ${addDays(today, days)} from 10:00 to 11:30`,
      );
    }
    expect(await prisma.booking.count({ where: { userId: ada.id } })).toBe(3);
  });

  it('accepts a 3rd booking', async () => {
    for (const days of [1, 2]) await existingBooking(ada, days);

    const res = await book();

    expect(res.status).toBe(201);
  });

  it('does not count cancelled and past bookings', async () => {
    for (const days of [1, 2]) await existingBooking(ada, days);
    await existingBooking(ada, 3, { status: 'CANCELLED' });
    await existingBooking(ada, -1); // yesterday, still CONFIRMED
    await existingBooking(ada, -2, { status: 'COMPLETED' });

    const res = await book();

    expect(res.status).toBe(201);
  });

  it('does not count the bookings of other players', async () => {
    for (const days of [1, 2, 3]) await existingBooking(bob, days);

    const res = await book();

    expect(res.status).toBe(201);
  });

  it('reads the limit from the settings', async () => {
    await setLimit('1');
    await existingBooking(ada, 1);

    const res = await book();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LIMIT_REACHED');
    expect(res.body.error.message).toMatch(/the maximum is 1\./);
  });

  it('uses 3 when the setting is missing', async () => {
    await prisma.setting.deleteMany({ where: { key: 'max_active_bookings' } });
    for (const days of [1, 2]) await existingBooking(ada, days);

    const third = await book();
    const fourth = await book(newSlot({ start: '20:00' }));

    expect(third.status).toBe(201);
    expect(fourth.status).toBe(409);
    expect(fourth.body.error.code).toBe('LIMIT_REACHED');
  });

  it('lets only one of two simultaneous requests take the last place', async () => {
    for (const days of [1, 2]) await existingBooking(ada, days);

    const responses = await Promise.all([
      book(newSlot({ start: '18:00' })),
      book(newSlot({ start: '20:00' })),
    ]);

    const statuses = responses.map((res) => res.status).sort();
    expect(statuses).toEqual([201, 409]);
    const refused = responses.find((res) => res.status === 409);
    expect(refused.body.error.code).toBe('LIMIT_REACHED');
    expect(await prisma.booking.count({ where: { userId: ada.id } })).toBe(3);
  });
});
