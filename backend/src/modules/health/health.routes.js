import { Router } from 'express';

const router = Router();

// GET /api/health - used by the front end and by monitoring.
router.get('/', (req, res) => {
  res.json({ status: 'OK' });
});

export default router;
