import { UnauthorizedError } from '../../utils/errors.js';
import { toPublicUser } from '../auth/auth.service.js';
import { usersRepository } from './users.repository.js';

// The profile of the logged-in user: the public user and the phone (FR-05).
const toProfile = (user) => ({ ...toPublicUser(user), phone: user.phone });

async function findActiveUser(userId) {
  const user = await usersRepository.findById(userId);
  if (!user || !user.isActive) throw new UnauthorizedError();
  return user;
}

export const usersService = {
  // The logged-in user (FR-05). A deleted or deactivated account loses access
  // even if its token is still valid.
  async getMe(userId) {
    return toProfile(await findActiveUser(userId));
  },

  // Changes the first name, last name or phone of the logged-in user (FR-05).
  // Only these fields are copied: the email and the role never change here.
  async updateMe(userId, { firstName, lastName, phone }) {
    await findActiveUser(userId);
    const user = await usersRepository.update(userId, {
      firstName,
      lastName,
      phone,
    });
    return toProfile(user);
  },
};
