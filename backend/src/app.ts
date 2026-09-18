import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import vehicleRoutes from './routes/vehicle.routes';
import driverRoutes from './routes/driver.routes';
import tripRoutes from './routes/trip.routes';
import operationsRoutes from './routes/operations.routes';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'transitops-backend', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/vehicles', vehicleRoutes);
  app.use('/api/drivers', driverRoutes);
  app.use('/api/trips', tripRoutes);
  // Maintenance, fuel-logs, expenses, dashboard, reports share the /api root.
  app.use('/api', operationsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
