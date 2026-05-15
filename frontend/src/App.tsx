// src/App.tsx
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import DashboardLayout from '@/components/layout/DashboardLayout';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import RegisterPage from '@/pages/RegisterPage';
import MicrosoftOAuthResultPage from '@/pages/MicrosoftOAuthResultPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import AdminApplicationsPage from '@/pages/AdminApplicationsPage';
import DashboardPage from '@/pages/DashboardPage';
import LeadsPage from '@/pages/LeadsPage';
import LeadDetailPage from '@/pages/LeadDetailPage';
import DRFPage from '@/pages/DRFPage';
import ProspectsPage from '@/pages/ProspectsPage';
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
import EmployeeDetailPage from '@/pages/EmployeeDetailPage';
import TrainingPage from '@/pages/TrainingPage';
import EngineerPerformancePage from '@/pages/EngineerPerformancePage';
import AttendancePage from '@/pages/AttendancePage';
import LeavePage from '@/pages/LeavePage';
import SettingsPage from '@/pages/SettingsPage';
import ProfilePage from '@/pages/ProfilePage';
import VisitsAndClaimsPage from '@/pages/VisitsAndClaimsPage';
import ContactsPage from '@/pages/ContactsPage';
import TimesheetPage from '@/pages/TimesheetPage';
import FeedbackPage from '@/pages/FeedbackPage';
import type { Role } from '@/types';

// Route guards
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, refreshToken, setToken, logout } = useAuthStore();
  const [checking, setChecking] = useState<boolean>(!token && !!refreshToken);

  useEffect(() => {
    if (!token && refreshToken) {
      import('./api/axios').then(({ default: api }) => {
        api.post('/auth/refresh', { refreshToken })
          .then(res => { setToken(res.data.data.accessToken); setChecking(false); })
          .catch(() => { logout(); setChecking(false); });
      });
    }
  }, []);

  if (checking) return null;
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return !token ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

// perm: if supplied, user must have this permission key (admin always bypasses)
function RoleRoute({ children, roles, perm }: { children: React.ReactNode; roles: Role[]; perm?: string }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  // If a specific permission is required and the user has that permission, allow access regardless of their role.
  if (perm && user.role !== 'admin') {
    const perms: string[] = (user as any).permissions ?? [];
    if (perms.length > 0) {
      if (perms.includes(perm)) return <>{children}</>;
      // user has permissions array but doesn't include this perm — deny
      return <Navigate to="/dashboard" replace />;
    }
  }
  // If no permission-based override occurred, ensure the user's role is allowed.
  if (!roles.includes(user.role as Role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <BrowserRouter basename="/zieos">
        <Routes>
          {/* Landing page — public */}
          <Route path="/" element={<LandingPage />} />

          {/* Public feedback route — no auth */}
          <Route path="/feedback/:token" element={<FeedbackPage />} />

          {/* Auth routes */}
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/microsoft-oauth-result" element={<MicrosoftOAuthResultPage />} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected layout — pathless so all /dashboard /leads etc. still work */}
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>

            {/* All roles */}
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />

            {/* Admin + Manager + Sales */}
            <Route path="leads" element={<RoleRoute roles={['admin', 'manager', 'sales']} perm="leads"><LeadsPage /></RoleRoute>} />
            <Route path="leads/:id" element={<RoleRoute roles={['admin', 'manager', 'sales']} perm="leads"><LeadDetailPage /></RoleRoute>} />
            <Route path="drfs" element={<RoleRoute roles={['admin', 'manager', 'sales']} perm="leads"><DRFPage /></RoleRoute>} />
            <Route path="prospects" element={<RoleRoute roles={['admin', 'manager', 'sales', 'engineer']} perm="prospects"><ProspectsPage /></RoleRoute>} />
            <Route path="quotations" element={<RoleRoute roles={['admin', 'manager', 'sales']} perm="quotations"><QuotationsPage /></RoleRoute>} />
            <Route path="purchases" element={<RoleRoute roles={['admin', 'manager', 'sales']} perm="purchases"><PurchasesPage /></RoleRoute>} />

            {/* Accounts */}
            <Route path="accounts" element={<RoleRoute roles={['admin', 'manager', 'sales', 'engineer', 'hr', 'finance']} perm="accounts"><AccountsPage /></RoleRoute>} />
            <Route path="accounts/:id" element={<RoleRoute roles={['admin', 'manager', 'sales', 'engineer', 'hr', 'finance']} perm="accounts"><AccountDetailPage /></RoleRoute>} />
            <Route path="support" element={<RoleRoute roles={['admin', 'manager', 'sales', 'engineer']} perm="support"><SupportPage /></RoleRoute>} />

            {/* Engineer */}
            <Route path="installations" element={<RoleRoute roles={['admin', 'manager', 'engineer']} perm="installations"><InstallationsPage /></RoleRoute>} />
            <Route path="training" element={<RoleRoute roles={['admin', 'manager', 'engineer']} perm="training"><TrainingPage /></RoleRoute>} />

            {/* Finance */}
            <Route path="invoices" element={<RoleRoute roles={['admin', 'manager', 'hr', 'finance']} perm="invoices"><InvoicesPage /></RoleRoute>} />
            <Route path="payments" element={<RoleRoute roles={['admin', 'manager', 'hr', 'finance']} perm="payments"><PaymentsPage /></RoleRoute>} />

            {/* HR */}
            <Route path="salary" element={<RoleRoute roles={['admin', 'manager', 'hr']} perm="salary"><SalaryPage /></RoleRoute>} />

            {/* Visits & Claims */}
            <Route path="visits-and-claims" element={<RoleRoute roles={['admin', 'manager', 'engineer', 'hr']} perm="visits"><VisitsAndClaimsPage /></RoleRoute>} />
            <Route path="engineer-visits" element={<RoleRoute roles={['admin', 'manager', 'engineer', 'hr']} perm="visits"><EngineerVisitsPage /></RoleRoute>} />

            <Route path="engineer-performance" element={<RoleRoute roles={['admin', 'manager', 'engineer', 'sales']}><EngineerPerformancePage /></RoleRoute>} />

            {/* Attendance & Leave */}
            <Route path="attendance" element={<RoleRoute roles={['admin', 'manager', 'hr', 'engineer', 'sales']} perm="attendance"><AttendancePage /></RoleRoute>} />
            <Route path="leaves" element={<RoleRoute roles={['admin', 'manager', 'hr', 'engineer', 'sales']} perm="leaves"><LeavePage /></RoleRoute>} />

            {/* Timesheet */}
            <Route path="timesheet" element={<RoleRoute roles={['admin', 'manager', 'sales', 'engineer', 'hr', 'finance']} perm="timesheet"><TimesheetPage /></RoleRoute>} />

            {/* Contacts */}
            <Route path="contacts" element={<RoleRoute roles={['admin', 'manager', 'sales', 'engineer', 'hr', 'finance']} perm="contacts"><ContactsPage /></RoleRoute>} />

            {/* Admin + Manager + HR — user management */}
            <Route path="users" element={<RoleRoute roles={['admin', 'manager', 'hr']}><UsersPage /></RoleRoute>} />
            <Route path="employees/:id" element={<RoleRoute roles={['admin', 'manager', 'hr']}><EmployeeDetailPage /></RoleRoute>} />

            {/* Admin only */}
            <Route path="settings" element={<RoleRoute roles={['admin']}><SettingsPage /></RoleRoute>} />

            {/* Platform admin only */}
            <Route path="admin-applications" element={<RoleRoute roles={['platform_admin']}><AdminApplicationsPage /></RoleRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}