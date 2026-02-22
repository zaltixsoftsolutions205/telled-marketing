import { useAuthStore } from '@/store/authStore';
import AdminDashboard from './dashboard/AdminDashboard';
import SalesDashboard from './dashboard/SalesDashboard';
import EngineerDashboard from './dashboard/EngineerDashboard';
import HRDashboard from './dashboard/HRDashboard';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  switch (user?.role) {
    case 'admin':       return <AdminDashboard />;
    case 'sales':       return <SalesDashboard />;
    case 'engineer':    return <EngineerDashboard />;
    case 'hr_finance':  return <HRDashboard />;
    default:            return null;
  }
}
