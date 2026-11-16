import bcrypt from 'bcryptjs';
import { ConflictError } from '../../utils/errors.js';
import { usersRepository } from '../users/users.repository.js';

// bcrypt cost from the SDD, section 8.
const BCRYPT_COST = 12;

// Business rules of the registration (FR-01, NFR-07, NFR-10).
export const authService = {
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
};

// Never send the password hash or internal fields to the client.
function toPublicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
  };
}
