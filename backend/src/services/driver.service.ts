import { DriverStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { startOfToday } from './eligibility';
import { CreateDriverInput, UpdateDriverInput } from '../validation/schemas';

interface DriverFilters {
  status?: DriverStatus;
  search?: string;
}

function normalizeEmail(email?: string): string | null {
  if (!email || email.trim() === '') return null;
  return email.trim();
}

export const DriverService = {
  async list(filters: DriverFilters) {
    const where: Prisma.DriverWhereInput = { isActive: true };
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { licenseNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return prisma.driver.findMany({
      where,
      include: {
        trips: {
          where: { status: 'DISPATCHED' },
          include: { vehicle: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: string) {
    const driver = await prisma.driver.findUnique({ where: { id } });
    if (!driver) throw AppError.notFound('Driver not found');
    return driver;
  },

  /**
   * Dispatch-eligible pool: active AVAILABLE drivers whose license has not
   * expired. Excludes SUSPENDED / OFF_DUTY / ON_TRIP and expired licenses
   * (spec rules 6–9).
   */
  async listAvailableForDispatch() {
    return prisma.driver.findMany({
      where: {
        isActive: true,
        status: 'AVAILABLE',
        licenseExpiryDate: { gte: startOfToday() },
        userAccount: { isNot: null },
      },
      orderBy: { name: 'asc' },
    });
  },

  async create(input: CreateDriverInput) {
    return prisma.driver.create({
      data: {
        name: input.name,
        licenseNumber: input.licenseNumber,
        licenseCategory: input.licenseCategory,
        licenseExpiryDate: input.licenseExpiryDate,
        contactNumber: input.contactNumber,
        email: normalizeEmail(input.email),
        address: input.address ?? null,
        safetyScore: input.safetyScore ?? 100,
      },
    });
  },

  async update(id: string, input: UpdateDriverInput) {
    await this.getById(id);
    const data: Prisma.DriverUpdateInput = { ...input };
    if (input.email !== undefined) data.email = normalizeEmail(input.email);
    return prisma.driver.update({ where: { id }, data });
  },

  /** Suspend a driver (spec rule 7 — suspended drivers cannot be dispatched). */
  async suspend(id: string) {
    const driver = await this.getById(id);
    if (driver.status === 'ON_TRIP') {
      throw AppError.unprocessable(
        'Cannot suspend a driver who is currently on a trip. Complete or cancel the trip first.',
      );
    }
    return prisma.driver.update({ where: { id }, data: { status: 'SUSPENDED' } });
  },

  /** Soft-delete a driver (sets isActive: false) and deactivates any associated user account. */
  async delete(id: string) {
    const driver = await this.getById(id);
    if (driver.status === 'ON_TRIP') {
      throw AppError.unprocessable(
        'Cannot delete a driver who is currently on a trip. Complete or cancel the trip first.',
      );
    }
    return prisma.$transaction(async (tx) => {
      // Soft-delete the driver record
      const deletedDriver = await tx.driver.update({
        where: { id },
        data: { isActive: false },
      });

      // Soft-delete linked User account if one exists
      await tx.user.updateMany({
        where: { driverId: id, isActive: true },
        data: { isActive: false },
      });

      return deletedDriver;
    });
  },

  async getAssignedVehicleId(driverId: string | null): Promise<string | null> {
    if (!driverId) return null;
    const activeTrip = await prisma.trip.findFirst({
      where: {
        driverId,
        status: 'DISPATCHED',
      },
      select: { vehicleId: true },
    });
    return activeTrip?.vehicleId || null;
  },
};
