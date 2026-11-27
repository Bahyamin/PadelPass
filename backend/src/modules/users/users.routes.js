import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { validate } from '../../middlewares/validate.js';
import { usersController } from './users.controller.js';
import { profileSchema } from './users.schemas.js';

const router = Router();

// GET /api/users/me - the logged-in user (SDD 5.1, access: Player)
router.get('/me', authenticate, usersController.getMe);

// PATCH /api/users/me - change my first name, last name or phone (FR-05)
router.patch(
  '/me',
  authenticate,
  validate(profileSchema),
  usersController.updateMe,
);

export default router;
