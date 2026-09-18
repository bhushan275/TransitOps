import { Router } from 'express';
import { DriverController } from '../controllers/driver.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createDriverSchema,
  driverQuerySchema,
  idParamSchema,
  updateDriverSchema,
} from '../validation/schemas';

const router = Router();
router.use(authenticate);

// View — all authenticated roles.
router.get('/', validate({ query: driverQuerySchema }), asyncHandler(DriverController.list));
router.get('/available', asyncHandler(DriverController.available));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(DriverController.getById));

// Full CRUD (license, safety score, status) — Safety Officer & Fleet Manager.
router.post(
  '/',
  requireRole('SAFETY_OFFICER', 'FLEET_MANAGER'),
  validate({ body: createDriverSchema }),
  asyncHandler(DriverController.create),
);
router.patch(
  '/:id',
  requireRole('SAFETY_OFFICER', 'FLEET_MANAGER'),
  validate({ params: idParamSchema, body: updateDriverSchema }),
  asyncHandler(DriverController.update),
);
router.patch(
  '/:id/suspend',
  requireRole('SAFETY_OFFICER', 'FLEET_MANAGER'),
  validate({ params: idParamSchema }),
  asyncHandler(DriverController.suspend),
);
router.delete(
  '/:id',
  requireRole('SAFETY_OFFICER', 'FLEET_MANAGER'),
  validate({ params: idParamSchema }),
  asyncHandler(DriverController.delete),
);

export default router;
