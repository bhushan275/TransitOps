import { FormEvent, useState } from 'react';
import { AlertTriangle, Ban, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { DriverStatusBadge } from '@/components/shared/StatusBadge';
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
import { Driver } from '@/lib/types';
import { can } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import { cn, formatDate, toDateInput } from '@/lib/utils';

interface FormState {
  name: string;
  licenseNumber: string;
  licenseCategory: string;
  licenseExpiryDate: string;
  contactNumber: string;
  email: string;
  address: string;
  safetyScore: string;
}

const EMPTY: FormState = {
  name: '',
  licenseNumber: '',
  licenseCategory: '',
  licenseExpiryDate: '',
  contactNumber: '',
  email: '',
  address: '',
  safetyScore: '100',
};

function licenseState(dateStr: string): { expired: boolean; soon: boolean } {
  const d = new Date(dateStr);
  const now = new Date();
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  return { expired: d < now, soon: d >= now && d <= in30 };
}

function ScoreBar({ score }: { score: number }) {
  const tone = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium">{score}</span>
    </div>
  );
}

export function DriversPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = can.manageDrivers(user?.role);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { data, loading, error, refetch } = useApi<Driver[]>(
    () => api.get('/drivers', { search, status }),
    [search, status],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<Driver | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };
  const openEdit = (d: Driver) => {
    setEditing(d);
    setForm({
      name: d.name,
      licenseNumber: d.licenseNumber,
      licenseCategory: d.licenseCategory,
      licenseExpiryDate: toDateInput(d.licenseExpiryDate),
      contactNumber: d.contactNumber,
      email: d.email ?? '',
      address: d.address ?? '',
      safetyScore: String(d.safetyScore),
    });
    setDialogOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        licenseNumber: form.licenseNumber,
        licenseCategory: form.licenseCategory,
        licenseExpiryDate: form.licenseExpiryDate,
        contactNumber: form.contactNumber,
        email: form.email || undefined,
        address: form.address || undefined,
        safetyScore: Number(form.safetyScore),
      };
      if (editing) {
        await api.patch(`/drivers/${editing.id}`, payload);
        toast('Driver updated');
      } else {
        await api.post('/drivers', payload);
        toast('Driver added');
      }
      setDialogOpen(false);
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const suspend = async () => {
    if (!suspendTarget) return;
    try {
      await api.patch(`/drivers/${suspendTarget.id}/suspend`);
      toast('Driver suspended');
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Suspend failed', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/drivers/${deleteTarget.id}`);
      toast('Driver deleted');
      refetch();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Driver Management"
        subtitle="Licenses, safety scores, and duty status"
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus /> Add Driver
            </Button>
          )
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search name or license…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="">All statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="ON_TRIP">On Trip</option>
            <option value="OFF_DUTY">Off Duty</option>
            <option value="SUSPENDED">Suspended</option>
          </Select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : !data || data.length === 0 ? (
          <EmptyState icon={Users} title="No drivers found" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>License</TH>
                <TH>Category</TH>
                <TH>Expiry</TH>
                <TH>Contact</TH>
                <TH>Safety</TH>
                <TH>Status</TH>
                {canManage && <TH className="text-right">Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {data.map((d) => {
                const ls = licenseState(d.licenseExpiryDate);
                return (
                  <TR key={d.id}>
                    <TD className="font-medium">{d.name}</TD>
                    <TD>{d.licenseNumber}</TD>
                    <TD>{d.licenseCategory}</TD>
                    <TD>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1',
                          ls.expired && 'font-medium text-red-600 dark:text-red-400',
                          ls.soon && 'font-medium text-amber-600 dark:text-amber-400',
                        )}
                      >
                        {(ls.expired || ls.soon) && <AlertTriangle className="size-3.5" />}
                        {formatDate(d.licenseExpiryDate)}
                      </span>
                    </TD>
                    <TD className="text-muted-foreground">{d.contactNumber}</TD>
                    <TD>
                      <ScoreBar score={d.safetyScore} />
                    </TD>
                    <TD>
                      <DriverStatusBadge status={d.status} />
                    </TD>
                    {canManage && (
                      <TD className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={d.status === 'SUSPENDED'}
                            onClick={() => setSuspendTarget(d)}
                            title="Suspend driver"
                          >
                            <Ban />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={d.status === 'ON_TRIP'}
                            onClick={() => setDeleteTarget(d)}
                            title="Delete driver"
                          >
                            <Trash2 className="text-destructive size-4" />
                          </Button>
                        </div>
                      </TD>
                    )}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? 'Edit Driver' : 'Add Driver'}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="License Number">
              <Input
                value={form.licenseNumber}
                onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                required
              />
            </Field>
            <Field label="License Category">
              <Input
                value={form.licenseCategory}
                onChange={(e) => setForm({ ...form, licenseCategory: e.target.value })}
                placeholder="HeavyGoods…"
                required
              />
            </Field>
            <Field label="License Expiry">
              <Input
                type="date"
                value={form.licenseExpiryDate}
                onChange={(e) => setForm({ ...form, licenseExpiryDate: e.target.value })}
                required
              />
            </Field>
            <Field label="Contact Number">
              <Input
                value={form.contactNumber}
                onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                required
              />
            </Field>
            <Field label="Safety Score">
              <Input
                type="number"
                min="0"
                max="100"
                step="any"
                value={form.safetyScore}
                onChange={(e) => setForm({ ...form, safetyScore: e.target.value })}
              />
            </Field>
            <Field label="Email (optional)">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Address (optional)">
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add driver'}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onConfirm={suspend}
        title="Suspend driver?"
        message={`${suspendTarget?.name} will be suspended and cannot be assigned to trips until reinstated.`}
        confirmLabel="Suspend"
        destructive
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete driver?"
        message={`${deleteTarget?.name} will be soft-deleted. Their driver profile and any associated user login credentials will be deactivated.`}
        confirmLabel="Delete"
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
