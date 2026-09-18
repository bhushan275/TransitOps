export type Role = 'FLEET_MANAGER' | 'DRIVER' | 'SAFETY_OFFICER' | 'FINANCIAL_ANALYST';
export type VehicleStatus = 'AVAILABLE' | 'ON_TRIP' | 'IN_SHOP' | 'RETIRED';
export type DriverStatus = 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY' | 'SUSPENDED';
export type TripStatus = 'DRAFT' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED';
export type ExpenseType = 'TOLL' | 'MAINTENANCE' | 'OTHER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  driverId: string | null;
}

export interface Vehicle {
  id: string;
  registrationNo: string;
  name: string;
  type: string;
  region: string;
  maxLoadCapacity: number;
  odometer: number;
  acquisitionCost: number;
  status: VehicleStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  licenseCategory: string;
  licenseExpiryDate: string;
  contactNumber: string;
  email: string | null;
  address: string | null;
  safetyScore: number;
  status: DriverStatus;
  isActive: boolean;
  trips?: (Trip & { vehicle: Vehicle })[];
  createdAt: string;
  updatedAt: string;
}

export interface TripRef {
  id: string;
  name?: string;
  registrationNo?: string;
  tripNumber?: string;
  licenseNumber?: string;
  status?: string;
  safetyScore?: number;
}

export interface TripSafetyReview {
  id: string;
  tripId: string;
  driverId: string;
  reviewerId: string;
  rating: number;
  remarks: string | null;
  reviewedAt: string;
}

export interface Trip {
  id: string;
  tripNumber: string;
  source: string;
  destination: string;
  vehicleId: string;
  driverId: string;
  vehicle: TripRef;
  driver: TripRef;
  cargoWeight: number;
  plannedDistance: number;
  actualDistance: number | null;
  fuelConsumed: number | null;
  revenue: number;
  status: TripStatus;
  dispatchedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  safetyReview?: TripSafetyReview | null;
  createdAt: string;
}

export interface MaintenanceLog {
  id: string;
  vehicleId: string;
  vehicle: { id: string; name: string; registrationNo: string; status?: string; region?: string };
  description: string;
  cost: number;
  isActive: boolean;
  openedAt: string;
  closedAt: string | null;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  vehicle?: { id: string; name: string; registrationNo: string };
  tripId: string | null;
  trip: { id: string; tripNumber: string; driver?: { id: string; name: string } } | null;
  liters: number;
  cost: number;
  date: string;
}

export interface Expense {
  id: string;
  vehicleId: string;
  vehicle?: { id: string; name: string; registrationNo: string };
  driverId?: string | null;
  driver?: { id: string; name: string } | null;
  type: ExpenseType;
  amount: number;
  date: string;
  notes: string | null;
}

export interface DashboardData {
  kpis: {
    activeVehicles: number;
    availableVehicles: number;
    vehiclesInMaintenance: number;
    activeTrips: number;
    pendingTrips: number;
    driversOnDuty: number;
    fleetUtilizationPct: number;
    todaysFuelLiters: number;
  };
  recentTrips: Array<
    Pick<Trip, 'id' | 'tripNumber' | 'source' | 'destination' | 'status' | 'createdAt'> & {
      vehicle: { id: string; name: string; registrationNo: string };
      driver: { id: string; name: string };
    }
  >;
  vehiclesInMaintenance: MaintenanceLog[];
  expiringLicenses: Array<{
    id: string;
    name: string;
    licenseNumber: string;
    licenseCategory: string;
    licenseExpiryDate: string;
    status: DriverStatus;
    expired: boolean;
    daysUntilExpiry: number;
  }>;
  todaysExpenses: {
    total: number;
    breakdown: Record<ExpenseType, number>;
  };
}

/* ---------- Role-specific dashboards ---------- */

export interface DriverDashboardData {
  role: 'DRIVER';
  profile: {
    id: string;
    name: string;
    licenseNumber: string;
    licenseCategory: string;
    licenseExpiryDate: string;
    contactNumber: string;
    safetyScore: number;
    status: DriverStatus;
  };
  kpis: {
    totalTrips: number;
    completedTrips: number;
    draftTrips: number;
    onTrip: number;
    totalDistance: number;
    safetyScore: number;
    licenseDaysLeft: number;
    licenseExpired: boolean;
  };
  activeTrip:
    | (Trip & { vehicle: { id: string; name: string; registrationNo: string; type: string } })
    | null;
  recentTrips: Array<
    Trip & { vehicle: { id: string; name: string; registrationNo: string; type: string } }
  >;
  todaysFuel: { liters: number; cost: number };
}

export interface SafetyDashboardData {
  role: 'SAFETY_OFFICER';
  kpis: {
    activeDrivers: number;
    driversOnDuty: number;
    suspendedDrivers: number;
    expiredLicenses: number;
    expiringSoon: number;
    avgSafetyScore: number;
    pendingReviews: number;
  };
  expiringLicenses: DashboardData['expiringLicenses'];
  pendingReviewTrips: Array<
    Trip & {
      vehicle: { id: string; name: string; registrationNo: string };
      driver: { id: string; name: string; safetyScore: number };
    }
  >;
  lowSafetyDrivers: Array<{
    id: string;
    name: string;
    licenseNumber: string;
    safetyScore: number;
    status: DriverStatus;
  }>;
  recentReviews: Array<{
    id: string;
    rating: number;
    remarks: string | null;
    reviewedAt: string;
    driver: { id: string; name: string };
    trip: { id: string; tripNumber: string; source: string; destination: string };
  }>;
}

export interface FinanceDashboardData {
  role: 'FINANCIAL_ANALYST';
  kpis: {
    todaysExpensesTotal: number;
    monthExpenses: number;
    monthFuelCost: number;
    monthMaintenanceCost: number;
    monthOperationalCost: number;
    monthRevenue: number;
  };
  todaysExpenses: { total: number; breakdown: Record<ExpenseType, number> };
  monthExpenseBreakdown: Record<ExpenseType, number>;
  costPerVehicle: Array<{
    id: string;
    name: string;
    registrationNo: string;
    fuelCost: number;
    expenseCost: number;
    maintenanceCost: number;
    total: number;
  }>;
  recentExpenses: Expense[];
}

export interface ReportData {
  range: { from: string | null; to: string | null; vehicleId: string | null };
  fuelEfficiency: Array<{
    vehicleId: string;
    name: string;
    registrationNo: string;
    totalActualDistance: number;
    totalFuelConsumed: number;
    fuelEfficiency: number;
  }>;
  fleetUtilization: { onTrip: number; activeFleet: number; pct: number };
  operationalCost: Array<{
    vehicleId: string;
    name: string;
    registrationNo: string;
    fuelCost: number;
    maintenanceCost: number;
    expenseCost: number;
    operationalCost: number;
  }>;
  roi: Array<{
    vehicleId: string;
    name: string;
    registrationNo: string;
    revenue: number;
    acquisitionCost: number;
    roi: number;
  }>;
  perVehicle: Array<{
    vehicleId: string;
    name: string;
    registrationNo: string;
    region: string;
    acquisitionCost: number;
    totalActualDistance: number;
    totalFuelConsumed: number;
    fuelEfficiency: number;
    fuelCost: number;
    maintenanceCost: number;
    expenseCost: number;
    operationalCost: number;
    revenue: number;
    roi: number;
  }>;
}
