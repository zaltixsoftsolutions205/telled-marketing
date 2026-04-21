// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import DashboardLayout from '@/components/layout/DashboardLayout';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import RegisterPage from '@/pages/RegisterPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import AdminApplicationsPage from '@/pages/AdminApplicationsPage';
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
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return !token ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

function RoleRoute({ children, roles }: { children: React.ReactNode; roles: Role[] }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
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
          <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected layout — pathless so all /dashboard /leads etc. still work */}
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>

            {/* All roles */}
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />

            {/* Admin + Sales */}
            <Route path="leads" element={<RoleRoute roles={['admin', 'sales']}><LeadsPage /></RoleRoute>} />
            <Route path="leads/:id" element={<RoleRoute roles={['admin', 'sales']}><LeadDetailPage /></RoleRoute>} />
            <Route path="drfs" element={<RoleRoute roles={['admin', 'sales']}><DRFPage /></RoleRoute>} />
            <Route path="quotations" element={<RoleRoute roles={['admin', 'sales']}><QuotationsPage /></RoleRoute>} />
            <Route path="purchases" element={<RoleRoute roles={['admin', 'sales']}><PurchasesPage /></RoleRoute>} />

            {/* Admin + Sales + Engineer + HR */}
            <Route path="accounts" element={<RoleRoute roles={['admin', 'sales', 'engineer', 'hr_finance']}><AccountsPage /></RoleRoute>} />
            <Route path="accounts/:id" element={<RoleRoute roles={['admin', 'sales', 'engineer', 'hr_finance']}><AccountDetailPage /></RoleRoute>} />
            <Route path="support" element={<RoleRoute roles={['admin', 'sales', 'engineer']}><SupportPage /></RoleRoute>} />

            {/* Engineer */}
            <Route path="installations" element={<RoleRoute roles={['admin', 'engineer']}><InstallationsPage /></RoleRoute>} />
            <Route path="training" element={<RoleRoute roles={['admin', 'engineer']}><TrainingPage /></RoleRoute>} />

            {/* HR & Finance */}
            <Route path="invoices" element={<RoleRoute roles={['admin', 'hr_finance']}><InvoicesPage /></RoleRoute>} />
            <Route path="payments" element={<RoleRoute roles={['admin', 'hr_finance']}><PaymentsPage /></RoleRoute>} />
            <Route path="salary" element={<RoleRoute roles={['admin', 'hr_finance']}><SalaryPage /></RoleRoute>} />

            {/* Engineer Visits & Claims - Combined Page */}
            <Route path="visits-and-claims" element={
              <RoleRoute roles={['admin', 'engineer', 'hr_finance']}>
                <VisitsAndClaimsPage />
              </RoleRoute>
            } />

            {/* Keep old route for backward compatibility (optional) */}
            <Route path="engineer-visits" element={
              <RoleRoute roles={['admin', 'engineer', 'hr_finance']}>
                <EngineerVisitsPage />
              </RoleRoute>
            } />

            <Route path="engineer-performance" element={<RoleRoute roles={['admin', 'engineer']}><EngineerPerformancePage /></RoleRoute>} />

            {/* Attendance & Leave */}
            <Route path="attendance" element={<RoleRoute roles={['admin', 'hr_finance', 'engineer', 'sales']}><AttendancePage /></RoleRoute>} />
            <Route path="leaves" element={<RoleRoute roles={['admin', 'hr_finance', 'engineer', 'sales']}><LeavePage /></RoleRoute>} />

            {/* Timesheet — all roles */}
            <Route path="timesheet" element={<RoleRoute roles={['admin', 'sales', 'engineer', 'hr_finance']}><TimesheetPage /></RoleRoute>} />

            {/* Contacts — all roles */}
            <Route path="contacts" element={<RoleRoute roles={['admin', 'sales', 'engineer', 'hr_finance']}><ContactsPage /></RoleRoute>} />

            {/* Admin only */}
            <Route path="users" element={<RoleRoute roles={['admin']}><UsersPage /></RoleRoute>} />
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