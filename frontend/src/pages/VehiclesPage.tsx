import { FormEvent, useState } from 'react';
import { Ban, Pencil, Plus, Search, Truck } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { VehicleStatusBadge } from '@/components/shared/StatusBadge';
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
import { Vehicle } from '@/lib/types';
import { can } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface FormState {
  registrationNo: string;
  name: string;
  type: string;
  region: string;
  maxLoadCapacity: string;
  odometer: string;
  acquisitionCost: string;
}

const EMPTY: FormState = {
  registrationNo: '',
  name: '',
  type: '',
  region: '',
  maxLoadCapacity: '',
  odometer: '0',
  acquisitionCost: '',
};

export function VehiclesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = can.manageVehicles(user?.role);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [region, setRegion] = useState('');

  const { data, loading, error, refetch } = useApi<Vehicle[]>(
    () => api.get('/vehicles', { search, status, region }),
    [search, status, region],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [retireTarget, setRetireTarget] = useState<Vehicle | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({
      registrationNo: v.registrationNo,
      name: v.name,
      type: v.type,
      region: v.region,
      maxLoadCapacity: String(v.maxLoadCapacity),
      odometer: String(v.odometer),
      acquisitionCost: String(v.acquisitionCost),
    });
    setDialogOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        registrationNo: form.registrationNo,
        name: form.name,
        type: form.type,
        region: form.region,
        maxLoadCapacity: Number(form.maxLoadCapacity),
        odometer: Number(form.odometer),
        acquisitionCost: Number(form.acquisitionCost),
      };
      if (editing) {
        await api.patch(`/vehicles/${editing.id}`, payload);
        toast('Vehicle updated');
      } else {
        await api.post('/vehicles', payload);
        toast('Vehicle registered');
      }
      setDialogOpen(false);
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const retire = async () => {
    if (!retireTarget) return;
    try {
      await api.patch(`/vehicles/${retireTarget.id}/retire`);
      toast('Vehicle retired');
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Retire failed', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Vehicle Registry"
        subtitle="Manage your fleet — register, edit, and retire vehicles"
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus /> Add Vehicle
            </Button>
          )
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search name or registration…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Input
            placeholder="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-40"
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="">All statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="ON_TRIP">On Trip</option>
            <option value="IN_SHOP">In Shop</option>
            <option value="RETIRED">Retired</option>
          </Select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No vehicles found"
            description="Try adjusting your filters or register a new vehicle."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Registration</TH>
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Region</TH>
                <TH>Capacity</TH>
                <TH>Odometer</TH>
                <TH>Acq. Cost</TH>
                <TH>Status</TH>
                {canManage && <TH className="text-right">Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {data.map((v) => (
                <TR key={v.id}>
                  <TD className="font-medium">{v.registrationNo}</TD>
                  <TD>{v.name}</TD>
                  <TD>{v.type}</TD>
                  <TD>
                    <Badge tone="neutral">{v.region}</Badge>
                  </TD>
                  <TD>{formatNumber(v.maxLoadCapacity)} kg</TD>
                  <TD>{formatNumber(v.odometer)} km</TD>
                  <TD>{formatCurrency(v.acquisitionCost)}</TD>
                  <TD>
                    <VehicleStatusBadge status={v.status} />
                  </TD>
                  {canManage && (
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={v.status === 'RETIRED'}
                          onClick={() => setRetireTarget(v)}
                          title="Retire vehicle"
                        >
                          <Ban />
                        </Button>
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? 'Edit Vehicle' : 'Register Vehicle'}
        description={editing ? undefined : 'Add a new vehicle to the fleet.'}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Registration No">
              <Input
                value={form.registrationNo}
                onChange={(e) => setForm({ ...form, registrationNo: e.target.value })}
                required
              />
            </Field>
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Type">
              <Input
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                placeholder="Van, Truck…"
                required
              />
            </Field>
            <Field label="Region">
              <Input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="North, South…"
                required
              />
            </Field>
            <Field label="Max Load (kg)">
              <Input
                type="number"
                min="0"
                step="any"
                value={form.maxLoadCapacity}
                onChange={(e) => setForm({ ...form, maxLoadCapacity: e.target.value })}
                required
              />
            </Field>
            <Field label="Odometer (km)">
              <Input
                type="number"
                min="0"
                step="any"
                value={form.odometer}
                onChange={(e) => setForm({ ...form, odometer: e.target.value })}
              />
            </Field>
            <Field label="Acquisition Cost">
              <Input
                type="number"
                min="0"
                step="any"
                value={form.acquisitionCost}
                onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })}
                required
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Register'}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!retireTarget}
        onClose={() => setRetireTarget(null)}
        onConfirm={retire}
        title="Retire vehicle?"
        message={`Retiring ${retireTarget?.registrationNo} is permanent — it can never return to service. Its history is preserved.`}
        confirmLabel="Retire"
        destructive
      />
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
