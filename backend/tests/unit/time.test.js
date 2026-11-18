import { describe, it, expect } from 'vitest';
import {
  addDays,
  addMinutes,
  clubTime,
  clubToday,
  dayOfWeek,
  isValidDay,
} from '../../src/utils/time.js';

describe('time utils', () => {
  it('converts a club time to UTC, winter (UTC+1) and summer (UTC+2)', () => {
    expect(clubTime('2026-11-20', '18:00').toISOString()).toBe(
      '2026-11-20T17:00:00.000Z',
    );
    expect(clubTime('2026-07-10', '18:00').toISOString()).toBe(
      '2026-07-10T16:00:00.000Z',
    );
  });

  it('gives the club day of an instant', () => {
    // 23:30 UTC on Nov 19 is already Nov 20 in Paris.
    expect(clubToday(new Date('2026-11-19T23:30:00Z'))).toBe('2026-11-20');
  });

  it('validates days', () => {
    expect(isValidDay('2026-11-20')).toBe(true);
    expect(isValidDay('2026-02-30')).toBe(false);
    expect(isValidDay('20/11/2026')).toBe(false);
    expect(isValidDay(undefined)).toBe(false);
  });

  it('computes days and times', () => {
    expect(dayOfWeek('2026-11-20')).toBe(5); // Friday
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addMinutes('22:30', 30)).toBe('23:00');
  });
});
