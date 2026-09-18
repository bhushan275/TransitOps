import { Request, Response } from 'express';
import { TripService } from '../services/trip.service';
import { getQuery } from '../middleware/validate';
import { AppError } from '../utils/AppError';

/**
 * Drivers may only see and operate trips assigned to their own driver profile.
 * Returns the caller's driverId when scoping applies, or undefined for roles
 * with fleet-wide access.
 */
function driverScope(req: Request): string | undefined {
  if (req.user!.role !== 'DRIVER') return undefined;
  if (!req.user!.driverId) {
    throw AppError.forbidden('Your account is not linked to a driver profile.');
  }
  return req.user!.driverId;
}

async function assertTripOwnedByCaller(req: Request, tripId: string) {
  const scope = driverScope(req);
  if (!scope) return;
  const trip = await TripService.getById(tripId);
  if (trip.driverId !== scope) {
    throw AppError.forbidden('You can only manage trips assigned to you.');
  }
}

export const TripController = {
  async list(req: Request, res: Response) {
    const filters = getQuery<Parameters<typeof TripService.list>[0]>(req);
    const scope = driverScope(req);
    res.json(await TripService.list({ ...filters, ...(scope ? { driverId: scope } : {}) }));
  },
  async active(req: Request, res: Response) {
    res.json(await TripService.listActive(driverScope(req)));
  },
  async getById(req: Request, res: Response) {
    const trip = await TripService.getById(req.params.id);
    const scope = driverScope(req);
    if (scope && trip.driverId !== scope) {
      throw AppError.forbidden('You can only view trips assigned to you.');
    }
    res.json(trip);
  },
  async create(req: Request, res: Response) {
    const scope = driverScope(req);
    if (scope) req.body.driverId = scope; // drivers can only create trips for themselves
    res.status(201).json(await TripService.create(req.body));
  },
  async dispatch(req: Request, res: Response) {
    await assertTripOwnedByCaller(req, req.params.id);
    res.json(await TripService.dispatch(req.params.id));
  },
  async complete(req: Request, res: Response) {
    await assertTripOwnedByCaller(req, req.params.id);
    res.json(await TripService.complete(req.params.id, req.body));
  },
  async cancel(req: Request, res: Response) {
    await assertTripOwnedByCaller(req, req.params.id);
    res.json(await TripService.cancel(req.params.id));
  },
  async pendingSafetyReview(_req: Request, res: Response) {
    res.json(await TripService.listPendingSafetyReview());
  },
  async review(req: Request, res: Response) {
    const reviewerId = req.user!.userId;
    res.status(201).json(await TripService.createSafetyReview(req.params.id, reviewerId, req.body));
  },
};
