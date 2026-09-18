import { Prisma, VehicleStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import {
  CreateVehicleInput,
  UpdateVehicleInput,
} from '../validation/schemas';

interface VehicleFilters {
  status?: VehicleStatus;
  type?: string;
  region?: string;
  search?: string;
}

export const VehicleService = {
  async list(filters: VehicleFilters) {
    const where: Prisma.VehicleWhereInput = { isActive: true };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = { equals: filters.type, mode: 'insensitive' };
    if (filters.region) where.region = { equals: filters.region, mode: 'insensitive' };
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { registrationNo: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return prisma.vehicle.findMany({
      where,
      include: {
        trips: {
          where: { status: 'DISPATCHED' },
          include: { driver: true },
        },
        maintenanceLogs: {
          orderBy: { openedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: string) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw AppError.notFound('Vehicle not found');
    return vehicle;
  },

  /**
   * Dispatch-eligible pool (spec rule 2 & VehicleService responsibility):
   * active, AVAILABLE vehicles only — IN_SHOP / RETIRED / ON_TRIP excluded.
   */
  async listAvailableForDispatch() {
    return prisma.vehicle.findMany({
      where: { isActive: true, status: 'AVAILABLE' },
      orderBy: { name: 'asc' },
    });
  },

  async create(input: CreateVehicleInput) {
    return prisma.vehicle.create({
      data: {
        registrationNo: input.registrationNo,
        name: input.name,
        type: input.type,
        region: input.region,
        maxLoadCapacity: input.maxLoadCapacity,
        odometer: input.odometer ?? 0,
        acquisitionCost: input.acquisitionCost,
      },
    });
  },

  async update(id: string, input: UpdateVehicleInput) {
    const vehicle = await this.getById(id);

    // Rule 4: retirement is terminal — a RETIRED vehicle can never become AVAILABLE again.
    if (
      vehicle.status === 'RETIRED' &&
      input.status &&
      input.status !== 'RETIRED'
    ) {
      throw AppError.unprocessable(
        'A retired vehicle cannot be reactivated — retirement is terminal.',
      );
    }

    return prisma.vehicle.update({ where: { id }, data: input });
  },

  /**
   * Retire (preferred over delete). Rule 4: terminal. A vehicle that is ON_TRIP
   * must finish/cancel its trip first (avoids orphaning an in-progress dispatch).
   */
  async retire(id: string) {
    const vehicle = await this.getById(id);
    if (vehicle.status === 'RETIRED') {
      throw AppError.unprocessable('Vehicle is already retired.');
    }
    if (vehicle.status === 'ON_TRIP') {
      throw AppError.unprocessable(
        'Cannot retire a vehicle that is currently on a trip. Complete or cancel the trip first.',
      );
    }
    return prisma.vehicle.update({
      where: { id },
      data: { status: 'RETIRED' },
    });
  },
};
