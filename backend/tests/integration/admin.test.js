import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { resetDb } from '../helpers/resetDb.js';
import { addDays, clubTime, clubToday } from '../../src/utils/time.js';

const PASSWORD = 'padel1234';
const WEDNESDAY = 3;

// Logs a user in and returns an agent that keeps the cookie.
async function loginAs(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  return agent;
}

// Starting configuration of each test, like the seed.
async function seedConfiguration() {
  for (let day = 0; day <= 6; day++) {
    await prisma.openingHours.create({
      data: { dayOfWeek: day, openTime: '08:00', closeTime: '23:00' },
    });
  }
  const rule = (startTime, endTime, pricePerHour, label) =>
    prisma.pricingRule.create({
      data: { dayOfWeek: WEDNESDAY, startTime, endTime, pricePerHour, label },
    });
  await rule('17:00', '22:00', 40, 'Peak');
  await rule('08:00', '17:00', 28, 'Off-peak');
  await prisma.setting.create({
    data: { key: 'booking_window_days', value: '14' },
  });
}

describe('admin configuration: opening hours, pricing rules, settings', () => {
  let admin;
  let player;
  let adminUser;

  beforeAll(async () => {
    await resetDb();
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const user = (email, role) =>
      prisma.user.create({
        data: {
          firstName: 'Test',
          lastName: role,
          email,
          phone: '0600000000',
          passwordHash,
          role,
          isVerified: true,
        },
      });
    adminUser = await user('admin@test.local', 'ADMIN');
    await user('player@test.local', 'PLAYER');
    admin = await loginAs('admin@test.local');
    player = await loginAs('player@test.local');
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.court.deleteMany();
    await prisma.pricingRule.deleteMany();
    await prisma.openingHours.deleteMany();
    await prisma.setting.deleteMany();
    await seedConfiguration();
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  describe('access', () => {
    it.each([
      ['GET', '/api/admin/opening-hours'],
      ['PUT', '/api/admin/opening-hours'],
      ['GET', '/api/admin/pricing-rules'],
      ['POST', '/api/admin/pricing-rules'],
      ['PATCH', '/api/admin/pricing-rules/1'],
      ['DELETE', '/api/admin/pricing-rules/1'],
      ['GET', '/api/admin/settings'],
      ['PUT', '/api/admin/settings'],
    ])('%s %s: 401 without login, 403 for a player', async (method, url) => {
      const anonymous = await request(app)[method.toLowerCase()](url);
      const asPlayer = await player[method.toLowerCase()](url);

      expect(anonymous.status).toBe(401);
      expect(asPlayer.status).toBe(403);
      expect(asPlayer.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('opening hours', () => {
    const week = (changes = {}) =>
      [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        openTime: '08:00',
        closeTime: '23:00',
        ...changes[dayOfWeek],
      }));

    it('lists the 7 days of the week', async () => {
      const res = await admin.get('/api/admin/opening-hours');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(7);
      expect(res.body[1]).toEqual({
        dayOfWeek: 1,
        closed: false,
        openTime: '08:00',
        closeTime: '23:00',
      });
    });

    it('sets the opening and closing time of each day, and can close a day', async () => {
      const res = await admin.put('/api/admin/opening-hours').send(
        week({
          1: { openTime: '09:00', closeTime: '21:30' },
          0: { closed: true },
        }),
      );

      expect(res.status).toBe(200);
      expect(res.body[1]).toMatchObject({
        openTime: '09:00',
        closeTime: '21:30',
      });
      expect(res.body[0]).toEqual({
        dayOfWeek: 0,
        closed: true,
        openTime: null,
        closeTime: null,
      });
      expect(await prisma.openingHours.count()).toBe(6);
      const log = await prisma.auditLog.findFirst();
      expect(log).toMatchObject({
        userId: adminUser.id,
        action: 'UPDATE',
        entity: 'opening_hours',
      });
    });

    it.each([
      ['only 6 days', week().slice(1), 'The 7 days of the week are required'],
      [
        'a day twice',
        [
          ...week().slice(1),
          { dayOfWeek: 1, openTime: '08:00', closeTime: '23:00' },
        ],
        'Each day of the week must appear once',
      ],
      [
        'a closing time before the opening time',
        week({ 2: { openTime: '20:00', closeTime: '10:00' } }),
        'openTime must be before closeTime',
      ],
      [
        'a time not on :00 or :30',
        week({ 2: { openTime: '08:15' } }),
        'openTime must be on the hour or half hour (HH:00 or HH:30)',
      ],
    ])('refuses %s', async (_label, body, message) => {
      const res = await admin.put('/api/admin/opening-hours').send(body);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe(message);
      expect(await prisma.openingHours.count()).toBe(7);
    });
  });

  describe('pricing rules', () => {
    const sundayRule = {
      dayOfWeek: 0,
      startTime: '08:00',
      endTime: '23:00',
      pricePerHour: 45.5,
      label: 'Weekend',
    };
    const wednesdayRule = (startTime) =>
      prisma.pricingRule.findFirst({
        where: { dayOfWeek: WEDNESDAY, startTime },
      });

    it('lists the rules by day and start time', async () => {
      const res = await admin.get('/api/admin/pricing-rules');

      expect(res.status).toBe(200);
      expect(res.body.map((r) => [r.startTime, r.pricePerHour])).toEqual([
        ['08:00', '28.00'],
        ['17:00', '40.00'],
      ]);
    });

    it('creates a rule', async () => {
      const res = await admin.post('/api/admin/pricing-rules').send(sundayRule);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(Number),
        ...sundayRule,
        pricePerHour: '45.50',
      });
      expect(await prisma.auditLog.count({ where: { action: 'CREATE' } })).toBe(
        1,
      );
    });

    it('refuses a rule that overlaps another rule of the same day', async () => {
      const res = await admin.post('/api/admin/pricing-rules').send({
        ...sundayRule,
        dayOfWeek: WEDNESDAY,
        startTime: '21:00',
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PRICING_RULE_OVERLAP');
      expect(res.body.error.message).toBe(
        'This time range overlaps the rule "Peak" (17:00-22:00)',
      );
    });

    it.each([
      ['an end before the start', { startTime: '20:00', endTime: '10:00' }],
      ['a negative price', { pricePerHour: -1 }],
      ['a price with 3 decimals', { pricePerHour: 10.005 }],
      ['a day out of range', { dayOfWeek: 7 }],
      ['a missing label', { label: ' ' }],
    ])('refuses %s', async (_label, changes) => {
      const res = await admin
        .post('/api/admin/pricing-rules')
        .send({ ...sundayRule, ...changes });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('edits a rule', async () => {
      const peak = await wednesdayRule('17:00');

      const res = await admin
        .patch(`/api/admin/pricing-rules/${peak.id}`)
        .send({ pricePerHour: 42, endTime: '23:00' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        startTime: '17:00',
        endTime: '23:00',
        pricePerHour: '42.00',
        label: 'Peak',
      });
    });

    it('refuses an edit that makes the rule overlap or end before it starts', async () => {
      const peak = await wednesdayRule('17:00');

      const overlap = await admin
        .patch(`/api/admin/pricing-rules/${peak.id}`)
        .send({ startTime: '16:00' });
      const reversed = await admin
        .patch(`/api/admin/pricing-rules/${peak.id}`)
        .send({ endTime: '12:00' });

      expect(overlap.status).toBe(409);
      expect(reversed.status).toBe(400);
      expect(reversed.body.error.message).toBe(
        'startTime must be before endTime',
      );
    });

    it('deletes a rule', async () => {
      const peak = await wednesdayRule('17:00');

      const res = await admin.delete(`/api/admin/pricing-rules/${peak.id}`);
      const again = await admin.delete(`/api/admin/pricing-rules/${peak.id}`);

      expect(res.status).toBe(204);
      expect(again.status).toBe(404);
      expect(await prisma.pricingRule.count()).toBe(1);
    });

    it('answers 404 for an unknown rule', async () => {
      const res = await admin
        .patch('/api/admin/pricing-rules/abc')
        .send({ label: 'x' });

      expect(res.status).toBe(404);
    });

    it('does not change the price of existing bookings', async () => {
      const playerUser = await prisma.user.findUnique({
        where: { email: 'player@test.local' },
      });
      const court = await prisma.court.create({ data: { name: 'Court 1' } });
      const day = addDays(clubToday(), 3);
      const booking = await prisma.booking.create({
        data: {
          userId: playerUser.id,
          createdById: playerUser.id,
          courtId: court.id,
          startTime: clubTime(day, '18:00'),
          endTime: clubTime(day, '19:30'),
          courtPrice: 60,
        },
      });
      const peak = await wednesdayRule('17:00');

      await admin
        .patch(`/api/admin/pricing-rules/${peak.id}`)
        .send({ pricePerHour: 80 });
      await admin.delete(`/api/admin/pricing-rules/${peak.id}`);

      const after = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(after.courtPrice.toFixed(2)).toBe('60.00');
    });
  });

  describe('booking parameters', () => {
    it('gives every parameter, with the default value when it is not set', async () => {
      const res = await admin.get('/api/admin/settings');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        maxActiveBookings: 3,
        bookingWindowDays: 14,
        cancellationDeadlineHours: 24,
        equipmentChangeDeadlineHours: 2,
      });
    });

    it('changes the active booking limit, the booking window and the cancellation deadline', async () => {
      const res = await admin.put('/api/admin/settings').send({
        maxActiveBookings: 5,
        bookingWindowDays: 21,
        cancellationDeadlineHours: 48,
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        maxActiveBookings: 5,
        bookingWindowDays: 21,
        cancellationDeadlineHours: 48,
        equipmentChangeDeadlineHours: 2,
      });
      const stored = await prisma.setting.findUnique({
        where: { key: 'max_active_bookings' },
      });
      expect(stored.value).toBe('5');
    });

    it('applies the new booking window to the availability grid', async () => {
      const day = addDays(clubToday(), 20);
      const before = await request(app).get(`/api/availability?date=${day}`);

      await admin.put('/api/admin/settings').send({ bookingWindowDays: 21 });
      const after = await request(app).get(`/api/availability?date=${day}`);

      expect(before.status).toBe(400);
      expect(after.status).toBe(200);
    });

    it.each([
      ['an unknown parameter', { colour: 'blue' }],
      ['an empty body', {}],
      ['a value out of range', { bookingWindowDays: 0 }],
      ['a decimal value', { maxActiveBookings: 2.5 }],
      ['a text value', { maxActiveBookings: 'three' }],
    ])('refuses %s', async (_label, body) => {
      const res = await admin.put('/api/admin/settings').send(body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
