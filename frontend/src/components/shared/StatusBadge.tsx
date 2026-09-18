import { Badge } from '@/components/ui/badge';
import { DriverStatus, ExpenseType, TripStatus, VehicleStatus } from '@/lib/types';

type Tone = React.ComponentProps<typeof Badge>['tone'];

const VEHICLE: Record<VehicleStatus, { tone: Tone; label: string }> = {
  AVAILABLE: { tone: 'success', label: 'Available' },
  ON_TRIP: { tone: 'info', label: 'On Trip' },
  IN_SHOP: { tone: 'warning', label: 'In Shop' },
  RETIRED: { tone: 'neutral', label: 'Retired' },
};

const DRIVER: Record<DriverStatus, { tone: Tone; label: string }> = {
  AVAILABLE: { tone: 'success', label: 'Available' },
  ON_TRIP: { tone: 'info', label: 'On Trip' },
  OFF_DUTY: { tone: 'neutral', label: 'Off Duty' },
  SUSPENDED: { tone: 'danger', label: 'Suspended' },
};

const TRIP: Record<TripStatus, { tone: Tone; label: string }> = {
  DRAFT: { tone: 'neutral', label: 'Draft' },
  DISPATCHED: { tone: 'info', label: 'Dispatched' },
  COMPLETED: { tone: 'success', label: 'Completed' },
  CANCELLED: { tone: 'danger', label: 'Cancelled' },
};

const EXPENSE: Record<ExpenseType, { tone: Tone; label: string }> = {
  TOLL: { tone: 'info', label: 'Toll' },
  MAINTENANCE: { tone: 'warning', label: 'Maintenance' },
  OTHER: { tone: 'purple', label: 'Other' },
};

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const s = VEHICLE[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
export function DriverStatusBadge({ status }: { status: DriverStatus }) {
  const s = DRIVER[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
export function TripStatusBadge({ status }: { status: TripStatus }) {
  const s = TRIP[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
export function ExpenseTypeBadge({ type }: { type: ExpenseType }) {
  const s = EXPENSE[type];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
