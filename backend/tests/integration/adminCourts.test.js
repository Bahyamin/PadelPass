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
import { config } from '../../src/config/index.js';
import { prisma } from '../../src/config/db.js';
import { mailer } from '../../src/modules/notifications/mailer.js';
import { bookingEmailsService } from '../../src/modules/notifications/bookingEmails.service.js';
import { clearBookings, resetDb } from '../helpers/resetDb.js';
import { addDays, clubTime, clubToday } from '../../src/utils/time.js';

const PASSWORD = 'padel1234';
const day = addDays(clubToday(), 3);
const yesterday = addDays(clubToday(), -1);

// FR-24, AC-17: the administrator adds, edits, deactivates and closes courts.
describe('court management (/api/admin/courts)', () => {
  let admin;
  let player;
  let ada;
  let court1;
  let court2;
  let sendMock;
  const retryDelay = config.email.retryDelayMs;

  const createUser = async (email, role, firstName) =>
    prisma.user.create({
      data: {
        firstName,
        lastName: 'Test',
        email,
        phone: '0612345678',
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        role,
        isVerified: true,
      },
    });

  const loginAs = async (email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: PASSWORD });
    return agent;
  };

  // A confirmed booking of Ada on `court`, `date` from `start` to `end`.
  const booking = (court, date, start, end, extra = {}) =>
    prisma.booking.create({
      data: {
        courtId: court.id,
        userId: ada.id,
        createdById: ada.id,
        startTime: clubTime(date, start),
        endTime: clubTime(date, end),
        courtPrice: 40,
        ...extra,
      },
    });

  // Status of one slot of a court in the availability grid of `day`.
  const gridStatus = async (court, time) => {
    const res = await request(app).get(`/api/availability?date=${day}`);
    const row = res.body.courts.find((c) => c.id === court.id);
    return row?.slots.find((s) => s.time === time).status;
  };

  const close = (court, body) =>
    admin.post(`/api/admin/courts/${court.id}/closures`).send({
      start: `${day}T10:00`,
      end: `${day}T12:00`,
      reason: 'Net replacement',
      ...body,
    });

  beforeAll(async () => {
    await resetDb();
    config.email.retryDelayMs = 0;
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
    await createUser('admin@test.local', 'ADMIN', 'Admin');
    ada = await createUser('ada@example.com', 'PLAYER', 'Ada');
    admin = await loginAs('admin@test.local');
    player = await loginAs('ada@example.com');
  });

  beforeEach(async () => {
    await clearBookings();
    await prisma.courtClosure.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.court.deleteMany();
    court1 = await prisma.court.create({ data: { name: 'Court 1' } });
    court2 = await prisma.court.create({
      data: { name: 'Court 2', type: 'OUTDOOR' },
    });
    sendMock = vi.spyOn(mailer, 'send').mockResolvedValue({});
  });

  afterEach(async () => {
    await bookingEmailsService.settle();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    config.email.retryDelayMs = retryDelay;
    await resetDb();
    await prisma.$disconnect();
  });

  describe('courts', () => {
    it('lists every court, active or not, with its closures to come', async () => {
      await prisma.court.update({
        where: { id: court2.id },
        data: { isActive: false },
      });
      await prisma.courtClosure.create({
        data: {
          courtId: court1.id,
          startTime: clubTime(day, '10:00'),
          endTime: clubTime(day, '12:00'),
          reason: 'Net replacement',
        },
      });
      await prisma.courtClosure.create({
        data: {
          courtId: court1.id,
          startTime: clubTime(yesterday, '10:00'),
          endTime: clubTime(yesterday, '12:00'),
          reason: 'Over',
        },
      });

      const res = await admin.get('/api/admin/courts');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          id: court1.id,
          name: 'Court 1',
          type: 'INDOOR',
          isActive: true,
          closures: [
            {
              id: expect.any(Number),
              courtId: court1.id,
              start: `${day}T10:00`,
              end: `${day}T12:00`,
              reason: 'Net replacement',
            },
          ],
        },
        {
          id: court2.id,
          name: 'Court 2',
          type: 'OUTDOOR',
          isActive: false,
          closures: [],
        },
      ]);
    });

    it('adds a court with a name and indoor/outdoor, and logs it', async () => {
      const res = await admin
        .post('/api/admin/courts')
        .send({ name: '  Court 3 ', type: 'OUTDOOR' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Court 3',
        type: 'OUTDOOR',
        isActive: true,
      });
      const courts = await request(app).get('/api/courts');
      expect(courts.body.map((c) => c.name)).toContain('Court 3');
      const log = await prisma.auditLog.findFirst();
      expect(log).toMatchObject({
        action: 'CREATE',
        entity: 'courts',
        entityId: res.body.id,
      });
    });

    it('refuses a court without a name, with an unknown type or a name taken', async () => {
      const noName = await admin
        .post('/api/admin/courts')
        .send({ name: ' ', type: 'INDOOR' });
      const badType = await admin
        .post('/api/admin/courts')
        .send({ name: 'Court 3', type: 'ROOF' });
      const taken = await admin
        .post('/api/admin/courts')
        .send({ name: 'court 1', type: 'INDOOR' });

      expect(noName.status).toBe(400);
      expect(noName.body.error.message).toBe('name is required');
      expect(badType.status).toBe(400);
      expect(badType.body.error.message).toBe('type must be INDOOR or OUTDOOR');
      expect(taken.status).toBe(409);
      expect(taken.body.error.code).toBe('COURT_NAME_TAKEN');
      expect(await prisma.court.count()).toBe(2);
    });

    it('edits the name and the type of a court', async () => {
      const res = await admin
        .patch(`/api/admin/courts/${court1.id}`)
        .send({ name: 'Centre court', type: 'OUTDOOR' });
      const taken = await admin
        .patch(`/api/admin/courts/${court1.id}`)
        .send({ name: 'Court 2' });
      const unknown = await admin
        .patch('/api/admin/courts/999999')
        .send({ name: 'Court 9' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: court1.id,
        name: 'Centre court',
        type: 'OUTDOOR',
      });
      expect(taken.status).toBe(409);
      expect(unknown.status).toBe(404);
      expect(unknown.body.error.code).toBe('COURT_NOT_FOUND');
    });

    it('deactivates a court: it leaves the grid and cannot be booked, until reactivated', async () => {
      const res = await admin
        .patch(`/api/admin/courts/${court2.id}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
      const courts = await request(app).get('/api/courts');
      expect(courts.body.map((c) => c.id)).toEqual([court1.id]);
      expect(await gridStatus(court2, '10:00')).toBeUndefined();
      const refused = await player
        .post('/api/bookings')
        .send({ courtId: court2.id, date: day, start: '10:00', duration: 60 });
      expect(refused.status).toBe(404);
      expect(refused.body.error.code).toBe('COURT_NOT_FOUND');

      const back = await admin
        .patch(`/api/admin/courts/${court2.id}`)
        .send({ isActive: true });
      expect(back.body.isActive).toBe(true);
      expect(await gridStatus(court2, '10:00')).toBe('FREE');
    });

    it('refuses to deactivate a court that still has bookings to come', async () => {
      await booking(court1, day, '18:00', '19:30');
      await booking(court2, yesterday, '18:00', '19:30'); // over
      await booking(court2, day, '18:00', '19:30', { status: 'CANCELLED' });

      const refused = await admin
        .patch(`/api/admin/courts/${court1.id}`)
        .send({ isActive: false });
      const allowed = await admin
        .patch(`/api/admin/courts/${court2.id}`)
        .send({ isActive: false });

      expect(refused.status).toBe(409);
      expect(refused.body.error.code).toBe('COURT_HAS_BOOKINGS');
      expect(refused.body.error.message).toContain('1 upcoming booking');
      expect(allowed.status).toBe(200);
      const stillActive = await prisma.court.findUnique({
        where: { id: court1.id },
      });
      expect(stillActive.isActive).toBe(true);
    });
  });

  describe('closures', () => {
    it('closes a court for a period with a reason: the grid shows it closed', async () => {
      const res = await close(court1);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(Number),
        courtId: court1.id,
        start: `${day}T10:00`,
        end: `${day}T12:00`,
        reason: 'Net replacement',
        cancelledBookings: [],
      });
      expect(await gridStatus(court1, '09:30')).toBe('FREE');
      expect(await gridStatus(court1, '10:00')).toBe('CLOSED');
      expect(await gridStatus(court1, '11:30')).toBe('CLOSED');
      expect(await gridStatus(court1, '12:00')).toBe('FREE');
      expect(await gridStatus(court2, '10:00')).toBe('FREE');

      const refused = await player
        .post('/api/bookings')
        .send({ courtId: court1.id, date: day, start: '11:00', duration: 60 });
      expect(refused.status).toBe(409);
      expect(refused.body.error.code).toBe('COURT_CLOSED');
    });

    it('cancels the bookings during the closure and sends their players the cancellation email', async () => {
      const during = await booking(court1, day, '11:00', '12:00');
      const guest = await booking(court1, day, '09:30', '10:30', {
        userId: null,
        guestName: 'Grace Hopper',
        guestPhone: '0611111111',
      });
      const after = await booking(court1, day, '12:00', '13:00');
      const otherCourt = await booking(court2, day, '10:00', '11:00');

      const res = await close(court1);
      await bookingEmailsService.settle();

      expect(res.status).toBe(201);
      expect(res.body.cancelledBookings).toEqual([
        {
          id: guest.id,
          date: day,
          start: '09:30',
          end: '10:30',
          player: 'Grace Hopper',
        },
        {
          id: during.id,
          date: day,
          start: '11:00',
          end: '12:00',
          player: 'Ada Test',
        },
      ]);
      const status = async (b) =>
        (await prisma.booking.findUnique({ where: { id: b.id } })).status;
      expect(await status(during)).toBe('CANCELLED');
      expect(await status(guest)).toBe('CANCELLED');
      expect(await status(after)).toBe('CONFIRMED');
      expect(await status(otherCourt)).toBe('CONFIRMED');

      // One email: the guest has no account, so no address.
      expect(sendMock).toHaveBeenCalledTimes(1);
      const email = sendMock.mock.calls[0][0];
      expect(email.to).toBe('ada@example.com');
      expect(email.subject).toBe('Annulation de votre réservation');
      const logged = await prisma.notification.findFirst({
        where: { bookingId: during.id },
      });
      expect(logged).toMatchObject({
        type: 'BOOKING_CANCELLATION',
        status: 'SENT',
      });
      const log = await prisma.auditLog.findFirst({
        where: { entity: 'court_closures' },
      });
      expect(log.details.cancelledBookingIds).toEqual([during.id, guest.id]);
    });

    it('refuses a period that is invalid, already over or on an unknown court', async () => {
      const backwards = await close(court1, {
        start: `${day}T12:00`,
        end: `${day}T10:00`,
      });
      const noReason = await close(court1, { reason: '' });
      const badDate = await close(court1, { start: `${day} 10:00` });
      const over = await close(court1, {
        start: `${yesterday}T10:00`,
        end: `${yesterday}T12:00`,
      });
      const unknown = await admin
        .post('/api/admin/courts/999999/closures')
        .send({ start: `${day}T10:00`, end: `${day}T12:00`, reason: 'Rain' });

      expect(backwards.status).toBe(400);
      expect(backwards.body.error.message).toBe('end must be after start');
      expect(noReason.status).toBe(400);
      expect(noReason.body.error.message).toBe('reason is required');
      expect(badDate.status).toBe(400);
      expect(over.status).toBe(400);
      expect(over.body.error.code).toBe('CLOSURE_IN_PAST');
      expect(unknown.status).toBe(404);
      expect(await prisma.courtClosure.count()).toBe(0);
    });
  });
});
