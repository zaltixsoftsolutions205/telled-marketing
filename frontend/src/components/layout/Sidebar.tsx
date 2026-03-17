// import { useState } from 'react';
// import { NavLink, useNavigate, useLocation } from 'react-router-dom';
// import {
//   LayoutDashboard, Users, Building2, FileText,
//   ShoppingCart, Wrench, Headphones, Receipt, CreditCard,
//   CalendarCheck, DollarSign, UserCog, LogOut, ChevronDown, ChevronRight,
//   FileBadge, GraduationCap, BarChart2,
// } from 'lucide-react';
// import { useAuthStore } from '@/store/authStore';
// import { authApi } from '@/api/auth';
// import type { Role } from '@/types';
// import { cn } from '@/utils/cn';

// // ─── Role Colors ─────────────────────────────────────────────────────────────
// const roleColors: Record<string, string> = {
//   admin:      'bg-violet-100 text-violet-700',
//   sales:      'bg-blue-100 text-blue-700',
//   engineer:   'bg-emerald-100 text-emerald-700',
//   hr_finance: 'bg-amber-100 text-amber-700',
// };

// // ─── Non-admin nav (flat list) ─────────────────────────────────────────────
// const salesNav = [
//   { to: '/leads',       label: 'Leads',           icon: Users },
//   { to: '/quotations',  label: 'Quotations',       icon: FileText },
//   { to: '/purchases',   label: 'Purchase Orders',  icon: ShoppingCart },
//   { to: '/support',     label: 'Support',          icon: Headphones },
//   { to: '/accounts',    label: 'Accounts',         icon: Building2 },
// ];

// const engineerNav = [
//   { to: '/accounts',        label: 'Accounts',        icon: Building2 },
//   { to: '/installations',   label: 'Installations',   icon: Wrench },
//   { to: '/support',         label: 'Support',         icon: Headphones },
//   { to: '/training',        label: 'Training',        icon: GraduationCap },
//   { to: '/engineer-visits', label: 'Visit Claims',    icon: CalendarCheck },
// ];

// const hrNav = [
//   { to: '/invoices',        label: 'Invoices',        icon: Receipt },
//   { to: '/payments',        label: 'Payments',        icon: CreditCard },
//   { to: '/engineer-visits', label: 'Engineer Visits', icon: CalendarCheck },
//   { to: '/salary',          label: 'Salary',          icon: DollarSign },
//   { to: '/accounts',        label: 'Accounts',        icon: Building2 },
// ];

// // ─── Admin dept sections ───────────────────────────────────────────────────
// const adminSections = [
//   {
//     label: 'Sales',
//     items: [
//       { to: '/leads',      label: 'Leads',          icon: Users },
//       { to: '/drfs',       label: 'DRF Management', icon: FileBadge },
//       { to: '/quotations', label: 'Quotations',      icon: FileText },
//       { to: '/purchases',  label: 'Purchase Orders', icon: ShoppingCart },
//     ],
//   },
//   {
//     label: 'Engineers',
//     items: [
//       { to: '/accounts',      label: 'Accounts',      icon: Building2 },
//       { to: '/installations', label: 'Installations', icon: Wrench },
//       { to: '/support',       label: 'Support',       icon: Headphones },
//       { to: '/training',      label: 'Training',      icon: GraduationCap },
//     ],
//   },
//   {
//     label: 'HR & Finance',
//     items: [
//       { to: '/invoices',        label: 'Invoices',        icon: Receipt },
//       { to: '/payments',        label: 'Payments',        icon: CreditCard },
//       { to: '/engineer-visits', label: 'Engineer Visits', icon: CalendarCheck },
//       { to: '/salary',          label: 'Salary',          icon: DollarSign },
//     ],
//   },
// ];

// // ─── Flat NavItem ──────────────────────────────────────────────────────────
// function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
//   return (
//     <NavLink to={to}>
//       {({ isActive }) => (
//         <div className={cn('sidebar-item', isActive ? 'sidebar-item-active' : 'sidebar-item-inactive')}>
//           <Icon size={17} />
//           <span className="flex-1 text-sm">{label}</span>
//         </div>
//       )}
//     </NavLink>
//   );
// }

// // ─── Collapsible Section (admin only) ─────────────────────────────────────
// function SidebarSection({ label, items }: { label: string; items: Array<{ to: string; label: string; icon: React.ElementType }> }) {
//   const location = useLocation();
//   const isAnyActive = items.some(i => location.pathname.startsWith(i.to));
//   const [open, setOpen] = useState(isAnyActive);

//   return (
//     <div>
//       <button
//         onClick={() => setOpen(o => !o)}
//         className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors mt-2"
//       >
//         <span>{label}</span>
//         {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
//       </button>
//       {open && (
//         <div className="space-y-0.5">
//           {items.map((item) => (
//             <NavLink key={item.to} to={item.to}>
//               {({ isActive }) => (
//                 <div className={cn('sidebar-item pl-6', isActive ? 'sidebar-item-active' : 'sidebar-item-inactive')}>
//                   <item.icon size={15} />
//                   <span className="flex-1 text-sm">{item.label}</span>
//                 </div>
//               )}
//             </NavLink>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// // ─── Main Sidebar ──────────────────────────────────────────────────────────
// export default function Sidebar() {
//   const user = useAuthStore((s) => s.user);
//   const { logout } = useAuthStore();
//   const navigate = useNavigate();
//   const role = user?.role as Role;

//   const handleLogout = async () => {
//     await authApi.logout();
//     logout();
//     navigate('/login');
//   };

//   const nonAdminItems = role === 'sales' ? salesNav : role === 'engineer' ? engineerNav : hrNav;

//   return (
//     <aside className="w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col">
//       {/* Logo */}
//       <div className="p-5 border-b border-gray-100">
//         <div className="flex items-center gap-3">
//           <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-200">
//             <span className="text-white font-black text-lg">T</span>
//           </div>
//           <div>
//             <p className="font-bold text-gray-900 text-sm leading-tight">Telled CRM</p>
//             <p className="text-xs text-gray-400 mt-0.5">Operations Platform</p>
//           </div>
//         </div>
//       </div>

//       {/* Nav */}
//       <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
//         {/* Dashboard — always first */}
//         <NavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} />

//         {role === 'admin' ? (
//           <>
//             {/* Admin dept-based collapsible */}
//             {adminSections.map((section) => (
//               <SidebarSection key={section.label} label={section.label} items={section.items} />
//             ))}
//             {/* Admin-only tools */}
//             <div className="mt-2 border-t border-gray-100 pt-2 space-y-0.5">
//               <NavItem to="/drfs" label="DRF Analytics" icon={BarChart2} />
//               <NavItem to="/users" label="Users" icon={UserCog} />
//             </div>
//           </>
//         ) : (
//           <div className="mt-1 space-y-0.5">
//             {nonAdminItems.map((item) => (
//               <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} />
//             ))}
//           </div>
//         )}
//       </nav>

//       {/* User Footer */}
//       <div className="p-4 border-t border-gray-100">
//         <div className="flex items-center gap-3 mb-3">
//           <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
//             <span className="text-violet-700 font-bold text-sm">{user?.name?.charAt(0).toUpperCase()}</span>
//           </div>
//           <div className="flex-1 min-w-0">
//             <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
//             <span className={cn('badge text-[10px] mt-0.5', roleColors[role] || 'bg-gray-100 text-gray-600')}>
//               {role?.replace('_', ' ')}
//             </span>
//           </div>
//         </div>
//         <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors font-medium">
//           <LogOut size={15} /> Logout
//         </button>
//       </div>
//     </aside>
//   );
// }
import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, FileText,
  ShoppingCart, Wrench, Headphones, Receipt, CreditCard,
  CalendarCheck, DollarSign, UserCog, LogOut, ChevronDown, ChevronRight,
  FileBadge, GraduationCap, BarChart2,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth';
import type { Role } from '@/types';
import { cn } from '@/utils/cn';

// ─── Role Colors ─────────────────────────────────────────────────────────────
const roleColors: Record<string, string> = {
  admin:      'bg-violet-100 text-violet-700',
  sales:      'bg-blue-100 text-blue-700',
  engineer:   'bg-emerald-100 text-emerald-700',
  hr_finance: 'bg-amber-100 text-amber-700',
};

// ─── Non-admin nav (flat list) ─────────────────────────────────────────────
const salesNav = [
  { to: '/leads',       label: 'Leads',           icon: Users },
  { to: '/drfs',        label: 'DRF Management',  icon: FileBadge }, // Added DRF
  { to: '/quotations',  label: 'Quotations',       icon: FileText },
  { to: '/purchases',   label: 'Purchase Orders',  icon: ShoppingCart },
  { to: '/support',     label: 'Support',          icon: Headphones },
  { to: '/accounts',    label: 'Accounts',         icon: Building2 },
];

const engineerNav = [
  { to: '/accounts',        label: 'Accounts',        icon: Building2 },
  { to: '/installations',   label: 'Installations',   icon: Wrench },
  { to: '/support',         label: 'Support',         icon: Headphones },
  { to: '/training',        label: 'Training',        icon: GraduationCap },
  { to: '/engineer-visits', label: 'Visit Claims',    icon: CalendarCheck },
];

const hrNav = [
  { to: '/invoices',        label: 'Invoices',        icon: Receipt },
  { to: '/payments',        label: 'Payments',        icon: CreditCard },
  { to: '/engineer-visits', label: 'Engineer Visits', icon: CalendarCheck },
  { to: '/salary',          label: 'Salary',          icon: DollarSign },
  { to: '/accounts',        label: 'Accounts',        icon: Building2 },
];

// ─── Admin dept sections ───────────────────────────────────────────────────
const adminSections = [
  {
    label: 'Sales',
    items: [
      { to: '/leads',      label: 'Leads',          icon: Users },
      { to: '/drfs',       label: 'DRF Management', icon: FileBadge },
      { to: '/quotations', label: 'Quotations',      icon: FileText },
      { to: '/purchases',  label: 'Purchase Orders', icon: ShoppingCart },
    ],
  },
  {
    label: 'Engineers',
    items: [
      { to: '/accounts',      label: 'Accounts',      icon: Building2 },
      { to: '/installations', label: 'Installations', icon: Wrench },
      { to: '/support',       label: 'Support',       icon: Headphones },
      { to: '/training',      label: 'Training',      icon: GraduationCap },
    ],
  },
  {
    label: 'HR & Finance',
    items: [
      { to: '/invoices',        label: 'Invoices',        icon: Receipt },
      { to: '/payments',        label: 'Payments',        icon: CreditCard },
      { to: '/engineer-visits', label: 'Engineer Visits', icon: CalendarCheck },
      { to: '/salary',          label: 'Salary',          icon: DollarSign },
    ],
  },
];

// ─── Flat NavItem ──────────────────────────────────────────────────────────
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

// ─── Collapsible Section (admin only) ─────────────────────────────────────
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

// ─── Main Sidebar ──────────────────────────────────────────────────────────
export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const role = user?.role as Role;

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
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-200">
            <span className="text-white font-black text-lg">T</span>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">Telled CRM</p>
            <p className="text-xs text-gray-400 mt-0.5">Operations Platform</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
        {/* Dashboard — always first */}
        <NavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} />

        {role === 'admin' ? (
          <>
            {/* Admin dept-based collapsible */}
            {adminSections.map((section) => (
              <SidebarSection key={section.label} label={section.label} items={section.items} />
            ))}
            {/* Admin-only tools */}
            <div className="mt-2 border-t border-gray-100 pt-2 space-y-0.5">
              <NavItem to="/drfs" label="DRF Analytics" icon={BarChart2} />
              <NavItem to="/users" label="Users" icon={UserCog} />
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