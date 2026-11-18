import { describe, it, expect, vi } from 'vitest';
import {
  ADMIN,
  STAFF,
  requireRole,
} from '../../src/middlewares/requireRole.js';

// Calls the middleware with a fake request and returns what it passed to next().
const run = (allowed, user) => {
  const next = vi.fn();
  requireRole(allowed)({ user }, {}, next);
  return next.mock.calls[0][0];
};

describe('requireRole', () => {
  it('lets an allowed role through', () => {
    expect(run(ADMIN, { id: 1, role: 'ADMIN' })).toBeUndefined();
    expect(run(STAFF, { id: 2, role: 'EQUIPMENT_MANAGER' })).toBeUndefined();
  });

  it('answers 403 to a role that is not allowed', () => {
    const error = run(ADMIN, { id: 3, role: 'PLAYER' });

    expect(error.status).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('answers 401 when nobody is logged in', () => {
    expect(run(STAFF, undefined).status).toBe(401);
  });
});
