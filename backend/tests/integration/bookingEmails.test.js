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

// FR-30, AC-12: an email when a booking is created, changed or cancelled.
describe('booking emails', () => {
  let ada;
  let agent;
  let court;
  let racket;
  let sendMock;
  const retryDelay = config.email.retryDelayMs;

  const book = () =>
    agent
      .post('/api/bookings')
      .send({ courtId: court.id, date: day, start: '18:00', duration: 90 });

  const emailsOf = (bookingId) =>
    prisma.notification.findMany({
      where: { bookingId },
      orderBy: { id: 'asc' },
    });

  beforeAll(async () => {
    await resetDb();
    config.email.retryDelayMs = 0; // no back-off wait in the tests
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
    court = await prisma.court.create({ data: { name: 'Court 1' } });
    racket = await prisma.equipmentType.create({
      data: {
        name: 'Racket',
        category: 'RACKET',
        rentalPrice: 4,
        damageFee: 60,
      },
    });
    ada = await prisma.user.create({
      data: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '0612345678',
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        isVerified: true,
      },
    });
    agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: PASSWORD });
  });

  beforeEach(async () => {
    await clearBookings();
    sendMock = vi.spyOn(mailer, 'send').mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    config.email.retryDelayMs = retryDelay;
    await resetDb();
    await prisma.$disconnect();
  });

  it('sends a confirmation email in French when a booking is created', async () => {
    const res = await book();
    await bookingEmailsService.settle();

    expect(res.status).toBe(201);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const email = sendMock.mock.calls[0][0];
    expect(email.to).toBe('ada@example.com');
    expect(email.subject).toBe('Confirmation de votre réservation');
    expect(email.text).toContain('Bonjour Ada,');
    expect(email.text).toContain('Horaire : 18:00 - 19:30 (90 min)');
    expect(email.text).toContain('Terrain : Court 1');
    expect(email.text).toContain('Équipement : aucun');
    expect(email.text).toContain('Prix : 60,00 €');

    const rows = await emailsOf(res.body.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: ada.id,
      type: 'BOOKING_CONFIRMATION',
      status: 'SENT',
    });
  });

  it('keeps the booking when the provider fails, retries 3 times and logs FAILED', async () => {
    sendMock.mockRejectedValue(new Error('SMTP down'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await book();
    await bookingEmailsService.settle();

    expect(res.status).toBe(201);
    expect(
      await prisma.booking.findUnique({ where: { id: res.body.id } }),
    ).toMatchObject({ status: 'CONFIRMED' });
    expect(sendMock).toHaveBeenCalledTimes(4); // 1 attempt + 3 retries
    expect(errorLog).toHaveBeenCalledTimes(4);
    const rows = await emailsOf(res.body.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'BOOKING_CONFIRMATION',
      status: 'FAILED',
      error: 'SMTP down (after 4 attempts)',
    });
  });

  it('logs SENT when a retry succeeds', async () => {
    sendMock
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await book();
    await bookingEmailsService.settle();

    expect(sendMock).toHaveBeenCalledTimes(3);
    const rows = await emailsOf(res.body.id);
    expect(rows.map((r) => r.status)).toEqual(['SENT']);
  });

  it('answers without waiting for the email', async () => {
    let release;
    sendMock.mockReturnValue(new Promise((resolve) => (release = resolve)));

    const res = await book();

    expect(res.status).toBe(201);
    expect(await emailsOf(res.body.id)).toHaveLength(0); // still being sent
    release({});
    await bookingEmailsService.settle();
    expect(await emailsOf(res.body.id)).toHaveLength(1);
  });

  it.each([
    ['UPDATED', 'BOOKING_UPDATE', 'Modification de votre réservation'],
    ['CANCELLED', 'BOOKING_CANCELLATION', 'Annulation de votre réservation'],
  ])(
    'sends the %s email with the reserved equipment',
    async (event, type, subject) => {
      const booking = await prisma.booking.create({
        data: {
          courtId: court.id,
          userId: ada.id,
          createdById: ada.id,
          startTime: clubTime(day, '10:00'),
          endTime: clubTime(day, '11:00'),
          courtPrice: 40,
          equipment: {
            create: [{ typeId: racket.id, quantity: 2, unitPrice: 4 }],
          },
        },
      });

      expect(await bookingEmailsService.send(event, booking.id)).toBe(true);

      const email = sendMock.mock.calls[0][0];
      expect(email.subject).toBe(subject);
      expect(email.text).toContain('Équipement : 2 × Racket');
      expect(email.text).toContain(
        'Prix : 48,00 € (terrain 40,00 €, équipement 8,00 €)',
      );
      expect(await emailsOf(booking.id)).toMatchObject([
        { type, status: 'SENT' },
      ]);
      await prisma.bookingEquipment.deleteMany();
    },
  );

  it('sends nothing for a guest booking (no account, no email)', async () => {
    const booking = await prisma.booking.create({
      data: {
        courtId: court.id,
        guestName: 'Walk-in guest',
        createdById: ada.id,
        startTime: clubTime(day, '12:00'),
        endTime: clubTime(day, '13:00'),
        courtPrice: 40,
      },
    });

    expect(await bookingEmailsService.send('CREATED', booking.id)).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
