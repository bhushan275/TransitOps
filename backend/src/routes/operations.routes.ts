import { Router } from 'express';
import {
  DashboardController,
  ExpenseController,
  FuelController,
  MaintenanceController,
  ReportController,
} from '../controllers/misc.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createExpenseSchema,
  createFuelLogSchema,
  createMaintenanceSchema,
  dashboardQuerySchema,
  idParamSchema,
  maintenanceQuerySchema,
  reportQuerySchema,
  vehicleIdParamSchema,
} from '../validation/schemas';

const router = Router();
router.use(authenticate);

/* ---------- Maintenance (Fleet Manager full; others view) ---------- */
router.get(
  '/maintenance',
  validate({ query: maintenanceQuerySchema }),
  asyncHandler(MaintenanceController.list),
);
router.get(
  '/maintenance/:vehicleId',
  validate({ params: vehicleIdParamSchema }),
  asyncHandler(MaintenanceController.listForVehicle),
);
router.post(
  '/maintenance',
  requireRole('FLEET_MANAGER', 'DRIVER'),
  validate({ body: createMaintenanceSchema }),
  asyncHandler(MaintenanceController.open),
);
router.patch(
  '/maintenance/:id/close',
  requireRole('FLEET_MANAGER'),
  validate({ params: idParamSchema }),
  asyncHandler(MaintenanceController.close),
);

/* ---------- Fuel logs (Driver logs fuel; Financial full; others view) ---------- */
router.get(
  '/fuel-logs',
  asyncHandler(FuelController.listAll),
);
router.get(
  '/fuel-logs/:vehicleId',
  validate({ params: vehicleIdParamSchema }),
  asyncHandler(FuelController.listForVehicle),
);
router.post(
  '/fuel-logs',
  requireRole('DRIVER', 'FINANCIAL_ANALYST', 'FLEET_MANAGER'),
  validate({ body: createFuelLogSchema }),
  asyncHandler(FuelController.create),
);

/* ---------- Expenses (Financial full CRUD; others view) ---------- */
router.get(
  '/expenses',
  asyncHandler(ExpenseController.listAll),
);
router.get(
  '/expenses/:vehicleId',
  validate({ params: vehicleIdParamSchema }),
  asyncHandler(ExpenseController.listForVehicle),
);
router.post(
  '/expenses',
  requireRole('FINANCIAL_ANALYST', 'DRIVER'),
  validate({ body: createExpenseSchema }),
  asyncHandler(ExpenseController.create),
);

/* ---------- Dashboard (all authenticated) ---------- */
router.get(
  '/dashboard',
  validate({ query: dashboardQuerySchema }),
  asyncHandler(DashboardController.get),
);

/* ---------- Reports (no Driver access per spec; CSV export for Financial + Fleet Manager) ---------- */
router.get(
  '/reports',
  requireRole('FLEET_MANAGER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST'),
  validate({ query: reportQuerySchema }),
  asyncHandler(ReportController.get),
);
router.get(
  '/reports/export.csv',
  requireRole('FINANCIAL_ANALYST', 'FLEET_MANAGER'),
  validate({ query: reportQuerySchema }),
  asyncHandler(ReportController.exportCsv),
);

export default router;
