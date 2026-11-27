import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { bookingDetailsController } from './bookingDetails.controller.js';

const router = Router();

// Details of a booking (SDD 5.1): its player, or staff. Mounted after the
// "My bookings" router in app.js, so that GET /bookings/me is matched first.
router.get('/bookings/:id', authenticate, bookingDetailsController.get);

export default router;
