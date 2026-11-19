import { UnauthorizedError } from '../../utils/errors.js';
import { toPublicUser } from '../auth/auth.service.js';
import { usersRepository } from './users.repository.js';

export const usersService = {
  // The logged-in user (FR-05). A deleted or deactivated account loses access
  // even if its token is still valid.
  async getMe(userId) {
    const user = await usersRepository.findById(userId);
    if (!user || !user.isActive) throw new UnauthorizedError();
    return toPublicUser(user);
  },
};
