import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { authController } from './auth.controller.js';
import { registerSchema } from './auth.schemas.js';

const router = Router();

// POST /api/auth/register - public (SDD 5.1, FR-01)
router.post('/register', validate(registerSchema), authController.register);

export default router;
