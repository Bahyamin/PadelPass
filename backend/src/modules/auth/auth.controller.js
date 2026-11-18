import { config } from '../../config/index.js';
import { authService } from './auth.service.js';

// httpOnly: JavaScript in the page cannot read the token (XSS protection).
// sameSite strict: the browser does not send it from other sites (CSRF).
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: config.isProduction,
  path: '/',
};

// HTTP layer: reads the request, calls the service, sends the response.
export const authController = {
  async register(req, res) {
    const user = await authService.register(req.body);
    res.status(201).json(user);
  },

  async login(req, res) {
    const { user, token } = await authService.login(req.body);
    res.cookie(config.authCookieName, token, {
      ...cookieOptions,
      maxAge: config.jwtExpiresInSeconds * 1000,
    });
    res.json(user);
  },

  logout(req, res) {
    res.clearCookie(config.authCookieName, cookieOptions);
    res.status(204).end();
  },
};
