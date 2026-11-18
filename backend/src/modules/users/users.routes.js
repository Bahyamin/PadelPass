import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { usersController } from './users.controller.js';

const router = Router();

// GET /api/users/me - the logged-in user (SDD 5.1, access: Player)
router.get('/me', authenticate, usersController.getMe);

export default router;
