import { authService } from './auth.service.js';

// HTTP layer: reads the request, calls the service, sends the response.
export const authController = {
  async register(req, res) {
    const user = await authService.register(req.body);
    res.status(201).json(user);
  },
};
