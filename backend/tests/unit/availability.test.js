import { describe, it, expect } from 'vitest';
import { buildAvailability } from '../../src/modules/courts/availability.js';
import { clubTime } from '../../src/utils/time.js';

const DAY = '2026-11-20'; // a Friday, Paris is UTC+1
const at = (time) => clubTime(DAY, time);
const courts = [
  { id: 1, name: 'Court 1', type: 'INDOOR' },
  { id: 2, name: 'Court 2', type: 'INDOOR' },
];
const openingHours = { openTime: '08:00', closeTime: '10:00' };

const statuses = (grid, courtId) =>
  grid.courts.find((c) => c.id === courtId).slots.map((s) => s.status);

describe('buildAvailability', () => {
  it('lists every 30-minute slot between opening and closing time', () => {
    const grid = buildAvailability({
      day: DAY,
      openingHours,
      courts,
      bookings: [],
      closures: [],
      now: at('07:00'),
    });

    expect(grid.slots).toEqual(['08:00', '08:30', '09:00', '09:30']);
    expect(statuses(grid, 1)).toEqual(['FREE', 'FREE', 'FREE', 'FREE']);
  });

  it('marks booked slots on the right court only', () => {
    const grid = buildAvailability({
      day: DAY,
      openingHours,
      courts,
      bookings: [{ courtId: 1, startTime: at('08:30'), endTime: at('09:30') }],
      closures: [],
      now: at('07:00'),
    });

    expect(statuses(grid, 1)).toEqual(['FREE', 'BOOKED', 'BOOKED', 'FREE']);
    expect(statuses(grid, 2)).toEqual(['FREE', 'FREE', 'FREE', 'FREE']);
  });

  it('marks closed slots, even if a booking exists', () => {
    const grid = buildAvailability({
      day: DAY,
      openingHours,
      courts,
      bookings: [{ courtId: 2, startTime: at('09:00'), endTime: at('10:00') }],
      closures: [{ courtId: 2, startTime: at('08:00'), endTime: at('10:00') }],
      now: at('07:00'),
    });

    expect(statuses(grid, 2)).toEqual(['CLOSED', 'CLOSED', 'CLOSED', 'CLOSED']);
  });

  it('marks slots that already started as past', () => {
    const grid = buildAvailability({
      day: DAY,
      openingHours,
      courts,
      bookings: [],
      closures: [],
      now: at('08:45'),
    });

    expect(statuses(grid, 1)).toEqual(['PAST', 'PAST', 'FREE', 'FREE']);
  });

  it('returns no slot on a day without opening hours', () => {
    const grid = buildAvailability({
      day: DAY,
      openingHours: null,
      courts,
      bookings: [],
      closures: [],
      now: at('07:00'),
    });

    expect(grid.slots).toEqual([]);
    expect(grid.courts[0].slots).toEqual([]);
  });
});
