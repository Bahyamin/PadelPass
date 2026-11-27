import { usersService } from './users.service.js';

export const usersController = {
  async getMe(req, res) {
    res.json(await usersService.getMe(req.user.id));
  },

  async updateMe(req, res) {
    res.json(await usersService.updateMe(req.user.id, req.body));
  },
};
