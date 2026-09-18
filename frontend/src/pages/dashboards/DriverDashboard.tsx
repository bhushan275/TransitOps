import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BadgeCheck,
  CalendarClock,
  Fuel,
  MapPin,
  Route as RouteIcon,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { KpiCard } from '@/components/shared/KpiCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { DetailDialog, DetailColumn } from '@/components/shared/DetailDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/spinner';
import { TripStatusBadge, DriverStatusBadge } from '@/components/shared/StatusBadge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { DriverDashboardData, FuelLog, Trip } from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/utils';

type DriverModalKey =
  | 'MY_TRIPS'
  | 'COMPLETED'
  | 'DISTANCE'
  | 'SAFETY'
  | 'LICENSE'
  | 'ON_TRIP'
  | 'FUEL';

/* eslint-disable @typescript-eslint/no-explicit-any */
const tripBaseColumns: DetailColumn<any>[] = [
  { header: 'Trip #', render: (t: Trip) => <span className="font-medium">{t.tripNumber}</span> },
  {
    header: 'Route',
    render: (t: Trip) => (
      <span className="text-muted-foreground">
        {t.source} → {t.destination}
      </span>
    ),
  },
  { header: 'Vehicle', render: (t: Trip) => t.vehicle?.registrationNo ?? '—' },
];

export function DriverDashboard() {
  const { data, loading, error } = useApi<DriverDashboardData>(() => api.get('/dashboard'), []);

  const [activeModal, setActiveModal] = useState<DriverModalKey | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const modals: Record<
    DriverModalKey,
    { title: string; load: () => Promise<any[]>; columns: DetailColumn<any>[] }
  > = {
    MY_TRIPS: {
      title: 'My Trips',
      load: () => api.get<Trip[]>('/trips'),
      columns: [
        ...tripBaseColumns,
        { header: 'Cargo', render: (t: Trip) => `${formatNumber(t.cargoWeight)} kg` },
        { header: 'Status', render: (t: Trip) => <TripStatusBadge status={t.status} /> },
        {
          header: 'Created',
          render: (t: Trip) => (
            <span className="text-muted-foreground">{formatDateTime(t.createdAt)}</span>
          ),
        },
      ],
    },
    COMPLETED: {
      title: 'My Completed Trips',
      load: () => api.get<Trip[]>('/trips', { status: 'COMPLETED' }),
      columns: [
        ...tripBaseColumns,
        {
          header: 'Distance',
          render: (t: Trip) => (t.actualDistance ? `${formatNumber(t.actualDistance)} km` : '—'),
        },
        {
          header: 'Fuel',
          render: (t: Trip) => (t.fuelConsumed ? `${formatNumber(t.fuelConsumed)} L` : '—'),
        },
        {
          header: 'Completed',
          render: (t: Trip) => (
            <span className="text-muted-foreground">{formatDateTime(t.completedAt)}</span>
          ),
        },
      ],
    },
    DISTANCE: {
      title: 'Distance by Trip',
      load: () => api.get<Trip[]>('/trips', { status: 'COMPLETED' }),
      columns: [
        ...tripBaseColumns,
        { header: 'Planned', render: (t: Trip) => `${formatNumber(t.plannedDistance)} km` },
        {
          header: 'Actual',
          render: (t: Trip) => (t.actualDistance ? `${formatNumber(t.actualDistance)} km` : '—'),
        },
        {
          header: 'Completed',
          render: (t: Trip) => (
            <span className="text-muted-foreground">{formatDateTime(t.completedAt)}</span>
          ),
        },
      ],
    },
    SAFETY: {
      title: 'My Safety Reviews',
      load: async () => (await api.get<Trip[]>('/trips')).filter((t) => t.safetyReview),
      columns: [
        ...tripBaseColumns,
        {
          header: 'Rating',
          render: (t: Trip) => (
            <Badge
              tone={
                (t.safetyReview?.rating ?? 0) >= 4
                  ? 'success'
                  : (t.safetyReview?.rating ?? 0) >= 3
                    ? 'warning'
                    : 'danger'
              }
            >
              {t.safetyReview?.rating} / 5
            </Badge>
          ),
        },
        {
          header: 'Remarks',
          render: (t: Trip) => (
            <span className="text-muted-foreground">{t.safetyReview?.remarks || '—'}</span>
          ),
        },
        {
          header: 'Reviewed',
          render: (t: Trip) => (
            <span className="text-muted-foreground">
              {formatDate(t.safetyReview?.reviewedAt ?? null)}
            </span>
          ),
        },
      ],
    },
    LICENSE: {
      title: 'My License Details',
      load: () => {
        if (!data) return Promise.resolve([]);
        const p = data.profile;
        return Promise.resolve([
          { id: '1', field: 'License Number', value: p.licenseNumber },
          { id: '2', field: 'Category', value: p.licenseCategory },
          { id: '3', field: 'Expiry Date', value: formatDate(p.licenseExpiryDate) },
          {
            id: '4',
            field: 'Days Remaining',
            value: data.kpis.licenseExpired
              ? 'Expired'
              : `${data.kpis.licenseDaysLeft} days`,
          },
          { id: '5', field: 'Contact', value: p.contactNumber },
          { id: '6', field: 'Duty Status', value: p.status.replace('_', ' ') },
        ]);
      },
      columns: [
        { header: 'Field', render: (r) => <span className="font-medium">{r.field}</span> },
        { header: 'Value', render: (r) => r.value },
      ],
    },
    ON_TRIP: {
      title: 'My Active Trip',
      load: () => api.get<Trip[]>('/trips/active'),
      columns: [
        ...tripBaseColumns,
        { header: 'Cargo', render: (t: Trip) => `${formatNumber(t.cargoWeight)} kg` },
        {
          header: 'Dispatched',
          render: (t: Trip) => (
            <span className="text-muted-foreground">{formatDateTime(t.dispatchedAt)}</span>
          ),
        },
      ],
    },
    FUEL: {
      title: 'My Fuel Logs',
      load: () => api.get<FuelLog[]>('/fuel-logs'),
      columns: [
        { header: 'Vehicle', render: (f: FuelLog) => f.vehicle?.registrationNo ?? '—' },
        { header: 'Trip', render: (f: FuelLog) => f.trip?.tripNumber ?? '—' },
        { header: 'Liters', render: (f: FuelLog) => `${formatNumber(f.liters, 1)} L` },
        {
          header: 'Cost',
          render: (f: FuelLog) => <span className="font-medium">{formatCurrency(f.cost)}</span>,
        },
        {
          header: 'Date',
          render: (f: FuelLog) => (
            <span className="text-muted-foreground">{formatDateTime(f.date)}</span>
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

  return (
    <div>
      <PageHeader
        title="My Dashboard"
        subtitle="Your trips, assigned vehicle, and safety profile"
        actions={
          <Link to="/trips">
            <Button>
              <RouteIcon /> My Trips
            </Button>
          </Link>
        }
      />

      {loading && <LoadingState />}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <KpiCard
              label="My Trips"
              value={data.kpis.totalTrips}
              icon={RouteIcon}
              onClick={() => setActiveModal('MY_TRIPS')}
            />
            <KpiCard
              label="Completed"
              value={data.kpis.completedTrips}
              icon={BadgeCheck}
              accent="success"
              hint={`${data.kpis.draftTrips} draft pending`}
              onClick={() => setActiveModal('COMPLETED')}
            />
            <KpiCard
              label="Distance Driven"
              value={`${formatNumber(data.kpis.totalDistance)} km`}
              icon={MapPin}
              accent="info"
              onClick={() => setActiveModal('DISTANCE')}
            />
            <KpiCard
              label="Safety Score"
              value={data.kpis.safetyScore}
              icon={ShieldCheck}
              accent={data.kpis.safetyScore >= 70 ? 'success' : 'danger'}
              hint="Rolling average of trip reviews"
              onClick={() => setActiveModal('SAFETY')}
            />
            <KpiCard
              label="License Status"
              value={
                data.kpis.licenseExpired ? 'Expired' : `${data.kpis.licenseDaysLeft}d left`
              }
              icon={CalendarClock}
              accent={
                data.kpis.licenseExpired
                  ? 'danger'
                  : data.kpis.licenseDaysLeft <= 30
                    ? 'warning'
                    : 'success'
              }
              hint={`Expires ${formatDate(data.profile.licenseExpiryDate)}`}
              onClick={() => setActiveModal('LICENSE')}
            />
            <KpiCard
              label="On Trip Now"
              value={data.kpis.onTrip ? 'Yes' : 'No'}
              icon={Activity}
              accent={data.kpis.onTrip ? 'info' : 'primary'}
              onClick={() => setActiveModal('ON_TRIP')}
            />
            <KpiCard
              label="Fuel Logged Today"
              value={`${formatNumber(data.todaysFuel.liters, 1)} L`}
              icon={Fuel}
              accent="warning"
              hint="Click for full fuel history"
              onClick={() => setActiveModal('FUEL')}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Current Trip</CardTitle>
              </CardHeader>
              <CardContent>
                {!data.activeTrip ? (
                  <EmptyState
                    icon={Truck}
                    title="No active trip"
                    description="You have no dispatched trip right now."
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg font-bold">{data.activeTrip.tripNumber}</span>
                      <TripStatusBadge status={data.activeTrip.status} />
                    </div>
                    <p className="text-muted-foreground">
                      {data.activeTrip.source} → {data.activeTrip.destination}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 text-sm">
                      <p>
                        <span className="text-muted-foreground">Vehicle:</span>{' '}
                        <span className="font-medium">
                          {data.activeTrip.vehicle.name} ({data.activeTrip.vehicle.registrationNo})
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Cargo:</span>{' '}
                        <span className="font-medium">
                          {formatNumber(data.activeTrip.cargoWeight)} kg
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Planned distance:</span>{' '}
                        <span className="font-medium">
                          {formatNumber(data.activeTrip.plannedDistance)} km
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Dispatched:</span>{' '}
                        <span className="font-medium">
                          {formatDateTime(data.activeTrip.dispatchedAt)}
                        </span>
                      </p>
                    </div>
                    <Link to="/trips" className="inline-block">
                      <Button variant="outline" size="sm">
                        Manage trip
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <ProfileRow label="Name" value={data.profile.name} />
                  <ProfileRow label="License No" value={data.profile.licenseNumber} />
                  <ProfileRow label="Category" value={data.profile.licenseCategory} />
                  <ProfileRow
                    label="License Expiry"
                    value={
                      <Badge tone={data.kpis.licenseExpired ? 'danger' : 'success'}>
                        {formatDate(data.profile.licenseExpiryDate)}
                      </Badge>
                    }
                  />
                  <ProfileRow label="Contact" value={data.profile.contactNumber} />
                  <ProfileRow
                    label="Status"
                    value={<DriverStatusBadge status={data.profile.status} />}
                  />
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>My Recent Trips</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentTrips.length === 0 ? (
                <EmptyState icon={RouteIcon} title="No trips yet" />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Trip</TH>
                      <TH>Route</TH>
                      <TH>Vehicle</TH>
                      <TH>Cargo</TH>
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
                        <TD>{formatNumber(t.cargoWeight)} kg</TD>
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

function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
