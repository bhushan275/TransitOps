import { Request, Response } from 'express';
import { DriverService } from '../services/driver.service';
import { getQuery } from '../middleware/validate';

export const DriverController = {
  async list(req: Request, res: Response) {
    res.json(await DriverService.list(getQuery(req)));
  },
  async available(_req: Request, res: Response) {
    res.json(await DriverService.listAvailableForDispatch());
  },
  async getById(req: Request, res: Response) {
    res.json(await DriverService.getById(req.params.id));
  },
  async create(req: Request, res: Response) {
    res.status(201).json(await DriverService.create(req.body));
  },
  async update(req: Request, res: Response) {
    res.json(await DriverService.update(req.params.id, req.body));
  },
  async suspend(req: Request, res: Response) {
    res.json(await DriverService.suspend(req.params.id));
  },
  async delete(req: Request, res: Response) {
    await DriverService.delete(req.params.id);
    res.status(204).end();
  },
};
