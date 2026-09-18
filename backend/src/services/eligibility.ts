import { Driver, Vehicle, User } from '@prisma/client';
import { AppError } from '../utils/AppError';

/**
 * Centralized, reusable business-rule guards (spec Section 6).
 * These are the SINGLE source of truth for eligibility — imported by
 * TripService, MaintenanceService, etc. Never re-implement these checks inline.
 */

/** Start-of-day for "today" comparisons so a license expiring today is still invalid. */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Rule 2 & 4 & 5: A vehicle is dispatch-eligible only if it is active and
 * currently AVAILABLE. RETIRED / IN_SHOP / ON_TRIP / inactive vehicles are excluded.
 */
export function assertVehicleEligibleForDispatch(vehicle: Vehicle): void {
  if (!vehicle.isActive) {
    throw AppError.unprocessable(
      `Vehicle ${vehicle.registrationNo} is deactivated and cannot be assigned to a trip.`,
    );
  }
  if (vehicle.status === 'RETIRED') {
    throw AppError.unprocessable(
      `Vehicle ${vehicle.registrationNo} is retired and cannot be assigned to a trip.`,
    );
  }
  if (vehicle.status === 'IN_SHOP') {
    throw AppError.unprocessable(
      `Vehicle ${vehicle.registrationNo} is in the shop and cannot be assigned to a trip.`,
    );
  }
  if (vehicle.status === 'ON_TRIP') {
    throw AppError.unprocessable(
      `Vehicle ${vehicle.registrationNo} is already on a trip.`,
    );
  }
  if (vehicle.status !== 'AVAILABLE') {
    throw AppError.unprocessable(
      `Vehicle ${vehicle.registrationNo} is not available for dispatch.`,
    );
  }
}

/**
 * Rules 6–9: A driver is dispatch-eligible only if active, license not expired,
 * registered user account linked, and not SUSPENDED / OFF_DUTY / ON_TRIP.
 */
export function assertDriverEligibleForDispatch(
  driver: Driver & { userAccount?: User | null },
): void {
  if (!driver.isActive) {
    throw AppError.unprocessable(`Driver ${driver.name} is deactivated and cannot be assigned.`);
  }
  if (!driver.userAccount) {
    throw AppError.unprocessable(
      `Driver ${driver.name} is not registered with a user account and cannot be assigned.`,
    );
  }
  if (driver.licenseExpiryDate < startOfToday()) {
    throw AppError.unprocessable(
      `Driver ${driver.name}'s license expired on ${driver.licenseExpiryDate
        .toISOString()
        .slice(0, 10)} and cannot be assigned to a trip.`,
    );
  }
  if (driver.status === 'SUSPENDED') {
    throw AppError.unprocessable(`Driver ${driver.name} is suspended and cannot be assigned.`);
  }
  if (driver.status === 'OFF_DUTY') {
    throw AppError.unprocessable(`Driver ${driver.name} is off duty and cannot be dispatched.`);
  }
  if (driver.status === 'ON_TRIP') {
    throw AppError.unprocessable(`Driver ${driver.name} is already on a trip.`);
  }
  if (driver.status !== 'AVAILABLE') {
    throw AppError.unprocessable(`Driver ${driver.name} is not available for dispatch.`);
  }
}

/**
 * Rule 10 & 11: cargo weight in range and source != destination.
 */
export function assertTripPayloadValid(params: {
  cargoWeight: number;
  maxLoadCapacity: number;
  source: string;
  destination: string;
}): void {
  const { cargoWeight, maxLoadCapacity, source, destination } = params;
  if (cargoWeight <= 0) {
    throw AppError.unprocessable('Cargo weight must be greater than 0.');
  }
  if (cargoWeight > maxLoadCapacity) {
    throw AppError.unprocessable(
      `Cargo weight (${cargoWeight}kg) exceeds the vehicle's max load capacity (${maxLoadCapacity}kg).`,
    );
  }
  if (source.trim().toLowerCase() === destination.trim().toLowerCase()) {
    throw AppError.unprocessable('Source and destination cannot be identical.');
  }
}

/**
 * Rule 3: a vehicle cannot enter maintenance while ON_TRIP; must be AVAILABLE.
 * Also blocks RETIRED (nothing to maintain) — retirement is terminal (rule 4).
 */
export function assertVehicleCanEnterMaintenance(vehicle: Vehicle): void {
  if (vehicle.status === 'ON_TRIP') {
    throw AppError.unprocessable(
      `Vehicle ${vehicle.registrationNo} is currently on a trip. Complete or cancel the trip before opening a maintenance log.`,
    );
  }
  if (vehicle.status === 'RETIRED') {
    throw AppError.unprocessable(
      `Vehicle ${vehicle.registrationNo} is retired and cannot enter maintenance.`,
    );
  }
  if (vehicle.status === 'IN_SHOP') {
    throw AppError.unprocessable(
      `Vehicle ${vehicle.registrationNo} is already in the shop.`,
    );
  }
}
