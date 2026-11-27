import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { validate } from '../../middlewares/validate.js';
import { bookingsController } from './bookings.controller.js';
import { bookingSchema, equipmentChangeSchema } from './bookings.schemas.js';

const router = Router();

// Player routes (SDD 5.1): a valid login is required.
router.get('/pricing/quote', authenticate, bookingsController.quote); // FR-10
router.post(
  '/bookings',
  authenticate,
  validate(bookingSchema),
  bookingsController.create,
); // FR-09, FR-13, FR-18

// Equipment of a booking, until 2 hours before its start (FR-18, FR-19).
// Owner or staff; anyone else gets 404.
router.get(
  '/bookings/:id/equipment',
  authenticate,
  bookingsController.getEquipment,
);
router.put(
  '/bookings/:id/equipment',
  authenticate,
  validate(equipmentChangeSchema),
  bookingsController.changeEquipment,
);

export default router;
