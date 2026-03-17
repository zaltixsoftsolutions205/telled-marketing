import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import DashboardLayout from '@/components/layout/DashboardLayout';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import DashboardPage from '@/pages/DashboardPage';
import LeadsPage from '@/pages/LeadsPage';
import LeadDetailPage from '@/pages/LeadDetailPage';
import DRFPage from '@/pages/DRFPage';
import AccountsPage from '@/pages/AccountsPage';
import AccountDetailPage from '@/pages/AccountDetailPage';
import QuotationsPage from '@/pages/QuotationsPage';
import PurchasesPage from '@/pages/PurchasesPage';
import InstallationsPage from '@/pages/InstallationsPage';
import SupportPage from '@/pages/SupportPage';
import InvoicesPage from '@/pages/InvoicesPage';
import PaymentsPage from '@/pages/PaymentsPage';
import EngineerVisitsPage from '@/pages/EngineerVisitsPage';
import SalaryPage from '@/pages/SalaryPage';
import UsersPage from '@/pages/UsersPage';
import TrainingPage from '@/pages/TrainingPage';
import type { Role } from '@/types';

// ─── Route guards ─────────────────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return !token ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

/** Renders children only if the logged-in user has one of the allowed roles.
 *  Otherwise redirects to /dashboard (which shows a role-specific view). */
function RoleRoute({ children, roles }: { children: React.ReactNode; roles: Role[] }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role as Role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login"  element={<GuestRoute><LoginPage  /></GuestRoute>} />
        <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />

        {/* Protected layout */}
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* All roles */}
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Admin + Sales */}
          <Route path="leads" element={
            <RoleRoute roles={['admin','sales']}><LeadsPage /></RoleRoute>
          } />
          <Route path="leads/:id" element={
            <RoleRoute roles={['admin','sales']}><LeadDetailPage /></RoleRoute>
          } />
          <Route path="drfs" element={
            <RoleRoute roles={['admin','sales']}><DRFPage /></RoleRoute>
          } />
          <Route path="quotations" element={
            <RoleRoute roles={['admin','sales']}><QuotationsPage /></RoleRoute>
          } />
          <Route path="purchases" element={
            <RoleRoute roles={['admin','sales']}><PurchasesPage /></RoleRoute>
          } />

          {/* Admin + Sales + Engineer (shared modules) */}
          <Route path="accounts" element={
            <RoleRoute roles={['admin','sales','engineer']}><AccountsPage /></RoleRoute>
          } />
          <Route path="accounts/:id" element={
            <RoleRoute roles={['admin','sales','engineer']}><AccountDetailPage /></RoleRoute>
          } />
          <Route path="support" element={
            <RoleRoute roles={['admin','sales','engineer']}><SupportPage /></RoleRoute>
          } />

          {/* Engineer */}
          <Route path="installations" element={
            <RoleRoute roles={['admin','engineer']}><InstallationsPage /></RoleRoute>
          } />
          <Route path="training" element={
            <RoleRoute roles={['admin','engineer']}><TrainingPage /></RoleRoute>
          } />

          {/* HR & Finance + Admin */}
          <Route path="invoices" element={
            <RoleRoute roles={['admin','hr_finance']}><InvoicesPage /></RoleRoute>
          } />
          <Route path="payments" element={
            <RoleRoute roles={['admin','hr_finance']}><PaymentsPage /></RoleRoute>
          } />
          <Route path="salary" element={
            <RoleRoute roles={['admin','hr_finance']}><SalaryPage /></RoleRoute>
          } />

          {/* Engineer visits — engineer submits, HR approves */}
          <Route path="engineer-visits" element={
            <RoleRoute roles={['admin','engineer','hr_finance']}><EngineerVisitsPage /></RoleRoute>
          } />

          {/* Admin only */}
          <Route path="users" element={
            <RoleRoute roles={['admin']}><UsersPage /></RoleRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
