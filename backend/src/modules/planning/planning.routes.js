import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRole, STAFF } from '../../middlewares/requireRole.js';
import { planningController } from './planning.controller.js';

const router = Router();

// Front desk (SDD 5.1, Staff access): staff, equipment managers and
// administrators. Mounted on /api/staff.
router.get(
  '/planning',
  authenticate,
  requireRole(STAFF),
  planningController.getDay,
); // FR-27

export default router;
