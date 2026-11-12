import express from 'express';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import healthRoutes from './modules/health/health.routes.js';

const app = express();

app.use(express.json());

// One router per module (SDD 3.2), all under /api.
app.use('/api/health', healthRoutes);

app.use('/api', notFound);
app.use(errorHandler);

export default app;
