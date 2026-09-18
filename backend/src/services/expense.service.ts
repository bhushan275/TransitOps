import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { CreateExpenseInput } from '../validation/schemas';

export const ExpenseService = {
  async listForVehicle(vehicleId: string) {
    return prisma.expense.findMany({
      where: { vehicleId },
      include: {
        vehicle: { select: { id: true, name: true, registrationNo: true } },
        driver: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });
  },

  async listAll(filters: { date?: string }) {
    const where: any = {};
    if (filters.date === 'today') {
      const { startOfToday } = require('./eligibility');
      where.date = { gte: startOfToday() };
    }
    return prisma.expense.findMany({
      where,
      include: {
        vehicle: { select: { id: true, name: true, registrationNo: true } },
        driver: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });
  },

  /** Log an expense by ExpenseType. amount validated >= 0 (rule 21). */
  async create(input: CreateExpenseInput) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw AppError.notFound('Vehicle not found');

    return prisma.expense.create({
      data: {
        vehicleId: input.vehicleId,
        driverId: input.driverId ?? null,
        type: input.type,
        amount: input.amount,
        notes: input.notes ?? null,
        date: input.date,
      },
    });
  },
};
