import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS } from '@/lib/permissions';

export function ForbiddenPage() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldX className="size-8" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">403 — Access denied</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Your role{user ? ` (${ROLE_LABELS[user.role]})` : ''} doesn't have access to this module.
          If you believe this is a mistake, contact your Fleet Manager.
        </p>
      </div>
      <Link to="/dashboard" className={buttonVariants()}>
        Back to Dashboard
      </Link>
    </div>
  );
}
