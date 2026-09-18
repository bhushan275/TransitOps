import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/components/ui/toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { RequireModule } from '@/components/layout/RequireModule';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { VehiclesPage } from '@/pages/VehiclesPage';
import { DriversPage } from '@/pages/DriversPage';
import { TripsPage } from '@/pages/TripsPage';
import { MaintenancePage } from '@/pages/MaintenancePage';
import { FuelExpensesPage } from '@/pages/FuelExpensesPage';
import { ReportsPage } from '@/pages/ReportsPage';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route
                  path="/vehicles"
                  element={
                    <RequireModule module="vehicles">
                      <VehiclesPage />
                    </RequireModule>
                  }
                />
                <Route
                  path="/drivers"
                  element={
                    <RequireModule module="drivers">
                      <DriversPage />
                    </RequireModule>
                  }
                />
                <Route
                  path="/trips"
                  element={
                    <RequireModule module="trips">
                      <TripsPage />
                    </RequireModule>
                  }
                />
                <Route
                  path="/maintenance"
                  element={
                    <RequireModule module="maintenance">
                      <MaintenancePage />
                    </RequireModule>
                  }
                />
                <Route
                  path="/fuel-expenses"
                  element={
                    <RequireModule module="fuel-expenses">
                      <FuelExpensesPage />
                    </RequireModule>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <RequireModule module="reports">
                      <ReportsPage />
                    </RequireModule>
                  }
                />
              </Route>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
