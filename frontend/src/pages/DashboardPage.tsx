import { useAuth } from '@/context/AuthContext';
import { FleetManagerDashboard } from './dashboards/FleetManagerDashboard';
import { DriverDashboard } from './dashboards/DriverDashboard';
import { SafetyOfficerDashboard } from './dashboards/SafetyOfficerDashboard';
import { FinancialAnalystDashboard } from './dashboards/FinancialAnalystDashboard';

/** Each role sees a purpose-built dashboard (the API is role-scoped too). */
export function DashboardPage() {
  const { user } = useAuth();
  switch (user?.role) {
    case 'DRIVER':
      return <DriverDashboard />;
    case 'SAFETY_OFFICER':
      return <SafetyOfficerDashboard />;
    case 'FINANCIAL_ANALYST':
      return <FinancialAnalystDashboard />;
    default:
      return <FleetManagerDashboard />;
  }
}
