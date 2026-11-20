import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from 'vitest';
import { prisma } from '../../src/config/db.js';
import { mailer } from '../../src/modules/notifications/mailer.js';
import { remindersService } from '../../src/modules/notifications/reminders.service.js';
import { clubTime } from '../../src/utils/time.js';
import { resetDb } from '../helpers/resetDb.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// The job runs with a given "now": exactly 24 hours before a Friday 18:00 booking.
const START = clubTime('2026-12-04', '18:00'); // Friday, 4 December 2026
const NOW = new Date(START.getTime() - 24 * HOUR);

let sendMock;
let player;
let courtNumber = 0;

// A booking starting `offset` ms after START, each on its own court so that
// bookings never overlap (no_overlap constraint).
async function createBooking({ offset = 0, ...data } = {}) {
  courtNumber += 1;
  const court = await prisma.court.create({
    data: { name: `Court ${courtNumber}` },
  });
  const startTime = new Date(START.getTime() + offset);
  return prisma.booking.create({
    data: {
      userId: player.id,
      createdById: player.id,
      courtId: court.id,
      startTime,
      endTime: new Date(startTime.getTime() + 90 * MINUTE),
      courtPrice: 60,
      ...data,
    },
  });
}

const reminders = () =>
  prisma.notification.findMany({ where: { type: 'BOOKING_REMINDER' } });

describe('booking reminders (sendDueReminders)', () => {
  beforeEach(async () => {
    sendMock = vi.spyOn(mailer, 'send').mockResolvedValue({});
    await resetDb();
    courtNumber = 0;
    player = await prisma.user.create({
      data: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '0612345678',
        passwordHash: 'x',
        isVerified: true,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('emails the player 24 hours before a confirmed booking', async () => {
    const booking = await createBooking();

    const result = await remindersService.sendDueReminders(NOW);

    expect(result).toEqual({ due: 1, sent: 1 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const email = sendMock.mock.calls[0][0];
    expect(email.to).toBe('ada@example.com');
    expect(email.subject).toBe('Reminder: your padel booking tomorrow');
    expect(email.text).toContain('Hello Ada');
    expect(email.text).toContain(
      'Court 1, Friday, 4 December 2026, from 18:00 to 19:30',
    );
    expect(email.text).toContain('Court price: 60.00 EUR');
    expect(await reminders()).toEqual([
      expect.objectContaining({
        userId: player.id,
        bookingId: booking.id,
        status: 'SENT',
      }),
    ]);
  });

  it('reminds the bookings starting between 23h45 and 24h15 from now only', async () => {
    const inside = [
      await createBooking({ offset: -15 * MINUTE }),
      await createBooking({ offset: 14 * MINUTE }),
      await createBooking({ offset: 15 * MINUTE }),
    ];
    await createBooking({ offset: -16 * MINUTE });
    await createBooking({ offset: 16 * MINUTE });
    await createBooking({ offset: -2 * HOUR });

    const result = await remindersService.sendDueReminders(NOW);

    expect(result.sent).toBe(3);
    const reminded = (await reminders()).map((n) => n.bookingId).sort();
    expect(reminded).toEqual(inside.map((b) => b.id).sort());
  });

  it('sends the reminder only once, even if the next runs see the booking again', async () => {
    await createBooking();

    await remindersService.sendDueReminders(NOW);
    const second = await remindersService.sendDueReminders(NOW);
    const nextRun = await remindersService.sendDueReminders(
      new Date(NOW.getTime() + 15 * MINUTE),
    );

    expect(second).toEqual({ due: 0, sent: 0 });
    expect(nextRun).toEqual({ due: 0, sent: 0 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(await reminders()).toHaveLength(1);
  });

  it('does not remind cancelled bookings', async () => {
    await createBooking({ status: 'CANCELLED' });

    const result = await remindersService.sendDueReminders(NOW);

    expect(result).toEqual({ due: 0, sent: 0 });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('skips guest bookings, which have no email address', async () => {
    await createBooking({ userId: null, guestName: 'Walk-in guest' });

    const result = await remindersService.sendDueReminders(NOW);

    expect(result.due).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('logs a failed email and tries again at the next run', async () => {
    const booking = await createBooking();
    sendMock.mockRejectedValueOnce(new Error('SMTP down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const first = await remindersService.sendDueReminders(NOW);
    const retry = await remindersService.sendDueReminders(
      new Date(NOW.getTime() + 15 * MINUTE),
    );

    expect(first).toEqual({ due: 1, sent: 0 });
    expect(retry).toEqual({ due: 1, sent: 1 });
    const statuses = (await reminders()).map((n) => n.status).sort();
    expect(statuses).toEqual(['FAILED', 'SENT']);
    expect((await reminders()).every((n) => n.bookingId === booking.id)).toBe(
      true,
    );
  });
});
