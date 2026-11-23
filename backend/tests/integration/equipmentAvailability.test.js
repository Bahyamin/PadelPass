import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { resetDb } from '../helpers/resetDb.js';
import { addDays, clubTime, clubToday } from '../../src/utils/time.js';

const day = addDays(clubToday(), 1);

const availability = (query) =>
  request(app).get('/api/equipment/availability').query(query);

// Available quantity of one type in the answer.
const availableOf = (res, name) =>
  res.body.equipment.find((e) => e.name === name).available;

describe('GET /api/equipment/availability', () => {
  beforeAll(async () => {
    await resetDb();

    const racket = await prisma.equipmentType.create({
      data: {
        name: 'Racket',
        category: 'RACKET',
        rentalPrice: 4,
        damageFee: 60,
      },
    });
    const balls = await prisma.equipmentType.create({
      data: {
        name: 'Balls (tube of 3)',
        category: 'BALLS',
        rentalPrice: 5,
        damageFee: 5,
      },
    });
    await prisma.equipmentType.create({
      data: {
        name: 'Old shoes',
        category: 'SHOES',
        rentalPrice: 3,
        damageFee: 40,
        isActive: false,
      },
    });

    // 7 rackets: 4 in service (3 available, 1 rented) and 3 out of service.
    const racketStatuses = [
      'AVAILABLE',
      'AVAILABLE',
      'AVAILABLE',
      'RENTED',
      'DAMAGED',
      'MAINTENANCE',
      'LOST',
    ];
    for (const [n, status] of racketStatuses.entries()) {
      await prisma.equipmentItem.create({
        data: { typeId: racket.id, code: `RKT-${n}`, status },
      });
    }
    for (const n of [1, 2]) {
      await prisma.equipmentItem.create({
        data: { typeId: balls.id, code: `BAL-${n}` },
      });
    }

    const player = await prisma.user.create({
      data: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '0612345678',
        passwordHash: 'x',
      },
    });
    const court = await prisma.court.create({ data: { name: 'Court 1' } });
    const court2 = await prisma.court.create({ data: { name: 'Court 2' } });

    // A booking with reserved equipment: { typeId: quantity }.
    const book = (courtId, start, end, equipment, status = 'CONFIRMED') =>
      prisma.booking.create({
        data: {
          userId: player.id,
          createdById: player.id,
          courtId,
          startTime: clubTime(day, start),
          endTime: clubTime(day, end),
          courtPrice: 40,
          status,
          equipment: {
            create: Object.entries(equipment).map(([typeId, quantity]) => ({
              typeId: Number(typeId),
              quantity,
              unitPrice: 4,
            })),
          },
        },
      });

    await book(court.id, '18:00', '19:30', { [racket.id]: 2, [balls.id]: 3 });
    await book(court.id, '20:00', '21:00', { [racket.id]: 1 });
    await book(court2.id, '18:00', '19:00', { [racket.id]: 1 }, 'CANCELLED');
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('gives the name, price and available quantity of each active type', async () => {
    const res = await availability({ date: day, start: '10:00', duration: 60 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ date: day, start: '10:00', end: '11:00' });
    expect(res.body.equipment).toEqual([
      {
        id: expect.any(Number),
        name: 'Racket',
        category: 'RACKET',
        rentalPrice: '4.00',
        available: 4,
      },
      {
        id: expect.any(Number),
        name: 'Balls (tube of 3)',
        category: 'BALLS',
        rentalPrice: '5.00',
        available: 2,
      },
    ]);
  });

  it('does not count damaged, maintenance or lost items', async () => {
    const res = await availability({ date: day, start: '10:00', duration: 60 });

    // 7 rackets, of which 3 are out of service.
    expect(availableOf(res, 'Racket')).toBe(4);
  });

  it('deducts the quantities of the confirmed bookings that overlap the slot', async () => {
    const res = await availability({ date: day, start: '18:30', duration: 90 });

    // 18:30-20:00 overlaps the 18:00-19:30 booking (2 rackets) only.
    expect(availableOf(res, 'Racket')).toBe(2);
    // 3 tubes reserved for 2 in stock: shown as 0, never negative.
    expect(availableOf(res, 'Balls (tube of 3)')).toBe(0);
  });

  it('ignores the cancelled booking (1 racket, 18:00-19:00)', async () => {
    const res = await availability({ date: day, start: '18:00', duration: 60 });

    // Only the confirmed 18:00-19:30 booking counts: 4 - 2.
    expect(availableOf(res, 'Racket')).toBe(2);
  });

  it('ignores bookings that end when the slot starts or start when it ends', async () => {
    // 19:30-21:00: the 18:00-19:30 booking has ended, 20:00-21:00 overlaps.
    const evening = await availability({
      date: day,
      start: '19:30',
      duration: 90,
    });
    // 17:00-18:00 ends when the 18:00 booking starts.
    const before = await availability({
      date: day,
      start: '17:00',
      duration: 60,
    });
    // 21:00-22:00 starts when the 20:00-21:00 booking ends.
    const after = await availability({
      date: day,
      start: '21:00',
      duration: 60,
    });

    expect(availableOf(evening, 'Racket')).toBe(3);
    expect(availableOf(before, 'Racket')).toBe(4);
    expect(availableOf(after, 'Racket')).toBe(4);
  });

  it.each([
    ['a missing date', { start: '18:00', duration: 60 }],
    ['an invalid date', { date: '2026-02-30', start: '18:00', duration: 60 }],
    ['a start not on :00 or :30', { date: day, start: '18:15', duration: 60 }],
    [
      'a duration other than 60 or 90',
      { date: day, start: '18:00', duration: 45 },
    ],
  ])('refuses %s', async (_label, query) => {
    const res = await availability(query);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
