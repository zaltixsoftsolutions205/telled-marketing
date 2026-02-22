import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { dashboardApi } from '@/api/dashboard';
import { formatCurrency, formatDate } from '@/utils/formatters';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, FileText, ShoppingCart, Building2, AlertTriangle, Activity, TrendingUp, ArrowRight } from 'lucide-react';

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
          <Icon size={19} className={color} />
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

export default function SalesDashboard() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?._id) dashboardApi.getSalesStats(user._id).then(setStats).catch(console.error).finally(() => setLoading(false));
  }, [user?._id]);

  if (loading) return <LoadingSpinner className="h-64" />;
  if (!stats) return <div className="text-center text-gray-400 mt-20">Failed to load dashboard</div>;

  return (
    <div className="space-y-5 sm:space-y-7 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Sales Dashboard</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Track your pipeline and close more deals</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <Activity size={13} className="text-blue-600" />
          <span className="text-xs sm:text-sm font-semibold text-blue-700">My Pipeline</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <StatCard
          title="My Leads" value={stats.myLeads.total}
          sub={`${stats.myLeads.new} new · ${stats.myLeads.converted} converted`}
          icon={Users} color="text-violet-700" bg="bg-violet-50" border="border-violet-400"
        />
        <StatCard
          title="My Accounts" value={stats.accounts.total}
          sub={`${stats.accounts.active} active`}
          icon={Building2} color="text-blue-600" bg="bg-blue-50" border="border-blue-400"
        />
        <StatCard
          title="Quotation Value" value={formatCurrency(stats.quotations.totalValue)}
          sub={`${stats.quotations.total} quotations raised`}
          icon={FileText} color="text-emerald-700" bg="bg-emerald-50" border="border-emerald-400"
        />
        <StatCard
          title="PO Value" value={formatCurrency(stats.purchaseOrders.totalValue)}
          sub={`${stats.purchaseOrders.total} purchase orders`}
          icon={ShoppingCart} color="text-orange-600" bg="bg-orange-50" border="border-orange-400"
        />
      </div>

      {/* Chart + Action Required */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 card !p-4 sm:!p-6">
          <div className="flex items-start sm:items-center justify-between mb-4 sm:mb-5 gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">My Lead Pipeline</h2>
              <p className="text-xs text-gray-400 mt-0.5">Leads by stage</p>
            </div>
            <Link to="/leads" className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 whitespace-nowrap">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.pipeline} layout="vertical" barSize={16} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={76} />
              <Tooltip
                formatter={(v: number) => [v, 'Leads']}
                cursor={{ fill: '#f5f3ff' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 12 }}
              />
              <Bar dataKey="count" fill="#7c3aed" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card !p-4 sm:!p-6">
          <div className="mb-3 sm:mb-4">
            <h2 className="text-sm sm:text-base font-bold text-gray-900">Action Required</h2>
            <p className="text-xs text-gray-400 mt-0.5">Items needing follow-up</p>
          </div>
          <div className="space-y-2 sm:space-y-2.5">
            <ActionItem
              label="DRFs Pending" value={stats.drfPending}
              to="/leads" icon={AlertTriangle}
              itemColor="text-amber-700" itemBg="bg-amber-50"
            />
            <ActionItem
              label="In Negotiation" value={stats.leadsInNegotiation}
              to="/leads" icon={TrendingUp}
              itemColor="text-orange-700" itemBg="bg-orange-50"
            />
            <ActionItem
              label="Quotations Raised" value={stats.quotations.total}
              to="/quotations" icon={FileText}
              itemColor="text-violet-700" itemBg="bg-violet-50"
            />
            <div className="flex items-center justify-between p-3 sm:p-3.5 bg-rose-50 rounded-xl">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <Users size={14} className="text-rose-700 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-rose-700">Lost Leads</span>
              </div>
              <span className="text-lg sm:text-xl font-extrabold tabular-nums text-rose-700">{stats.myLeads.lost}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Leads */}
      {stats.recentLeads?.length > 0 ? (
        <div className="card !p-0 overflow-hidden">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">My Recent Leads</h2>
              <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">Your latest pipeline activity</p>
            </div>
            <Link to="/leads" className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 whitespace-nowrap">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="table-header">Company</th>
                  <th className="table-header">Contact</th>
                  <th className="table-header">Stage</th>
                  <th className="table-header">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentLeads.map((lead: any) => (
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
      ) : (
        <div className="card text-center py-12 sm:py-14">
          <Users size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-base font-semibold text-gray-500">No leads assigned to you yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first lead to get started</p>
          <Link to="/leads" className="btn-primary mt-5 inline-block text-sm">+ New Lead</Link>
        </div>
      )}
    </div>
  );
}
