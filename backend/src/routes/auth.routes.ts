import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema } from '../validation/schemas';

const router = Router();

router.post('/login', validate({ body: loginSchema }), asyncHandler(AuthController.login));
// Account creation is an admin action — only Fleet Managers may register users.
router.post(
  '/register',
  authenticate,
  requireRole('FLEET_MANAGER'),
  validate({ body: registerSchema }),
  asyncHandler(AuthController.register),
);
router.get('/me', authenticate, asyncHandler(AuthController.me));

export default router;
