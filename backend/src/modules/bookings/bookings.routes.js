import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { validate } from '../../middlewares/validate.js';
import { bookingsController } from './bookings.controller.js';
import { slotSchema } from './bookings.schemas.js';

const router = Router();

// Player routes (SDD 5.1): a valid login is required.
router.get('/pricing/quote', authenticate, bookingsController.quote); // FR-10
router.post(
  '/bookings',
  authenticate,
  validate(slotSchema),
  bookingsController.create,
); // FR-09, FR-13

export default router;
