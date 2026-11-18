import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { authController } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

const router = Router();

// Public routes (SDD 5.1)
router.post('/register', validate(registerSchema), authController.register); // FR-01
router.post('/login', validate(loginSchema), authController.login); // FR-03
// Logout only clears the cookie, so it also works with an expired session.
router.post('/logout', authController.logout); // FR-03

export default router;
