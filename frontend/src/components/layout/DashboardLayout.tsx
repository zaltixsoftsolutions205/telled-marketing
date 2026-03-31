import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { usePageTitleStore } from '@/store/pageTitleStore';

const titleMap: Record<string, string> = {
  '/dashboard':       'Dashboard',
  '/leads':           'Leads',
  '/drfs':            'DRF Management',
  '/accounts':        'Accounts',
  '/quotations':      'Quotations',
  '/purchases':       'Purchase Orders',
  '/installations':   'Installations',
  '/support':         'Support Tickets',
  '/invoices':        'Invoices',
  '/payments':        'Payments',
  '/engineer-visits': 'Engineer Visits',
  '/salary':          'Salary Management',
  '/users':           'User Management',
  '/training':        'Training',
};

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Auto-close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const subtitle = usePageTitleStore((s) => s.subtitle);
  const segments = location.pathname.split('/').filter(Boolean);
  const path = '/' + segments[0];
  const baseTitle = titleMap[path] || 'Telled CRM';
  const title = subtitle ? `${baseTitle} / ${subtitle}` : baseTitle;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f2ff]">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static on desktop */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          lg:static lg:translate-x-0 lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header title={title} onMenuClick={() => setSidebarOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
