import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { resetDb } from '../helpers/resetDb.js';
import { addDays, clubTime, clubToday } from '../../src/utils/time.js';

const PASSWORD = 'padel1234';
const today = clubToday();

// FR-14, NFR-08: a player sees their upcoming and past bookings, only theirs.
describe('GET /api/bookings/me', () => {
  let ada;
  let court1;
  let court2;
  let racket;
  let balls;

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

  const loginAs = async (email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: PASSWORD });
    return agent;
  };

  // A booking of `user`, `days` days from today, from `start` to `end`.
  const booking = (user, court, days, start, end, extra = {}) =>
    prisma.booking.create({
      data: {
        courtId: court.id,
        userId: user.id,
        createdById: user.id,
        startTime: clubTime(addDays(today, days), start),
        endTime: clubTime(addDays(today, days), end),
        courtPrice: 40,
        ...extra,
      },
    });

  beforeAll(async () => {
    await resetDb();
    court1 = await prisma.court.create({ data: { name: 'Court 1' } });
    court2 = await prisma.court.create({ data: { name: 'Court 2' } });
    racket = await prisma.equipmentType.create({
      data: {
        name: 'Racket',
        category: 'RACKET',
        rentalPrice: 4,
        damageFee: 60,
      },
    });
    balls = await prisma.equipmentType.create({
      data: {
        name: 'Balls (tube of 3)',
        category: 'BALLS',
        rentalPrice: 5,
        damageFee: 5,
      },
    });
    ada = await createPlayer('Ada', 'ada@example.com');
    const bob = await createPlayer('Bob', 'bob@example.com');
    await createPlayer('Cleo', 'cleo@example.com');

    // Ada: two upcoming bookings (created in the wrong order on purpose)
    // and two past ones.
    await booking(ada, court2, 5, '10:00', '11:00', { status: 'CANCELLED' });
    await booking(ada, court1, 2, '18:00', '19:30', {
      courtPrice: 60,
      equipment: {
        create: [
          { typeId: racket.id, quantity: 2, unitPrice: 4 },
          { typeId: balls.id, quantity: 1, unitPrice: 5 },
        ],
      },
    });
    await booking(ada, court1, -6, '09:00', '10:00', { status: 'COMPLETED' });
    await booking(ada, court2, -2, '20:00', '21:30', {
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      feesTotal: 60,
    });
    // Bob's booking must never appear for Ada.
    await booking(bob, court1, 3, '12:00', '13:00');
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('requires a login', async () => {
    const res = await request(app).get('/api/bookings/me');

    expect(res.status).toBe(401);
  });

  it('lists the upcoming bookings first, soonest first, then the past ones, most recent first', async () => {
    const agent = await loginAs('ada@example.com');

    const res = await agent.get('/api/bookings/me');

    expect(res.status).toBe(200);
    expect(res.body.upcoming.map((b) => b.date)).toEqual([
      addDays(today, 2),
      addDays(today, 5),
    ]);
    expect(res.body.past.map((b) => b.date)).toEqual([
      addDays(today, -2),
      addDays(today, -6),
    ]);
  });

  it('gives the date, time, court, duration, equipment, total price, status and payment', async () => {
    const agent = await loginAs('ada@example.com');

    const res = await agent.get('/api/bookings/me');

    expect(res.body.upcoming[0]).toEqual({
      id: expect.any(Number),
      date: addDays(today, 2),
      start: '18:00',
      end: '19:30',
      duration: 90,
      courtName: 'Court 1',
      equipment: [
        { name: 'Racket', quantity: 2, unitPrice: '4.00' },
        { name: 'Balls (tube of 3)', quantity: 1, unitPrice: '5.00' },
      ],
      courtPrice: '60.00',
      equipmentPrice: '13.00',
      feesTotal: '0.00',
      totalPrice: '73.00',
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID',
    });
    expect(res.body.upcoming[1]).toMatchObject({
      courtName: 'Court 2',
      duration: 60,
      equipment: [],
      status: 'CANCELLED',
    });
    expect(res.body.past[0]).toMatchObject({
      start: '20:00',
      end: '21:30',
      feesTotal: '60.00',
      totalPrice: '100.00',
      status: 'COMPLETED',
      paymentStatus: 'PAID',
    });
  });

  it('only shows the bookings of the logged-in player', async () => {
    const adaAgent = await loginAs('ada@example.com');
    const bobAgent = await loginAs('bob@example.com');

    const adaRes = await adaAgent.get('/api/bookings/me');
    const bobRes = await bobAgent.get('/api/bookings/me');

    const adaAll = [...adaRes.body.upcoming, ...adaRes.body.past];
    expect(adaAll).toHaveLength(4);
    expect(adaAll.some((b) => b.start === '12:00')).toBe(false);
    expect(bobRes.body.upcoming).toHaveLength(1);
    expect(bobRes.body.upcoming[0].start).toBe('12:00');
    expect(bobRes.body.past).toEqual([]);
  });

  it('answers two empty lists to a player without bookings', async () => {
    const agent = await loginAs('cleo@example.com');

    const res = await agent.get('/api/bookings/me');

    expect(res.body).toEqual({ upcoming: [], past: [] });
  });
});
