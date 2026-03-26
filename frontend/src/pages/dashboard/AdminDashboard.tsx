import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { dashboardApi } from '@/api/dashboard';
import { formatCurrency, formatDate } from '@/utils/formatters';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  TrendingUp, Building2, Receipt, Headphones, AlertTriangle,
  Users, Activity, FileBadge, ArrowRight,
} from 'lucide-react';
import type { Lead } from '@/types';

function StatCard({
  title, value, sub, icon: Icon, color, bg, border,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; bg: string; border: string;
}) {
  return (
    <div className={`card border-l-4 ${border} hover:shadow-lg transition-all duration-200 group`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{title}</p>
          <p className={`text-2xl sm:text-3xl font-extrabold mt-1.5 sm:mt-2 ${color} leading-none tabular-nums`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1.5 sm:mt-2 leading-snug">{sub}</p>}
        </div>
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl ${bg} flex items-center justify-center flex-shrink-0 ml-3 group-hover:scale-110 transition-transform duration-200`}>
          <Icon size={18} className={`${color} sm:hidden`} />
          <Icon size={20} className={`${color} hidden sm:block`} />
        </div>
      </div>
    </div>
  );
}

function ActionItem({
  label, value, to, icon: Icon, itemColor, itemBg,
}: {
  label: string; value: number | string; to: string;
  icon: React.ElementType; itemColor: string; itemBg: string;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center justify-between p-3 sm:p-3.5 ${itemBg} rounded-xl hover:brightness-95 transition-all duration-150 group`}
    >
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <Icon size={14} className={`${itemColor} flex-shrink-0`} />
        <span className={`text-xs sm:text-sm font-semibold ${itemColor} truncate`}>{label}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        <span className={`text-lg sm:text-xl font-extrabold tabular-nums ${itemColor}`}>{value}</span>
        <ArrowRight size={13} className={`${itemColor} opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all`} />
      </div>
    </Link>
  );
}

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getAdminStats()
      .then(setStats)
      .catch((e) => { console.error('Admin dashboard:', e); setStats({}); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-64" />;

  return (
    <div className="space-y-5 sm:space-y-7 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Admin Dashboard</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">Good morning, {user?.name?.split(' ')[0]}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Here's your complete business overview</p>
        </div>
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <Activity size={13} className="text-violet-600" />
          <span className="text-xs sm:text-sm font-semibold text-violet-700">Live</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <StatCard
          title="Total Leads" value={stats.leads?.total ?? 0}
          sub={`${stats.leads?.new ?? 0} new · ${stats.leads?.converted ?? 0} converted`}
          icon={Users} color="text-violet-700" bg="bg-violet-50" border="border-violet-400"
        />
        <StatCard
          title="Active Accounts" value={stats.accounts?.active ?? 0}
          sub={`${stats.accounts?.total ?? 0} total accounts`}
          icon={Building2} color="text-blue-600" bg="bg-blue-50" border="border-blue-400"
        />
        <StatCard
          title="Revenue Collected" value={formatCurrency(stats.invoices?.totalRevenue ?? 0)}
          sub={`${stats.invoices?.pending ?? 0} invoices pending`}
          icon={TrendingUp} color="text-emerald-700" bg="bg-emerald-50" border="border-emerald-400"
        />
        <StatCard
          title="Open Tickets" value={stats.tickets?.open ?? 0}
          sub={`${stats.tickets?.critical ?? 0} critical · ${stats.tickets?.resolved ?? 0} resolved`}
          icon={Headphones} color="text-rose-600" bg="bg-rose-50" border="border-rose-400"
        />
      </div>

      {/* Chart + Action Required */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 card !p-4 sm:!p-6">
          <div className="flex items-start sm:items-center justify-between mb-4 sm:mb-5 gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Revenue Trend</h2>
              <p className="text-xs text-gray-400 mt-0.5">Monthly collections</p>
            </div>
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full font-medium whitespace-nowrap">Last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.revenueByMonth ?? []} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40}
              />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                cursor={{ fill: '#f5f3ff' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 12 }}
              />
              <Bar dataKey="revenue" fill="#7c3aed" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card !p-4 sm:!p-6">
          <div className="mb-3 sm:mb-4">
            <h2 className="text-sm sm:text-base font-bold text-gray-900">Action Required</h2>
            <p className="text-xs text-gray-400 mt-0.5">Items needing your attention</p>
          </div>
          <div className="space-y-2 sm:space-y-2.5">
            <ActionItem
              label="DRFs Pending" value={stats.drfs?.pending ?? 0}
              to="/drfs" icon={FileBadge}
              itemColor="text-amber-700" itemBg="bg-amber-50"
            />
            <ActionItem
              label="DRFs Expiring Soon" value={stats.drfs?.expiringSoon ?? 0}
              to="/drfs" icon={AlertTriangle}
              itemColor="text-orange-700" itemBg="bg-orange-50"
            />
            <ActionItem
              label="Overdue Invoices" value={stats.invoices?.overdue ?? 0}
              to="/invoices" icon={Receipt}
              itemColor="text-red-700" itemBg="bg-red-50"
            />
            <ActionItem
              label="Open Tickets" value={stats.tickets?.open ?? 0}
              to="/support" icon={Headphones}
              itemColor="text-rose-700" itemBg="bg-rose-50"
            />
          </div>
        </div>
      </div>

      {/* Recent Leads */}
      {stats.recentLeads?.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Recent Leads</h2>
              <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">Latest activity across your pipeline</p>
            </div>
            <Link to="/leads" className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 whitespace-nowrap">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="table-header">Company</th>
                  <th className="table-header">Contact</th>
                  <th className="table-header">Stage</th>
                  <th className="table-header">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentLeads.map((lead: Lead) => (
                  <tr key={lead._id} className="hover:bg-violet-50/30 transition-colors">
                    <td className="table-cell">
                      <Link to={`/leads/${lead._id}`} className="font-semibold text-violet-700 hover:underline">{lead.companyName}</Link>
                    </td>
                    <td className="table-cell text-gray-500">{lead.contactName}</td>
                    <td className="table-cell"><StatusBadge status={lead.stage} /></td>
                    <td className="table-cell text-gray-400 text-xs">{formatDate(lead.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
