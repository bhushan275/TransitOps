import { Role } from './types';

/**
 * Frontend mirror of the server-side RBAC (spec Section 4). The server enforces
 * these regardless — this only hides/disables controls the user can't use.
 */
export const can = {
  manageVehicles: (role?: Role) => role === 'FLEET_MANAGER',
  manageDrivers: (role?: Role) => role === 'SAFETY_OFFICER' || role === 'FLEET_MANAGER',
  operateTrips: (role?: Role) => role === 'FLEET_MANAGER' || role === 'DRIVER',
  manageMaintenance: (role?: Role) => role === 'FLEET_MANAGER',
  logFuel: (role?: Role) =>
    role === 'DRIVER' || role === 'FINANCIAL_ANALYST' || role === 'FLEET_MANAGER',
  manageExpenses: (role?: Role) => role === 'FINANCIAL_ANALYST',
  exportReports: (role?: Role) => role === 'FINANCIAL_ANALYST' || role === 'FLEET_MANAGER',
};

export const ROLE_LABELS: Record<Role, string> = {
  FLEET_MANAGER: 'Fleet Manager',
  DRIVER: 'Driver',
  SAFETY_OFFICER: 'Safety Officer',
  FINANCIAL_ANALYST: 'Financial Analyst',
};

/** Application modules (route keys). */
export type ModuleKey =
  | 'dashboard'
  | 'vehicles'
  | 'drivers'
  | 'trips'
  | 'maintenance'
  | 'fuel-expenses'
  | 'reports';

/**
 * Module-level access matrix — which roles may open each module at all.
 * Mirrors the role matrix in testing-plan.md §2 (resolved against its detailed
 * per-module cases). A role not listed for a module is fully blocked: the nav
 * item is hidden and direct navigation renders a 403 page.
 */
export const MODULE_ACCESS: Record<ModuleKey, Role[]> = {
  dashboard: ['FLEET_MANAGER', 'DRIVER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST'],
  vehicles: ['FLEET_MANAGER', 'DRIVER', 'FINANCIAL_ANALYST'],
  drivers: ['FLEET_MANAGER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST'],
  trips: ['FLEET_MANAGER', 'DRIVER', 'SAFETY_OFFICER'],
  maintenance: ['FLEET_MANAGER', 'FINANCIAL_ANALYST', 'DRIVER'],
  'fuel-expenses': ['DRIVER', 'FINANCIAL_ANALYST', 'FLEET_MANAGER'],
  reports: ['FLEET_MANAGER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST'],
};

export function canAccessModule(module: ModuleKey, role?: Role): boolean {
  if (!role) return false;
  return MODULE_ACCESS[module].includes(role);
}
