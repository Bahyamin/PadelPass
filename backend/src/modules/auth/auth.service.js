import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from '../../utils/errors.js';
import { usersRepository } from '../users/users.repository.js';
import { authRepository } from './auth.repository.js';

// bcrypt cost from the SDD, section 8.
const BCRYPT_COST = 12;

// Compared when the email is unknown, so that a wrong email takes as long as a
// wrong password and the response time does not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

const INVALID_CREDENTIALS = 'Invalid email or password';
const ACCOUNT_LOCKED = `Too many failed attempts, try again in ${config.lockMinutes} minutes`;

export const authService = {
  // Registration (FR-01, NFR-07, NFR-10).
  async register({ firstName, lastName, email, password, phone }) {
    try {
      const user = await usersRepository.create({
        firstName,
        lastName,
        email,
        phone,
        passwordHash: await bcrypt.hash(password, BCRYPT_COST),
        // GDPR: the date the player accepted the terms, set by the server.
        consentAt: new Date(),
        // role PLAYER and isVerified false come from the schema defaults.
      });
      return toPublicUser(user);
    } catch (err) {
      // P2002 = unique constraint violation, here on users.email.
      if (err.code === 'P2002') {
        throw new ConflictError(
          'EMAIL_ALREADY_USED',
          'An account already exists with this email',
        );
      }
      throw err;
    }
  },

  // Login (FR-03, RULE-11). Returns the user and a signed JWT.
  async login({ email, password }, now = new Date()) {
    const attempt = await authRepository.findAttempt(email);
    if (attempt?.lockedUntil && attempt.lockedUntil > now) {
      throw new AppError(429, 'ACCOUNT_LOCKED', ACCOUNT_LOCKED);
    }

    const user = await usersRepository.findByEmail(email);
    const passwordOk = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    if (!user || !user.isActive || !passwordOk) {
      await recordFailure(email, attempt, now);
      throw new UnauthorizedError(INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
    }

    await authRepository.clearAttempts(email);

    // The password is right: only now can we say the email is not verified.
    if (!user.isVerified) {
      throw new ForbiddenError(
        'Please verify your email address before logging in',
        'EMAIL_NOT_VERIFIED',
      );
    }

    const token = jwt.sign({ role: user.role }, config.jwtSecret, {
      subject: String(user.id),
      expiresIn: config.jwtExpiresInSeconds,
    });
    return { user: toPublicUser(user), token };
  },
};

// The same counter is used for real and unknown emails. After the 5th failure
// in a row the email is locked for 15 minutes, and the counter starts again.
async function recordFailure(email, attempt, now) {
  const failedCount = (attempt?.failedCount ?? 0) + 1;
  if (failedCount >= config.maxFailedLogins) {
    await authRepository.saveAttempt(email, {
      failedCount: 0,
      lockedUntil: new Date(now.getTime() + config.lockMinutes * 60 * 1000),
    });
  } else {
    await authRepository.saveAttempt(email, { failedCount, lockedUntil: null });
  }
}

// Never send the password hash or internal fields to the client.
export function toPublicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
  };
}
