import { Request, Response } from 'express';
import { VehicleService } from '../services/vehicle.service';
import { getQuery } from '../middleware/validate';

export const VehicleController = {
  async list(req: Request, res: Response) {
    const filters = getQuery<Parameters<typeof VehicleService.list>[0]>(req);
    // Spec §4: drivers only view the available pool.
    if (req.user!.role === 'DRIVER') filters.status = 'AVAILABLE';
    const vehicles = await VehicleService.list(filters);
    res.json(vehicles);
  },
  async available(_req: Request, res: Response) {
    res.json(await VehicleService.listAvailableForDispatch());
  },
  async getById(req: Request, res: Response) {
    res.json(await VehicleService.getById(req.params.id));
  },
  async create(req: Request, res: Response) {
    res.status(201).json(await VehicleService.create(req.body));
  },
  async update(req: Request, res: Response) {
    res.json(await VehicleService.update(req.params.id, req.body));
  },
  async retire(req: Request, res: Response) {
    res.json(await VehicleService.retire(req.params.id));
  },
};
