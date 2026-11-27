import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../src/app.js';
import { prisma } from '../../src/config/db.js';
import { clearBookings, resetDb } from '../helpers/resetDb.js';
import { addDays, clubTime, clubToday } from '../../src/utils/time.js';

const PASSWORD = 'padel1234';
const day = addDays(clubToday(), 3);
const HOUR = 60 * 60 * 1000;

// FR-18, FR-19, AC-09: rackets and balls with a booking, or later until
// 2 hours before the start, never more than the stock of the slot.
describe('equipment of a booking', () => {
  let ada;
  let bob;
  let court1;
  let court2;
  let racket;
  let balls;
  let oldBag;
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

  const book = (agent, body) =>
    agent.post('/api/bookings').send({
      courtId: court1.id,
      date: day,
      start: '18:00',
      duration: 90,
      ...body,
    });

  // A booking saved directly, starting `start` (a Date), for 90 minutes.
  const savedBooking = (user, start, equipment = [], extra = {}) =>
    prisma.booking.create({
      data: {
        courtId: court1.id,
        userId: user.id,
        createdById: user.id,
        startTime: start,
        endTime: new Date(start.getTime() + 1.5 * HOUR),
        courtPrice: 60,
        equipment: { create: equipment },
        ...extra,
      },
    });

  const equipmentOf = (bookingId) =>
    prisma.bookingEquipment.findMany({
      where: { bookingId },
      orderBy: { typeId: 'asc' },
      select: { typeId: true, quantity: true, unitPrice: true },
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
          pricePerHour: 40,
          label: 'Test',
        },
      });
    }
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
    oldBag = await prisma.equipmentType.create({
      data: {
        name: 'Old bag',
        category: 'BAG',
        rentalPrice: 1,
        damageFee: 1,
        isActive: false,
      },
    });
    // 3 rackets in service (+1 damaged, not counted), 2 tubes of balls.
    const items = [
      [racket, 'R1', 'AVAILABLE'],
      [racket, 'R2', 'AVAILABLE'],
      [racket, 'R3', 'RENTED'],
      [racket, 'R4', 'DAMAGED'],
      [balls, 'B1', 'AVAILABLE'],
      [balls, 'B2', 'AVAILABLE'],
      [oldBag, 'X1', 'AVAILABLE'],
    ];
    for (const [type, code, status] of items) {
      await prisma.equipmentItem.create({
        data: { typeId: type.id, code, status },
      });
    }
    ada = await createUser('Ada');
    bob = await createUser('Bob');
    await createUser('Sam', 'STAFF');
    for (const name of ['ada', 'bob', 'sam']) {
      agents[name] = request.agent(app);
      await agents[name]
        .post('/api/auth/login')
        .send({ email: `${name}@example.com`, password: PASSWORD });
    }
  });

  beforeEach(async () => {
    await clearBookings();
    await prisma.setting.deleteMany();
    await prisma.equipmentType.update({
      where: { id: racket.id },
      data: { rentalPrice: 4 },
    });
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  describe('while booking (POST /api/bookings)', () => {
    it('books with rackets and balls: the total price adds the rental prices', async () => {
      const res = await book(agents.ada, {
        equipment: [
          { typeId: racket.id, quantity: 2 },
          { typeId: balls.id, quantity: 1 },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        courtPrice: '60.00',
        equipment: [
          { typeId: racket.id, name: 'Racket', quantity: 2, unitPrice: '4.00' },
          {
            typeId: balls.id,
            name: 'Balls (tube of 3)',
            quantity: 1,
            unitPrice: '5.00',
          },
        ],
        equipmentPrice: '13.00',
        totalPrice: '73.00',
      });
      expect(await equipmentOf(res.body.id)).toEqual([
        { typeId: racket.id, quantity: 2, unitPrice: expect.anything() },
        { typeId: balls.id, quantity: 1, unitPrice: expect.anything() },
      ]);
      const mine = await agents.ada.get('/api/bookings/me');
      expect(mine.body.upcoming[0].totalPrice).toBe('73.00');
    });

    it('books without equipment, as before', async () => {
      const res = await book(agents.ada, {});

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        equipment: [],
        equipmentPrice: '0.00',
        totalPrice: '60.00',
      });
    });

    it('refuses more than the quantity available for the slot, with a message', async () => {
      // Bob already has 2 of the 3 rackets from 18:30 to 20:00.
      await savedBooking(bob, clubTime(day, '18:30'), [
        { typeId: racket.id, quantity: 2, unitPrice: 4 },
      ]);

      const res = await book(agents.ada, {
        courtId: court2.id,
        equipment: [{ typeId: racket.id, quantity: 2 }],
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EQUIPMENT_UNAVAILABLE');
      expect(res.body.error.message).toBe(
        'Only 1 × Racket available for this slot, you asked for 2',
      );
      expect(await prisma.booking.count({ where: { userId: ada.id } })).toBe(0);
    });

    it('does not count the equipment of a booking at another time', async () => {
      await savedBooking(bob, clubTime(day, '20:00'), [
        { typeId: racket.id, quantity: 3, unitPrice: 4 },
      ]);

      const res = await book(agents.ada, {
        equipment: [{ typeId: racket.id, quantity: 3 }],
      });

      expect(res.status).toBe(201);
    });

    it('refuses an unknown or inactive equipment type and an invalid list', async () => {
      const inactive = await book(agents.ada, {
        equipment: [{ typeId: oldBag.id, quantity: 1 }],
      });
      const twice = await book(agents.ada, {
        equipment: [
          { typeId: racket.id, quantity: 1 },
          { typeId: racket.id, quantity: 1 },
        ],
      });
      const negative = await book(agents.ada, {
        equipment: [{ typeId: racket.id, quantity: -1 }],
      });

      expect(inactive.status).toBe(404);
      expect(inactive.body.error.code).toBe('EQUIPMENT_NOT_FOUND');
      expect(twice.status).toBe(400);
      expect(twice.body.error.message).toBe(
        'Each equipment type can appear only once',
      );
      expect(negative.status).toBe(400);
      expect(await prisma.booking.count()).toBe(0);
    });

    it('gives the last rackets to only one of two simultaneous bookings', async () => {
      const [first, second] = await Promise.all([
        book(agents.ada, { equipment: [{ typeId: racket.id, quantity: 2 }] }),
        book(agents.bob, {
          courtId: court2.id,
          equipment: [{ typeId: racket.id, quantity: 2 }],
        }),
      ]);

      expect([first.status, second.status].sort()).toEqual([201, 409]);
      const refused = first.status === 409 ? first : second;
      expect(refused.body.error.code).toBe('EQUIPMENT_UNAVAILABLE');
      const reserved = await prisma.bookingEquipment.aggregate({
        _sum: { quantity: true },
      });
      expect(reserved._sum.quantity).toBe(2);
    });
  });

  describe('later (GET and PUT /api/bookings/:id/equipment)', () => {
    const inThreeDays = () => clubTime(day, '18:00');

    it('shows each type with its price, my quantity and what I can have', async () => {
      const mine = await savedBooking(ada, inThreeDays(), [
        { typeId: racket.id, quantity: 1, unitPrice: 4 },
      ]);
      await savedBooking(
        bob,
        inThreeDays(),
        [{ typeId: balls.id, quantity: 1, unitPrice: 5 }],
        { courtId: court2.id },
      );

      const res = await agents.ada.get(`/api/bookings/${mine.id}/equipment`);

      expect(res.status).toBe(200);
      expect(res.body.booking).toMatchObject({
        id: mine.id,
        courtName: 'Court 1',
        date: day,
        start: '18:00',
        totalPrice: '64.00',
      });
      expect(res.body.changeDeadline).toBe(`${day}T16:00`);
      expect(res.body.canChange).toBe(true);
      expect(res.body.equipment).toEqual([
        {
          typeId: racket.id,
          name: 'Racket',
          category: 'RACKET',
          unitPrice: '4.00',
          quantity: 1,
          available: 3, // my own racket is not counted against me
        },
        {
          typeId: balls.id,
          name: 'Balls (tube of 3)',
          category: 'BALLS',
          unitPrice: '5.00',
          quantity: 0,
          available: 1, // Bob has the other tube
        },
      ]);
    });

    it('changes the quantities later: the total price is updated', async () => {
      const mine = await savedBooking(ada, inThreeDays(), [
        { typeId: racket.id, quantity: 1, unitPrice: 4 },
      ]);
      // The rental price changed since the booking: the racket keeps its price.
      await prisma.equipmentType.update({
        where: { id: racket.id },
        data: { rentalPrice: 6 },
      });

      const res = await agents.ada
        .put(`/api/bookings/${mine.id}/equipment`)
        .send({
          equipment: [
            { typeId: racket.id, quantity: 3 },
            { typeId: balls.id, quantity: 2 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        equipmentPrice: '22.00', // 3 x 4.00 + 2 x 5.00
        totalPrice: '82.00',
      });
      expect(await equipmentOf(mine.id)).toEqual([
        { typeId: racket.id, quantity: 3, unitPrice: expect.anything() },
        { typeId: balls.id, quantity: 2, unitPrice: expect.anything() },
      ]);
      const list = await agents.ada.get('/api/bookings/me');
      expect(list.body.upcoming[0].totalPrice).toBe('82.00');

      const none = await agents.ada
        .put(`/api/bookings/${mine.id}/equipment`)
        .send({ equipment: [] });
      expect(none.body.totalPrice).toBe('60.00');
      expect(await equipmentOf(mine.id)).toEqual([]);
    });

    it('refuses a change above the stock and keeps the old equipment', async () => {
      const mine = await savedBooking(ada, inThreeDays(), [
        { typeId: balls.id, quantity: 1, unitPrice: 5 },
      ]);

      const res = await agents.ada
        .put(`/api/bookings/${mine.id}/equipment`)
        .send({ equipment: [{ typeId: balls.id, quantity: 3 }] });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe(
        'Only 2 × Balls (tube of 3) available for this slot, you asked for 3',
      );
      expect(await equipmentOf(mine.id)).toEqual([
        { typeId: balls.id, quantity: 1, unitPrice: expect.anything() },
      ]);
    });

    it('closes the change 2 hours before the start for a player, not for staff', async () => {
      const soon = await savedBooking(ada, new Date(Date.now() + 1.5 * HOUR));
      const later = await savedBooking(
        ada,
        new Date(Date.now() + 2.5 * HOUR),
        [],
        { courtId: court2.id },
      );
      const change = { equipment: [{ typeId: racket.id, quantity: 1 }] };

      const tooLate = await agents.ada
        .put(`/api/bookings/${soon.id}/equipment`)
        .send(change);
      const inTime = await agents.ada
        .put(`/api/bookings/${later.id}/equipment`)
        .send(change);
      const byStaff = await agents.sam
        .put(`/api/bookings/${soon.id}/equipment`)
        .send(change);
      const view = await agents.ada.get(`/api/bookings/${soon.id}/equipment`);

      expect(tooLate.status).toBe(409);
      expect(tooLate.body.error.code).toBe('EQUIPMENT_CHANGE_CLOSED');
      expect(tooLate.body.error.message).toMatch(
        /up to 2 hours before the start/,
      );
      expect(inTime.status).toBe(200);
      expect(byStaff.status).toBe(200);
      expect(view.body.canChange).toBe(false);
    });

    it('uses the deadline set by the administrator', async () => {
      await prisma.setting.create({
        data: { key: 'equipment_change_deadline_hours', value: '4' },
      });
      const mine = await savedBooking(ada, new Date(Date.now() + 3 * HOUR));

      const res = await agents.ada
        .put(`/api/bookings/${mine.id}/equipment`)
        .send({ equipment: [{ typeId: racket.id, quantity: 1 }] });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/up to 4 hours before/);
    });

    it('hides the bookings of other players and refuses a cancelled booking', async () => {
      const bobs = await savedBooking(bob, inThreeDays());
      const cancelled = await savedBooking(ada, inThreeDays(), [], {
        courtId: court2.id,
        status: 'CANCELLED',
      });
      const change = { equipment: [{ typeId: racket.id, quantity: 1 }] };

      const other = await agents.ada
        .put(`/api/bookings/${bobs.id}/equipment`)
        .send(change);
      const otherView = await agents.ada.get(
        `/api/bookings/${bobs.id}/equipment`,
      );
      const notActive = await agents.ada
        .put(`/api/bookings/${cancelled.id}/equipment`)
        .send(change);

      expect(other.status).toBe(404);
      expect(other.body.error.code).toBe('BOOKING_NOT_FOUND');
      expect(otherView.status).toBe(404);
      expect(notActive.status).toBe(409);
      expect(notActive.body.error.code).toBe('BOOKING_NOT_ACTIVE');
      expect(await equipmentOf(bobs.id)).toEqual([]);
    });
  });
});
