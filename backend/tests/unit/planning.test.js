import { describe, it, expect } from 'vitest';
import {
  buildPlanning,
  planningSlots,
} from '../../src/modules/planning/planning.js';
import { clubTime } from '../../src/utils/time.js';

const DAY = '2026-12-02';
const at = (time) => clubTime(DAY, time);
const dayStart = clubTime(DAY, '00:00');
const dayEnd = clubTime('2026-12-03', '00:00');

const court1 = { id: 1, name: 'Court 1', type: 'INDOOR', isActive: true };
const court2 = { id: 2, name: 'Court 2', type: 'OUTDOOR', isActive: true };

const booking = (id, courtId, start, end, extra = {}) => ({
  id,
  courtId,
  startTime: at(start),
  endTime: at(end),
  status: 'CONFIRMED',
  paymentStatus: 'UNPAID',
  courtPrice: '60.00',
  feesTotal: '0.00',
  user: { firstName: 'Ada', lastName: 'Lovelace', phone: '0612345678' },
  guestName: null,
  guestPhone: null,
  equipment: [],
  ...extra,
});

describe('planningSlots', () => {
  it('lists the 30-minute rows of the opening hours', () => {
    const slots = planningSlots({ openTime: '08:00', closeTime: '10:00' }, []);

    expect(slots).toEqual(['08:00', '08:30', '09:00', '09:30']);
  });

  it('widens the rows to a booking outside the opening hours', () => {
    const slots = planningSlots({ openTime: '09:00', closeTime: '10:00' }, [
      { start: '08:00', end: '09:00' },
      { start: '09:30', end: '11:00' },
    ]);

    expect(slots[0]).toBe('08:00');
    expect(slots.at(-1)).toBe('10:30');
  });

  it('has no row on a closed day without bookings', () => {
    expect(planningSlots(null, [])).toEqual([]);
  });
});

describe('buildPlanning', () => {
  it('puts each booking on its court with the player, equipment and payment', () => {
    const planning = buildPlanning({
      date: DAY,
      hours: { openTime: '08:00', closeTime: '23:00' },
      courts: [court1, court2],
      bookings: [
        booking(2, 1, '18:00', '19:30', {
          paymentStatus: 'PAID',
          equipment: [
            {
              typeId: 1,
              quantity: 2,
              unitPrice: '4.00',
              type: { name: 'Racket' },
            },
          ],
        }),
        booking(1, 1, '10:00', '11:00'),
        booking(3, 2, '12:00', '13:00', {
          user: null,
          guestName: 'John Guest',
          guestPhone: '0699999999',
        }),
      ],
      closures: [],
      dayStart,
      dayEnd,
    });

    expect(planning.date).toBe(DAY);
    expect(planning.slots).toHaveLength(30);
    const [first, second] = planning.courts;
    expect(first.bookings.map((b) => b.id)).toEqual([1, 2]);
    expect(first.bookings[1]).toEqual({
      id: 2,
      start: '18:00',
      end: '19:30',
      duration: 90,
      status: 'CONFIRMED',
      player: 'Ada Lovelace',
      isGuest: false,
      phone: '0612345678',
      equipment: [{ name: 'Racket', quantity: 2 }],
      paymentStatus: 'PAID',
      totalPrice: '68.00',
    });
    expect(second.bookings[0]).toMatchObject({
      player: 'John Guest',
      isGuest: true,
      phone: '0699999999',
    });
  });

  it('cuts a closure of several days to the day shown', () => {
    const planning = buildPlanning({
      date: DAY,
      hours: { openTime: '08:00', closeTime: '23:00' },
      courts: [court1],
      bookings: [],
      closures: [
        {
          courtId: 1,
          startTime: clubTime('2026-12-01', '14:00'),
          endTime: clubTime('2026-12-04', '12:00'),
          reason: 'Resurfacing',
        },
      ],
      dayStart,
      dayEnd,
    });

    expect(planning.courts[0].closures).toEqual([
      { start: '00:00', end: '24:00', reason: 'Resurfacing' },
    ]);
  });
});
