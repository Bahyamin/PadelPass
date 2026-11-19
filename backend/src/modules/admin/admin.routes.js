import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { ADMIN, requireRole } from '../../middlewares/requireRole.js';
import { validate } from '../../middlewares/validate.js';
import { adminController } from './admin.controller.js';
import {
  openingHoursSchema,
  pricingRulePatchSchema,
  pricingRuleSchema,
  settingsSchema,
} from './admin.schemas.js';

const router = Router();

// Every route of this router is for administrators only (SDD 5.1, FR-25).
router.use(authenticate, requireRole(ADMIN));

router.get('/opening-hours', adminController.getOpeningHours);
router.put(
  '/opening-hours',
  validate(openingHoursSchema),
  adminController.replaceOpeningHours,
);

router.get('/pricing-rules', adminController.listPricingRules);
router.post(
  '/pricing-rules',
  validate(pricingRuleSchema),
  adminController.createPricingRule,
);
router.patch(
  '/pricing-rules/:id',
  validate(pricingRulePatchSchema),
  adminController.updatePricingRule,
);
router.delete('/pricing-rules/:id', adminController.deletePricingRule);

router.get('/settings', adminController.getSettings);
router.put(
  '/settings',
  validate(settingsSchema),
  adminController.updateSettings,
);

export default router;
