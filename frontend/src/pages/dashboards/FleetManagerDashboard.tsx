import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Activity,
  CircleCheck,
  DollarSign,
  Fuel,
  Gauge,
  Search,
  Truck,
  UserCheck,
  Wrench,
} from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';
import { KpiCard } from '@/components/shared/KpiCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/spinner';
import { TripStatusBadge } from '@/components/shared/StatusBadge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { DashboardData } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

const EXPENSE_COLORS: Record<string, string> = {
  TOLL: '#0ea5e9',
  MAINTENANCE: '#f59e0b',
  OTHER: '#8b5cf6',
};

export function FleetManagerDashboard() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [region, setRegion] = useState('');

  const { data, loading, error } = useApi<DashboardData>(
    () => api.get('/dashboard', { type, status, region }),
    [type, status, region],
  );

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalData, setModalData] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    if (!activeModal) {
      setModalData([]);
      setSearchQuery('');
      setSortField(null);
      setCurrentPage(1);
      return;
    }

    setModalLoading(true);
    setModalError(null);

    let endpoint = '';
    if (activeModal === 'ACTIVE_VEHICLES') endpoint = '/vehicles';
    else if (activeModal === 'AVAILABLE_VEHICLES') endpoint = '/vehicles/available';
    else if (activeModal === 'MAINTENANCE_VEHICLES') endpoint = '/maintenance?isActive=true';
    else if (activeModal === 'ACTIVE_TRIPS') endpoint = '/trips/active';
    else if (activeModal === 'DRIVERS_ON_DUTY') endpoint = '/drivers';
    else if (activeModal === 'FLEET_UTILIZATION') endpoint = '/vehicles';
    else if (activeModal === 'TODAYS_EXPENSES') endpoint = '/expenses?date=today';
    else if (activeModal === 'FUEL_LOGS') endpoint = '/fuel-logs';

    api.get<any[]>(endpoint)
      .then((res) => {
        if (activeModal === 'ACTIVE_VEHICLES' || activeModal === 'FLEET_UTILIZATION') {
          setModalData(res.filter((v: any) => v.status !== 'RETIRED'));
        } else {
          setModalData(res);
        }
      })
      .catch((err) => {
        setModalError(err instanceof ApiError ? err.message : 'Failed to load details');
      })
      .finally(() => {
        setModalLoading(false);
      });
  }, [activeModal]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return modalData;
    const q = searchQuery.toLowerCase();
    return modalData.filter((item) => {
      const check = (val: any): boolean => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'object') {
          return Object.values(val).some(check);
        }
        return String(val).toLowerCase().includes(q);
      };
      return check(item);
    });
  }, [modalData, searchQuery]);

  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const getVal = (obj: any, path: string): any => {
        return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : null), obj);
      };
      const valA = getVal(a, sortField);
      const valB = getVal(b, sortField);
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
    return sorted;
  }, [filteredData, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage]);

  const renderHeaders = () => {
    const handleSort = (field: string) => {
      if (sortField === field) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        setSortOrder('asc');
      }
      setCurrentPage(1);
    };

    const thClass = () =>
      "cursor-pointer hover:bg-muted/50 select-none transition-colors";

    const sortIndicator = (field: string) => {
      if (sortField !== field) return null;
      return sortOrder === 'asc' ? ' 🔼' : ' 🔽';
    };

    if (activeModal === 'ACTIVE_VEHICLES' || activeModal === 'FLEET_UTILIZATION') {
      return (
        <>
          <TH onClick={() => handleSort('registrationNo')} className={thClass()}>Reg No{sortIndicator('registrationNo')}</TH>
          <TH onClick={() => handleSort('name')} className={thClass()}>Name{sortIndicator('name')}</TH>
          <TH onClick={() => handleSort('type')} className={thClass()}>Type{sortIndicator('type')}</TH>
          <TH>Driver Assigned</TH>
          <TH onClick={() => handleSort('maxLoadCapacity')} className={thClass()}>Capacity{sortIndicator('maxLoadCapacity')}</TH>
          <TH onClick={() => handleSort('status')} className={thClass()}>Status{sortIndicator('status')}</TH>
          <TH>Current Location</TH>
          <TH onClick={() => handleSort('region')} className={thClass()}>Region{sortIndicator('region')}</TH>
          <TH>Last Maint.</TH>
          <TH>Next Maint. Due</TH>
        </>
      );
    }

    if (activeModal === 'AVAILABLE_VEHICLES') {
      return (
        <>
          <TH onClick={() => handleSort('registrationNo')} className={thClass()}>Reg No{sortIndicator('registrationNo')}</TH>
          <TH onClick={() => handleSort('type')} className={thClass()}>Type{sortIndicator('type')}</TH>
          <TH onClick={() => handleSort('maxLoadCapacity')} className={thClass()}>Capacity{sortIndicator('maxLoadCapacity')}</TH>
          <TH onClick={() => handleSort('region')} className={thClass()}>Region{sortIndicator('region')}</TH>
          <TH onClick={() => handleSort('odometer')} className={thClass()}>Odometer{sortIndicator('odometer')}</TH>
          <TH>Availability</TH>
        </>
      );
    }

    if (activeModal === 'MAINTENANCE_VEHICLES') {
      return (
        <>
          <TH onClick={() => handleSort('vehicle.name')} className={thClass()}>Vehicle{sortIndicator('vehicle.name')}</TH>
          <TH onClick={() => handleSort('description')} className={thClass()}>Type / Desc{sortIndicator('description')}</TH>
          <TH onClick={() => handleSort('openedAt')} className={thClass()}>Started On{sortIndicator('openedAt')}</TH>
          <TH>Expected Comp.</TH>
          <TH onClick={() => handleSort('cost')} className={thClass()}>Est. Cost{sortIndicator('cost')}</TH>
          <TH>Status</TH>
          <TH>Technician</TH>
        </>
      );
    }

    if (activeModal === 'ACTIVE_TRIPS') {
      return (
        <>
          <TH onClick={() => handleSort('tripNumber')} className={thClass()}>Trip No{sortIndicator('tripNumber')}</TH>
          <TH onClick={() => handleSort('source')} className={thClass()}>Source{sortIndicator('source')}</TH>
          <TH onClick={() => handleSort('destination')} className={thClass()}>Destination{sortIndicator('destination')}</TH>
          <TH onClick={() => handleSort('driver.name')} className={thClass()}>Driver{sortIndicator('driver.name')}</TH>
          <TH onClick={() => handleSort('vehicle.registrationNo')} className={thClass()}>Vehicle{sortIndicator('vehicle.registrationNo')}</TH>
          <TH>Cargo</TH>
          <TH onClick={() => handleSort('cargoWeight')} className={thClass()}>Weight (kg){sortIndicator('cargoWeight')}</TH>
          <TH onClick={() => handleSort('dispatchedAt')} className={thClass()}>Departure{sortIndicator('dispatchedAt')}</TH>
          <TH>Expected Arrival</TH>
          <TH>Status</TH>
          <TH>Dist Remaining</TH>
        </>
      );
    }

    if (activeModal === 'DRIVERS_ON_DUTY') {
      return (
        <>
          <TH onClick={() => handleSort('name')} className={thClass()}>Name{sortIndicator('name')}</TH>
          <TH onClick={() => handleSort('licenseNumber')} className={thClass()}>License No{sortIndicator('licenseNumber')}</TH>
          <TH onClick={() => handleSort('licenseExpiryDate')} className={thClass()}>License Expiry{sortIndicator('licenseExpiryDate')}</TH>
          <TH onClick={() => handleSort('status')} className={thClass()}>Status{sortIndicator('status')}</TH>
          <TH>Assigned Vehicle</TH>
          <TH>Current Trip</TH>
          <TH onClick={() => handleSort('safetyScore')} className={thClass()}>Safety Score{sortIndicator('safetyScore')}</TH>
        </>
      );
    }

    if (activeModal === 'TODAYS_EXPENSES') {
      return (
        <>
          <TH onClick={() => handleSort('type')} className={thClass()}>Expense Type{sortIndicator('type')}</TH>
          <TH onClick={() => handleSort('amount')} className={thClass()}>Amount{sortIndicator('amount')}</TH>
          <TH onClick={() => handleSort('vehicle.registrationNo')} className={thClass()}>Vehicle{sortIndicator('vehicle.registrationNo')}</TH>
          <TH>Driver/User</TH>
          <TH onClick={() => handleSort('notes')} className={thClass()}>Description{sortIndicator('notes')}</TH>
          <TH onClick={() => handleSort('date')} className={thClass()}>Date & Time{sortIndicator('date')}</TH>
          <TH>Created By</TH>
        </>
      );
    }

    if (activeModal === 'FUEL_LOGS') {
      return (
        <>
          <TH onClick={() => handleSort('vehicle.registrationNo')} className={thClass()}>Vehicle{sortIndicator('vehicle.registrationNo')}</TH>
          <TH onClick={() => handleSort('trip.driver.name')} className={thClass()}>Driver{sortIndicator('trip.driver.name')}</TH>
          <TH onClick={() => handleSort('liters')} className={thClass()}>Liters{sortIndicator('liters')}</TH>
          <TH onClick={() => handleSort('cost')} className={thClass()}>Cost{sortIndicator('cost')}</TH>
          <TH>Trip Ref</TH>
          <TH onClick={() => handleSort('date')} className={thClass()}>Logged Time{sortIndicator('date')}</TH>
        </>
      );
    }

    return null;
  };

  const renderRow = (item: any) => {
    if (activeModal === 'ACTIVE_VEHICLES' || activeModal === 'FLEET_UTILIZATION') {
      const activeTrip = item.trips?.[0];
      const lastMaint = item.maintenanceLogs?.[0];
      const lastMaintDate = lastMaint ? new Date(lastMaint.closedAt || lastMaint.openedAt) : null;
      const nextMaintDate = lastMaintDate ? new Date(lastMaintDate.getTime()) : null;
      if (nextMaintDate) nextMaintDate.setMonth(nextMaintDate.getMonth() + 6);

      return (
        <>
          <TD className="font-semibold">{item.registrationNo}</TD>
          <TD>{item.name}</TD>
          <TD className="capitalize text-muted-foreground">{item.type.toLowerCase()}</TD>
          <TD>{activeTrip?.driver?.name || <span className="text-muted-foreground text-xs text-center block w-full">-</span>}</TD>
          <TD>{item.maxLoadCapacity} kg</TD>
          <TD><Badge tone={item.status === 'AVAILABLE' ? 'success' : item.status === 'ON_TRIP' ? 'info' : 'warning'}>{item.status}</Badge></TD>
          <TD>{activeTrip?.destination || <span className="text-muted-foreground text-xs italic">In Depot</span>}</TD>
          <TD>{item.region}</TD>
          <TD>{lastMaintDate ? formatDate(lastMaintDate.toISOString()) : <span className="text-muted-foreground text-xs">-</span>}</TD>
          <TD>{nextMaintDate ? formatDate(nextMaintDate.toISOString()) : <span className="text-muted-foreground text-xs">-</span>}</TD>
        </>
      );
    }

    if (activeModal === 'AVAILABLE_VEHICLES') {
      return (
        <>
          <TD className="font-semibold">{item.registrationNo}</TD>
          <TD className="capitalize text-muted-foreground">{item.type.toLowerCase()}</TD>
          <TD>{item.maxLoadCapacity} kg</TD>
          <TD>{item.region}</TD>
          <TD>{item.odometer} km</TD>
          <TD><Badge tone="success">AVAILABLE</Badge></TD>
        </>
      );
    }

    if (activeModal === 'MAINTENANCE_VEHICLES') {
      const start = new Date(item.openedAt);
      const estComp = new Date(start.getTime());
      estComp.setDate(estComp.getDate() + 3);

      return (
        <>
          <TD className="font-semibold">{item.vehicle?.name} ({item.vehicle?.registrationNo})</TD>
          <TD>{item.description}</TD>
          <TD>{formatDate(item.openedAt)}</TD>
          <TD>{formatDate(estComp.toISOString())}</TD>
          <TD className="font-medium">{formatCurrency(item.cost)}</TD>
          <TD><Badge tone="warning">IN SHOP</Badge></TD>
          <TD className="text-muted-foreground text-xs">N/A</TD>
        </>
      );
    }

    if (activeModal === 'ACTIVE_TRIPS') {
      const departure = new Date(item.dispatchedAt);
      const estArrival = new Date(departure.getTime());
      estArrival.setDate(estArrival.getDate() + 1);

      return (
        <>
          <TD className="font-semibold">{item.tripNumber}</TD>
          <TD>{item.source}</TD>
          <TD>{item.destination}</TD>
          <TD>{item.driver?.name}</TD>
          <TD className="font-medium">{item.vehicle?.registrationNo}</TD>
          <TD className="text-muted-foreground text-xs">Freight</TD>
          <TD>{item.cargoWeight} kg</TD>
          <TD>{formatDateTime(item.dispatchedAt)}</TD>
          <TD>{formatDateTime(estArrival.toISOString())}</TD>
          <TD><Badge tone="info">DISPATCHED</Badge></TD>
          <TD className="text-muted-foreground text-xs">N/A</TD>
        </>
      );
    }

    if (activeModal === 'DRIVERS_ON_DUTY') {
      const activeTrip = item.trips?.[0];

      return (
        <>
          <TD className="font-semibold">{item.name}</TD>
          <TD>{item.licenseNumber}</TD>
          <TD>{formatDate(item.licenseExpiryDate)}</TD>
          <TD><Badge tone={item.status === 'AVAILABLE' ? 'success' : item.status === 'ON_TRIP' ? 'info' : 'warning'}>{item.status}</Badge></TD>
          <TD>{activeTrip?.vehicle?.registrationNo || <span className="text-muted-foreground text-xs">-</span>}</TD>
          <TD>{activeTrip?.tripNumber || <span className="text-muted-foreground text-xs">-</span>}</TD>
          <TD className="font-medium">{item.safetyScore}</TD>
        </>
      );
    }

    if (activeModal === 'TODAYS_EXPENSES') {
      return (
        <>
          <TD><Badge tone="danger">{item.type}</Badge></TD>
          <TD className="font-semibold">{formatCurrency(item.amount)}</TD>
          <TD>{item.vehicle?.registrationNo}</TD>
          <TD className="text-muted-foreground text-xs">N/A</TD>
          <TD>{item.notes || <span className="text-muted-foreground text-xs">None</span>}</TD>
          <TD>{formatDateTime(item.date)}</TD>
          <TD className="text-muted-foreground text-xs">System</TD>
        </>
      );
    }

    if (activeModal === 'FUEL_LOGS') {
      return (
        <>
          <TD className="font-semibold">{item.vehicle?.registrationNo}</TD>
          <TD>{item.trip?.driver?.name || <span className="text-muted-foreground text-xs">N/A</span>}</TD>
          <TD className="font-medium">{item.liters} L</TD>
          <TD className="font-semibold">{formatCurrency(item.cost)}</TD>
          <TD>{item.trip ? item.trip.tripNumber : <span className="text-muted-foreground text-xs">N/A</span>}</TD>
          <TD>{formatDateTime(item.date)}</TD>
        </>
      );
    }

    return null;
  };

  const pieData = data
    ? (Object.entries(data.todaysExpenses.breakdown)
        .map(([name, value]) => ({ name, value }))
        .filter((d) => d.value > 0) as { name: string; value: number }[])
    : [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Live overview of your fleet operations"
        actions={
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Filter region…"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-36"
            />
            <Input
              placeholder="Filter type…"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-36"
            />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
              <option value="">All statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="ON_TRIP">On Trip</option>
              <option value="IN_SHOP">In Shop</option>
              <option value="RETIRED">Retired</option>
            </Select>
          </div>
        }
      />

      {loading && <LoadingState />}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <KpiCard
              label="Active Vehicles"
              value={data.kpis.activeVehicles}
              icon={Truck}
              onClick={() => setActiveModal('ACTIVE_VEHICLES')}
            />
            <KpiCard
              label="Available"
              value={data.kpis.availableVehicles}
              icon={CircleCheck}
              accent="success"
              onClick={() => setActiveModal('AVAILABLE_VEHICLES')}
            />
            <KpiCard
              label="In Maintenance"
              value={data.kpis.vehiclesInMaintenance}
              icon={Wrench}
              accent="warning"
              onClick={() => setActiveModal('MAINTENANCE_VEHICLES')}
            />
            <KpiCard
              label="Active Trips"
              value={data.kpis.activeTrips}
              icon={Activity}
              accent="info"
              hint={`${data.kpis.pendingTrips} draft pending`}
              onClick={() => setActiveModal('ACTIVE_TRIPS')}
            />
            <KpiCard
              label="Drivers On Duty"
              value={data.kpis.driversOnDuty}
              icon={UserCheck}
              accent="success"
              onClick={() => setActiveModal('DRIVERS_ON_DUTY')}
            />
            <KpiCard
              label="Fleet Utilization"
              value={`${data.kpis.fleetUtilizationPct}%`}
              icon={Gauge}
              accent="primary"
              hint="Vehicles on trip vs active fleet"
              onClick={() => setActiveModal('FLEET_UTILIZATION')}
            />
            <KpiCard
              label="Today's Expenses"
              value={formatCurrency(data.todaysExpenses.total)}
              icon={DollarSign}
              accent="danger"
              onClick={() => setActiveModal('TODAYS_EXPENSES')}
            />
            <KpiCard
              label="Fuel Consumption"
              value={`${data.kpis.todaysFuelLiters.toFixed(1)} L`}
              icon={Fuel}
              accent="warning"
              hint="Liters logged today"
              onClick={() => setActiveModal('FUEL_LOGS')}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Trips</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentTrips.length === 0 ? (
                  <EmptyState icon={Activity} title="No trips yet" />
                ) : (
                  <Table>
                    <THead>
                      <TR>
                        <TH>Trip</TH>
                        <TH>Route</TH>
                        <TH>Vehicle</TH>
                        <TH>Driver</TH>
                        <TH>Status</TH>
                        <TH>Created</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {data.recentTrips.map((t) => (
                        <TR key={t.id}>
                          <TD className="font-medium">{t.tripNumber}</TD>
                          <TD className="text-muted-foreground">
                            {t.source} → {t.destination}
                          </TD>
                          <TD>{t.vehicle.registrationNo}</TD>
                          <TD>{t.driver.name}</TD>
                          <TD>
                            <TripStatusBadge status={t.status} />
                          </TD>
                          <TD className="text-muted-foreground">{formatDateTime(t.createdAt)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Today's Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <EmptyState icon={DollarSign} title="No expenses today" />
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
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Vehicles in Maintenance</CardTitle>
              </CardHeader>
              <CardContent>
                {data.vehiclesInMaintenance.length === 0 ? (
                  <EmptyState icon={Wrench} title="No open maintenance" />
                ) : (
                  <ul className="space-y-3">
                    {data.vehiclesInMaintenance.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {m.vehicle.name}{' '}
                            <span className="text-muted-foreground">
                              ({m.vehicle.registrationNo})
                            </span>
                          </p>
                          <p className="text-sm text-muted-foreground">{m.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(m.cost)}</p>
                          <p className="text-xs text-muted-foreground">
                            since {formatDate(m.openedAt)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expiring Licenses (next 30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                {data.expiringLicenses.length === 0 ? (
                  <EmptyState icon={CircleCheck} title="All licenses current" />
                ) : (
                  <ul className="space-y-3">
                    {data.expiringLicenses.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle
                            className={d.expired ? 'size-4 text-red-500' : 'size-4 text-amber-500'}
                          />
                          <div>
                            <Link to="/drivers" className="font-medium hover:underline">
                              {d.name}
                            </Link>
                            <p className="text-sm text-muted-foreground">{d.licenseNumber}</p>
                          </div>
                        </div>
                        <Badge tone={d.expired ? 'danger' : 'warning'}>
                          {d.expired
                            ? `Expired ${formatDate(d.licenseExpiryDate)}`
                            : `${d.daysUntilExpiry}d left`}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog
        open={!!activeModal}
        onClose={() => setActiveModal(null)}
        title={
          activeModal === 'ACTIVE_VEHICLES' ? 'Active Vehicles' :
          activeModal === 'AVAILABLE_VEHICLES' ? 'Available Vehicles' :
          activeModal === 'MAINTENANCE_VEHICLES' ? 'Vehicles In Maintenance' :
          activeModal === 'ACTIVE_TRIPS' ? 'Active Trips' :
          activeModal === 'DRIVERS_ON_DUTY' ? 'Drivers Registry' :
          activeModal === 'FLEET_UTILIZATION' ? 'Fleet Status & Utilization' :
          activeModal === 'TODAYS_EXPENSES' ? "Today's Expenses" :
          activeModal === 'FUEL_LOGS' ? 'Fuel Consumption Logs' : ''
        }
      >
        <div className="space-y-4 max-w-4xl w-full">
          {activeModal === 'TODAYS_EXPENSES' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 font-semibold text-base">
              Today's Total Expense: {formatCurrency(modalData.reduce((s, i) => s + (i.amount || 0), 0))}
            </div>
          )}

          {activeModal === 'FUEL_LOGS' && (
            <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-600 dark:text-sky-400 font-semibold text-base">
              Today's Total Fuel Logged: {modalData.reduce((s, i) => s + (i.liters || 0), 0).toFixed(1)} Liters
            </div>
          )}

          <div className="flex justify-between items-center gap-2">
            <Input
              placeholder="Search detailed logs..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="max-w-xs"
            />
            <span className="text-xs text-muted-foreground">
              Showing {sortedData.length} records
            </span>
          </div>

          {modalLoading ? (
            <LoadingState />
          ) : modalError ? (
            <p className="text-sm text-destructive">{modalError}</p>
          ) : sortedData.length === 0 ? (
            <EmptyState icon={Search} title="No matching records found" />
          ) : (
            <div className="overflow-x-auto rounded-md border max-h-[400px]">
              <Table>
                <THead>
                  <TR>
                    {renderHeaders()}
                  </TR>
                </THead>
                <TBody>
                  {paginatedData.map((item, idx) => (
                    <TR key={item.id || idx}>
                      {renderRow(item)}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
