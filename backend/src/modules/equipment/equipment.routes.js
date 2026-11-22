import { Router } from 'express';
import { equipmentController } from './equipment.controller.js';

const router = Router();

// Public route (SDD 5.1, FR-17): GET /api/equipment/availability?date=&start=&duration=
router.get('/availability', equipmentController.getAvailability);

export default router;
