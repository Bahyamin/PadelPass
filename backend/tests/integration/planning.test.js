import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { resetDb } from '../helpers/resetDb.js';
import { addDays, clubTime, clubToday } from '../../src/utils/time.js';

const PASSWORD = 'padel1234';
const today = clubToday();
const day = addDays(today, 2);

// FR-27, AC-16, UC-09: the front desk sees the bookings of a day per court,
// and opens the details of a booking.
describe('daily planning and booking details', () => {
  let ada;
  let bob;
  let staff;
  let court1;
  let court2;
  let oldCourt;
  let adaBooking;
  let guestBooking;
  const agents = {};

  const createUser = async (firstName, role = 'PLAYER') =>
    prisma.user.create({
      data: {
        firstName,
        lastName: 'Test',
        email: `${firstName.toLowerCase()}@example.com`,
        phone: '0612345678',
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        role,
        isVerified: true,
      },
    });

  const loginAs = async (user) => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD });
    return agent;
  };

  const booking = (court, onDay, start, end, extra = {}) =>
    prisma.booking.create({
      data: {
        courtId: court.id,
        userId: ada.id,
        createdById: ada.id,
        startTime: clubTime(onDay, start),
        endTime: clubTime(onDay, end),
        courtPrice: 40,
        ...extra,
      },
    });

  beforeAll(async () => {
    await resetDb();
    await prisma.openingHours.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        openTime: '08:00',
        closeTime: '23:00',
      })),
    });
    court1 = await prisma.court.create({ data: { name: 'Court 1' } });
    court2 = await prisma.court.create({ data: { name: 'Court 2' } });
    oldCourt = await prisma.court.create({
      data: { name: 'Old court', isActive: false },
    });
    await prisma.court.create({ data: { name: 'Gone', isActive: false } });
    const racket = await prisma.equipmentType.create({
      data: {
        name: 'Racket',
        category: 'RACKET',
        rentalPrice: 4,
        damageFee: 60,
      },
    });
    const item = await prisma.equipmentItem.create({
      data: { typeId: racket.id, code: 'RKT-01', status: 'RENTED' },
    });

    ada = await createUser('Ada');
    bob = await createUser('Bob');
    staff = await createUser('Sam', 'STAFF');

    adaBooking = await booking(court1, day, '18:00', '19:30', {
      courtPrice: 60,
      paymentStatus: 'PAID',
      equipment: {
        create: [{ typeId: racket.id, quantity: 2, unitPrice: 4 }],
      },
    });
    await booking(court1, day, '10:00', '11:00');
    guestBooking = await booking(court2, day, '12:00', '13:00', {
      userId: null,
      createdById: staff.id,
      guestName: 'John Guest',
      guestPhone: '0699999999',
    });
    await booking(oldCourt, day, '09:00', '10:00');
    // Not shown: a cancelled booking, and a booking of another day.
    await booking(court2, day, '15:00', '16:00', { status: 'CANCELLED' });
    await booking(court2, addDays(day, 1), '15:00', '16:00');
    await prisma.courtClosure.create({
      data: {
        courtId: court2.id,
        startTime: clubTime(day, '20:00'),
        endTime: clubTime(addDays(day, 1), '12:00'),
        reason: 'Lighting repair',
      },
    });
    await prisma.rental.create({
      data: {
        bookingId: adaBooking.id,
        itemId: item.id,
        pickedUpAt: clubTime(day, '17:55'),
      },
    });

    agents.ada = await loginAs(ada);
    agents.bob = await loginAs(bob);
    agents.staff = await loginAs(staff);
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('shows each court of the day with its bookings, player, equipment and payment', async () => {
    const res = await agents.staff.get(`/api/staff/planning?date=${day}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      date: day,
      openTime: '08:00',
      closeTime: '23:00',
    });
    expect(res.body.slots).toHaveLength(30);
    expect(res.body.courts.map((c) => c.name)).toEqual([
      'Court 1',
      'Court 2',
      'Old court',
    ]);

    const [first, second, third] = res.body.courts;
    expect(first.bookings).toEqual([
      expect.objectContaining({ start: '10:00', end: '11:00' }),
      {
        id: adaBooking.id,
        start: '18:00',
        end: '19:30',
        duration: 90,
        status: 'CONFIRMED',
        player: 'Ada Test',
        isGuest: false,
        phone: '0612345678',
        equipment: [{ name: 'Racket', quantity: 2 }],
        paymentStatus: 'PAID',
        totalPrice: '68.00',
      },
    ]);
    expect(second.bookings).toEqual([
      expect.objectContaining({
        id: guestBooking.id,
        player: 'John Guest',
        isGuest: true,
        phone: '0699999999',
        paymentStatus: 'UNPAID',
      }),
    ]);
    expect(second.closures).toEqual([
      { start: '20:00', end: '24:00', reason: 'Lighting repair' },
    ]);
    // An inactive court only appears for the bookings it still has.
    expect(third).toMatchObject({ isActive: false });
    expect(third.bookings).toHaveLength(1);
  });

  it('shows today when no day is given, and refuses a wrong day', async () => {
    const todayRes = await agents.staff.get('/api/staff/planning');
    expect(todayRes.status).toBe(200);
    expect(todayRes.body.date).toBe(today);

    const wrong = await agents.staff.get('/api/staff/planning?date=2026-02-30');
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.message).toBe(
      'date must be a valid day (YYYY-MM-DD)',
    );
  });

  it('refuses the planning to a player', async () => {
    const res = await agents.ada.get(`/api/staff/planning?date=${day}`);

    expect(res.status).toBe(403);
  });

  it('gives staff the details of a booking with the items handed out', async () => {
    const res = await agents.staff.get(`/api/bookings/${adaBooking.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: adaBooking.id,
      courtName: 'Court 1',
      date: day,
      start: '18:00',
      end: '19:30',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      totalPrice: '68.00',
      equipment: [
        {
          typeId: expect.any(Number),
          name: 'Racket',
          quantity: 2,
          unitPrice: '4.00',
        },
      ],
      player: {
        id: ada.id,
        firstName: 'Ada',
        lastName: 'Test',
        email: 'ada@example.com',
        phone: '0612345678',
      },
      guest: null,
      rentals: [
        {
          code: 'RKT-01',
          typeName: 'Racket',
          pickedUpAt: `${day}T17:55`,
          returnedAt: null,
          returnCondition: null,
        },
      ],
    });
    expect(res.body.player.passwordHash).toBeUndefined();
  });

  it('gives the guest of a booking made by staff', async () => {
    const res = await agents.staff.get(`/api/bookings/${guestBooking.id}`);

    expect(res.body.player).toBeNull();
    expect(res.body.guest).toEqual({
      name: 'John Guest',
      phone: '0699999999',
    });
  });

  it('gives a player their own booking, and 404 for the booking of another player', async () => {
    const own = await agents.ada.get(`/api/bookings/${adaBooking.id}`);
    expect(own.status).toBe(200);

    const other = await agents.bob.get(`/api/bookings/${adaBooking.id}`);
    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe('BOOKING_NOT_FOUND');

    const unknown = await agents.staff.get('/api/bookings/999999');
    expect(unknown.status).toBe(404);
  });

  it('still answers GET /api/bookings/me with the list of my bookings', async () => {
    const res = await agents.ada.get('/api/bookings/me');

    expect(res.status).toBe(200);
    expect(res.body.upcoming.length).toBeGreaterThan(0);
  });
});
