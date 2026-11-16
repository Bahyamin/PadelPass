import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/config/db.js';

// Checks the integrity rules of the SDD (section 4.2) on a real PostgreSQL.
describe('booking integrity rules', () => {
  let player;
  let court;
  let otherCourt;

  const at = (time) => new Date(`2030-01-07T${time}:00Z`);

  const book = (courtId, start, end, extra = {}) =>
    prisma.booking.create({
      data: {
        courtId,
        userId: player.id,
        createdById: player.id,
        startTime: at(start),
        endTime: at(end),
        courtPrice: 42,
        ...extra,
      },
    });

  beforeAll(async () => {
    await prisma.booking.deleteMany();
    await prisma.court.deleteMany();
    await prisma.user.deleteMany();
    player = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'Player',
        email: 'player@test.local',
        phone: '0600000000',
        passwordHash: 'x',
      },
    });
    court = await prisma.court.create({ data: { name: 'Test court A' } });
    otherCourt = await prisma.court.create({ data: { name: 'Test court B' } });
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany();
  });

  afterAll(async () => {
    await prisma.booking.deleteMany();
    await prisma.court.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('rejects an overlapping confirmed booking on the same court', async () => {
    await book(court.id, '10:00', '11:30');

    await expect(book(court.id, '11:00', '12:00')).rejects.toThrow(
      /no_overlap/,
    );
  });

  it('accepts a booking that starts when the previous one ends', async () => {
    await book(court.id, '10:00', '11:30');

    await expect(book(court.id, '11:30', '12:30')).resolves.toBeDefined();
  });

  it('accepts the same slot on another court', async () => {
    await book(court.id, '10:00', '11:30');

    await expect(book(otherCourt.id, '10:00', '11:30')).resolves.toBeDefined();
  });

  it('ignores cancelled bookings', async () => {
    await book(court.id, '10:00', '11:30', { status: 'CANCELLED' });

    await expect(book(court.id, '10:00', '11:30')).resolves.toBeDefined();
  });

  it('rejects a booking that ends before it starts', async () => {
    await expect(book(court.id, '12:00', '11:00')).rejects.toThrow(
      /bookings_end_after_start/,
    );
  });

  it('rejects a booking with neither a player nor a guest', async () => {
    await expect(
      book(court.id, '10:00', '11:00', { userId: null }),
    ).rejects.toThrow(/bookings_player_or_guest/);
  });

  it('accepts a guest booking made by staff', async () => {
    await expect(
      book(court.id, '10:00', '11:00', {
        userId: null,
        guestName: 'Walk-in guest',
        guestPhone: '0611111111',
      }),
    ).resolves.toBeDefined();
  });
});
