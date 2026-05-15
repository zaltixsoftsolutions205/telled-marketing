// src/components/layout/Sidebar.tsx
import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, FileText,
  ShoppingCart, Wrench, Headphones, Receipt, CreditCard,
  CalendarCheck, DollarSign, UserCog, LogOut, ChevronDown, ChevronRight,
  FileBadge, GraduationCap, TrendingUp, CalendarDays, Calendar, Settings,
  BookUser, Timer, ClipboardCheck, UserCircle, Target,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useLogoStore } from '@/store/logoStore';
import { authApi } from '@/api/auth';
import type { Role } from '@/types';
import { cn } from '@/utils/cn';

const roleColors: Record<string, string> = {
  admin:          'bg-violet-100 text-violet-700',
  manager:        'bg-purple-100 text-purple-700',
  sales:          'bg-blue-100 text-blue-700',
  engineer:       'bg-emerald-100 text-emerald-700',
  hr:             'bg-amber-100 text-amber-700',
  finance:        'bg-orange-100 text-orange-700',
  platform_admin: 'bg-rose-100 text-rose-700',
};

// Each nav item carries an optional `perm` key that must exist in user.permissions.
// Items with no `perm` are always shown for that role.
type NavEntry = { to: string; label: string; icon: React.ElementType; perm?: string };

// Master nav — ALL possible modules for non-admin users.
// Sidebar shows only items whose perm is in user.permissions (or items with no perm).
const allModulesNav: NavEntry[] = [
  { to: '/leads',                label: 'Leads',            icon: Users,        perm: 'leads' },
  { to: '/drfs',                 label: 'DRF Management',   icon: FileBadge,    perm: 'leads' },
  { to: '/prospects',            label: 'Prospects',        icon: Target,       perm: 'prospects' },
  { to: '/quotations',           label: 'Quotations',       icon: FileText,     perm: 'quotations' },
  { to: '/purchases',            label: 'Purchase Orders',  icon: ShoppingCart, perm: 'purchases' },
  { to: '/accounts',             label: 'Accounts',         icon: Building2,    perm: 'accounts' },
  { to: '/installations',        label: 'Installations',    icon: Wrench,       perm: 'installations' },
  { to: '/support',              label: 'Support',          icon: Headphones,   perm: 'support' },
  { to: '/training',             label: 'Training',         icon: GraduationCap,perm: 'training' },
  { to: '/visits-and-claims',    label: 'Visits & Claims',  icon: CalendarCheck,perm: 'visits' },
  { to: '/invoices',             label: 'Invoices',         icon: Receipt,      perm: 'invoices' },
  { to: '/payments',             label: 'Payments',         icon: CreditCard,   perm: 'payments' },
  { to: '/salary',               label: 'Salary & Payroll', icon: DollarSign,   perm: 'salary' },
  { to: '/attendance',           label: 'Attendance',       icon: CalendarDays, perm: 'attendance' },
  { to: '/leaves',               label: 'Leave Management', icon: Calendar,     perm: 'leaves' },
  { to: '/timesheet',            label: 'Timesheet',        icon: Timer,        perm: 'timesheet' },
  { to: '/contacts',             label: 'Contacts',         icon: BookUser,     perm: 'contacts' },
  { to: '/engineer-performance', label: 'My Performance',   icon: TrendingUp },
  { to: '/users',                label: 'Users & Access',   icon: UserCog },
];

const adminSections = [
  {
    label: 'Sales',
    items: [
      { to: '/leads',      label: 'Leads',           icon: Users },
      { to: '/drfs',       label: 'DRF Management',  icon: FileBadge },
      { to: '/prospects',  label: 'Prospects',       icon: Target },
      { to: '/quotations', label: 'Quotations',      icon: FileText },
      { to: '/purchases',  label: 'Purchase Orders', icon: ShoppingCart },
    ],
  },
  {
    label: 'Engineers',
    items: [
      { to: '/accounts',             label: 'Accounts',        icon: Building2 },
      { to: '/installations',        label: 'Installations',   icon: Wrench },
      { to: '/support',              label: 'Support',         icon: Headphones },
      { to: '/training',             label: 'Training',        icon: GraduationCap },
      { to: '/visits-and-claims',    label: 'Visits & Claims', icon: CalendarCheck },
      { to: '/engineer-performance', label: 'Performance',     icon: TrendingUp },
    ],
  },
  {
    label: 'HR',
    items: [
      { to: '/visits-and-claims', label: 'Visits & Claims',  icon: CalendarCheck },
      { to: '/salary',            label: 'Salary & Payroll', icon: DollarSign },
      { to: '/attendance',        label: 'Attendance',       icon: CalendarDays },
      { to: '/leaves',            label: 'Leave Management', icon: Calendar },
      { to: '/timesheet',         label: 'Timesheet',        icon: Timer },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/invoices', label: 'Invoices', icon: Receipt },
      { to: '/payments', label: 'Payments', icon: CreditCard },
    ],
  },
];

function NavItem({ to, label, icon: Icon, compact = false }: { to: string; label: string; icon: React.ElementType; compact?: boolean }) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div className={cn('sidebar-item', isActive ? 'sidebar-item-active' : 'sidebar-item-inactive', compact && '!py-1 !px-2.5')}>
          <Icon size={compact ? 12 : 15} />
          <span className={cn('flex-1', compact ? 'text-[11px]' : 'text-sm')}>{label}</span>
        </div>
      )}
    </NavLink>
  );
}

function SidebarSection({ label, items }: { label: string; items: Array<{ to: string; label: string; icon: React.ElementType }> }) {
  const location = useLocation();
  const isAnyActive = items.some(i => location.pathname.startsWith(i.to));
  const [open, setOpen] = useState(isAnyActive);
  if (items.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors mt-1"
      >
        <span>{label}</span>
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
      </button>
      {open && (
        <div className="space-y-0.5">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {({ isActive }) => (
                <div className={cn('sidebar-item pl-5', isActive ? 'sidebar-item-active' : 'sidebar-item-inactive')}>
                  <item.icon size={13} />
                  <span className="flex-1 text-xs">{item.label}</span>
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
  const permissions: string[] = (user as any)?.permissions ?? [];
  const canCreateUsers: boolean = (user as any)?.canCreateUsers ?? false;
  const hasPermission = (perm?: string) => {
    if (!perm) return true;
    return permissions.includes(perm);
  };

  const handleLogout = async () => {
    await authApi.logout();
    logout();
    navigate('/login');
  };

  // Filter master nav by permissions; hide Users & Access unless canCreateUsers
  const filteredNonAdmin = allModulesNav.filter(item => {
    if (item.to === '/users') return canCreateUsers;
    return hasPermission(item.perm);
  });

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-100 flex flex-col">
      {/* Logo */}
      <div className="py-4 px-4 border-b border-gray-100">
        <div className="flex flex-col items-center text-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
          ) : (
            <div className="h-10 flex items-center justify-center px-2 border border-dashed border-violet-300 rounded-lg bg-violet-50 cursor-pointer" onClick={() => window.location.href = '/zieos/settings'}>
              <span className="text-[10px] text-violet-500 font-medium leading-tight">Add your logo here</span>
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900 text-xs leading-tight">{companyName || 'ZIEOS'}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">CRM & Operations</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
        <NavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} compact={role === 'manager'} />

        {role === 'platform_admin' ? (
          <div className="mt-1.5 space-y-0.5">
            <NavItem to="/admin-applications" label="Applications" icon={ClipboardCheck} />
          </div>
        ) : role === 'admin' ? (
          <>
            {adminSections.map((section) => (
              <SidebarSection key={section.label} label={section.label} items={section.items} />
            ))}
            <div className="mt-1.5 border-t border-gray-100 pt-1.5 space-y-0.5">
              <NavItem to="/contacts" label="Contacts"      icon={BookUser} />
              <NavItem to="/users"    label="Users & Access" icon={UserCog} />
              <NavItem to="/settings" label="Settings"      icon={Settings} />
            </div>
          </>
        ) : (
          <div className="mt-1 space-y-0">
            {filteredNonAdmin.length === 0 ? (
              <p className="text-[11px] text-gray-400 px-3 py-4 text-center">No modules assigned.<br/>Contact your admin.</p>
            ) : (
              filteredNonAdmin.map((item) => (
                <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} compact={role === 'manager'} />
              ))
            )}
          </div>
        )}
      </nav>

      {/* User Footer */}
      <div className="p-3.5 border-t border-gray-100">
        <div className="flex items-center gap-2.5 mb-2.5">
          <UserCircle size={30} className="text-violet-400 flex-shrink-0" strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate leading-tight">
              {user?.name?.trim() || user?.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className={cn('badge text-[10px]', roleColors[role] || 'bg-gray-100 text-gray-600')}>
            {role === 'hr' ? 'HR' : role === 'finance' ? 'Finance' : role === 'platform_admin' ? 'Platform Admin' : role === 'manager' ? 'Manager' : role ? role.charAt(0).toUpperCase() + role.slice(1) : ''}
          </span>
          <span className="text-[10px] text-gray-400">{user?.department || ''}</span>
        </div>
        {permissions.length > 0 && role !== 'admin' && (
          <p className="text-[10px] text-gray-400 mb-1.5">{permissions.length} module{permissions.length !== 1 ? 's' : ''} enabled</p>
        )}
        <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors font-medium">
          <LogOut size={14} /> Logout
        </button>
      </div>
    </aside>
  );
}
