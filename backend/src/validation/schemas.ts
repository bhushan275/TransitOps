import { z } from 'zod';

/* ---------- shared ---------- */
const nonNegative = z.number({ invalid_type_error: 'Must be a number' }).min(0, 'Must be >= 0');
const positive = z.number({ invalid_type_error: 'Must be a number' }).gt(0, 'Must be > 0');
const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`);

/* ---------- auth ---------- */
export const loginSchema = z.object({
  email: z.string().trim().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: nonEmpty('Name'),
  email: z.string().trim().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['FLEET_MANAGER', 'DRIVER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST']),
  driverId: z.string().uuid().optional(),
});

/* ---------- vehicle ---------- */
export const createVehicleSchema = z.object({
  registrationNo: nonEmpty('Registration number'),
  name: nonEmpty('Name'),
  type: nonEmpty('Type'),
  region: nonEmpty('Region'),
  maxLoadCapacity: positive,
  odometer: nonNegative.optional().default(0),
  acquisitionCost: nonNegative,
});

export const updateVehicleSchema = z
  .object({
    registrationNo: nonEmpty('Registration number'),
    name: nonEmpty('Name'),
    type: nonEmpty('Type'),
    region: nonEmpty('Region'),
    maxLoadCapacity: positive,
    odometer: nonNegative,
    acquisitionCost: nonNegative,
    status: z.enum(['AVAILABLE', 'ON_TRIP', 'IN_SHOP', 'RETIRED']),
    isActive: z.boolean(),
  })
  .partial();

export const vehicleQuerySchema = z.object({
  status: z.enum(['AVAILABLE', 'ON_TRIP', 'IN_SHOP', 'RETIRED']).optional(),
  type: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

/* ---------- driver ---------- */
export const createDriverSchema = z.object({
  name: nonEmpty('Name'),
  licenseNumber: nonEmpty('License number'),
  licenseCategory: nonEmpty('License category'),
  licenseExpiryDate: z.coerce.date({ invalid_type_error: 'Valid expiry date required' }),
  contactNumber: nonEmpty('Contact number'),
  email: z.string().trim().email('Valid email required').optional().or(z.literal('')),
  address: z.string().trim().optional(),
  safetyScore: z.number().min(0).max(100).optional(),
});

export const updateDriverSchema = z
  .object({
    name: nonEmpty('Name'),
    licenseNumber: nonEmpty('License number'),
    licenseCategory: nonEmpty('License category'),
    licenseExpiryDate: z.coerce.date(),
    contactNumber: nonEmpty('Contact number'),
    email: z.string().trim().email('Valid email required').optional().or(z.literal('')),
    address: z.string().trim().optional(),
    safetyScore: z.number().min(0).max(100),
    status: z.enum(['AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'SUSPENDED']),
    isActive: z.boolean(),
  })
  .partial();

export const driverQuerySchema = z.object({
  status: z.enum(['AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'SUSPENDED']).optional(),
  search: z.string().trim().min(1).optional(),
});

/* ---------- trip ---------- */
export const createTripSchema = z.object({
  source: nonEmpty('Source'),
  destination: nonEmpty('Destination'),
  vehicleId: z.string().uuid('Valid vehicle required'),
  driverId: z.string().uuid('Valid driver required'),
  cargoWeight: positive,
  plannedDistance: positive,
  revenue: nonNegative.optional().default(0),
});

export const completeTripSchema = z.object({
  actualDistance: positive,
  fuelConsumed: positive,
});

export const tripQuerySchema = z.object({
  status: z.enum(['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED']).optional(),
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
});

/* ---------- maintenance ---------- */
export const createMaintenanceSchema = z.object({
  vehicleId: z.string().uuid('Valid vehicle required'),
  description: nonEmpty('Description'),
  cost: nonNegative,
});

export const maintenanceQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

/* ---------- fuel ---------- */
export const createFuelLogSchema = z.object({
  vehicleId: z.string().uuid('Valid vehicle required'),
  tripId: z.string().uuid().optional(),
  liters: nonNegative,
  cost: nonNegative,
  date: z.coerce.date().optional(),
});

/* ---------- expense ---------- */
export const createExpenseSchema = z.object({
  vehicleId: z.string().uuid('Valid vehicle required'),
  driverId: z.string().uuid().optional(),
  type: z.enum(['TOLL', 'MAINTENANCE', 'OTHER']),
  amount: nonNegative,
  date: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});

/* ---------- dashboard & reports ---------- */
export const dashboardQuerySchema = z.object({
  type: z.string().trim().min(1).optional(),
  status: z.enum(['AVAILABLE', 'ON_TRIP', 'IN_SHOP', 'RETIRED']).optional(),
  region: z.string().trim().min(1).optional(),
});

export const reportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  vehicleId: z.string().uuid().optional(),
});

/* ---------- params ---------- */
export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });
export const vehicleIdParamSchema = z.object({ vehicleId: z.string().uuid('Invalid vehicle id') });

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type CreateTripInput = z.infer<typeof createTripSchema>;
export type CompleteTripInput = z.infer<typeof completeTripSchema>;
export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
export type CreateFuelLogInput = z.infer<typeof createFuelLogSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/* ---------- safety review ---------- */
export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  remarks: z.string().trim().optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
