import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { startOfToday } from './eligibility';
import { DashboardQuery } from '../validation/schemas';

const EXPIRY_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export const DashboardService = {
  /** Fleet Manager dashboard — full fleet overview (spec Section 9). */
  async get(filters: DashboardQuery) {
    // Vehicle scope from optional type/status/region filters.
    const vehicleWhere: Prisma.VehicleWhereInput = { isActive: true };
    if (filters.type) vehicleWhere.type = { equals: filters.type, mode: 'insensitive' };
    if (filters.region) vehicleWhere.region = { equals: filters.region, mode: 'insensitive' };
    if (filters.status) vehicleWhere.status = filters.status;

    // Trips scoped to the same vehicle filter (via relation) when type/region set.
    const tripVehicleFilter: Prisma.VehicleWhereInput = {};
    if (filters.type) tripVehicleFilter.type = { equals: filters.type, mode: 'insensitive' };
    if (filters.region) tripVehicleFilter.region = { equals: filters.region, mode: 'insensitive' };
    const tripWhere: Prisma.TripWhereInput =
      Object.keys(tripVehicleFilter).length > 0 ? { vehicle: tripVehicleFilter } : {};

    const activeFleetWhere: Prisma.VehicleWhereInput = {
      ...vehicleWhere,
      status: filters.status ?? { not: 'RETIRED' },
    };

    const now = new Date();
    const expiryCutoff = new Date();
    expiryCutoff.setDate(expiryCutoff.getDate() + EXPIRY_WINDOW_DAYS);

    const [
      activeVehicles,
      availableVehicles,
      vehiclesInMaintenanceCount,
      onTripVehicles,
      activeTrips,
      pendingTrips,
      driversOnDuty,
      recentTrips,
      maintenanceLogs,
      expiringLicenses,
      todaysExpenses,
      todaysFuel,
    ] = await Promise.all([
      // KPIs
      prisma.vehicle.count({ where: activeFleetWhere }),
      prisma.vehicle.count({ where: { ...vehicleWhere, status: 'AVAILABLE' } }),
      prisma.vehicle.count({ where: { ...vehicleWhere, status: 'IN_SHOP' } }),
      prisma.vehicle.count({ where: { ...vehicleWhere, status: 'ON_TRIP' } }),
      prisma.trip.count({ where: { ...tripWhere, status: 'DISPATCHED' } }),
      prisma.trip.count({ where: { ...tripWhere, status: 'DRAFT' } }),
      prisma.driver.count({
        where: { isActive: true, status: { in: ['AVAILABLE', 'ON_TRIP'] } },
      }),
      // Widgets
      prisma.trip.findMany({
        where: tripWhere,
        include: {
          vehicle: { select: { id: true, name: true, registrationNo: true } },
          driver: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.maintenanceLog.findMany({
        where: { isActive: true, ...(Object.keys(vehicleWhere).length ? { vehicle: vehicleWhere } : {}) },
        include: { vehicle: { select: { id: true, name: true, registrationNo: true, region: true } } },
        orderBy: { openedAt: 'desc' },
      }),
      prisma.driver.findMany({
        where: { isActive: true, licenseExpiryDate: { lte: expiryCutoff } },
        orderBy: { licenseExpiryDate: 'asc' },
        select: {
          id: true,
          name: true,
          licenseNumber: true,
          licenseCategory: true,
          licenseExpiryDate: true,
          status: true,
        },
      }),
      prisma.expense.groupBy({
        by: ['type'],
        where: { date: { gte: startOfToday() }, ...(Object.keys(vehicleWhere).length ? { vehicle: vehicleWhere } : {}) },
        _sum: { amount: true },
      }),
      prisma.fuelLog.aggregate({
        where: { date: { gte: startOfToday() }, ...(Object.keys(vehicleWhere).length ? { vehicle: vehicleWhere } : {}) },
        _sum: { liters: true },
      }),
    ]);

    // Fleet utilization % = ON_TRIP / active-non-retired fleet * 100 (spec Section 10).
    const fleetUtilizationPct =
      activeVehicles > 0 ? Math.round((onTripVehicles / activeVehicles) * 1000) / 10 : 0;

    const breakdown = { TOLL: 0, MAINTENANCE: 0, OTHER: 0 } as Record<string, number>;
    for (const row of todaysExpenses) {
      breakdown[row.type] = row._sum.amount ?? 0;
    }
    const total = breakdown.TOLL + breakdown.MAINTENANCE + breakdown.OTHER;

    // Flag which expiring licenses are already expired for the UI.
    const expiring = expiringLicenses.map((d) => ({
      ...d,
      expired: d.licenseExpiryDate < startOfToday(),
      daysUntilExpiry: Math.ceil(
        (d.licenseExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
    }));

    return {
      kpis: {
        activeVehicles,
        availableVehicles,
        vehiclesInMaintenance: vehiclesInMaintenanceCount,
        activeTrips,
        pendingTrips,
        driversOnDuty,
        fleetUtilizationPct,
        todaysFuelLiters: todaysFuel._sum.liters ?? 0,
      },
      recentTrips,
      vehiclesInMaintenance: maintenanceLogs,
      expiringLicenses: expiring,
      todaysExpenses: { total, breakdown },
    };
  },

  /** Driver dashboard — the caller's own profile, active trip, and history. */
  async getForDriver(driverId: string | null) {
    if (!driverId) {
      throw AppError.forbidden('Your account is not linked to a driver profile.');
    }
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw AppError.notFound('Driver profile not found');

    const tripInclude = {
      vehicle: { select: { id: true, name: true, registrationNo: true, type: true } },
    };

    const [totalTrips, completedAgg, draftTrips, activeTrip, recentTrips, todaysFuel] =
      await Promise.all([
        prisma.trip.count({ where: { driverId } }),
        prisma.trip.aggregate({
          where: { driverId, status: 'COMPLETED' },
          _count: { _all: true },
          _sum: { actualDistance: true, revenue: true },
        }),
        prisma.trip.count({ where: { driverId, status: 'DRAFT' } }),
        prisma.trip.findFirst({
          where: { driverId, status: 'DISPATCHED' },
          include: tripInclude,
          orderBy: { dispatchedAt: 'desc' },
        }),
        prisma.trip.findMany({
          where: { driverId },
          include: tripInclude,
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        prisma.fuelLog.aggregate({
          where: { date: { gte: startOfToday() }, trip: { driverId } },
          _sum: { liters: true, cost: true },
        }),
      ]);

    const now = new Date();
    const licenseDaysLeft = Math.ceil(
      (driver.licenseExpiryDate.getTime() - now.getTime()) / DAY_MS,
    );

    return {
      role: 'DRIVER' as const,
      profile: {
        id: driver.id,
        name: driver.name,
        licenseNumber: driver.licenseNumber,
        licenseCategory: driver.licenseCategory,
        licenseExpiryDate: driver.licenseExpiryDate,
        contactNumber: driver.contactNumber,
        safetyScore: driver.safetyScore,
        status: driver.status,
      },
      kpis: {
        totalTrips,
        completedTrips: completedAgg._count._all,
        draftTrips,
        onTrip: activeTrip ? 1 : 0,
        totalDistance: completedAgg._sum.actualDistance ?? 0,
        safetyScore: driver.safetyScore,
        licenseDaysLeft,
        licenseExpired: licenseDaysLeft < 0,
      },
      activeTrip,
      recentTrips,
      todaysFuel: {
        liters: todaysFuel._sum.liters ?? 0,
        cost: todaysFuel._sum.cost ?? 0,
      },
    };
  },

  /** Safety Officer dashboard — driver compliance, licenses, and reviews. */
  async getForSafetyOfficer() {
    const expiryCutoff = new Date(Date.now() + EXPIRY_WINDOW_DAYS * DAY_MS);
    const today = startOfToday();

    const [
      activeDrivers,
      driversOnDuty,
      suspendedDrivers,
      expiredLicenses,
      safetyAgg,
      pendingReviewCount,
      expiringLicenses,
      pendingReviewTrips,
      lowSafetyDrivers,
      recentReviews,
    ] = await Promise.all([
      prisma.driver.count({ where: { isActive: true } }),
      prisma.driver.count({
        where: { isActive: true, status: { in: ['AVAILABLE', 'ON_TRIP'] } },
      }),
      prisma.driver.count({ where: { isActive: true, status: 'SUSPENDED' } }),
      prisma.driver.count({ where: { isActive: true, licenseExpiryDate: { lt: today } } }),
      prisma.driver.aggregate({ where: { isActive: true }, _avg: { safetyScore: true } }),
      prisma.trip.count({ where: { status: 'COMPLETED', safetyReview: null } }),
      prisma.driver.findMany({
        where: { isActive: true, licenseExpiryDate: { lte: expiryCutoff } },
        orderBy: { licenseExpiryDate: 'asc' },
        select: {
          id: true,
          name: true,
          licenseNumber: true,
          licenseCategory: true,
          licenseExpiryDate: true,
          status: true,
        },
      }),
      prisma.trip.findMany({
        where: { status: 'COMPLETED', safetyReview: null },
        include: {
          vehicle: { select: { id: true, name: true, registrationNo: true } },
          driver: { select: { id: true, name: true, safetyScore: true } },
        },
        orderBy: { completedAt: 'desc' },
        take: 8,
      }),
      prisma.driver.findMany({
        where: { isActive: true, safetyScore: { lt: 70 } },
        orderBy: { safetyScore: 'asc' },
        select: { id: true, name: true, licenseNumber: true, safetyScore: true, status: true },
        take: 8,
      }),
      prisma.tripSafetyReview.findMany({
        include: {
          driver: { select: { id: true, name: true } },
          trip: { select: { id: true, tripNumber: true, source: true, destination: true } },
        },
        orderBy: { reviewedAt: 'desc' },
        take: 8,
      }),
    ]);

    const now = new Date();
    const expiring = expiringLicenses.map((d) => ({
      ...d,
      expired: d.licenseExpiryDate < today,
      daysUntilExpiry: Math.ceil((d.licenseExpiryDate.getTime() - now.getTime()) / DAY_MS),
    }));

    return {
      role: 'SAFETY_OFFICER' as const,
      kpis: {
        activeDrivers,
        driversOnDuty,
        suspendedDrivers,
        expiredLicenses,
        expiringSoon: expiring.filter((d) => !d.expired).length,
        avgSafetyScore: Math.round((safetyAgg._avg.safetyScore ?? 0) * 10) / 10,
        pendingReviews: pendingReviewCount,
      },
      expiringLicenses: expiring,
      pendingReviewTrips,
      lowSafetyDrivers,
      recentReviews,
    };
  },

  /** Financial Analyst dashboard — spend, revenue, and cost per vehicle. */
  async getForFinancialAnalyst() {
    const today = startOfToday();
    const monthStart = startOfMonth();

    const [
      todaysExpenses,
      monthExpenseAgg,
      monthFuelAgg,
      monthMaintenanceAgg,
      monthRevenueAgg,
      monthExpenseByType,
      recentExpenses,
      vehicles,
      monthFuelByVehicle,
      monthExpenseByVehicle,
      monthMaintByVehicle,
    ] = await Promise.all([
      prisma.expense.groupBy({
        by: ['type'],
        where: { date: { gte: today } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({ where: { date: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.fuelLog.aggregate({ where: { date: { gte: monthStart } }, _sum: { cost: true } }),
      prisma.maintenanceLog.aggregate({
        where: { openedAt: { gte: monthStart } },
        _sum: { cost: true },
      }),
      prisma.trip.aggregate({
        where: { status: 'COMPLETED', completedAt: { gte: monthStart } },
        _sum: { revenue: true },
      }),
      prisma.expense.groupBy({
        by: ['type'],
        where: { date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.expense.findMany({
        include: {
          vehicle: { select: { id: true, name: true, registrationNo: true } },
          driver: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        take: 8,
      }),
      prisma.vehicle.findMany({
        where: { isActive: true },
        select: { id: true, name: true, registrationNo: true },
      }),
      prisma.fuelLog.groupBy({
        by: ['vehicleId'],
        where: { date: { gte: monthStart } },
        _sum: { cost: true },
      }),
      prisma.expense.groupBy({
        by: ['vehicleId'],
        where: { date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.maintenanceLog.groupBy({
        by: ['vehicleId'],
        where: { openedAt: { gte: monthStart } },
        _sum: { cost: true },
      }),
    ]);

    const todayBreakdown = { TOLL: 0, MAINTENANCE: 0, OTHER: 0 } as Record<string, number>;
    for (const row of todaysExpenses) todayBreakdown[row.type] = row._sum.amount ?? 0;
    const todayTotal = todayBreakdown.TOLL + todayBreakdown.MAINTENANCE + todayBreakdown.OTHER;

    const monthBreakdown = { TOLL: 0, MAINTENANCE: 0, OTHER: 0 } as Record<string, number>;
    for (const row of monthExpenseByType) monthBreakdown[row.type] = row._sum.amount ?? 0;

    const fuelBy = new Map(monthFuelByVehicle.map((r) => [r.vehicleId, r._sum.cost ?? 0]));
    const expBy = new Map(monthExpenseByVehicle.map((r) => [r.vehicleId, r._sum.amount ?? 0]));
    const maintBy = new Map(monthMaintByVehicle.map((r) => [r.vehicleId, r._sum.cost ?? 0]));
    const costPerVehicle = vehicles
      .map((v) => {
        const fuelCost = fuelBy.get(v.id) ?? 0;
        const expenseCost = expBy.get(v.id) ?? 0;
        const maintenanceCost = maintBy.get(v.id) ?? 0;
        return { ...v, fuelCost, expenseCost, maintenanceCost, total: fuelCost + expenseCost + maintenanceCost };
      })
      .filter((v) => v.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const monthExpenses = monthExpenseAgg._sum.amount ?? 0;
    const monthFuelCost = monthFuelAgg._sum.cost ?? 0;
    const monthMaintenanceCost = monthMaintenanceAgg._sum.cost ?? 0;

    return {
      role: 'FINANCIAL_ANALYST' as const,
      kpis: {
        todaysExpensesTotal: todayTotal,
        monthExpenses,
        monthFuelCost,
        monthMaintenanceCost,
        monthOperationalCost: monthExpenses + monthFuelCost + monthMaintenanceCost,
        monthRevenue: monthRevenueAgg._sum.revenue ?? 0,
      },
      todaysExpenses: { total: todayTotal, breakdown: todayBreakdown },
      monthExpenseBreakdown: monthBreakdown,
      costPerVehicle,
      recentExpenses,
    };
  },
};
