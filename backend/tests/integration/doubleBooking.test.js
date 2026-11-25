import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  vi,
} from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { bookingsRepository } from '../../src/modules/bookings/bookings.repository.js';
import { clearBookings, resetDb } from '../helpers/resetDb.js';
import { addDays, clubTime, clubToday } from '../../src/utils/time.js';

const PASSWORD = 'padel1234';
const day = addDays(clubToday(), 2);

// FR-11, RULE-05, AC-06: a court can never be booked twice for the same time.
describe('POST /api/bookings refuses double bookings', () => {
  let bob;
  let adaAgent;
  let bobAgent;
  let court;
  let otherCourt;

  const slot = (data = {}) => ({
    courtId: court.id,
    date: day,
    start: '10:00',
    duration: 90,
    ...data,
  });

  const createPlayer = (firstName, email) =>
    bcrypt.hash(PASSWORD, 4).then((passwordHash) =>
      prisma.user.create({
        data: {
          firstName,
          lastName: 'Test',
          email,
          phone: '0612345678',
          passwordHash,
          isVerified: true,
        },
      }),
    );

  const login = async (email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: PASSWORD });
    return agent;
  };

  // A confirmed booking saved directly in the database.
  const existingBooking = (start, end, extra = {}) =>
    prisma.booking.create({
      data: {
        courtId: court.id,
        userId: bob.id,
        createdById: bob.id,
        startTime: clubTime(day, start),
        endTime: clubTime(day, end),
        courtPrice: 42,
        ...extra,
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
    otherCourt = await prisma.court.create({ data: { name: 'Court 2' } });
    await createPlayer('Ada', 'ada@example.com');
    bob = await createPlayer('Bob', 'bob@example.com');
    adaAgent = await login('ada@example.com');
    bobAgent = await login('bob@example.com');
  });

  beforeEach(async () => {
    await clearBookings();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('refuses a slot booked in the meantime with 409 SLOT_UNAVAILABLE', async () => {
    await existingBooking('10:00', '11:30');

    const res = await adaAgent.post('/api/bookings').send(slot());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
    expect(res.body.error.message).toBe('This court is already booked');
    expect(await prisma.booking.count()).toBe(1);
  });

  it('refuses a slot that only partly overlaps a booking', async () => {
    await existingBooking('10:00', '11:30');

    const res = await adaAgent
      .post('/api/bookings')
      .send(slot({ start: '11:00', duration: 60 }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('also refuses the quote of a booked slot', async () => {
    await existingBooking('10:00', '11:30');

    const res = await adaAgent.get('/api/pricing/quote').query(slot());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('accepts a slot that starts when the previous booking ends', async () => {
    await existingBooking('10:00', '11:30');

    const res = await adaAgent
      .post('/api/bookings')
      .send(slot({ start: '11:30', duration: 60 }));

    expect(res.status).toBe(201);
  });

  it('accepts the same slot on another court', async () => {
    await existingBooking('10:00', '11:30');

    const res = await adaAgent
      .post('/api/bookings')
      .send(slot({ courtId: otherCourt.id }));

    expect(res.status).toBe(201);
  });

  it('accepts a slot freed by a cancelled booking', async () => {
    await existingBooking('10:00', '11:30', { status: 'CANCELLED' });

    const res = await adaAgent.post('/api/bookings').send(slot());

    expect(res.status).toBe(201);
  });

  it('lets exactly one of two simultaneous requests book the slot', async () => {
    const responses = await Promise.all([
      adaAgent.post('/api/bookings').send(slot()),
      bobAgent.post('/api/bookings').send(slot()),
    ]);

    const statuses = responses.map((res) => res.status).sort();
    expect(statuses).toEqual([201, 409]);
    const refused = responses.find((res) => res.status === 409);
    expect(refused.body.error.code).toBe('SLOT_UNAVAILABLE');
    expect(
      await prisma.booking.count({
        where: { courtId: court.id, status: 'CONFIRMED' },
      }),
    ).toBe(1);
  });

  it('answers 409, not 500, when only the database constraint sees the conflict', async () => {
    // Both requests pass the early check, as if they arrived at the same
    // instant: the no_overlap constraint is the last safety net.
    vi.spyOn(bookingsRepository, 'findOverlappingBooking').mockResolvedValue(
      null,
    );

    const responses = await Promise.all([
      adaAgent.post('/api/bookings').send(slot()),
      bobAgent.post('/api/bookings').send(slot()),
    ]);

    const statuses = responses.map((res) => res.status).sort();
    expect(statuses).toEqual([201, 409]);
    const refused = responses.find((res) => res.status === 409);
    expect(refused.body.error).toMatchObject({
      code: 'SLOT_UNAVAILABLE',
      message: 'This court is already booked',
    });
    expect(await prisma.booking.count()).toBe(1);
  });

  it('tries again when PostgreSQL stops the insert because of a deadlock', async () => {
    // What PostgreSQL may do to one of two simultaneous inserts (Prisma P2034).
    const deadlock = Object.assign(new Error('write conflict or deadlock'), {
      code: 'P2034',
    });
    const save = vi.spyOn(bookingsRepository, 'createWithinLimit');
    save.mockRejectedValueOnce(deadlock);

    const res = await adaAgent.post('/api/bookings').send(slot());

    expect(res.status).toBe(201);
    expect(save).toHaveBeenCalledTimes(2);
    expect(await prisma.booking.count()).toBe(1);
  });
});
