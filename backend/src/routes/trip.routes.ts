import { Router } from 'express';
import { TripController } from '../controllers/trip.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  completeTripSchema,
  createTripSchema,
  idParamSchema,
  tripQuerySchema,
  createReviewSchema,
} from '../validation/schemas';

const router = Router();
router.use(authenticate);

// View — all authenticated roles.
router.get('/', validate({ query: tripQuerySchema }), asyncHandler(TripController.list));
router.get('/active', asyncHandler(TripController.active));
router.get(
  '/pending-safety-review',
  requireRole('SAFETY_OFFICER'),
  asyncHandler(TripController.pendingSafetyReview),
);
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(TripController.getById));
router.post(
  '/:id/review',
  requireRole('SAFETY_OFFICER'),
  validate({ params: idParamSchema, body: createReviewSchema }),
  asyncHandler(TripController.review),
);

// Lifecycle — Fleet Manager and Driver (drivers are scoped to their own trips
// in the controller).
const canOperateTrips = requireRole('FLEET_MANAGER', 'DRIVER');

router.post(
  '/',
  canOperateTrips,
  validate({ body: createTripSchema }),
  asyncHandler(TripController.create),
);
router.patch(
  '/:id/dispatch',
  canOperateTrips,
  validate({ params: idParamSchema }),
  asyncHandler(TripController.dispatch),
);
router.patch(
  '/:id/complete',
  canOperateTrips,
  validate({ params: idParamSchema, body: completeTripSchema }),
  asyncHandler(TripController.complete),
);
router.patch(
  '/:id/cancel',
  canOperateTrips,
  validate({ params: idParamSchema }),
  asyncHandler(TripController.cancel),
);

export default router;
