import { FormEvent, useEffect, useState } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { MaintenanceLog, Vehicle, Trip } from '@/lib/types';
import { can } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';

export function MaintenancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = can.manageMaintenance(user?.role);

  const [filter, setFilter] = useState('open');
  const isActive = filter === 'open' ? true : filter === 'closed' ? false : undefined;

  const { data, loading, error, refetch } = useApi<MaintenanceLog[]>(
    () => api.get('/maintenance', isActive === undefined ? {} : { isActive }),
    [filter],
  );

  const [openDialog, setOpenDialog] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState({ vehicleId: '', description: '', cost: '' });
  const [saving, setSaving] = useState(false);
  const [closeTarget, setCloseTarget] = useState<MaintenanceLog | null>(null);

  const isDriver = user?.role === 'DRIVER';
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [fetchingVehicle, setFetchingVehicle] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ description: '' });

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    type: 'TOLL',
    amount: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (user?.role !== 'DRIVER') return;
    setFetchingVehicle(true);
    api.get<Trip[]>('/trips', { status: 'DISPATCHED', driverId: user.driverId })
      .then((trips) => {
        if (trips.length > 0) {
          const t = trips[0];
          setActiveTrip(t);
          api.get<Vehicle>(`/vehicles/${t.vehicleId}`)
            .then((v) => setAssignedVehicle(v))
            .catch(() => {
              setAssignedVehicle({
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
              });
            });
        }
      })
      .catch(() => toast('Failed to load active vehicle assignment', 'error'))
      .finally(() => setFetchingVehicle(false));
  }, [user, toast]);

  const submitIssue = async (e: FormEvent) => {
    e.preventDefault();
    if (!assignedVehicle) return;
    setSaving(true);
    try {
      await api.post('/maintenance', {
        vehicleId: assignedVehicle.id,
        description: reportForm.description,
        cost: 0,
      });
      toast('Maintenance issue reported successfully');
      setReportOpen(false);
      setReportForm({ description: '' });
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed to report issue', 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!assignedVehicle) return;
    setSaving(true);
    try {
      await api.post('/expenses', {
        vehicleId: assignedVehicle.id,
        type: expenseForm.type,
        amount: Number(expenseForm.amount),
        notes: activeTrip
          ? `[Trip ${activeTrip.tripNumber}] ${expenseForm.notes}`
          : expenseForm.notes,
        date: expenseForm.date ? new Date(expenseForm.date).toISOString() : undefined,
      });
      toast('Expense recorded successfully');
      setExpenseOpen(false);
      setExpenseForm({
        type: 'TOLL',
        amount: '',
        notes: '',
        date: new Date().toISOString().split('T')[0],
      });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed to record expense', 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!openDialog) return;
    void api
      .get<Vehicle[]>('/vehicles')
      .then((v) => setVehicles(v.filter((x) => x.status !== 'RETIRED')))
      .catch(() => toast('Failed to load vehicles', 'error'));
  }, [openDialog, toast]);

  const openLog = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/maintenance', {
        vehicleId: form.vehicleId,
        description: form.description,
        cost: Number(form.cost),
      });
      toast('Maintenance opened — vehicle set to In Shop');
      setOpenDialog(false);
      setForm({ vehicleId: '', description: '', cost: '' });
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed to open maintenance', 'error');
    } finally {
      setSaving(false);
    }
  };

  const closeLog = async () => {
    if (!closeTarget) return;
    try {
      await api.patch(`/maintenance/${closeTarget.id}/close`);
      toast('Maintenance closed — vehicle restored');
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed to close', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle="Open and close maintenance logs — vehicle status stays in sync"
        actions={
          <div className="flex gap-2">
            {isDriver && (
              <>
                <Button
                  onClick={() => setReportOpen(true)}
                  disabled={!assignedVehicle}
                  variant="outline"
                >
                  Report Issue
                </Button>
                <Button
                  onClick={() => setExpenseOpen(true)}
                  disabled={!assignedVehicle}
                >
                  Add Expense
                </Button>
              </>
            )}
            {canManage && (
              <Button onClick={() => setOpenDialog(true)}>
                <Plus /> Open Maintenance
              </Button>
            )}
          </div>
        }
      />

      {isDriver && !fetchingVehicle && !assignedVehicle && (
        <div className="mb-4 rounded-md bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
          You are not currently assigned to an active vehicle. To report issues or record expenses, you must be on an active dispatched trip.
        </div>
      )}
      {isDriver && assignedVehicle && (
        <div className="mb-4 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
          Assigned Vehicle: <span className="underline">{assignedVehicle.name} ({assignedVehicle.registrationNo})</span>
          {activeTrip && <> on active Trip: <span className="underline">{activeTrip.tripNumber} ({activeTrip.source} → {activeTrip.destination})</span></>}
        </div>
      )}

      <Card className="mb-4 p-4">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-52">
          <option value="open">Open (In Shop)</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </Select>
      </Card>

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No maintenance logs"
            description="Open a maintenance log to move a vehicle into the shop."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Vehicle</TH>
                <TH>Description</TH>
                <TH>Cost</TH>
                <TH>Opened</TH>
                <TH>Closed</TH>
                <TH>State</TH>
                {canManage && <TH className="text-right">Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {data.map((m) => (
                <TR key={m.id}>
                  <TD className="font-medium">
                    {m.vehicle.registrationNo}
                    <span className="ml-1 text-muted-foreground">({m.vehicle.name})</span>
                  </TD>
                  <TD>{m.description}</TD>
                  <TD>{formatCurrency(m.cost)}</TD>
                  <TD className="text-muted-foreground">{formatDate(m.openedAt)}</TD>
                  <TD className="text-muted-foreground">{formatDate(m.closedAt)}</TD>
                  <TD>
                    <Badge tone={m.isActive ? 'warning' : 'success'}>
                      {m.isActive ? 'Open' : 'Closed'}
                    </Badge>
                  </TD>
                  {canManage && (
                    <TD className="text-right">
                      {m.isActive ? (
                        <Button variant="outline" size="sm" onClick={() => setCloseTarget(m)}>
                          Close
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        title="Open Maintenance Log"
        description="A vehicle that is On Trip must finish its trip first."
      >
        <form onSubmit={openLog} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Vehicle</Label>
            <Select
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              required
            >
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id} disabled={v.status !== 'AVAILABLE'}>
                  {v.registrationNo} — {v.name}
                  {v.status !== 'AVAILABLE' ? ` (${v.status})` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Oil change, brake pads…"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cost</Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Opening…' : 'Open & set In Shop'}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        onConfirm={closeLog}
        title="Close maintenance?"
        message={`Closing this log will restore ${closeTarget?.vehicle.registrationNo} to Available (unless it has been retired).`}
        confirmLabel="Close log"
      />

      {/* Report Maintenance Issue Modal */}
      <Dialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report Maintenance Issue"
        description="Report a vehicle problem. The vehicle status will be set to In Shop."
      >
        {assignedVehicle && (
          <form onSubmit={submitIssue} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Assigned Vehicle</Label>
              <Input
                value={`${assignedVehicle.registrationNo} — ${assignedVehicle.name}`}
                disabled
                readOnly
              />
            </div>
            <div className="space-y-1.5">
              <Label>Problem Description *</Label>
              <Input
                value={reportForm.description}
                onChange={(e) => setReportForm({ description: e.target.value })}
                placeholder="e.g. Brake issue, Engine noise, Tire damage..."
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Reporting…' : 'Report Issue'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Record Expense Modal */}
      <Dialog
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title="Record Vehicle Expense"
        description="Log expenses incurred during your active trip."
      >
        {assignedVehicle && (
          <form onSubmit={submitExpense} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assigned Vehicle</Label>
                <Input
                  value={`${assignedVehicle.registrationNo} — ${assignedVehicle.name}`}
                  disabled
                  readOnly
                />
              </div>
              <div className="space-y-1.5">
                <Label>Active Trip</Label>
                <Input
                  value={activeTrip ? activeTrip.tripNumber : 'N/A'}
                  disabled
                  readOnly
                />
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
                placeholder="Detail Toll location, Washing context, Emergency repair reason..."
                required
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setExpenseOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Submitting…' : 'Record Expense'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
