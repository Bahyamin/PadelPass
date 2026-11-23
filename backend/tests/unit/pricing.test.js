import { describe, it, expect } from 'vitest';
import {
  computeCourtPrice,
  formatPrice,
} from '../../src/modules/bookings/pricing.js';

const WEDNESDAY = 3;

// The default rules of a weekday (seed): off-peak 28/h, peak 40/h from 17:00 to 22:00.
const rules = [
  {
    dayOfWeek: WEDNESDAY,
    startTime: '08:00',
    endTime: '17:00',
    pricePerHour: '28',
  },
  {
    dayOfWeek: WEDNESDAY,
    startTime: '17:00',
    endTime: '22:00',
    pricePerHour: '40',
  },
  {
    dayOfWeek: WEDNESDAY,
    startTime: '22:00',
    endTime: '23:00',
    pricePerHour: '28',
  },
];

const price = (start, duration, dayOfWeek = WEDNESDAY, list = rules) =>
  computeCourtPrice({ dayOfWeek, start, duration, rules: list });

describe('computeCourtPrice', () => {
  it('prices Wednesday 18:00-19:30 at 60.00 (3 peak segments of 20.00)', () => {
    expect(price('18:00', 90)).toBe(6000);
    expect(formatPrice(price('18:00', 90))).toBe('60.00');
  });

  it('prices one off-peak hour at 28.00', () => {
    expect(price('10:00', 60)).toBe(2800);
  });

  it('prices each 30-minute segment with its own rule', () => {
    // 16:30-17:00 off-peak (14.00) + 17:00-17:30 peak (20.00)
    expect(price('16:30', 60)).toBe(3400);
    // 21:30-22:00 peak (20.00) + 22:00-23:00 off-peak (2 x 14.00)
    expect(price('21:30', 90)).toBe(4800);
  });

  it('rounds only once, on the total', () => {
    const odd = [{ ...rules[0], pricePerHour: '28.25' }];
    expect(price('10:00', 90, WEDNESDAY, odd)).toBe(4238); // 42.375 -> 42.38
  });

  it('returns null when a segment has no pricing rule', () => {
    expect(price('22:30', 90)).toBeNull(); // 23:00-23:30 has no rule
    expect(price('18:00', 60, 4)).toBeNull(); // no rule on Thursday here
  });
});

describe('formatPrice', () => {
  it('writes cents as a price with two decimals', () => {
    expect(formatPrice(2800)).toBe('28.00');
    expect(formatPrice(4238)).toBe('42.38');
  });
});
