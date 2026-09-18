import { Request, Response } from 'express';
import { MaintenanceService } from '../services/maintenance.service';
import { FuelService } from '../services/fuel.service';
import { ExpenseService } from '../services/expense.service';
import { DashboardService } from '../services/dashboard.service';
import { DriverService } from '../services/driver.service';
import { ReportService } from '../services/report.service';
import { getQuery } from '../middleware/validate';
import { AppError } from '../utils/AppError';


export const MaintenanceController = {
  async list(req: Request, res: Response) {
    const { isActive } = getQuery<{ isActive?: boolean }>(req);
    let vehicleId: string | undefined;
    if (req.user!.role === 'DRIVER') {
      const assigned = await DriverService.getAssignedVehicleId(req.user!.driverId);
      if (!assigned) {
        return res.json([]);
      }
      vehicleId = assigned;
    }
    res.json(await MaintenanceService.list(isActive, vehicleId));
  },
  async listForVehicle(req: Request, res: Response) {
    if (req.user!.role === 'DRIVER') {
      const assigned = await DriverService.getAssignedVehicleId(req.user!.driverId);
      if (!assigned || assigned !== req.params.vehicleId) {
        throw AppError.forbidden('You are only authorized to view maintenance for your assigned vehicle.');
      }
    }
    res.json(await MaintenanceService.listForVehicle(req.params.vehicleId));
  },
  async open(req: Request, res: Response) {
    if (req.user!.role === 'DRIVER') {
      const assigned = await DriverService.getAssignedVehicleId(req.user!.driverId);
      if (!assigned || assigned !== req.body.vehicleId) {
        throw AppError.forbidden('You are only authorized to report maintenance for your assigned vehicle.');
      }
    }
    res.status(201).json(await MaintenanceService.open(req.body));
  },
  async close(req: Request, res: Response) {
    res.json(await MaintenanceService.close(req.params.id));
  },
};

export const FuelController = {
  async listForVehicle(req: Request, res: Response) {
    if (req.user!.role === 'DRIVER') {
      const assigned = await DriverService.getAssignedVehicleId(req.user!.driverId);
      if (!assigned || assigned !== req.params.vehicleId) {
        throw AppError.forbidden('You are only authorized to view fuel logs for your assigned vehicle.');
      }
    }
    res.json(await FuelService.listForVehicle(req.params.vehicleId));
  },
  async listAll(req: Request, res: Response) {
    if (req.user!.role === 'DRIVER') {
      if (!req.user!.driverId) {
        return res.json([]);
      }
      res.json(await FuelService.listForDriver(req.user!.driverId));
    } else {
      res.json(await FuelService.listAll());
    }
  },
  async create(req: Request, res: Response) {
    if (req.user!.role === 'DRIVER') {
      const assigned = await DriverService.getAssignedVehicleId(req.user!.driverId);
      if (!assigned || assigned !== req.body.vehicleId) {
        throw AppError.forbidden('You are only authorized to log fuel for your assigned vehicle.');
      }
    }
    res.status(201).json(await FuelService.create(req.body));
  },
};

export const ExpenseController = {
  async listForVehicle(req: Request, res: Response) {
    if (req.user!.role === 'DRIVER') {
      const assigned = await DriverService.getAssignedVehicleId(req.user!.driverId);
      if (!assigned || assigned !== req.params.vehicleId) {
        throw AppError.forbidden('You are only authorized to view expenses for your assigned vehicle.');
      }
    }
    res.json(await ExpenseService.listForVehicle(req.params.vehicleId));
  },
  async listAll(req: Request, res: Response) {
    if (req.user!.role === 'DRIVER') {
      const assigned = await DriverService.getAssignedVehicleId(req.user!.driverId);
      if (!assigned) {
        return res.json([]);
      }
      res.json(await ExpenseService.listForVehicle(assigned));
    } else {
      res.json(await ExpenseService.listAll(getQuery(req)));
    }
  },
  async create(req: Request, res: Response) {
    if (req.user!.role === 'DRIVER') {
      const assigned = await DriverService.getAssignedVehicleId(req.user!.driverId);
      if (!assigned || assigned !== req.body.vehicleId) {
        throw AppError.forbidden('You are only authorized to record expenses for your assigned vehicle.');
      }
      req.body.driverId = req.user!.driverId;
    }
    res.status(201).json(await ExpenseService.create(req.body));
  },
};

export const DashboardController = {
  /** Each role gets its own dashboard payload, discriminated by `role`. */
  async get(req: Request, res: Response) {
    switch (req.user!.role) {
      case 'DRIVER':
        return res.json(await DashboardService.getForDriver(req.user!.driverId));
      case 'SAFETY_OFFICER':
        return res.json(await DashboardService.getForSafetyOfficer());
      case 'FINANCIAL_ANALYST':
        return res.json(await DashboardService.getForFinancialAnalyst());
      default:
        return res.json({ role: 'FLEET_MANAGER', ...(await DashboardService.get(getQuery(req))) });
    }
  },
};

export const ReportController = {
  async get(req: Request, res: Response) {
    res.json(await ReportService.build(getQuery(req)));
  },
  async exportCsv(req: Request, res: Response) {
    const csv = await ReportService.toCsv(getQuery(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transitops-report.csv"');
    res.send(csv);
  },
};
