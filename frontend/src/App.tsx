import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import DashboardLayout from '@/components/layout/DashboardLayout';
import LoginPage from '@/pages/LoginPage';
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return !token ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="drfs" element={<DRFPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="accounts/:id" element={<AccountDetailPage />} />
          <Route path="quotations" element={<QuotationsPage />} />
          <Route path="purchases" element={<PurchasesPage />} />
          <Route path="installations" element={<InstallationsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="engineer-visits" element={<EngineerVisitsPage />} />
          <Route path="salary" element={<SalaryPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="training" element={<TrainingPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
