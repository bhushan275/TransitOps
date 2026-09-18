import { useEffect, useState } from 'react';
import { Download, Gauge, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ReportData, Vehicle } from '@/lib/types';
import { can } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatNumber } from '@/lib/utils';

const AXIS = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };

export function ReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canExport = can.exportReports(user?.role);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    void api.get<Vehicle[]>('/vehicles').then(setVehicles).catch(() => undefined);
  }, []);

  const { data, loading, error } = useApi<ReportData>(
    () => api.get('/reports', { from, to, vehicleId }),
    [from, to, vehicleId],
  );

  const exportCsv = async () => {
    try {
      const blob = await api.getBlob('/reports/export.csv', { from, to, vehicleId });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transitops-report.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast('CSV exported');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Export failed', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Fuel efficiency, fleet utilization, operational cost, and ROI"
        actions={
          canExport && (
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" onClick={exportCsv} disabled={!data}>
                <Download className="size-4" /> Export CSV
              </Button>
              <Button variant="outline" onClick={() => window.print()} disabled={!data}>
                <Download className="size-4" /> Download PDF
              </Button>
            </div>
          )
        }
      />

      <Card className="mb-6 p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1.5">
            <Label>Vehicle</Label>
            <Select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-56"
            >
              <option value="">All vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registrationNo} — {v.name}
                </option>
              ))}
            </Select>
          </div>
          {(from || to || vehicleId) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom('');
                setTo('');
                setVehicleId('');
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      {loading && <LoadingState />}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="size-4 text-primary" /> Fleet Utilization
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="text-5xl font-bold text-primary">
                  {data.fleetUtilization.pct}%
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {data.fleetUtilization.onTrip} on trip / {data.fleetUtilization.activeFleet} active
                </p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Fuel Efficiency (km / L)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartOrEmpty rows={data.fuelEfficiency}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.fuelEfficiency}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="registrationNo" tick={AXIS} />
                      <YAxis tick={AXIS} />
                      <RTooltip
                        formatter={(v: number) => [`${v} km/L`, 'Efficiency']}
                        cursor={{ fill: 'hsl(var(--accent))' }}
                      />
                      <Bar dataKey="fuelEfficiency" radius={[4, 4, 0, 0]} fill="#0ea5e9" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartOrEmpty>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Operational Cost by Vehicle</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartOrEmpty rows={data.operationalCost}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.operationalCost}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="registrationNo" tick={AXIS} />
                      <YAxis tick={AXIS} />
                      <RTooltip
                        formatter={(v: number) => formatCurrency(v)}
                        cursor={{ fill: 'hsl(var(--accent))' }}
                      />
                      <Bar dataKey="fuelCost" stackId="c" fill="#0ea5e9" name="Fuel" />
                      <Bar dataKey="maintenanceCost" stackId="c" fill="#f59e0b" name="Maintenance" />
                      <Bar
                        dataKey="expenseCost"
                        stackId="c"
                        fill="#8b5cf6"
                        name="Expenses"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartOrEmpty>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-500" /> Vehicle ROI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartOrEmpty rows={data.roi}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.roi}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="registrationNo" tick={AXIS} />
                      <YAxis tick={AXIS} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                      <RTooltip
                        formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, 'ROI']}
                        cursor={{ fill: 'hsl(var(--accent))' }}
                      />
                      <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                        {data.roi.map((r) => (
                          <Cell key={r.vehicleId} fill={r.roi >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartOrEmpty>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Per-Vehicle Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>Vehicle</TH>
                    <TH>Distance</TH>
                    <TH>Fuel (L)</TH>
                    <TH>km/L</TH>
                    <TH>Fuel Cost</TH>
                    <TH>Maint.</TH>
                    <TH>Expenses</TH>
                    <TH>Op. Cost</TH>
                    <TH>Revenue</TH>
                    <TH>ROI</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.perVehicle.map((r) => (
                    <TR key={r.vehicleId}>
                      <TD className="font-medium">{r.registrationNo}</TD>
                      <TD>{formatNumber(r.totalActualDistance)} km</TD>
                      <TD>{formatNumber(r.totalFuelConsumed, 1)}</TD>
                      <TD>{r.fuelEfficiency}</TD>
                      <TD>{formatCurrency(r.fuelCost)}</TD>
                      <TD>{formatCurrency(r.maintenanceCost)}</TD>
                      <TD>{formatCurrency(r.expenseCost)}</TD>
                      <TD className="font-medium">{formatCurrency(r.operationalCost)}</TD>
                      <TD>{formatCurrency(r.revenue)}</TD>
                      <TD
                        className={
                          r.roi >= 0
                            ? 'font-medium text-emerald-600 dark:text-emerald-400'
                            : 'font-medium text-red-600 dark:text-red-400'
                        }
                      >
                        {(r.roi * 100).toFixed(1)}%
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ChartOrEmpty({ rows, children }: { rows: unknown[]; children: React.ReactNode }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No data for the selected range.
      </div>
    );
  }
  return <>{children}</>;
}
