import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { CreateFuelLogInput } from '../validation/schemas';

export const FuelService = {
  async listForVehicle(vehicleId: string) {
    return prisma.fuelLog.findMany({
      where: { vehicleId },
      include: { trip: { select: { id: true, tripNumber: true } } },
      orderBy: { date: 'desc' },
    });
  },

  async listAll() {
    return prisma.fuelLog.findMany({
      include: {
        vehicle: { select: { id: true, name: true, registrationNo: true } },
        trip: {
          select: {
            id: true,
            tripNumber: true,
            driver: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  },

  /** Fuel logs recorded against the given driver's trips. */
  async listForDriver(driverId: string) {
    return prisma.fuelLog.findMany({
      where: { trip: { driverId } },
      include: {
        vehicle: { select: { id: true, name: true, registrationNo: true } },
        trip: {
          select: {
            id: true,
            tripNumber: true,
            driver: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  },

  /** Log fuel, optionally linked to a trip. liters & cost validated >= 0 (rule 21). */
  async create(input: CreateFuelLogInput) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw AppError.notFound('Vehicle not found');

    if (input.tripId) {
      const trip = await prisma.trip.findUnique({ where: { id: input.tripId } });
      if (!trip) throw AppError.notFound('Linked trip not found');
      if (trip.vehicleId !== input.vehicleId) {
        throw AppError.unprocessable('The linked trip does not belong to this vehicle.');
      }
    }

    return prisma.fuelLog.create({
      data: {
        vehicleId: input.vehicleId,
        tripId: input.tripId ?? null,
        liters: input.liters,
        cost: input.cost,
        date: input.date,
      },
      include: { trip: { select: { id: true, tripNumber: true } } },
    });
  },
};
