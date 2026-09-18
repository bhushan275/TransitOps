import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CircleCheck,
  ClipboardCheck,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { KpiCard } from '@/components/shared/KpiCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { DetailDialog, DetailColumn } from '@/components/shared/DetailDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/spinner';
import { DriverStatusBadge, TripStatusBadge } from '@/components/shared/StatusBadge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Driver, SafetyDashboardData, Trip } from '@/lib/types';
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils';

type SafetyModalKey =
  | 'ACTIVE_DRIVERS'
  | 'ON_DUTY'
  | 'SUSPENDED'
  | 'AVG_SCORE'
  | 'EXPIRED'
  | 'EXPIRING'
  | 'PENDING_REVIEWS';

/* eslint-disable @typescript-eslint/no-explicit-any */
function scoreBadge(score: number) {
  return (
    <Badge tone={score >= 70 ? 'success' : score >= 50 ? 'warning' : 'danger'}>{score}</Badge>
  );
}

const driverColumns: DetailColumn<any>[] = [
  { header: 'Name', render: (d: Driver) => <span className="font-medium">{d.name}</span> },
  { header: 'License No', render: (d: Driver) => d.licenseNumber },
  {
    header: 'License Expiry',
    render: (d: Driver) => (
      <span className="text-muted-foreground">{formatDate(d.licenseExpiryDate)}</span>
    ),
  },
  { header: 'Status', render: (d: Driver) => <DriverStatusBadge status={d.status} /> },
  { header: 'Safety Score', render: (d: Driver) => scoreBadge(d.safetyScore) },
];

const licenseColumns: DetailColumn<any>[] = [
  { header: 'Name', render: (d) => <span className="font-medium">{d.name}</span> },
  { header: 'License No', render: (d) => d.licenseNumber },
  { header: 'Category', render: (d) => d.licenseCategory },
  {
    header: 'Expiry',
    render: (d) => (
      <Badge tone={d.expired ? 'danger' : 'warning'}>
        {d.expired
          ? `Expired ${formatDate(d.licenseExpiryDate)}`
          : `${d.daysUntilExpiry}d left`}
      </Badge>
    ),
  },
  { header: 'Status', render: (d) => <DriverStatusBadge status={d.status} /> },
];

export function SafetyOfficerDashboard() {
  const { data, loading, error } = useApi<SafetyDashboardData>(() => api.get('/dashboard'), []);

  const [activeModal, setActiveModal] = useState<SafetyModalKey | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const modals: Record<
    SafetyModalKey,
    { title: string; load: () => Promise<any[]>; columns: DetailColumn<any>[] }
  > = {
    ACTIVE_DRIVERS: {
      title: 'Active Drivers',
      load: () => api.get<Driver[]>('/drivers'),
      columns: driverColumns,
    },
    ON_DUTY: {
      title: 'Drivers On Duty',
      load: async () =>
        (await api.get<Driver[]>('/drivers')).filter(
          (d) => d.status === 'AVAILABLE' || d.status === 'ON_TRIP',
        ),
      columns: driverColumns,
    },
    SUSPENDED: {
      title: 'Suspended Drivers',
      load: () => api.get<Driver[]>('/drivers', { status: 'SUSPENDED' }),
      columns: driverColumns,
    },
    AVG_SCORE: {
      title: 'Safety Scores (lowest first)',
      load: async () =>
        (await api.get<Driver[]>('/drivers')).sort((a, b) => a.safetyScore - b.safetyScore),
      columns: driverColumns,
    },
    EXPIRED: {
      title: 'Expired Licenses',
      load: () => Promise.resolve((data?.expiringLicenses ?? []).filter((d) => d.expired)),
      columns: licenseColumns,
    },
    EXPIRING: {
      title: 'Licenses Expiring in 30 Days',
      load: () => Promise.resolve((data?.expiringLicenses ?? []).filter((d) => !d.expired)),
      columns: licenseColumns,
    },
    PENDING_REVIEWS: {
      title: 'Trips Awaiting Safety Review',
      load: () => api.get<Trip[]>('/trips/pending-safety-review'),
      columns: [
        {
          header: 'Trip #',
          render: (t: Trip) => <span className="font-medium">{t.tripNumber}</span>,
        },
        { header: 'Driver', render: (t: Trip) => t.driver?.name ?? '—' },
        {
          header: 'Route',
          render: (t: Trip) => (
            <span className="text-muted-foreground">
              {t.source} → {t.destination}
            </span>
          ),
        },
        {
          header: 'Distance',
          render: (t: Trip) => (t.actualDistance ? `${formatNumber(t.actualDistance)} km` : '—'),
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

  return (
    <div>
      <PageHeader
        title="Safety Dashboard"
        subtitle="Driver compliance, licenses, and trip safety reviews"
        actions={
          <Link to="/trips">
            <Button>
              <ClipboardCheck /> Review Trips
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
              label="Active Drivers"
              value={data.kpis.activeDrivers}
              icon={Users}
              onClick={() => setActiveModal('ACTIVE_DRIVERS')}
            />
            <KpiCard
              label="On Duty"
              value={data.kpis.driversOnDuty}
              icon={UserCheck}
              accent="success"
              onClick={() => setActiveModal('ON_DUTY')}
            />
            <KpiCard
              label="Suspended"
              value={data.kpis.suspendedDrivers}
              icon={UserX}
              accent="danger"
              onClick={() => setActiveModal('SUSPENDED')}
            />
            <KpiCard
              label="Avg Safety Score"
              value={data.kpis.avgSafetyScore}
              icon={Gauge}
              accent={data.kpis.avgSafetyScore >= 70 ? 'success' : 'warning'}
              hint="Across active drivers"
              onClick={() => setActiveModal('AVG_SCORE')}
            />
            <KpiCard
              label="Expired Licenses"
              value={data.kpis.expiredLicenses}
              icon={ShieldAlert}
              accent="danger"
              onClick={() => setActiveModal('EXPIRED')}
            />
            <KpiCard
              label="Expiring in 30 Days"
              value={data.kpis.expiringSoon}
              icon={CalendarClock}
              accent="warning"
              onClick={() => setActiveModal('EXPIRING')}
            />
            <KpiCard
              label="Pending Safety Reviews"
              value={data.kpis.pendingReviews}
              icon={ClipboardCheck}
              accent="info"
              hint="Completed trips awaiting review"
              onClick={() => setActiveModal('PENDING_REVIEWS')}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Trips Awaiting Safety Review</CardTitle>
              </CardHeader>
              <CardContent>
                {data.pendingReviewTrips.length === 0 ? (
                  <EmptyState icon={CircleCheck} title="All completed trips reviewed" />
                ) : (
                  <Table>
                    <THead>
                      <TR>
                        <TH>Trip</TH>
                        <TH>Driver</TH>
                        <TH>Route</TH>
                        <TH>Completed</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {data.pendingReviewTrips.map((t) => (
                        <TR key={t.id}>
                          <TD className="font-medium">
                            <Link to="/trips" className="hover:underline">
                              {t.tripNumber}
                            </Link>
                          </TD>
                          <TD>{t.driver.name}</TD>
                          <TD className="text-muted-foreground">
                            {t.source} → {t.destination}
                          </TD>
                          <TD className="text-muted-foreground">
                            {formatDateTime(t.completedAt)}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
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

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Low Safety Scores (&lt; 70)</CardTitle>
              </CardHeader>
              <CardContent>
                {data.lowSafetyDrivers.length === 0 ? (
                  <EmptyState icon={ShieldCheck} title="No at-risk drivers" />
                ) : (
                  <ul className="space-y-3">
                    {data.lowSafetyDrivers.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3">
                        <div>
                          <Link to="/drivers" className="font-medium hover:underline">
                            {d.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">{d.licenseNumber}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <DriverStatusBadge status={d.status} />
                          <Badge tone={d.safetyScore < 50 ? 'danger' : 'warning'}>
                            {d.safetyScore}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Safety Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentReviews.length === 0 ? (
                  <EmptyState icon={ClipboardCheck} title="No reviews submitted yet" />
                ) : (
                  <ul className="space-y-3">
                    {data.recentReviews.map((r) => (
                      <li key={r.id} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {r.trip.tripNumber}{' '}
                            <span className="text-muted-foreground">— {r.driver.name}</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {r.remarks || `${r.trip.source} → ${r.trip.destination}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge tone={r.rating >= 4 ? 'success' : r.rating >= 3 ? 'warning' : 'danger'}>
                            {r.rating} / 5
                          </Badge>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(r.reviewedAt)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
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
