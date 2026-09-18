import { Prisma, TripStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import {
  assertDriverEligibleForDispatch,
  assertTripPayloadValid,
  assertVehicleEligibleForDispatch,
} from './eligibility';
import { CompleteTripInput, CreateTripInput, CreateReviewInput } from '../validation/schemas';

const tripInclude = {
  vehicle: { select: { id: true, name: true, registrationNo: true, status: true } },
  driver: { select: { id: true, name: true, licenseNumber: true, status: true, safetyScore: true } },
  safetyReview: { select: { id: true, rating: true, remarks: true, reviewedAt: true } },
} satisfies Prisma.TripInclude;

interface TripFilters {
  status?: TripStatus;
  vehicleId?: string;
  driverId?: string;
}

/** Generates the next business-friendly trip number, e.g. TRP-00001. */
async function nextTripNumber(tx: Prisma.TransactionClient): Promise<string> {
  const last = await tx.trip.findFirst({
    orderBy: { tripNumber: 'desc' },
    select: { tripNumber: true },
  });
  const lastSeq = last ? parseInt(last.tripNumber.replace(/\D/g, ''), 10) || 0 : 0;
  return `TRP-${String(lastSeq + 1).padStart(5, '0')}`;
}

export const TripService = {
  async list(filters: TripFilters) {
    const where: Prisma.TripWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.driverId) where.driverId = filters.driverId;
    return prisma.trip.findMany({
      where,
      include: tripInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  async listActive(driverId?: string) {
    return prisma.trip.findMany({
      where: { status: 'DISPATCHED', ...(driverId ? { driverId } : {}) },
      include: tripInclude,
      orderBy: { dispatchedAt: 'desc' },
    });
  },

  async getById(id: string) {
    const trip = await prisma.trip.findUnique({ where: { id }, include: tripInclude });
    if (!trip) throw AppError.notFound('Trip not found');
    return trip;
  },

  /**
   * Create a trip as DRAFT. Validates cargo weight <= capacity, source != dest,
   * and that the chosen vehicle + driver are currently eligible (rules 6–11).
   * No status is reserved at DRAFT — reservation happens on dispatch.
   */
  async create(input: CreateTripInput) {
    return prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
      if (!vehicle) throw AppError.notFound('Selected vehicle not found');
      const driver = await tx.driver.findUnique({
        where: { id: input.driverId },
        include: { userAccount: true },
      });
      if (!driver) throw AppError.notFound('Selected driver not found');

      assertTripPayloadValid({
        cargoWeight: input.cargoWeight,
        maxLoadCapacity: vehicle.maxLoadCapacity,
        source: input.source,
        destination: input.destination,
      });
      assertVehicleEligibleForDispatch(vehicle);
      assertDriverEligibleForDispatch(driver);

      const tripNumber = await nextTripNumber(tx);
      return tx.trip.create({
        data: {
          tripNumber,
          source: input.source,
          destination: input.destination,
          vehicleId: input.vehicleId,
          driverId: input.driverId,
          cargoWeight: input.cargoWeight,
          plannedDistance: input.plannedDistance,
          revenue: input.revenue ?? 0,
          status: 'DRAFT',
        },
        include: tripInclude,
      });
    });
  },

  /**
   * Dispatch: DRAFT -> DISPATCHED. Re-checks eligibility at dispatch time
   * (state may have changed since creation) and flips vehicle + driver to
   * ON_TRIP atomically (rule 12).
   */
  async dispatch(id: string) {
    return prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id } });
      if (!trip) throw AppError.notFound('Trip not found');
      if (trip.status !== 'DRAFT') {
        throw AppError.unprocessable(
          `Only DRAFT trips can be dispatched (current status: ${trip.status}).`,
        );
      }

      const vehicle = await tx.vehicle.findUnique({ where: { id: trip.vehicleId } });
      const driver = await tx.driver.findUnique({
        where: { id: trip.driverId },
        include: { userAccount: true },
      });
      if (!vehicle || !driver) throw AppError.notFound('Trip vehicle or driver missing');

      assertVehicleEligibleForDispatch(vehicle);
      assertDriverEligibleForDispatch(driver);

      const vehicleUpdate = await tx.vehicle.updateMany({
        where: { id: vehicle.id, status: 'AVAILABLE' },
        data: { status: 'ON_TRIP' },
      });
      if (vehicleUpdate.count === 0) {
        throw AppError.unprocessable(
          `Vehicle ${vehicle.registrationNo} is no longer available for dispatch.`,
        );
      }

      const driverUpdate = await tx.driver.updateMany({
        where: { id: driver.id, status: 'AVAILABLE' },
        data: { status: 'ON_TRIP' },
      });
      if (driverUpdate.count === 0) {
        throw AppError.unprocessable(`Driver ${driver.name} is no longer available for dispatch.`);
      }

      return tx.trip.update({
        where: { id },
        data: { status: 'DISPATCHED', dispatchedAt: new Date() },
        include: tripInclude,
      });
    });
  },

  /**
   * Complete: DISPATCHED -> COMPLETED (rule 13). Records actual distance and
   * fuel consumed, then restores vehicle + driver to AVAILABLE (rule 14).
   */
  async complete(id: string, input: CompleteTripInput) {
    return prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id } });
      if (!trip) throw AppError.notFound('Trip not found');
      if (trip.status === 'CANCELLED') {
        throw AppError.unprocessable('A cancelled trip can never be completed.');
      }
      if (trip.status !== 'DISPATCHED') {
        throw AppError.unprocessable(
          `Only DISPATCHED trips can be completed (current status: ${trip.status}).`,
        );
      }

      await tx.vehicle.update({ where: { id: trip.vehicleId }, data: { status: 'AVAILABLE' } });
      await tx.driver.update({ where: { id: trip.driverId }, data: { status: 'AVAILABLE' } });

      return tx.trip.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          actualDistance: input.actualDistance,
          fuelConsumed: input.fuelConsumed,
          completedAt: new Date(),
        },
        include: tripInclude,
      });
    });
  },

  /**
   * Cancel. A DRAFT trip cancels directly (nothing reserved, rule 17). A
   * DISPATCHED trip additionally restores vehicle + driver to AVAILABLE
   * (rule 16). COMPLETED / already-CANCELLED trips cannot be cancelled.
   */
  async cancel(id: string) {
    return prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id } });
      if (!trip) throw AppError.notFound('Trip not found');
      if (trip.status === 'COMPLETED') {
        throw AppError.unprocessable('A completed trip cannot be cancelled.');
      }
      if (trip.status === 'CANCELLED') {
        throw AppError.unprocessable('Trip is already cancelled.');
      }

      if (trip.status === 'DISPATCHED') {
        await tx.vehicle.update({ where: { id: trip.vehicleId }, data: { status: 'AVAILABLE' } });
        await tx.driver.update({ where: { id: trip.driverId }, data: { status: 'AVAILABLE' } });
      }

      return tx.trip.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        include: tripInclude,
      });
    });
  },

  async listPendingSafetyReview() {
    return prisma.trip.findMany({
      where: {
        status: 'COMPLETED',
        safetyReview: null,
      },
      include: tripInclude,
      orderBy: { completedAt: 'desc' },
    });
  },

  async createSafetyReview(tripId: string, reviewerId: string, input: CreateReviewInput) {
    return prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: { safetyReview: true },
      });
      if (!trip) throw AppError.notFound('Trip not found');
      if (trip.status !== 'COMPLETED') {
        throw AppError.unprocessable('Only completed trips can be safety reviewed.');
      }
      if (trip.safetyReview) {
        throw AppError.unprocessable('This trip has already been safety reviewed.');
      }

      // Create safety review
      const review = await tx.tripSafetyReview.create({
        data: {
          tripId,
          driverId: trip.driverId,
          reviewerId,
          rating: input.rating,
          remarks: input.remarks ?? null,
        },
      });

      // Calculate rolling average of ratings for the driver
      const reviews = await tx.tripSafetyReview.findMany({
        where: { driverId: trip.driverId },
        select: { rating: true },
      });
      
      const totalRatings = reviews.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = totalRatings / reviews.length;
      const newSafetyScore = Math.round(averageRating * 20 * 10) / 10;

      // Update driver safety score in DB
      await tx.driver.update({
        where: { id: trip.driverId },
        data: { safetyScore: newSafetyScore },
      });

      return review;
    });
  },
};
