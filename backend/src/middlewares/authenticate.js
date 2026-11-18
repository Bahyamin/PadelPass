import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError } from '../utils/errors.js';

// Protects a route: reads the JWT from the httpOnly cookie and puts
// { id, role } in req.user. Without a valid token: 401 UNAUTHORIZED.
export function authenticate(req, res, next) {
  const token = req.cookies?.[config.authCookieName];
  if (!token) return next(new UnauthorizedError());

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  } catch {
    next(
      new UnauthorizedError('Your session has expired, please log in again'),
    );
  }
}
