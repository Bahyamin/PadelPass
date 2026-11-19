import { config } from '../../config/index.js';
import { authService } from './auth.service.js';
import { verificationService } from './verification.service.js';

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

  async verifyEmail(req, res) {
    await verificationService.verify(req.body.token);
    res.json({ message: 'Your email address is verified, you can log in' });
  },

  // Always the same answer, whether the email has an account or not.
  async resendVerification(req, res) {
    await verificationService.resend(req.body.email);
    res.status(202).json({
      message:
        'If an account with this email is waiting for verification, a new link has been sent',
    });
  },

  logout(req, res) {
    res.clearCookie(config.authCookieName, cookieOptions);
    res.status(204).end();
  },
};
