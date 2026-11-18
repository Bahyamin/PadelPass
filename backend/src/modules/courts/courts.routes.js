import { Router } from 'express';
import { courtsController } from './courts.controller.js';

const router = Router();

// Public routes (SDD 5.1, FR-08)
router.get('/courts', courtsController.listCourts);
router.get('/availability', courtsController.getAvailability);

export default router;
