import { useAuthStore } from '@/store/authStore';
import AdminDashboard from './dashboard/AdminDashboard';
import ManagerDashboard from './dashboard/ManagerDashboard';
import SalesDashboard from './dashboard/SalesDashboard';
import EngineerDashboard from './dashboard/EngineerDashboard';
import HRDashboard from './dashboard/HRDashboard';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  switch (user?.role) {
    case 'admin':    return <AdminDashboard />;
    case 'manager':  return <ManagerDashboard />;
    case 'sales':    return <SalesDashboard />;
    case 'engineer': return <EngineerDashboard />;
    case 'hr':       return <HRDashboard />;
    case 'finance':  return <HRDashboard />;
    default:         return null;
  }
}
