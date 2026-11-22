import cookieParser from 'cookie-parser';
import express from 'express';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import healthRoutes from './modules/health/health.routes.js';
import courtsRoutes from './modules/courts/courts.routes.js';
import equipmentRoutes from './modules/equipment/equipment.routes.js';
import usersRoutes from './modules/users/users.routes.js';

const app = express();

app.use(express.json());
app.use(cookieParser()); // fills req.cookies, used by the authenticate middleware

// One router per module (SDD 3.2), all under /api.
app.use('/api', courtsRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

app.use('/api', notFound);
app.use(errorHandler);

export default app;
