import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ReportQuery } from '../validation/schemas';

interface PerVehicleRow {
  vehicleId: string;
  name: string;
  registrationNo: string;
  region: string;
  acquisitionCost: number;
  // fuel efficiency
  totalActualDistance: number;
  totalFuelConsumed: number;
  fuelEfficiency: number; // km per liter
  // operational cost
  fuelCost: number;
  maintenanceCost: number;
  expenseCost: number;
  operationalCost: number;
  // roi
  revenue: number;
  roi: number;
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export const ReportService = {
  async build(query: ReportQuery) {
    const { from, to, vehicleId } = query;

    const dateFilter: Prisma.DateTimeFilter | undefined =
      from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

    const vehicleWhere: Prisma.VehicleWhereInput = { isActive: true };
    if (vehicleId) vehicleWhere.id = vehicleId;

    const vehicles = await prisma.vehicle.findMany({
      where: vehicleWhere,
      orderBy: { name: 'asc' },
    });
    const vehicleIds = vehicles.map((v) => v.id);

    // Pull all relevant records once, filtered by date range, then group in memory.
    const [completedTrips, fuelLogs, maintenanceLogs, expenses] = await Promise.all([
      prisma.trip.findMany({
        where: {
          vehicleId: { in: vehicleIds },
          status: 'COMPLETED',
          ...(dateFilter ? { completedAt: dateFilter } : {}),
        },
        select: {
          vehicleId: true,
          actualDistance: true,
          fuelConsumed: true,
          revenue: true,
        },
      }),
      prisma.fuelLog.findMany({
        where: { vehicleId: { in: vehicleIds }, ...(dateFilter ? { date: dateFilter } : {}) },
        select: { vehicleId: true, cost: true },
      }),
      prisma.maintenanceLog.findMany({
        where: { vehicleId: { in: vehicleIds }, ...(dateFilter ? { openedAt: dateFilter } : {}) },
        select: { vehicleId: true, cost: true },
      }),
      prisma.expense.findMany({
        where: { vehicleId: { in: vehicleIds }, ...(dateFilter ? { date: dateFilter } : {}) },
        select: { vehicleId: true, amount: true },
      }),
    ]);

    const rows: PerVehicleRow[] = vehicles.map((v) => {
      const vTrips = completedTrips.filter((t) => t.vehicleId === v.id);
      const totalActualDistance = vTrips.reduce((s, t) => s + (t.actualDistance ?? 0), 0);
      const totalFuelConsumed = vTrips.reduce((s, t) => s + (t.fuelConsumed ?? 0), 0);
      const revenue = vTrips.reduce((s, t) => s + (t.revenue ?? 0), 0);

      const fuelCost = fuelLogs
        .filter((f) => f.vehicleId === v.id)
        .reduce((s, f) => s + f.cost, 0);
      const maintenanceCost = maintenanceLogs
        .filter((m) => m.vehicleId === v.id)
        .reduce((s, m) => s + m.cost, 0);
      const expenseCost = expenses
        .filter((e) => e.vehicleId === v.id)
        .reduce((s, e) => s + e.amount, 0);

      const operationalCost = fuelCost + maintenanceCost + expenseCost;
      const fuelEfficiency =
        totalFuelConsumed > 0 ? round(totalActualDistance / totalFuelConsumed) : 0;
      const roi =
        v.acquisitionCost > 0
          ? round((revenue - (maintenanceCost + fuelCost)) / v.acquisitionCost, 4)
          : 0;

      return {
        vehicleId: v.id,
        name: v.name,
        registrationNo: v.registrationNo,
        region: v.region,
        acquisitionCost: v.acquisitionCost,
        totalActualDistance: round(totalActualDistance),
        totalFuelConsumed: round(totalFuelConsumed),
        fuelEfficiency,
        fuelCost: round(fuelCost),
        maintenanceCost: round(maintenanceCost),
        expenseCost: round(expenseCost),
        operationalCost: round(operationalCost),
        revenue: round(revenue),
        roi,
      };
    });

    // Fleet utilization % (spec Section 10): ON_TRIP / (active & != RETIRED) * 100.
    const [onTrip, activeFleet] = await Promise.all([
      prisma.vehicle.count({ where: { isActive: true, status: 'ON_TRIP' } }),
      prisma.vehicle.count({ where: { isActive: true, status: { not: 'RETIRED' } } }),
    ]);
    const fleetUtilization = {
      onTrip,
      activeFleet,
      pct: activeFleet > 0 ? round((onTrip / activeFleet) * 100, 1) : 0,
    };

    return {
      range: { from: from ?? null, to: to ?? null, vehicleId: vehicleId ?? null },
      fuelEfficiency: rows.map((r) => ({
        vehicleId: r.vehicleId,
        name: r.name,
        registrationNo: r.registrationNo,
        totalActualDistance: r.totalActualDistance,
        totalFuelConsumed: r.totalFuelConsumed,
        fuelEfficiency: r.fuelEfficiency,
      })),
      fleetUtilization,
      operationalCost: rows.map((r) => ({
        vehicleId: r.vehicleId,
        name: r.name,
        registrationNo: r.registrationNo,
        fuelCost: r.fuelCost,
        maintenanceCost: r.maintenanceCost,
        expenseCost: r.expenseCost,
        operationalCost: r.operationalCost,
      })),
      roi: rows.map((r) => ({
        vehicleId: r.vehicleId,
        name: r.name,
        registrationNo: r.registrationNo,
        revenue: r.revenue,
        acquisitionCost: r.acquisitionCost,
        roi: r.roi,
      })),
      perVehicle: rows,
    };
  },

  async toCsv(query: ReportQuery): Promise<string> {
    const report = await this.build(query);
    const headers = [
      'Vehicle',
      'Registration No',
      'Region',
      'Acquisition Cost',
      'Total Distance (km)',
      'Total Fuel (L)',
      'Fuel Efficiency (km/L)',
      'Fuel Cost',
      'Maintenance Cost',
      'Expense Cost',
      'Operational Cost',
      'Revenue',
      'ROI',
    ];
    const escape = (val: string | number): string => {
      const s = String(val);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(',')];
    for (const r of report.perVehicle) {
      lines.push(
        [
          r.name,
          r.registrationNo,
          r.region,
          r.acquisitionCost,
          r.totalActualDistance,
          r.totalFuelConsumed,
          r.fuelEfficiency,
          r.fuelCost,
          r.maintenanceCost,
          r.expenseCost,
          r.operationalCost,
          r.revenue,
          r.roi,
        ]
          .map(escape)
          .join(','),
      );
    }
    return lines.join('\n');
  },
};
