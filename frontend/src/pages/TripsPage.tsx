import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Plus, Route as RouteIcon, Send, Star, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { TripStatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Driver, Trip, Vehicle } from '@/lib/types';
import { can } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatNumber } from '@/lib/utils';

const EMPTY = {
  source: '',
  destination: '',
  vehicleId: '',
  driverId: '',
  cargoWeight: '',
  plannedDistance: '',
  revenue: '',
};

export function TripsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canOperate = can.operateTrips(user?.role);
  const isDriver = user?.role === 'DRIVER';

  const [status, setStatus] = useState('');
  const { data, loading, error, refetch } = useApi<Trip[]>(
    () => api.get('/trips', { status }),
    [status],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [availVehicles, setAvailVehicles] = useState<Vehicle[]>([]);
  const [availDrivers, setAvailDrivers] = useState<Driver[]>([]);

  const [completeTrip, setCompleteTrip] = useState<Trip | null>(null);
  const [completeForm, setCompleteForm] = useState({ actualDistance: '', fuelConsumed: '' });
  const [confirm, setConfirm] = useState<{ trip: Trip; action: 'dispatch' | 'cancel' } | null>(
    null,
  );

  const isSafetyOfficer = user?.role === 'SAFETY_OFFICER';
  const { data: pendingReviews, loading: pendingLoading, error: pendingError, refetch: refetchPending } = useApi<Trip[]>(
    () => (isSafetyOfficer ? api.get('/trips/pending-safety-review') : Promise.resolve([])),
    [user],
  );

  const [reviewTrip, setReviewTrip] = useState<Trip | null>(null);
  const [rating, setRating] = useState(0);
  const [remarks, setRemarks] = useState('');

  const submitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewTrip || rating === 0) return;
    setSaving(true);
    try {
      await api.post(`/trips/${reviewTrip.id}/review`, {
        rating,
        remarks: remarks.trim() || undefined,
      });
      toast('Trip safety review submitted');
      setReviewTrip(null);
      setRating(0);
      setRemarks('');
      refetchPending();
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Submit review failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!createOpen) return;
    void (async () => {
      try {
        // Drivers can only create trips for themselves — no driver picker needed.
        const [v, d] = await Promise.all([
          api.get<Vehicle[]>('/vehicles/available'),
          isDriver ? Promise.resolve<Driver[]>([]) : api.get<Driver[]>('/drivers/available'),
        ]);
        setAvailVehicles(v);
        setAvailDrivers(d);
      } catch {
        toast('Failed to load available vehicles/drivers', 'error');
      }
    })();
  }, [createOpen, isDriver, toast]);

  const selectedVehicle = availVehicles.find((v) => v.id === form.vehicleId);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/trips', {
        source: form.source,
        destination: form.destination,
        vehicleId: form.vehicleId,
        driverId: isDriver ? user?.driverId : form.driverId,
        cargoWeight: Number(form.cargoWeight),
        plannedDistance: Number(form.plannedDistance),
        revenue: form.revenue ? Number(form.revenue) : 0,
      });
      toast('Trip created as DRAFT');
      setCreateOpen(false);
      setForm(EMPTY);
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Create failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async () => {
    if (!confirm) return;
    try {
      await api.patch(`/trips/${confirm.trip.id}/${confirm.action}`);
      toast(confirm.action === 'dispatch' ? 'Trip dispatched' : 'Trip cancelled');
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Action failed', 'error');
    }
  };

  const doComplete = async (e: FormEvent) => {
    e.preventDefault();
    if (!completeTrip) return;
    setSaving(true);
    try {
      await api.patch(`/trips/${completeTrip.id}/complete`, {
        actualDistance: Number(completeForm.actualDistance),
        fuelConsumed: Number(completeForm.fuelConsumed),
      });
      toast('Trip completed');
      setCompleteTrip(null);
      setCompleteForm({ actualDistance: '', fuelConsumed: '' });
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Complete failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Trip Management"
        subtitle="Create, dispatch, complete, and cancel trips"
        actions={
          canOperate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> New Trip
            </Button>
          )
        }
      />

      {isSafetyOfficer && (
        <Card className="mb-6 p-4">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <RouteIcon className="text-primary size-5" />
            Pending Safety Reviews
          </h2>
          {pendingLoading ? (
            <LoadingState />
          ) : pendingError ? (
            <p className="text-sm text-destructive">{pendingError}</p>
          ) : !pendingReviews || pendingReviews.length === 0 ? (
            <EmptyState icon={RouteIcon} title="No pending safety reviews" description="All completed trips have been reviewed." />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <THead>
                  <TR>
                    <TH>Trip #</TH>
                    <TH>Vehicle</TH>
                    <TH>Driver</TH>
                    <TH>Route</TH>
                    <TH>Cargo</TH>
                    <TH>Completed</TH>
                    <TH>Distance</TH>
                    <TH>Duration</TH>
                    <TH>Driver Safety Score</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {pendingReviews.map((t) => {
                    const durationHours = t.completedAt && t.dispatchedAt
                      ? Math.round(
                          ((new Date(t.completedAt).getTime() - new Date(t.dispatchedAt).getTime()) /
                            (1000 * 60 * 60)) *
                            10
                        ) / 10
                      : null;

                    return (
                      <TR key={t.id}>
                        <TD className="font-medium">{t.tripNumber}</TD>
                        <TD>{t.vehicle.name} ({t.vehicle.registrationNo})</TD>
                        <TD>{t.driver.name}</TD>
                        <TD className="text-muted-foreground">
                          {t.source} → {t.destination}
                        </TD>
                        <TD>{formatNumber(t.cargoWeight)} kg</TD>
                        <TD>{t.completedAt ? new Date(t.completedAt).toLocaleDateString() : 'N/A'}</TD>
                        <TD>{t.actualDistance ? `${formatNumber(t.actualDistance)} km` : 'N/A'}</TD>
                        <TD>{durationHours !== null ? `${durationHours} hrs` : 'N/A'}</TD>
                        <TD>
                          <span className="font-semibold">{t.driver.safetyScore}</span> / 100
                        </TD>
                        <TD className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setReviewTrip(t)}>
                            Review Trip
                          </Button>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      <Card className="mb-4 p-4">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-52">
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="DISPATCHED">Dispatched</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </Card>

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : !data || data.length === 0 ? (
          <EmptyState icon={RouteIcon} title="No trips found" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Trip #</TH>
                <TH>Route</TH>
                <TH>Vehicle</TH>
                <TH>Driver</TH>
                <TH>Cargo</TH>
                <TH>Revenue</TH>
                <TH>Status</TH>
                {canOperate && <TH className="text-right">Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {data.map((t) => (
                <TR key={t.id}>
                  <TD className="font-medium">{t.tripNumber}</TD>
                  <TD className="text-muted-foreground">
                    {t.source} → {t.destination}
                  </TD>
                  <TD>{t.vehicle.registrationNo}</TD>
                  <TD>{t.driver.name}</TD>
                  <TD>{formatNumber(t.cargoWeight)} kg</TD>
                  <TD>{formatCurrency(t.revenue)}</TD>
                  <TD>
                    <TripStatusBadge status={t.status} />
                  </TD>
                  {canOperate && (
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        {t.status === 'DRAFT' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirm({ trip: t, action: 'dispatch' })}
                          >
                            <Send /> Dispatch
                          </Button>
                        )}
                        {t.status === 'DISPATCHED' && (
                          <Button variant="outline" size="sm" onClick={() => setCompleteTrip(t)}>
                            <CheckCircle2 /> Complete
                          </Button>
                        )}
                        {(t.status === 'DRAFT' || t.status === 'DISPATCHED') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirm({ trip: t, action: 'cancel' })}
                          >
                            <XCircle /> Cancel
                          </Button>
                        )}
                        {(t.status === 'COMPLETED' || t.status === 'CANCELLED') && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Create trip */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Trip"
        description="Vehicles and drivers shown are dispatch-eligible only."
      >
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source">
              <Input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                required
              />
            </Field>
            <Field label="Destination">
              <Input
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                required
              />
            </Field>
            <Field label="Vehicle">
              <Select
                value={form.vehicleId}
                onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                required
              >
                <option value="">Select vehicle…</option>
                {availVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNo} — {v.name} (max {formatNumber(v.maxLoadCapacity)}kg)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Driver">
              {isDriver ? (
                <Input value={`${user?.name ?? 'You'} (assigned to you)`} disabled />
              ) : (
                <Select
                  value={form.driverId}
                  onChange={(e) => setForm({ ...form, driverId: e.target.value })}
                  required
                >
                  <option value="">Select driver…</option>
                  {availDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.licenseNumber}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Cargo Weight (kg)">
              <Input
                type="number"
                min="0"
                step="any"
                value={form.cargoWeight}
                onChange={(e) => setForm({ ...form, cargoWeight: e.target.value })}
                required
              />
            </Field>
            <Field label="Planned Distance (km)">
              <Input
                type="number"
                min="0"
                step="any"
                value={form.plannedDistance}
                onChange={(e) => setForm({ ...form, plannedDistance: e.target.value })}
                required
              />
            </Field>
            <Field label="Revenue">
              <Input
                type="number"
                min="0"
                step="any"
                value={form.revenue}
                onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                placeholder="0"
              />
            </Field>
          </div>
          {selectedVehicle && Number(form.cargoWeight) > selectedVehicle.maxLoadCapacity && (
            <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
              Cargo exceeds this vehicle's capacity ({formatNumber(selectedVehicle.maxLoadCapacity)}
              kg).
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create trip'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Complete trip */}
      <Dialog
        open={!!completeTrip}
        onClose={() => setCompleteTrip(null)}
        title={`Complete ${completeTrip?.tripNumber ?? ''}`}
        description="Record actuals. The vehicle and driver will return to Available."
      >
        <form onSubmit={doComplete} className="space-y-4">
          <Field label="Actual Distance (km)">
            <Input
              type="number"
              min="0"
              step="any"
              value={completeForm.actualDistance}
              onChange={(e) => setCompleteForm({ ...completeForm, actualDistance: e.target.value })}
              required
            />
          </Field>
          <Field label="Fuel Consumed (L)">
            <Input
              type="number"
              min="0"
              step="any"
              value={completeForm.fuelConsumed}
              onChange={(e) => setCompleteForm({ ...completeForm, fuelConsumed: e.target.value })}
              required
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCompleteTrip(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Completing…' : 'Complete trip'}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runAction}
        title={confirm?.action === 'dispatch' ? 'Dispatch trip?' : 'Cancel trip?'}
        message={
          confirm?.action === 'dispatch'
            ? `Dispatching ${confirm?.trip.tripNumber} will set its vehicle and driver to On Trip.`
            : `Cancelling ${confirm?.trip.tripNumber}${
                confirm?.trip.status === 'DISPATCHED'
                  ? ' will release its vehicle and driver back to Available.'
                  : '.'
              }`
        }
        confirmLabel={confirm?.action === 'dispatch' ? 'Dispatch' : 'Cancel trip'}
        destructive={confirm?.action === 'cancel'}
      />

      {/* Review Trip Modal */}
      <Dialog
        open={!!reviewTrip}
        onClose={() => {
          setReviewTrip(null);
          setRating(0);
          setRemarks('');
        }}
        title={`Safety Review for ${reviewTrip?.tripNumber ?? ''}`}
        description="Submit safety rating and optional remarks to adjust the driver's rolling safety score."
      >
        {reviewTrip && (
          <form onSubmit={submitReview} className="space-y-4">
            <div className="bg-muted/40 p-3 rounded-lg border text-sm space-y-1">
              <p><strong>Driver:</strong> {reviewTrip.driver.name}</p>
              <p><strong>Vehicle:</strong> {reviewTrip.vehicle.name} ({reviewTrip.vehicle.registrationNo})</p>
              <p><strong>Route:</strong> {reviewTrip.source} → {reviewTrip.destination}</p>
              {reviewTrip.actualDistance && <p><strong>Distance:</strong> {formatNumber(reviewTrip.actualDistance)} km</p>}
            </div>

            <Field label="Driver Safety Rating *">
              <StarRating rating={rating} onChange={setRating} />
            </Field>

            <Field label="Safety Remarks (Optional)">
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Specify remarks like: Rash driving, Excellent handling, Speed violations..."
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReviewTrip(null);
                  setRating(0);
                  setRemarks('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || rating === 0}>
                {saving ? 'Submitting…' : 'Submit Review'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function StarRating({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  return (
    <div className="flex gap-1.5 items-center">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = hoverRating !== null ? star <= hoverRating : star <= rating;
        return (
          <button
            key={star}
            type="button"
            className="focus:outline-none transition-transform duration-150 hover:scale-125 cursor-pointer"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(null)}
          >
            <Star
              className={`size-8 transition-colors duration-150 ${
                active ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/30 hover:text-muted-foreground/50'
              }`}
            />
          </button>
        );
      })}
      {rating > 0 && (
        <span className="text-sm font-semibold ml-2 text-amber-600 dark:text-amber-400">
          {rating} / 5
        </span>
      )}
    </div>
  );
}
