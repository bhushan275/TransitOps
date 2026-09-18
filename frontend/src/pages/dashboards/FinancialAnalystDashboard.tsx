import { Link } from 'react-router-dom';
import {
  BarChart3,
  DollarSign,
  Fuel,
  Receipt,
  TrendingUp,
  Wallet,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { KpiCard } from '@/components/shared/KpiCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { DetailDialog, DetailColumn } from '@/components/shared/DetailDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/spinner';
import { ExpenseTypeBadge, TripStatusBadge } from '@/components/shared/StatusBadge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Expense, FinanceDashboardData, FuelLog, MaintenanceLog, Trip } from '@/lib/types';
import { formatCurrency, formatDateTime, formatNumber, isThisMonth } from '@/lib/utils';

const EXPENSE_COLORS: Record<string, string> = {
  TOLL: '#0ea5e9',
  MAINTENANCE: '#f59e0b',
  OTHER: '#8b5cf6',
};

type FinanceModalKey =
  | 'TODAY'
  | 'MONTH_EXPENSES'
  | 'FUEL'
  | 'MAINTENANCE'
  | 'OP_COST'
  | 'REVENUE';

/* eslint-disable @typescript-eslint/no-explicit-any */
const expenseColumns: DetailColumn<any>[] = [
  { header: 'Type', render: (e: Expense) => <ExpenseTypeBadge type={e.type} /> },
  {
    header: 'Amount',
    render: (e: Expense) => <span className="font-semibold">{formatCurrency(e.amount)}</span>,
  },
  { header: 'Vehicle', render: (e: Expense) => e.vehicle?.registrationNo ?? '—' },
  { header: 'Driver', render: (e: Expense) => e.driver?.name ?? '—' },
  {
    header: 'Notes',
    render: (e: Expense) => <span className="text-muted-foreground">{e.notes || '—'}</span>,
  },
  {
    header: 'Date',
    render: (e: Expense) => <span className="text-muted-foreground">{formatDateTime(e.date)}</span>,
  },
];

export function FinancialAnalystDashboard() {
  const { data, loading, error } = useApi<FinanceDashboardData>(() => api.get('/dashboard'), []);

  const [activeModal, setActiveModal] = useState<FinanceModalKey | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const modals: Record<
    FinanceModalKey,
    { title: string; load: () => Promise<any[]>; columns: DetailColumn<any>[] }
  > = {
    TODAY: {
      title: "Today's Expenses",
      load: () => api.get<Expense[]>('/expenses', { date: 'today' }),
      columns: expenseColumns,
    },
    MONTH_EXPENSES: {
      title: 'Expenses This Month',
      load: async () => (await api.get<Expense[]>('/expenses')).filter((e) => isThisMonth(e.date)),
      columns: expenseColumns,
    },
    FUEL: {
      title: 'Fuel Logs This Month',
      load: async () => (await api.get<FuelLog[]>('/fuel-logs')).filter((f) => isThisMonth(f.date)),
      columns: [
        { header: 'Vehicle', render: (f: FuelLog) => f.vehicle?.registrationNo ?? '—' },
        { header: 'Trip', render: (f: FuelLog) => f.trip?.tripNumber ?? '—' },
        { header: 'Driver', render: (f: FuelLog) => f.trip?.driver?.name ?? '—' },
        { header: 'Liters', render: (f: FuelLog) => `${formatNumber(f.liters, 1)} L` },
        {
          header: 'Cost',
          render: (f: FuelLog) => <span className="font-semibold">{formatCurrency(f.cost)}</span>,
        },
        {
          header: 'Date',
          render: (f: FuelLog) => (
            <span className="text-muted-foreground">{formatDateTime(f.date)}</span>
          ),
        },
      ],
    },
    MAINTENANCE: {
      title: 'Maintenance This Month',
      load: async () =>
        (await api.get<MaintenanceLog[]>('/maintenance')).filter((m) => isThisMonth(m.openedAt)),
      columns: [
        {
          header: 'Vehicle',
          render: (m: MaintenanceLog) => (
            <span className="font-medium">
              {m.vehicle?.name} ({m.vehicle?.registrationNo})
            </span>
          ),
        },
        { header: 'Description', render: (m: MaintenanceLog) => m.description },
        {
          header: 'Cost',
          render: (m: MaintenanceLog) => (
            <span className="font-semibold">{formatCurrency(m.cost)}</span>
          ),
        },
        {
          header: 'Status',
          render: (m: MaintenanceLog) => (
            <Badge tone={m.isActive ? 'warning' : 'success'}>
              {m.isActive ? 'Open' : 'Closed'}
            </Badge>
          ),
        },
        {
          header: 'Opened',
          render: (m: MaintenanceLog) => (
            <span className="text-muted-foreground">{formatDateTime(m.openedAt)}</span>
          ),
        },
      ],
    },
    OP_COST: {
      title: 'Operational Cost per Vehicle (Month)',
      load: () => Promise.resolve(data?.costPerVehicle ?? []),
      columns: [
        {
          header: 'Vehicle',
          render: (v) => (
            <span className="font-medium">
              {v.name} ({v.registrationNo})
            </span>
          ),
        },
        { header: 'Fuel', render: (v) => formatCurrency(v.fuelCost) },
        { header: 'Maintenance', render: (v) => formatCurrency(v.maintenanceCost) },
        { header: 'Expenses', render: (v) => formatCurrency(v.expenseCost) },
        {
          header: 'Total',
          render: (v) => <span className="font-semibold">{formatCurrency(v.total)}</span>,
        },
      ],
    },
    REVENUE: {
      title: 'Revenue This Month (completed trips)',
      load: async () =>
        (await api.get<Trip[]>('/trips', { status: 'COMPLETED' })).filter((t) =>
          isThisMonth(t.completedAt),
        ),
      columns: [
        {
          header: 'Trip #',
          render: (t: Trip) => <span className="font-medium">{t.tripNumber}</span>,
        },
        {
          header: 'Route',
          render: (t: Trip) => (
            <span className="text-muted-foreground">
              {t.source} → {t.destination}
            </span>
          ),
        },
        { header: 'Driver', render: (t: Trip) => t.driver?.name ?? '—' },
        {
          header: 'Revenue',
          render: (t: Trip) => <span className="font-semibold">{formatCurrency(t.revenue)}</span>,
        },
        { header: 'Status', render: (t: Trip) => <TripStatusBadge status={t.status} /> },
        {
          header: 'Completed',
          render: (t: Trip) => (
            <span className="text-muted-foreground">{formatDateTime(t.completedAt)}</span>
          ),
        },
      ],
    },
  };

  useEffect(() => {
    if (!activeModal) {
      setRows([]);
      setModalError(null);
      return;
    }
    setModalLoading(true);
    setModalError(null);
    modals[activeModal]
      .load()
      .then(setRows)
      .catch((e) => setModalError(e instanceof ApiError ? e.message : 'Failed to load details'))
      .finally(() => setModalLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModal]);

  const pieData = data
    ? Object.entries(data.monthExpenseBreakdown)
        .map(([name, value]) => ({ name, value }))
        .filter((d) => d.value > 0)
    : [];

  return (
    <div>
      <PageHeader
        title="Finance Dashboard"
        subtitle="Operational spend, revenue, and cost per vehicle (month to date)"
        actions={
          <Link to="/reports">
            <Button>
              <BarChart3 /> Full Reports
            </Button>
          </Link>
        }
      />

      {loading && <LoadingState />}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <KpiCard
              label="Today's Expenses"
              value={formatCurrency(data.kpis.todaysExpensesTotal)}
              icon={Receipt}
              accent="danger"
              onClick={() => setActiveModal('TODAY')}
            />
            <KpiCard
              label="Expenses (Month)"
              value={formatCurrency(data.kpis.monthExpenses)}
              icon={Wallet}
              accent="warning"
              onClick={() => setActiveModal('MONTH_EXPENSES')}
            />
            <KpiCard
              label="Fuel Cost (Month)"
              value={formatCurrency(data.kpis.monthFuelCost)}
              icon={Fuel}
              accent="info"
              onClick={() => setActiveModal('FUEL')}
            />
            <KpiCard
              label="Maintenance (Month)"
              value={formatCurrency(data.kpis.monthMaintenanceCost)}
              icon={Wrench}
              accent="warning"
              onClick={() => setActiveModal('MAINTENANCE')}
            />
            <KpiCard
              label="Operational Cost (Month)"
              value={formatCurrency(data.kpis.monthOperationalCost)}
              icon={DollarSign}
              accent="danger"
              hint="Expenses + fuel + maintenance"
              onClick={() => setActiveModal('OP_COST')}
            />
            <KpiCard
              label="Revenue (Month)"
              value={formatCurrency(data.kpis.monthRevenue)}
              icon={TrendingUp}
              accent="success"
              hint="From completed trips"
              onClick={() => setActiveModal('REVENUE')}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Expense Breakdown (Month)</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <EmptyState icon={DollarSign} title="No expenses this month" />
                ) : (
                  <>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                          >
                            {pieData.map((d) => (
                              <Cell key={d.name} fill={EXPENSE_COLORS[d.name]} />
                            ))}
                          </Pie>
                          <RTooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 space-y-2">
                      {pieData.map((d) => (
                        <div key={d.name} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span
                              className="size-3 rounded-full"
                              style={{ background: EXPENSE_COLORS[d.name] }}
                            />
                            {d.name}
                          </span>
                          <span className="font-medium">{formatCurrency(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Costliest Vehicles (Month)</CardTitle>
              </CardHeader>
              <CardContent>
                {data.costPerVehicle.length === 0 ? (
                  <EmptyState icon={BarChart3} title="No vehicle costs this month" />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.costPerVehicle} margin={{ left: 8, right: 8 }}>
                        <XAxis dataKey="registrationNo" fontSize={12} tickLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                        <RTooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="fuelCost" name="Fuel" stackId="c" fill="#0ea5e9" />
                        <Bar
                          dataKey="maintenanceCost"
                          name="Maintenance"
                          stackId="c"
                          fill="#f59e0b"
                        />
                        <Bar
                          dataKey="expenseCost"
                          name="Expenses"
                          stackId="c"
                          fill="#8b5cf6"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentExpenses.length === 0 ? (
                <EmptyState icon={Receipt} title="No expenses recorded" />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Type</TH>
                      <TH>Amount</TH>
                      <TH>Vehicle</TH>
                      <TH>Driver</TH>
                      <TH>Notes</TH>
                      <TH>Date</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.recentExpenses.map((e) => (
                      <TR key={e.id}>
                        <TD>
                          <ExpenseTypeBadge type={e.type} />
                        </TD>
                        <TD className="font-semibold">{formatCurrency(e.amount)}</TD>
                        <TD>{e.vehicle?.registrationNo ?? '—'}</TD>
                        <TD>{e.driver?.name ?? '—'}</TD>
                        <TD className="text-muted-foreground">{e.notes || '—'}</TD>
                        <TD className="text-muted-foreground">{formatDateTime(e.date)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <DetailDialog
        open={!!activeModal}
        onClose={() => setActiveModal(null)}
        title={activeModal ? modals[activeModal].title : ''}
        loading={modalLoading}
        error={modalError}
        rows={rows}
        columns={activeModal ? modals[activeModal].columns : []}
      />
    </div>
  );
}
