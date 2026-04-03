// src/components/layout/Sidebar.tsx
import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, FileText,
  ShoppingCart, Wrench, Headphones, Receipt, CreditCard,
  CalendarCheck, DollarSign, UserCog, LogOut, ChevronDown, ChevronRight,
  FileBadge, GraduationCap, TrendingUp, CalendarDays, Calendar, Settings,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useLogoStore } from '@/store/logoStore';
import { resolveLogoUrl } from '@/api/settings';
import { authApi } from '@/api/auth';
import type { Role } from '@/types';
import { cn } from '@/utils/cn';

const roleColors: Record<string, string> = {
  admin:      'bg-violet-100 text-violet-700',
  sales:      'bg-blue-100 text-blue-700',
  engineer:   'bg-emerald-100 text-emerald-700',
  hr_finance: 'bg-amber-100 text-amber-700',
};

const salesNav = [
  { to: '/leads',       label: 'Leads',           icon: Users },
  { to: '/drfs',        label: 'DRF Management',  icon: FileBadge },
  { to: '/quotations',  label: 'Quotations',       icon: FileText },
  { to: '/purchases',   label: 'Purchase Orders',  icon: ShoppingCart },
  { to: '/accounts',    label: 'Accounts',         icon: Building2 },
];

const engineerNav = [
  { to: '/accounts',             label: 'Accounts',          icon: Building2 },
  { to: '/installations',        label: 'Installations',     icon: Wrench },
  { to: '/support',              label: 'Support',           icon: Headphones },
  { to: '/training',             label: 'Training',          icon: GraduationCap },
  { to: '/visits-and-claims',    label: 'Visits & Claims',   icon: CalendarCheck }, // Updated path
  { to: '/engineer-performance', label: 'My Performance',    icon: TrendingUp },
  { to: '/attendance',           label: 'My Attendance',     icon: CalendarDays },
  { to: '/leaves',               label: 'My Leaves',         icon: Calendar },
];

const hrNav = [
  { to: '/invoices',        label: 'Invoices',          icon: Receipt },
  { to: '/payments',        label: 'Payments',          icon: CreditCard },
  { to: '/visits-and-claims', label: 'Visits & Claims', icon: CalendarCheck }, // Updated path
  { to: '/salary',          label: 'Salary',            icon: DollarSign },
  { to: '/attendance',      label: 'Attendance',        icon: CalendarDays },
  { to: '/leaves',          label: 'Leave Management',  icon: CalendarDays },
  { to: '/accounts',        label: 'Accounts',          icon: Building2 },
];

const adminSections = [
  {
    label: 'Sales',
    items: [
      { to: '/leads',      label: 'Leads',          icon: Users },
      { to: '/drfs',       label: 'DRF Management', icon: FileBadge },
      { to: '/quotations', label: 'Quotations',     icon: FileText },
      { to: '/purchases',  label: 'Purchase Orders',icon: ShoppingCart },
    ],
  },
  {
    label: 'Engineers',
    items: [
      { to: '/accounts',             label: 'Accounts',        icon: Building2 },
      { to: '/installations',        label: 'Installations',   icon: Wrench },
      { to: '/support',              label: 'Support',         icon: Headphones },
      { to: '/training',             label: 'Training',        icon: GraduationCap },
      { to: '/visits-and-claims',    label: 'Visits & Claims', icon: CalendarCheck }, // Updated path
      { to: '/engineer-performance', label: 'Performance',     icon: TrendingUp },
    ],
  },
  {
    label: 'HR & Finance',
    items: [
      { to: '/invoices',        label: 'Invoices',          icon: Receipt },
      { to: '/payments',        label: 'Payments',          icon: CreditCard },
      { to: '/visits-and-claims', label: 'Visits & Claims', icon: CalendarCheck }, // Updated path
      { to: '/salary',          label: 'Salary',            icon: DollarSign },
      { to: '/attendance',      label: 'Attendance',        icon: CalendarDays },
      { to: '/leaves',          label: 'Leave Management',  icon: CalendarDays },
    ],
  },
];

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div className={cn('sidebar-item', isActive ? 'sidebar-item-active' : 'sidebar-item-inactive')}>
          <Icon size={17} />
          <span className="flex-1 text-sm">{label}</span>
        </div>
      )}
    </NavLink>
  );
}

function SidebarSection({ label, items }: { label: string; items: Array<{ to: string; label: string; icon: React.ElementType }> }) {
  const location = useLocation();
  const isAnyActive = items.some(i => location.pathname.startsWith(i.to));
  const [open, setOpen] = useState(isAnyActive);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors mt-2"
      >
        <span>{label}</span>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && (
        <div className="space-y-0.5">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {({ isActive }) => (
                <div className={cn('sidebar-item pl-6', isActive ? 'sidebar-item-active' : 'sidebar-item-inactive')}>
                  <item.icon size={15} />
                  <span className="flex-1 text-sm">{item.label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const role = user?.role as Role;
  const logoUrl = useLogoStore((s) => s.logoUrl);
  const companyName = useLogoStore((s) => s.companyName);
  const resolvedLogo = resolveLogoUrl(logoUrl);

  const handleLogout = async () => {
    await authApi.logout();
    logout();
    navigate('/login');
  };

  const nonAdminItems = role === 'sales' ? salesNav : role === 'engineer' ? engineerNav : hrNav;

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {resolvedLogo ? (
            <img src={resolvedLogo} alt="Company Logo" className="h-14 w-14 object-contain rounded-xl" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-200">
              <span className="text-white font-black text-lg">T</span>
            </div>
          )}
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">{companyName || 'My Company'}</p>
            <p className="text-xs text-gray-400 mt-0.5">Operations Platform</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
        <NavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} />

        {role === 'admin' ? (
          <>
            {adminSections.map((section) => (
              <SidebarSection key={section.label} label={section.label} items={section.items} />
            ))}
            <div className="mt-2 border-t border-gray-100 pt-2 space-y-0.5">
              <NavItem to="/users" label="Users" icon={UserCog} />
              <NavItem to="/settings" label="Settings" icon={Settings} />
            </div>
          </>
        ) : (
          <div className="mt-1 space-y-0.5">
            {nonAdminItems.map((item) => (
              <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} />
            ))}
          </div>
        )}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <span className="text-violet-700 font-bold text-sm">{user?.name?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
            <span className={cn('badge text-[10px] mt-0.5', roleColors[role] || 'bg-gray-100 text-gray-600')}>
              {role?.replace('_', ' ')}
            </span>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors font-medium">
          <LogOut size={15} /> Logout
        </button>
      </div>
    </aside>
  );
}