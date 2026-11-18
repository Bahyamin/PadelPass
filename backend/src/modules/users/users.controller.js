import { usersService } from './users.service.js';

export const usersController = {
  async getMe(req, res) {
    res.json(await usersService.getMe(req.user.id));
  },
};
