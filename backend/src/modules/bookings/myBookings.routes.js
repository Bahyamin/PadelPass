import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { myBookingsController } from './myBookings.controller.js';

const router = Router();

// Player route (SDD 5.1): a valid login is required.
router.get('/bookings/me', authenticate, myBookingsController.list); // FR-14

export default router;
