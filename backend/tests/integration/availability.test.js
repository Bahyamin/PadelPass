import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { resetDb } from '../helpers/resetDb.js';
import { addDays, clubTime, clubToday } from '../../src/utils/time.js';

// Tomorrow at the club: every slot is in the future, inside the booking window.
const tomorrow = addDays(clubToday(), 1);

describe('GET /api/courts and GET /api/availability', () => {
  let courtA;
  let courtB;

  beforeAll(async () => {
    await resetDb();
    for (let day = 0; day <= 6; day++) {
      await prisma.openingHours.create({
        data: { dayOfWeek: day, openTime: '08:00', closeTime: '23:00' },
      });
    }
    await prisma.setting.create({
      data: { key: 'booking_window_days', value: '14' },
    });
    courtA = await prisma.court.create({ data: { name: 'Court A' } });
    courtB = await prisma.court.create({
      data: { name: 'Court B', type: 'OUTDOOR' },
    });
    await prisma.court.create({ data: { name: 'Old court', isActive: false } });

    const player = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'Player',
        email: 'player@test.local',
        phone: '0600000000',
        passwordHash: 'x',
      },
    });
    const booking = (startTime, endTime, status) => ({
      courtId: courtA.id,
      userId: player.id,
      createdById: player.id,
      startTime: clubTime(tomorrow, startTime),
      endTime: clubTime(tomorrow, endTime),
      courtPrice: 40,
      status,
    });
    await prisma.booking.create({ data: booking('18:00', '19:30') });
    await prisma.booking.create({
      data: booking('10:00', '11:00', 'CANCELLED'),
    });
    await prisma.courtClosure.create({
      data: {
        courtId: courtB.id,
        startTime: clubTime(tomorrow, '08:00'),
        endTime: clubTime(tomorrow, '12:00'),
        reason: 'Maintenance',
      },
    });
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('lists the active courts only', async () => {
    const res = await request(app).get('/api/courts');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: courtA.id, name: 'Court A', type: 'INDOOR' },
      { id: courtB.id, name: 'Court B', type: 'OUTDOOR' },
    ]);
  });

  it('returns the grid of a day: 30 slots from 08:00 to 22:30 per court', async () => {
    const res = await request(app).get(`/api/availability?date=${tomorrow}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toBe(tomorrow);
    expect(res.body.slots).toHaveLength(30);
    expect(res.body.slots[0]).toBe('08:00');
    expect(res.body.slots.at(-1)).toBe('22:30');
    expect(res.body.courts.map((c) => c.name)).toEqual(['Court A', 'Court B']);
  });

  it('shows confirmed bookings as BOOKED and ignores cancelled ones', async () => {
    const res = await request(app).get(`/api/availability?date=${tomorrow}`);
    const slotsA = res.body.courts[0].slots;
    const status = (time) => slotsA.find((s) => s.time === time).status;

    expect(status('17:30')).toBe('FREE');
    expect(status('18:00')).toBe('BOOKED');
    expect(status('19:00')).toBe('BOOKED');
    expect(status('19:30')).toBe('FREE');
    expect(status('10:00')).toBe('FREE'); // cancelled booking
  });

  it('shows closures as CLOSED', async () => {
    const res = await request(app).get(`/api/availability?date=${tomorrow}`);
    const slotsB = res.body.courts[1].slots;
    const status = (time) => slotsB.find((s) => s.time === time).status;

    expect(status('08:00')).toBe('CLOSED');
    expect(status('11:30')).toBe('CLOSED');
    expect(status('12:00')).toBe('FREE');
  });

  it.each([
    ['missing', ''],
    ['badly formatted', '?date=20-11-2026'],
    ['not a real day', '?date=2026-02-30'],
  ])('refuses a %s date', async (_label, query) => {
    const res = await request(app).get(`/api/availability${query}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['in the past', addDays(clubToday(), -1)],
    ['beyond the 14-day booking window', addDays(clubToday(), 15)],
  ])('refuses a date %s', async (_label, date) => {
    const res = await request(app).get(`/api/availability?date=${date}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OUTSIDE_BOOKING_WINDOW');
  });
});
