import { useAuth } from '@/context/AuthContext';
import { ModuleKey, canAccessModule } from '@/lib/permissions';
import { ForbiddenPage } from '@/pages/ForbiddenPage';

/**
 * Route-level guard: renders the module only if the current role may access it,
 * otherwise a 403 page (never a silently blank screen). Direct-URL navigation
 * to a blocked module therefore lands on the 403, matching the RBAC matrix.
 */
export function RequireModule({
  module,
  children,
}: {
  module: ModuleKey;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!canAccessModule(module, user?.role)) return <ForbiddenPage />;
  return <>{children}</>;
}
