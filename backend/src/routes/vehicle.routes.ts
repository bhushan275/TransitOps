import { Router } from 'express';
import { VehicleController } from '../controllers/vehicle.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createVehicleSchema,
  idParamSchema,
  updateVehicleSchema,
  vehicleQuerySchema,
} from '../validation/schemas';

const router = Router();
router.use(authenticate);

// View — all authenticated roles.
router.get('/', validate({ query: vehicleQuerySchema }), asyncHandler(VehicleController.list));
router.get('/available', asyncHandler(VehicleController.available));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(VehicleController.getById));

// Full CRUD — Fleet Manager only.
router.post(
  '/',
  requireRole('FLEET_MANAGER'),
  validate({ body: createVehicleSchema }),
  asyncHandler(VehicleController.create),
);
router.patch(
  '/:id',
  requireRole('FLEET_MANAGER'),
  validate({ params: idParamSchema, body: updateVehicleSchema }),
  asyncHandler(VehicleController.update),
);
router.patch(
  '/:id/retire',
  requireRole('FLEET_MANAGER'),
  validate({ params: idParamSchema }),
  asyncHandler(VehicleController.retire),
);

export default router;
