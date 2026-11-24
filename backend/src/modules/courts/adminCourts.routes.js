import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { ADMIN, requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import { adminCourtsController } from './adminCourts.controller.js';
import {
  closureSchema,
  courtPatchSchema,
  courtSchema,
} from './adminCourts.schemas.js';

const router = Router();

// Court management, for administrators only (SDD 5.1, FR-24).
router.use('/courts', authenticate, requireRole(ADMIN));

router.get('/courts', adminCourtsController.list);
router.post('/courts', validate(courtSchema), adminCourtsController.create);
router.patch(
  '/courts/:id',
  validate(courtPatchSchema),
  adminCourtsController.update,
);
router.post(
  '/courts/:id/closures',
  validate(closureSchema),
  adminCourtsController.close,
);

export default router;
