import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

// Access levels of the SDD (section 5.1).
export const STAFF = ['STAFF', 'EQUIPMENT_MANAGER', 'ADMIN'];
export const EQUIPMENT_MANAGER = ['EQUIPMENT_MANAGER', 'ADMIN'];
export const ADMIN = ['ADMIN'];

// Use after authenticate: router.post('/x', authenticate, requireRole(ADMIN), ...)
// A user whose role is not in the list gets 403 FORBIDDEN (NFR-08, AC-03).
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!allowedRoles.includes(req.user.role))
      return next(new ForbiddenError());
    next();
  };
}
