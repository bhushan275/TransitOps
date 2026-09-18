import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  DollarSign,
  Droplet,
  Fuel,
  Wrench,
  Calendar,
  Truck,
  Search,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
} from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ExpenseTypeBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { Expense, FuelLog, MaintenanceLog, Vehicle, Driver, Trip } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';

const COLORS = [
  'hsl(var(--primary))',
  '#06b6d4',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#3b82f6',
  '#10b981',
];

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = r.getDate() - day + (day === 0 ? -6 : 1);
  r.setDate(diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfMonth(d: Date): Date {
  const r = new Date(d);
  r.setDate(1);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function FuelExpensesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isDriver = user?.role === 'DRIVER';

  // Driver UI States
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [driverFuelLogs, setDriverFuelLogs] = useState<FuelLog[]>([]);
  const [driverExpenses, setDriverExpenses] = useState<Expense[]>([]);
  const [driverMaintenance, setDriverMaintenance] = useState<MaintenanceLog[]>([]);

  // Manager UI States
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [allFuelLogs, setAllFuelLogs] = useState<FuelLog[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allMaintenance, setAllMaintenance] = useState<MaintenanceLog[]>([]);
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'vehicles' | 'drivers' | 'logs'>('dashboard');
  const [loading, setLoading] = useState(false);

  // Dialog forms
  const [fuelOpen, setFuelOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [fuelForm, setFuelForm] = useState({ liters: '', cost: '' });
  const [expenseForm, setExpenseForm] = useState({ type: 'TOLL', amount: '', notes: '', date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);

  // Reports selections
  const [selectedReportVehicle, setSelectedReportVehicle] = useState('');
  const [selectedReportDriver, setSelectedReportDriver] = useState('');
  const [monthlyReportRange, setMonthlyReportRange] = useState<'current' | 'previous' | 'last3'>('current');

  // Logs filters
  const [logType, setLogType] = useState<'fuel' | 'expense'>('fuel');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterDriver, setFilterDriver] = useState('');
  const [filterExpenseType, setFilterExpenseType] = useState('');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sort State
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Load Driver Context
  const loadDriverData = async (vId: string) => {
    setLoading(true);
    try {
      const [f, e, m] = await Promise.all([
        api.get<FuelLog[]>(`/fuel-logs/${vId}`),
        api.get<Expense[]>(`/expenses/${vId}`),
        api.get<MaintenanceLog[]>(`/maintenance/${vId}`),
      ]);
      setDriverFuelLogs(f);
      setDriverExpenses(e);
      setDriverMaintenance(m);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed to load vehicle data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isDriver) {
      setLoading(true);
      api.get<Trip[]>('/trips', { status: 'DISPATCHED', driverId: user.driverId })
        .then((trips) => {
          if (trips.length > 0) {
            const t = trips[0];
            setActiveTrip(t);
            api.get<Vehicle>(`/vehicles/${t.vehicleId}`)
              .then((v) => {
                setAssignedVehicle(v);
                void loadDriverData(v.id);
              })
              .catch(() => {
                const dummyVeh = {
                  id: t.vehicleId,
                  registrationNo: t.vehicle.registrationNo || '',
                  name: t.vehicle.name || '',
                  type: '',
                  region: '',
                  maxLoadCapacity: 0,
                  odometer: 0,
                  acquisitionCost: 0,
                  status: 'ON_TRIP',
                  isActive: true,
                  createdAt: '',
                  updatedAt: '',
                } as Vehicle;
                setAssignedVehicle(dummyVeh);
                void loadDriverData(t.vehicleId);
              });
          } else {
            setLoading(false);
          }
        })
        .catch(() => {
          toast('Failed to load dispatch context', 'error');
          setLoading(false);
        });
    } else {
      // Load Fleet Manager / Financial Analyst Data
      setLoading(true);
      Promise.all([
        api.get<Vehicle[]>('/vehicles'),
        api.get<Driver[]>('/drivers'),
        api.get<FuelLog[]>('/fuel-logs'),
        api.get<Expense[]>('/expenses'),
        api.get<MaintenanceLog[]>('/maintenance'),
      ])
        .then(([v, d, f, e, m]) => {
          setVehicles(v);
          setDrivers(d);
          setAllFuelLogs(f);
          setAllExpenses(e);
          setAllMaintenance(m);
          if (v.length > 0) setSelectedReportVehicle(v[0].id);
          if (d.length > 0) setSelectedReportDriver(d[0].id);
        })
        .catch(() => toast('Failed to load fleet operational data', 'error'))
        .finally(() => setLoading(false));
    }
  }, [isDriver, user]);

  // Log Actions
  const handleLogFuel = async (e: FormEvent) => {
    e.preventDefault();
    const vId = isDriver ? assignedVehicle?.id : filterVehicle;
    if (!vId) return;
    setSaving(true);
    try {
      await api.post('/fuel-logs', {
        vehicleId: vId,
        liters: Number(fuelForm.liters),
        cost: Number(fuelForm.cost),
      });
      toast('Fuel log created successfully');
      setFuelOpen(false);
      setFuelForm({ liters: '', cost: '' });
      if (isDriver) void loadDriverData(vId);
      else {
        // Refetch all fuel logs
        const logs = await api.get<FuelLog[]>('/fuel-logs');
        setAllFuelLogs(logs);
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed to log fuel', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogExpense = async (e: FormEvent) => {
    e.preventDefault();
    const vId = isDriver ? assignedVehicle?.id : filterVehicle;
    if (!vId) return;
    setSaving(true);
    try {
      await api.post('/expenses', {
        vehicleId: vId,
        type: expenseForm.type,
        amount: Number(expenseForm.amount),
        notes: activeTrip
          ? `[Trip ${activeTrip.tripNumber}] ${expenseForm.notes}`
          : expenseForm.notes,
        date: expenseForm.date ? new Date(expenseForm.date).toISOString() : undefined,
      });
      toast('Expense recorded successfully');
      setExpenseOpen(false);
      setExpenseForm({ type: 'TOLL', amount: '', notes: '', date: new Date().toISOString().split('T')[0] });
      if (isDriver) void loadDriverData(vId);
      else {
        // Refetch all expenses
        const logs = await api.get<Expense[]>('/expenses');
        setAllExpenses(logs);
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed to record expense', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Driver UI Rendering Helpers
  const driverFuelCost = driverFuelLogs.reduce((s, f) => s + f.cost, 0);
  const driverExpenseCost = driverExpenses.reduce((s, e) => s + e.amount, 0);
  const driverMaintCost = driverMaintenance.reduce((s, m) => s + m.cost, 0);
  const driverTotalCost = driverFuelCost + driverExpenseCost + driverMaintCost;

  // Manager calculations - global
  const managerStats = useMemo(() => {
    const today = startOfDay(new Date());
    const fuelToday = allFuelLogs
      .filter((f) => startOfDay(new Date(f.date)).getTime() === today.getTime())
      .reduce((s, f) => s + f.cost, 0);
    const expenseToday = allExpenses
      .filter((e) => startOfDay(new Date(e.date)).getTime() === today.getTime())
      .reduce((s, e) => s + e.amount, 0);
    const totalFuelLiters = allFuelLogs.reduce((s, f) => s + f.liters, 0);
    const totalFuelCost = allFuelLogs.reduce((s, f) => s + f.cost, 0);
    const totalExpenseCost = allExpenses.reduce((s, e) => s + e.amount, 0);
    const totalMaintCost = allMaintenance.reduce((s, m) => s + m.cost, 0);

    return {
      fuelToday,
      expenseToday,
      totalFuelLiters,
      totalFuelCost,
      totalExpenseCost,
      totalMaintCost,
      combinedCost: totalFuelCost + totalExpenseCost + totalMaintCost,
    };
  }, [allFuelLogs, allExpenses, allMaintenance]);

  // Monthly Reports Calculation Engine
  const monthlyReports = useMemo(() => {
    const now = new Date();
    let startLimit = new Date();
    let endLimit = new Date();

    if (monthlyReportRange === 'current') {
      startLimit = startOfMonth(now);
      endLimit = now;
    } else if (monthlyReportRange === 'previous') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startLimit = startOfMonth(prev);
      endLimit = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else {
      const prev3 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      startLimit = startOfMonth(prev3);
      endLimit = now;
    }

    const startMs = startLimit.getTime();
    const endMs = endLimit.getTime();

    const rangeFuel = allFuelLogs.filter((f) => {
      const t = new Date(f.date).getTime();
      return t >= startMs && t <= endMs;
    });

    const rangeExpenses = allExpenses.filter((e) => {
      const t = new Date(e.date).getTime();
      return t >= startMs && t <= endMs;
    });

    const rangeMaint = allMaintenance.filter((m) => {
      const t = new Date(m.openedAt).getTime();
      return t >= startMs && t <= endMs;
    });

    const totalExpense = rangeExpenses.reduce((s, e) => s + e.amount, 0);
    const totalFuelCost = rangeFuel.reduce((s, f) => s + f.cost, 0);
    const totalMaintCost = rangeMaint.reduce((s, m) => s + m.cost, 0);
    const totalCombined = totalExpense + totalFuelCost + totalMaintCost;

    const daysCount = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
    const avgDailyCost = totalCombined / daysCount;

    // Highest expense/fuel days
    const expenseByDate: Record<string, number> = {};
    rangeExpenses.forEach((e) => {
      const d = new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      expenseByDate[d] = (expenseByDate[d] || 0) + e.amount;
    });
    let highestExpenseDay = 'N/A';
    let maxExpenseAmt = 0;
    Object.entries(expenseByDate).forEach(([d, val]) => {
      if (val > maxExpenseAmt) {
        maxExpenseAmt = val;
        highestExpenseDay = d;
      }
    });

    const fuelLitersByDate: Record<string, number> = {};
    rangeFuel.forEach((f) => {
      const d = new Date(f.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      fuelLitersByDate[d] = (fuelLitersByDate[d] || 0) + f.liters;
    });
    let highestFuelDay = 'N/A';
    let maxFuelLit = 0;
    Object.entries(fuelLitersByDate).forEach(([d, val]) => {
      if (val > maxFuelLit) {
        maxFuelLit = val;
        highestFuelDay = d;
      }
    });

    // Vehicle breakdown
    const vehicleCostMap: Record<string, { name: string; fuel: number; expense: number; maint: number }> = {};
    vehicles.forEach((v) => {
      vehicleCostMap[v.id] = { name: `${v.registrationNo} (${v.name})`, fuel: 0, expense: 0, maint: 0 };
    });
    rangeFuel.forEach((f) => {
      if (vehicleCostMap[f.vehicleId]) vehicleCostMap[f.vehicleId].fuel += f.cost;
    });
    rangeExpenses.forEach((e) => {
      if (vehicleCostMap[e.vehicleId]) vehicleCostMap[e.vehicleId].expense += e.amount;
    });
    rangeMaint.forEach((m) => {
      if (vehicleCostMap[m.vehicleId]) vehicleCostMap[m.vehicleId].maint += m.cost;
    });

    let mostExpensiveVehicle = 'N/A';
    let maxVehCost = 0;
    const vehicleBreakdownData = Object.entries(vehicleCostMap).map(([_, stats]) => {
      const total = stats.fuel + stats.expense + stats.maint;
      if (total > maxVehCost) {
        maxVehCost = total;
        mostExpensiveVehicle = stats.name;
      }
      return { name: stats.name, value: Math.round(total) };
    }).filter((x) => x.value > 0);

    // Driver breakdown
    const driverCostMap: Record<string, { name: string; expense: number; fuel: number }> = {};
    drivers.forEach((d) => {
      driverCostMap[d.id] = { name: d.name, expense: 0, fuel: 0 };
    });
    rangeExpenses.forEach((e) => {
      const eDriverId = (e as any).driverId;
      if (eDriverId && driverCostMap[eDriverId]) {
        driverCostMap[eDriverId].expense += e.amount;
      }
    });
    // Associate fuel log to driver via trip relation if possible
    rangeFuel.forEach((f) => {
      const fDriverId = (f.trip as any)?.driver?.id;
      if (fDriverId && driverCostMap[fDriverId]) {
        driverCostMap[fDriverId].fuel += f.cost;
      }
    });

    const driverBreakdownData = Object.entries(driverCostMap).map(([_, stats]) => {
      const total = stats.expense + stats.fuel;
      return { name: stats.name, value: Math.round(total) };
    }).filter((x) => x.value > 0);

    // Daily Trend for charts
    const trendMap: Record<string, { date: string; fuel: number; expense: number; total: number }> = {};
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(startLimit);
      d.setDate(d.getDate() + i);
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      trendMap[label] = { date: label, fuel: 0, expense: 0, total: 0 };
    }
    rangeFuel.forEach((f) => {
      const label = new Date(f.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (trendMap[label]) {
        trendMap[label].fuel += f.cost;
        trendMap[label].total += f.cost;
      }
    });
    rangeExpenses.forEach((e) => {
      const label = new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (trendMap[label]) {
        trendMap[label].expense += e.amount;
        trendMap[label].total += e.amount;
      }
    });

    const trendData = Object.values(trendMap);

    return {
      totalExpense,
      totalFuelCost,
      totalCombined,
      avgDailyCost,
      highestExpenseDay,
      maxExpenseAmt,
      highestFuelDay,
      maxFuelLit,
      mostExpensiveVehicle,
      vehicleBreakdownData,
      driverBreakdownData,
      trendData,
    };
  }, [allFuelLogs, allExpenses, allMaintenance, vehicles, drivers, monthlyReportRange]);

  // Selected Vehicle Report Calculations
  const vehicleReportData = useMemo(() => {
    const vId = selectedReportVehicle;
    if (!vId) return null;
    const v = vehicles.find((x) => x.id === vId);
    if (!v) return null;

    const vFuel = allFuelLogs.filter((f) => f.vehicleId === vId);
    const vExpenses = allExpenses.filter((e) => e.vehicleId === vId);
    const vMaint = allMaintenance.filter((m) => m.vehicleId === vId);

    const fuelCost = vFuel.reduce((s, f) => s + f.cost, 0);
    const expenseCost = vExpenses.reduce((s, e) => s + e.amount, 0);
    const maintCost = vMaint.reduce((s, m) => s + m.cost, 0);
    const totalCost = fuelCost + expenseCost + maintCost;

    // Monthly Trend specific to vehicle
    const monthlyMap: Record<string, { month: string; fuel: number; expense: number }> = {};
    vFuel.forEach((f) => {
      const m = new Date(f.date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, fuel: 0, expense: 0 };
      monthlyMap[m].fuel += f.cost;
    });
    vExpenses.forEach((e) => {
      const m = new Date(e.date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, fuel: 0, expense: 0 };
      monthlyMap[m].expense += e.amount;
    });

    const trendData = Object.values(monthlyMap);

    return {
      vehicle: v,
      fuelLogs: vFuel,
      expenses: vExpenses,
      fuelCost,
      expenseCost,
      maintCost,
      totalCost,
      trendData,
    };
  }, [selectedReportVehicle, allFuelLogs, allExpenses, allMaintenance, vehicles]);

  // Selected Driver Report Calculations
  const driverReportData = useMemo(() => {
    const dId = selectedReportDriver;
    if (!dId) return null;
    const d = drivers.find((x) => x.id === dId);
    if (!d) return null;

    const dExpenses = allExpenses.filter((e) => (e as any).driverId === dId);
    const dFuel = allFuelLogs.filter((f) => (f.trip as any)?.driver?.id === dId);

    const totalExpenses = dExpenses.reduce((s, e) => s + e.amount, 0);
    const totalFuelCost = dFuel.reduce((s, f) => s + f.cost, 0);

    const activeTrip = (d as any).trips?.find((t: any) => t.status === 'DISPATCHED');
    const assignedVehReg = activeTrip?.vehicle?.registrationNo || 'None Assigned';

    // Type Breakdown for Pie Chart
    const typeMap: Record<string, number> = { TOLL: 0, MAINTENANCE: 0, OTHER: 0 };
    dExpenses.forEach((e) => {
      typeMap[e.type] = (typeMap[e.type] || 0) + e.amount;
    });
    const typeBreakdown = Object.entries(typeMap).map(([type, amt]) => ({
      name: type === 'TOLL' ? 'Toll' : type === 'MAINTENANCE' ? 'Repair' : 'Other',
      value: Math.round(amt),
    })).filter((x) => x.value > 0);

    return {
      driver: d,
      expenses: dExpenses,
      fuelLogs: dFuel,
      totalExpenses,
      totalFuelCost,
      assignedVehReg,
      typeBreakdown,
    };
  }, [selectedReportDriver, allExpenses, allFuelLogs, drivers]);

  // All Logs Tab filtering and sorting
  const filteredAndSortedLogs = useMemo(() => {
    let startLimit: number | null = null;
    let endLimit: number | null = null;

    if (filterDateRange === 'today') {
      startLimit = startOfDay(new Date()).getTime();
      endLimit = new Date().getTime();
    } else if (filterDateRange === 'week') {
      startLimit = startOfWeek(new Date()).getTime();
      endLimit = new Date().getTime();
    } else if (filterDateRange === 'month') {
      startLimit = startOfMonth(new Date()).getTime();
      endLimit = new Date().getTime();
    } else if (filterDateRange === 'custom') {
      if (filterStart) startLimit = startOfDay(new Date(filterStart)).getTime();
      if (filterEnd) {
        const end = new Date(filterEnd);
        end.setHours(23, 59, 59, 999);
        endLimit = end.getTime();
      }
    }

    if (logType === 'fuel') {
      let data = [...allFuelLogs];
      if (filterVehicle) data = data.filter((f) => f.vehicleId === filterVehicle);
      if (filterDriver) data = data.filter((f) => (f.trip as any)?.driver?.id === filterDriver);
      if (startLimit) data = data.filter((f) => new Date(f.date).getTime() >= startLimit!);
      if (endLimit) data = data.filter((f) => new Date(f.date).getTime() <= endLimit!);
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        data = data.filter((f) => f.trip?.tripNumber?.toLowerCase().includes(s));
      }

      // Sort
      data.sort((a, b) => {
        if (sortKey === 'date') {
          const tA = new Date(a.date).getTime();
          const tB = new Date(b.date).getTime();
          return sortAsc ? tA - tB : tB - tA;
        }
        if (sortKey === 'amount') {
          return sortAsc ? a.cost - b.cost : b.cost - a.cost;
        }
        return 0;
      });

      return data;
    } else {
      let data = [...allExpenses];
      if (filterVehicle) data = data.filter((e) => e.vehicleId === filterVehicle);
      if (filterDriver) data = data.filter((e) => (e as any).driverId === filterDriver);
      if (filterExpenseType) data = data.filter((e) => e.type === filterExpenseType);
      if (startLimit) data = data.filter((e) => new Date(e.date).getTime() >= startLimit!);
      if (endLimit) data = data.filter((e) => new Date(e.date).getTime() <= endLimit!);
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        data = data.filter((e) => e.notes?.toLowerCase().includes(s));
      }

      // Sort
      data.sort((a, b) => {
        if (sortKey === 'date') {
          const tA = new Date(a.date).getTime();
          const tB = new Date(b.date).getTime();
          return sortAsc ? tA - tB : tB - tA;
        }
        if (sortKey === 'amount') {
          return sortAsc ? a.amount - b.amount : b.amount - a.amount;
        }
        return 0;
      });

      return data;
    }
  }, [logType, allFuelLogs, allExpenses, filterVehicle, filterDriver, filterExpenseType, filterDateRange, filterStart, filterEnd, searchTerm, sortKey, sortAsc]);

  // Render Driver Layout
  if (isDriver) {
    return (
      <div>
        <PageHeader
          title="Fuel & Expenses"
          subtitle="Record expenses and fuel logs directly related to your active dispatch."
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!assignedVehicle}
                onClick={() => setFuelOpen(true)}
              >
                Log Fuel
              </Button>
              <Button
                disabled={!assignedVehicle}
                onClick={() => setExpenseOpen(true)}
              >
                Add Expense
              </Button>
            </div>
          }
        />

        {!assignedVehicle && (
          <div className="mb-4 rounded-md bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            You are not currently assigned to an active vehicle. To report issues or record expenses, you must be on an active dispatched trip.
          </div>
        )}

        {assignedVehicle && (
          <>
            <div className="mb-4 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              Active Assigned Vehicle: <span className="underline">{assignedVehicle.name} ({assignedVehicle.registrationNo})</span>
              {activeTrip && <> on active Trip: <span className="underline">{activeTrip.tripNumber} ({activeTrip.source} → {activeTrip.destination})</span></>}
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <CostTile label="Fuel Cost" value={driverFuelCost} icon={Droplet} accent="text-sky-500" />
              <CostTile label="Maintenance Cost" value={driverMaintCost} icon={Wrench} accent="text-amber-500" />
              <CostTile label="Other Expenses" value={driverExpenseCost} icon={DollarSign} accent="text-violet-500" />
              <CostTile label="Operational Cost" value={driverTotalCost} icon={DollarSign} accent="text-primary" bold />
            </div>

            {loading ? (
              <LoadingState />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>My Fuel Logs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {driverFuelLogs.length === 0 ? (
                      <EmptyState icon={Fuel} title="No fuel logs logged" />
                    ) : (
                      <Table>
                        <THead>
                          <TR>
                            <TH>Date</TH>
                            <TH>Liters</TH>
                            <TH>Cost</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {driverFuelLogs.map((f) => (
                            <TR key={f.id}>
                              <TD>{formatDate(f.date)}</TD>
                              <TD>{formatNumber(f.liters, 1)} L</TD>
                              <TD>{formatCurrency(f.cost)}</TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>My Trip Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {driverExpenses.length === 0 ? (
                      <EmptyState icon={DollarSign} title="No expenses logged" />
                    ) : (
                      <Table>
                        <THead>
                          <TR>
                            <TH>Date</TH>
                            <TH>Type</TH>
                            <TH>Amount</TH>
                            <TH>Notes</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {driverExpenses.map((ex) => (
                            <TR key={ex.id}>
                              <TD>{formatDate(ex.date)}</TD>
                              <TD>
                                <ExpenseTypeBadge type={ex.type} />
                              </TD>
                              <TD>{formatCurrency(ex.amount)}</TD>
                              <TD className="text-muted-foreground">{ex.notes ?? '—'}</TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {/* Dialog Modals */}
        <Dialog open={fuelOpen} onClose={() => setFuelOpen(false)} title="Log Fuel">
          {assignedVehicle && (
            <form onSubmit={handleLogFuel} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Assigned Vehicle</Label>
                <Input value={`${assignedVehicle.registrationNo} — ${assignedVehicle.name}`} disabled readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Liters *</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={fuelForm.liters}
                  onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cost *</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={fuelForm.cost}
                  onChange={(e) => setFuelForm({ ...fuelForm, cost: e.target.value })}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setFuelOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Log Fuel'}
                </Button>
              </div>
            </form>
          )}
        </Dialog>

        <Dialog open={expenseOpen} onClose={() => setExpenseOpen(false)} title="Record Expense">
          {assignedVehicle && (
            <form onSubmit={handleLogExpense} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Assigned Vehicle</Label>
                  <Input value={`${assignedVehicle.registrationNo} — ${assignedVehicle.name}`} disabled readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label>Active Trip</Label>
                  <Input value={activeTrip ? activeTrip.tripNumber : 'N/A'} disabled readOnly />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Expense Type *</Label>
                <Select
                  value={expenseForm.type}
                  onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}
                  required
                >
                  <option value="TOLL">Toll Charge</option>
                  <option value="MAINTENANCE">Emergency Repair</option>
                  <option value="OTHER">Parking / Washing / Miscellaneous</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description / Remarks *</Label>
                <textarea
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  placeholder="Detail context..."
                  required
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setExpenseOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Record Expense'}
                </Button>
              </div>
            </form>
          )}
        </Dialog>
      </div>
    );
  }

  // Render Manager Layout
  return (
    <div>
      <PageHeader
        title="Fuel & Expenses Analytics"
        subtitle="Operational costs analysis, vehicle and driver breakdowns, monthly trends, and report generation."
      />

      {/* Tabs Menu */}
      <div className="mb-6 flex gap-2 border-b pb-px">
        {[
          { id: 'dashboard', label: 'Analytics Dashboard' },
          { id: 'vehicles', label: 'Vehicle Reports' },
          { id: 'drivers', label: 'Driver Reports' },
          { id: 'logs', label: 'All Logs' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {/* TAB 1: ANALYTICS DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Daily KPI tiles */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <CostTile label="Fuel Cost Today" value={managerStats.fuelToday} icon={Droplet} accent="text-sky-500" />
                <CostTile label="Expenses Today" value={managerStats.expenseToday} icon={DollarSign} accent="text-violet-500" />
                <CostTile label="Combined Fleet Cost" value={managerStats.combinedCost} icon={DollarSign} accent="text-primary" bold />
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Fuel className="size-4 text-emerald-500" />
                    Total Fuel Consumed
                  </div>
                  <p className="mt-2 text-2xl font-semibold">
                    {formatNumber(managerStats.totalFuelLiters, 1)} L
                  </p>
                </Card>
              </div>

              {/* Monthly Reports Generator */}
              <Card>
                <CardHeader className="flex-row items-center justify-between border-b pb-4">
                  <div>
                    <CardTitle className="text-lg">Monthly Analytics Generator</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Generate daily cost trends and breakdowns over specific monthly windows.</p>
                  </div>
                  <Select
                    value={monthlyReportRange}
                    onChange={(e) => setMonthlyReportRange(e.target.value as any)}
                    className="w-48"
                  >
                    <option value="current">Current Month</option>
                    <option value="previous">Previous Month</option>
                    <option value="last3">Last 3 Months</option>
                  </Select>
                </CardHeader>
                <CardContent className="pt-6">
                  {/* Monthly KPI Overview */}
                  <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5 mb-6 text-center">
                    <div className="rounded-lg bg-accent/30 p-3">
                      <p className="text-xs text-muted-foreground">Total Expenses</p>
                      <p className="text-lg font-bold text-violet-500 mt-1">{formatCurrency(monthlyReports.totalExpense)}</p>
                    </div>
                    <div className="rounded-lg bg-accent/30 p-3">
                      <p className="text-xs text-muted-foreground">Total Fuel Cost</p>
                      <p className="text-lg font-bold text-sky-500 mt-1">{formatCurrency(monthlyReports.totalFuelCost)}</p>
                    </div>
                    <div className="rounded-lg bg-accent/30 p-3">
                      <p className="text-xs text-muted-foreground">Daily Average Cost</p>
                      <p className="text-lg font-bold mt-1">{formatCurrency(monthlyReports.avgDailyCost)}</p>
                    </div>
                    <div className="rounded-lg bg-accent/30 p-3">
                      <p className="text-xs text-muted-foreground">Peak Expense Day</p>
                      <p className="text-sm font-bold mt-1 text-amber-500 leading-tight">
                        {monthlyReports.highestExpenseDay} <br/>
                        <span className="text-xs font-normal">({formatCurrency(monthlyReports.maxExpenseAmt)})</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-accent/30 p-3">
                      <p className="text-xs text-muted-foreground">Peak Fuel Day</p>
                      <p className="text-sm font-bold mt-1 text-emerald-500 leading-tight">
                        {monthlyReports.highestFuelDay} <br/>
                        <span className="text-xs font-normal">({formatNumber(monthlyReports.maxFuelLit, 1)} L)</span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400 mb-6 font-medium">
                    Most Expensive Vehicle: <span className="underline">{monthlyReports.mostExpensiveVehicle}</span>
                  </div>

                  {/* Daily Trend Line Chart */}
                  <div className="mb-8">
                    <p className="font-semibold text-sm mb-4">Daily Cost Trend (Fuel vs Expenses)</p>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyReports.trendData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <RTooltip formatter={(v) => formatCurrency(v as number)} />
                          <Legend />
                          <Line type="monotone" dataKey="fuel" stroke="#3b82f6" name="Fuel Cost" strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="expense" stroke="#8b5cf6" name="Expense" strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Vehicle and Driver breakdowns side-by-side */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <p className="font-semibold text-sm mb-4">Cost Breakdown by Vehicle</p>
                      {monthlyReports.vehicleBreakdownData.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-10">No data available for this range</p>
                      ) : (
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyReports.vehicleBreakdownData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <RTooltip formatter={(v) => formatCurrency(v as number)} />
                              <Bar dataKey="value" fill="hsl(var(--primary))" name="Total Cost" radius={[4, 4, 0, 0]}>
                                {monthlyReports.vehicleBreakdownData.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-sm mb-4">Expense Breakdown by Driver</p>
                      {monthlyReports.driverBreakdownData.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-10">No data available for this range</p>
                      ) : (
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={monthlyReports.driverBreakdownData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                outerRadius={70}
                                dataKey="value"
                              >
                                {monthlyReports.driverBreakdownData.map((_, i) => (
                                  <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                                ))}
                              </Pie>
                              <RTooltip formatter={(v) => formatCurrency(v as number)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: VEHICLE REPORTS */}
          {activeTab === 'vehicles' && (
            <div className="space-y-6">
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Label className="shrink-0">Select Vehicle</Label>
                  <Select
                    value={selectedReportVehicle}
                    onChange={(e) => setSelectedReportVehicle(e.target.value)}
                    className="w-72"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registrationNo} — {v.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </Card>

              {vehicleReportData && (
                <>
                  {/* Cost Summary Cards */}
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <CostTile label="Total Fuel Cost" value={vehicleReportData.fuelCost} icon={Droplet} accent="text-sky-500" />
                    <CostTile label="Total Maintenance Cost" value={vehicleReportData.maintCost} icon={Wrench} accent="text-amber-500" />
                    <CostTile label="Total Other Expenses" value={vehicleReportData.expenseCost} icon={DollarSign} accent="text-violet-500" />
                    <CostTile label="Combined Vehicle Cost" value={vehicleReportData.totalCost} icon={DollarSign} accent="text-primary" bold />
                  </div>

                  {/* Monthly Trend Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Monthly Operational Cost Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {vehicleReportData.trendData.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No historical costs found for this vehicle.</p>
                      ) : (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={vehicleReportData.trendData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <RTooltip formatter={(v) => formatCurrency(v as number)} />
                              <Legend />
                              <Bar dataKey="fuel" fill="#3b82f6" name="Fuel Cost" stackId="a" />
                              <Bar dataKey="expense" fill="#8b5cf6" name="Expense" stackId="a" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* History Listings */}
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">Fuel Logs History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {vehicleReportData.fuelLogs.length === 0 ? (
                          <EmptyState icon={Fuel} title="No fuel logs" />
                        ) : (
                          <Table>
                            <THead>
                              <TR>
                                <TH>Date</TH>
                                <TH>Liters</TH>
                                <TH>Cost</TH>
                              </TR>
                            </THead>
                            <TBody>
                              {vehicleReportData.fuelLogs.map((f) => (
                                <TR key={f.id}>
                                  <TD>{formatDate(f.date)}</TD>
                                  <TD>{formatNumber(f.liters, 1)} L</TD>
                                  <TD>{formatCurrency(f.cost)}</TD>
                                </TR>
                              ))}
                            </TBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">Expenses History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {vehicleReportData.expenses.length === 0 ? (
                          <EmptyState icon={DollarSign} title="No expenses logged" />
                        ) : (
                          <Table>
                            <THead>
                              <TR>
                                <TH>Date</TH>
                                <TH>Type</TH>
                                <TH>Amount</TH>
                                <TH>Description</TH>
                              </TR>
                            </THead>
                            <TBody>
                              {vehicleReportData.expenses.map((ex) => (
                                <TR key={ex.id}>
                                  <TD>{formatDate(ex.date)}</TD>
                                  <TD><ExpenseTypeBadge type={ex.type} /></TD>
                                  <TD>{formatCurrency(ex.amount)}</TD>
                                  <TD className="text-muted-foreground">{ex.notes ?? '—'}</TD>
                                </TR>
                              ))}
                            </TBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: DRIVER REPORTS */}
          {activeTab === 'drivers' && (
            <div className="space-y-6">
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Label className="shrink-0">Select Driver</Label>
                  <Select
                    value={selectedReportDriver}
                    onChange={(e) => setSelectedReportDriver(e.target.value)}
                    className="w-72"
                  >
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </Card>

              {driverReportData && (
                <>
                  {/* Stats and assigned vehicle details */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Truck className="size-4 text-emerald-500" />
                        Assigned Vehicle
                      </div>
                      <p className="mt-2 text-xl font-bold">{driverReportData.assignedVehReg}</p>
                    </Card>
                    <CostTile label="Total Expenses Submitted" value={driverReportData.totalExpenses} icon={DollarSign} accent="text-violet-500" />
                    <CostTile label="Total Fuel Cost Submitted" value={driverReportData.totalFuelCost} icon={Droplet} accent="text-sky-500" />
                  </div>

                  {/* Expense Type Pie Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold">Expense Type Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {driverReportData.typeBreakdown.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No expenses submitted by this driver.</p>
                      ) : (
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={driverReportData.typeBreakdown}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                outerRadius={70}
                                dataKey="value"
                              >
                                {driverReportData.typeBreakdown.map((_, i) => (
                                  <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                                ))}
                              </Pie>
                              <RTooltip formatter={(v) => formatCurrency(v as number)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Submitted Lists */}
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">Expenses Submitted</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {driverReportData.expenses.length === 0 ? (
                          <EmptyState icon={DollarSign} title="No expenses submitted" />
                        ) : (
                          <Table>
                            <THead>
                              <TR>
                                <TH>Date</TH>
                                <TH>Vehicle</TH>
                                <TH>Amount</TH>
                                <TH>Notes</TH>
                              </TR>
                            </THead>
                            <TBody>
                              {driverReportData.expenses.map((e) => {
                                const veh = vehicles.find((x) => x.id === e.vehicleId);
                                return (
                                  <TR key={e.id}>
                                    <TD>{formatDate(e.date)}</TD>
                                    <TD>{veh ? veh.registrationNo : '—'}</TD>
                                    <TD>{formatCurrency(e.amount)}</TD>
                                    <TD className="text-muted-foreground">{e.notes ?? '—'}</TD>
                                  </TR>
                                );
                              })}
                            </TBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold">Fuel Logs Submitted</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {driverReportData.fuelLogs.length === 0 ? (
                          <EmptyState icon={Fuel} title="No fuel logs logged" />
                        ) : (
                          <Table>
                            <THead>
                              <TR>
                                <TH>Date</TH>
                                <TH>Vehicle</TH>
                                <TH>Liters</TH>
                                <TH>Cost</TH>
                              </TR>
                            </THead>
                            <TBody>
                              {driverReportData.fuelLogs.map((f) => {
                                const veh = vehicles.find((x) => x.id === f.vehicleId);
                                return (
                                  <TR key={f.id}>
                                    <TD>{formatDate(f.date)}</TD>
                                    <TD>{veh ? veh.registrationNo : '—'}</TD>
                                    <TD>{formatNumber(f.liters, 1)} L</TD>
                                    <TD>{formatCurrency(f.cost)}</TD>
                                  </TR>
                                );
                              })}
                            </TBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: ALL LOGS TABLE */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              {/* Filters Block */}
              <Card className="p-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <div className="space-y-1">
                    <Label className="text-xs">Log Category</Label>
                    <Select value={logType} onChange={(e) => setLogType(e.target.value as any)}>
                      <option value="fuel">Fuel Logs</option>
                      <option value="expense">Expenses</option>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Vehicle</Label>
                    <Select value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
                      <option value="">All Vehicles</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.registrationNo}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Driver</Label>
                    <Select value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)}>
                      <option value="">All Drivers</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {logType === 'expense' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Expense Type</Label>
                      <Select value={filterExpenseType} onChange={(e) => setFilterExpenseType(e.target.value)}>
                        <option value="">All Types</option>
                        <option value="TOLL">Toll</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="OTHER">Other</option>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">Date Window</Label>
                    <Select value={filterDateRange} onChange={(e) => setFilterDateRange(e.target.value)}>
                      <option value="all">All History</option>
                      <option value="today">Today</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                      <option value="custom">Custom Date Range</option>
                    </Select>
                  </div>
                </div>

                {filterDateRange === 'custom' && (
                  <div className="mt-4 flex gap-3 border-t pt-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Start Date</Label>
                      <Input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Date</Label>
                      <Input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2 border-t pt-4">
                  <Search className="size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by notes or trip reference..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                  />
                </div>
              </Card>

              {/* Data Table */}
              <Card>
                <CardHeader className="flex-row items-center justify-between border-b py-3">
                  <CardTitle className="text-sm font-semibold">
                    Operational Logs ({filteredAndSortedLogs.length} found)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredAndSortedLogs.length === 0 ? (
                    <div className="p-8">
                      <EmptyState icon={Calendar} title="No operational logs match filter parameters." />
                    </div>
                  ) : (
                    <Table>
                      <THead>
                        <TR>
                          <TH className="cursor-pointer select-none" onClick={() => { setSortKey('date'); setSortAsc(!sortAsc); }}>
                            Date {sortKey === 'date' && (sortAsc ? '▲' : '▼')}
                          </TH>
                          <TH>Vehicle</TH>
                          <TH>Driver</TH>
                          {logType === 'fuel' ? (
                            <>
                              <TH>Liters</TH>
                              <TH className="cursor-pointer select-none" onClick={() => { setSortKey('amount'); setSortAsc(!sortAsc); }}>
                                Fuel Cost {sortKey === 'amount' && (sortAsc ? '▲' : '▼')}
                              </TH>
                              <TH>Trip</TH>
                            </>
                          ) : (
                            <>
                              <TH>Type</TH>
                              <TH className="cursor-pointer select-none" onClick={() => { setSortKey('amount'); setSortAsc(!sortAsc); }}>
                                Amount {sortKey === 'amount' && (sortAsc ? '▲' : '▼')}
                              </TH>
                              <TH>Remarks / Details</TH>
                            </>
                          )}
                        </TR>
                      </THead>
                      <TBody>
                        {filteredAndSortedLogs.map((log: any) => {
                          const veh = log.vehicle || vehicles.find((v) => v.id === log.vehicleId);
                          const driverName = log.driver?.name || log.trip?.driver?.name || 'Unassigned';
                          return (
                            <TR key={log.id}>
                              <TD>{formatDate(log.date)}</TD>
                              <TD className="font-semibold">{veh ? veh.registrationNo : '—'}</TD>
                              <TD>{driverName}</TD>
                              {logType === 'fuel' ? (
                                <>
                                  <TD>{formatNumber(log.liters, 1)} L</TD>
                                  <TD className="font-bold text-sky-500">{formatCurrency(log.cost)}</TD>
                                  <TD className="text-muted-foreground">{log.trip?.tripNumber ?? '—'}</TD>
                                </>
                              ) : (
                                <>
                                  <TD><ExpenseTypeBadge type={log.type} /></TD>
                                  <TD className="font-bold text-violet-500">{formatCurrency(log.amount)}</TD>
                                  <TD className="text-muted-foreground text-xs max-w-sm truncate">{log.notes ?? '—'}</TD>
                                </>
                              )}
                            </TR>
                          );
                        })}
                      </TBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CostTile({
  label,
  value,
  icon: Icon,
  accent,
  bold,
}: {
  label: string;
  value: number;
  icon: typeof DollarSign;
  accent: string;
  bold?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={`size-4 ${accent}`} />
        {label}
      </div>
      <p className={`mt-2 text-2xl ${bold ? 'font-bold' : 'font-semibold'}`}>
        {formatCurrency(value)}
      </p>
    </Card>
  );
}
