import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { resetDb } from '../helpers/resetDb.js';
import {
  addDays,
  clubTime,
  clubToday,
  dayOfWeek,
} from '../../src/utils/time.js';

const PASSWORD = 'padel1234';
const today = clubToday();
const tomorrow = addDays(today, 1);

// The next Wednesday at the club (1 to 7 days ahead), for the example of the story.
let wednesday = tomorrow;
while (dayOfWeek(wednesday) !== 3) wednesday = addDays(wednesday, 1);

// Default rules of the club (seed): peak = weekdays 17:00-22:00 and the weekend.
function pricingRules(day) {
  if (day === 0 || day === 6) {
    return [{ startTime: '08:00', endTime: '23:00', pricePerHour: 40 }];
  }
  return [
    { startTime: '08:00', endTime: '17:00', pricePerHour: 28 },
    { startTime: '17:00', endTime: '22:00', pricePerHour: 40 },
    { startTime: '22:00', endTime: '23:00', pricePerHour: 28 },
  ];
}

describe('GET /api/pricing/quote and POST /api/bookings', () => {
  let agent;
  let player;
  let court;
  let closedCourt;
  let oldCourt;

  const quote = (slot) => agent.get('/api/pricing/quote').query(slot);
  const book = (slot) => agent.post('/api/bookings').send(slot);
  const slot = (data = {}) => ({
    courtId: court.id,
    date: wednesday,
    start: '18:00',
    duration: 90,
    ...data,
  });

  beforeAll(async () => {
    await resetDb();
    for (let day = 0; day <= 6; day++) {
      await prisma.openingHours.create({
        data: { dayOfWeek: day, openTime: '08:00', closeTime: '23:00' },
      });
      for (const rule of pricingRules(day)) {
        await prisma.pricingRule.create({
          data: { dayOfWeek: day, label: 'Test', ...rule },
        });
      }
    }
    await prisma.setting.create({
      data: { key: 'booking_window_days', value: '14' },
    });
    court = await prisma.court.create({ data: { name: 'Court 1' } });
    closedCourt = await prisma.court.create({ data: { name: 'Court 2' } });
    oldCourt = await prisma.court.create({
      data: { name: 'Old court', isActive: false },
    });
    await prisma.courtClosure.create({
      data: {
        courtId: closedCourt.id,
        startTime: clubTime(tomorrow, '08:00'),
        endTime: clubTime(tomorrow, '12:00'),
        reason: 'Maintenance',
      },
    });
    player = await prisma.user.create({
      data: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '0612345678',
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        isVerified: true,
      },
    });

    // The agent keeps the login cookie for the next requests.
    agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: PASSWORD });
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('requires a login', async () => {
    const quoteRes = await request(app).get('/api/pricing/quote').query(slot());
    const bookRes = await request(app).post('/api/bookings').send(slot());

    expect(quoteRes.status).toBe(401);
    expect(bookRes.status).toBe(401);
  });

  it('quotes Wednesday 18:00-19:30 at 60.00 EUR', async () => {
    const res = await quote(slot());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      courtId: court.id,
      courtName: 'Court 1',
      date: wednesday,
      start: '18:00',
      end: '19:30',
      duration: 90,
      price: '60.00',
    });
  });

  it('quotes a 60-minute off-peak slot at 28.00 EUR', async () => {
    const res = await quote(slot({ start: '10:00', duration: 60 }));

    expect(res.status).toBe(200);
    expect(res.body.price).toBe('28.00');
  });

  it('saves the booking as CONFIRMED and UNPAID, and the slot appears as booked', async () => {
    const res = await book(slot());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      courtId: court.id,
      courtName: 'Court 1',
      date: wednesday,
      start: '18:00',
      end: '19:30',
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID',
      courtPrice: '60.00',
    });

    const saved = await prisma.booking.findUnique({
      where: { id: res.body.id },
    });
    expect(saved.userId).toBe(player.id);
    expect(saved.createdById).toBe(player.id);
    expect(saved.startTime).toEqual(clubTime(wednesday, '18:00'));
    expect(saved.endTime).toEqual(clubTime(wednesday, '19:30'));
    expect(saved.courtPrice.toFixed(2)).toBe('60.00');

    const grid = await request(app).get(`/api/availability?date=${wednesday}`);
    const slots = grid.body.courts.find((c) => c.id === court.id).slots;
    const status = (time) => slots.find((s) => s.time === time).status;
    expect(status('17:30')).toBe('FREE');
    expect(status('18:00')).toBe('BOOKED');
    expect(status('19:00')).toBe('BOOKED');
    expect(status('19:30')).toBe('FREE');
  });

  it('refuses a slot in the past', async () => {
    const res = await book(slot({ date: addDays(today, -1), start: '10:00' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SLOT_IN_PAST');
  });

  it('accepts the last day of the window and refuses one day more', async () => {
    const lastDay = await quote(slot({ date: addDays(today, 14) }));
    const tooFar = await book(slot({ date: addDays(today, 15) }));

    expect(lastDay.status).toBe(200);
    expect(tooFar.status).toBe(400);
    expect(tooFar.body.error.code).toBe('OUTSIDE_BOOKING_WINDOW');
  });

  it.each([
    ['starts before opening', '07:30', 60],
    ['ends after closing', '22:30', 60],
  ])('refuses a slot that %s', async (_label, start, duration) => {
    const res = await book(slot({ date: tomorrow, start, duration }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OUTSIDE_OPENING_HOURS');
    expect(res.body.error.message).toBe(
      'The club is open from 08:00 to 23:00 on this day',
    );
  });

  it('accepts a slot that ends exactly at closing time', async () => {
    const res = await quote(
      slot({ date: tomorrow, start: '22:00', duration: 60 }),
    );

    expect(res.status).toBe(200);
  });

  it('refuses a day without opening hours', async () => {
    const day = dayOfWeek(tomorrow);
    const hours = await prisma.openingHours.delete({
      where: { dayOfWeek: day },
    });

    const res = await book(slot({ date: tomorrow, start: '10:00' }));
    await prisma.openingHours.create({ data: hours });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('The club is closed on this day');
  });

  it.each([
    ['a start time not on :00 or :30', { start: '18:15' }],
    ['a duration other than 60 or 90', { duration: 120 }],
    ['a missing court', { courtId: undefined }],
    ['an invalid date', { date: '2026-02-30' }],
  ])('refuses %s', async (_label, data) => {
    const res = await book(slot(data));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses an unknown or inactive court', async () => {
    const unknown = await book(slot({ courtId: 9999 }));
    const inactive = await book(slot({ courtId: oldCourt.id }));

    for (const res of [unknown, inactive]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('COURT_NOT_FOUND');
    }
  });

  it('refuses a court closed during the slot', async () => {
    const res = await book(
      slot({ courtId: closedCourt.id, date: tomorrow, start: '11:30' }),
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COURT_CLOSED');
  });
});
