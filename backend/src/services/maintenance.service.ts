import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { assertVehicleCanEnterMaintenance } from './eligibility';
import { CreateMaintenanceInput } from '../validation/schemas';

const maintInclude = {
  vehicle: { select: { id: true, name: true, registrationNo: true, status: true } },
};

export const MaintenanceService = {
  async list(isActive?: boolean, vehicleId?: string) {
    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (vehicleId) where.vehicleId = vehicleId;
    return prisma.maintenanceLog.findMany({
      where,
      include: maintInclude,
      orderBy: { openedAt: 'desc' },
    });
  },

  async listForVehicle(vehicleId: string) {
    return prisma.maintenanceLog.findMany({
      where: { vehicleId },
      include: maintInclude,
      orderBy: { openedAt: 'desc' },
    });
  },

  /**
   * Open a maintenance log. Blocks if the vehicle is ON_TRIP (rule 3) or
   * already has an open log (rule 20). Sets vehicle IN_SHOP (rule 18).
   * Status change + record write are atomic.
   */
  async open(input: CreateMaintenanceInput) {
    return prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
      if (!vehicle) throw AppError.notFound('Vehicle not found');

      assertVehicleCanEnterMaintenance(vehicle);

      // Rule 20: no two simultaneously open maintenance logs.
      const openLog = await tx.maintenanceLog.findFirst({
        where: { vehicleId: vehicle.id, isActive: true },
      });
      if (openLog) {
        throw AppError.unprocessable(
          `Vehicle ${vehicle.registrationNo} already has an open maintenance log.`,
        );
      }

      await tx.vehicle.update({ where: { id: vehicle.id }, data: { status: 'IN_SHOP' } });

      return tx.maintenanceLog.create({
        data: {
          vehicleId: vehicle.id,
          description: input.description,
          cost: input.cost,
          isActive: true,
        },
        include: maintInclude,
      });
    });
  },

  /**
   * Close a maintenance log (rule 19). Restores the vehicle to AVAILABLE unless
   * it has since been RETIRED. Atomic.
   */
  async close(id: string) {
    return prisma.$transaction(async (tx) => {
      const log = await tx.maintenanceLog.findUnique({ where: { id } });
      if (!log) throw AppError.notFound('Maintenance log not found');
      if (!log.isActive) {
        throw AppError.unprocessable('This maintenance log is already closed.');
      }

      const vehicle = await tx.vehicle.findUnique({ where: { id: log.vehicleId } });
      if (!vehicle) throw AppError.notFound('Vehicle not found');

      // Rule 19: restore unless retired. Never resurrect a RETIRED vehicle (rule 4).
      if (vehicle.status !== 'RETIRED') {
        await tx.vehicle.update({ where: { id: vehicle.id }, data: { status: 'AVAILABLE' } });
      }

      return tx.maintenanceLog.update({
        where: { id },
        data: { isActive: false, closedAt: new Date() },
        include: maintInclude,
      });
    });
  },
};
