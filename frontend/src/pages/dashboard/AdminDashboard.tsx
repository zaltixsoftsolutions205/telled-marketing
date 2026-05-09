import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { dashboardApi } from '@/api/dashboard';
import { formatCurrency, formatDate } from '@/utils/formatters';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  TrendingUp, Building2, Receipt, Headphones, AlertTriangle,
  Users, Activity, FileBadge, ArrowRight, Wrench, CheckCircle2, Clock,
} from 'lucide-react';
import type { Lead } from '@/types';

function StatCard({
  title, value, sub, icon: Icon, gradient, iconColor, delay = 0,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; gradient: string; iconColor: string; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/60 p-4 transition-all duration-500 hover:shadow-lg hover:-translate-y-0.5 cursor-default
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
      style={{
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 2px 16px rgba(124,58,237,0.06), 0 1px 4px rgba(0,0,0,0.04)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {/* Subtle gradient blob */}
      <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-20 blur-2xl ${gradient}`} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
          <p className={`text-2xl font-extrabold mt-1 leading-none tabular-nums ${iconColor}`}>{value}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-1 leading-snug">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-xl ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>

      {/* Bottom accent bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${gradient} opacity-60`} />
    </div>
  );
}

function ActionItem({
  label, sub, value, to, icon: Icon, iconBg, textColor, delay = 0,
}: {
  label: string; sub?: string; value: number | string; to: string;
  icon: React.ElementType; iconBg: string; textColor: string; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);

  return (
    <Link
      to={to}
      className={`flex items-center justify-between p-3 rounded-xl border border-white/70 hover:border-white transition-all duration-300 hover:shadow-md hover:-translate-x-0.5 group
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'}`}
      style={{
        background: 'rgba(255,255,255,0.5)',
        backdropFilter: 'blur(8px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={13} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${textColor} leading-tight`}>{label}</p>
          {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
        <span className={`text-base font-extrabold tabular-nums ${textColor}`}>{value}</span>
        <ArrowRight size={12} className={`${textColor} opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150`} />
      </div>
    </Link>
  );
}

function GlassCard({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);

  return (
    <div
      className={`rounded-2xl border border-white/60 p-4 sm:p-5 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${className}`}
      style={{
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 2px 20px rgba(124,58,237,0.06), 0 1px 4px rgba(0,0,0,0.04)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 opacity-0 animate-[fadeSlideDown_0.4s_ease_forwards]"
        style={{ animationDelay: '0ms' }}
      >
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Admin Dashboard</p>
          <h1 className="text-lg sm:text-xl font-extrabold text-gray-900">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-xs text-gray-400 mt-0.5">Here's your complete business overview</p>
        </div>
        <div
          className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl px-3 py-1.5 border border-blue-200/70"
          style={{ background: 'rgba(219,234,254,0.5)', backdropFilter: 'blur(8px)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <Activity size={11} className="text-blue-600" />
          <span className="text-xs font-semibold text-blue-700">Live</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Total Leads" value={stats.leads?.total ?? 0}
          sub={`${stats.leads?.new ?? 0} new · ${stats.leads?.converted ?? 0} converted`}
          icon={Users} gradient="bg-gradient-to-br from-violet-500 to-violet-700"
          iconColor="text-violet-700" delay={50}
        />
        <StatCard
          title="Active Accounts" value={stats.accounts?.active ?? 0}
          sub={`${stats.accounts?.total ?? 0} total accounts`}
          icon={Building2} gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          iconColor="text-blue-700" delay={100}
        />
        <StatCard
          title="Revenue Collected" value={formatCurrency(stats.invoices?.totalRevenue ?? 0)}
          sub={`${stats.invoices?.pending ?? 0} invoices pending`}
          icon={TrendingUp} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          iconColor="text-emerald-700" delay={150}
        />
        <StatCard
          title="Open Tickets" value={stats.tickets?.open ?? 0}
          sub={`${stats.tickets?.critical ?? 0} critical · ${stats.tickets?.resolved ?? 0} resolved`}
          icon={Headphones} gradient="bg-gradient-to-br from-violet-400 to-blue-600"
          iconColor="text-blue-700" delay={200}
        />
      </div>

      {/* Chart + Action Required */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">

        {/* Revenue Chart */}
        <GlassCard className="lg:col-span-2" delay={250}>
          <div className="flex items-center justify-between mb-4 gap-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Revenue Trend</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Monthly collections</p>
            </div>
            <span className="text-[10px] font-semibold text-gray-400 bg-white/70 border border-gray-100 px-2 py-1 rounded-full">Last 6 months</span>
          </div>

          {(stats.revenueByMonth?.length ?? 0) === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center">
                <TrendingUp size={18} className="text-violet-400" />
              </div>
              <p className="text-xs font-semibold text-gray-400">No data available yet</p>
              <p className="text-[10px] text-gray-300">Revenue trend will appear here once data is available.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={stats.revenueByMonth ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={36}
                />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                  cursor={{ stroke: '#7c3aed', strokeWidth: 1, strokeDasharray: '4 2' }}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 11, background: 'rgba(255,255,255,0.95)' }}
                />
                <Area dataKey="revenue" stroke="#7c3aed" strokeWidth={2} fill="url(#revenueGrad)" dot={{ r: 3, fill: '#7c3aed', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#7c3aed' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />
            <span className="text-[10px] text-gray-400 font-medium">Revenue (₹)</span>
          </div>
        </GlassCard>

        {/* Action Required */}
        <GlassCard delay={300}>
          <div className="mb-3">
            <h2 className="text-sm font-bold text-gray-900">Action Required</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Items needing your attention</p>
          </div>
          <div className="space-y-2">
            <ActionItem
              label="DRFs Pending" sub="Documents waiting for approval"
              value={stats.drfs?.pending ?? 0} to="/drfs" icon={FileBadge}
              iconBg="bg-gradient-to-br from-violet-500 to-violet-700" textColor="text-violet-700" delay={350}
            />
            <ActionItem
              label="DRFs Expiring Soon" sub="DRFs expiring in next 7 days"
              value={stats.drfs?.expiringSoon ?? 0} to="/drfs" icon={AlertTriangle}
              iconBg="bg-gradient-to-br from-blue-500 to-blue-700" textColor="text-blue-700" delay={400}
            />
            <ActionItem
              label="Overdue Invoices" sub="Invoices past due date"
              value={stats.invoices?.overdue ?? 0} to="/invoices" icon={Receipt}
              iconBg="bg-gradient-to-br from-emerald-500 to-emerald-700" textColor="text-emerald-700" delay={450}
            />
            <ActionItem
              label="Open Tickets" sub="Unresolved support tickets"
              value={stats.tickets?.open ?? 0} to="/support" icon={Headphones}
              iconBg="bg-gradient-to-br from-violet-400 to-blue-600" textColor="text-violet-700" delay={500}
            />
          </div>
        </GlassCard>
      </div>

      {/* Installations Overview */}
      <GlassCard delay={350}>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Installations Overview</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Status across all engineers</p>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <CheckCircle2 size={12} /> {stats.installations?.completed ?? 0} Done
            </span>
            <span className="flex items-center gap-1 text-blue-600 font-semibold">
              <Clock size={12} /> {stats.installations?.inProgress ?? 0} In Progress
            </span>
            <span className="flex items-center gap-1 text-violet-600 font-semibold">
              <Wrench size={12} /> {stats.installations?.scheduled ?? 0} Scheduled
            </span>
          </div>
        </div>

        {(stats.installations?.total ?? 0) > 0 && (
          <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
            <div className="flex h-full rounded-full overflow-hidden">
              <div className="bg-emerald-500 transition-all duration-700"
                style={{ width: `${Math.round(((stats.installations?.completed ?? 0) / (stats.installations?.total ?? 1)) * 100)}%` }} />
              <div className="bg-blue-500 transition-all duration-700"
                style={{ width: `${Math.round(((stats.installations?.inProgress ?? 0) / (stats.installations?.total ?? 1)) * 100)}%` }} />
              <div className="bg-violet-500 transition-all duration-700"
                style={{ width: `${Math.round(((stats.installations?.scheduled ?? 0) / (stats.installations?.total ?? 1)) * 100)}%` }} />
            </div>
          </div>
        )}

        {stats.installsByEngineer?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px]">
              <thead>
                <tr>
                  {['Engineer', 'Total', 'Done', 'In Progress', 'Scheduled'].map((h, i) => (
                    <th key={h} className={`pb-2 text-[10px] font-bold uppercase tracking-wider ${i === 0 ? 'text-left text-gray-400' : 'text-center'} ${i === 2 ? 'text-emerald-500' : i === 3 ? 'text-blue-500' : i === 4 ? 'text-violet-500' : 'text-gray-400'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.installsByEngineer.map((row: any) => (
                  <tr key={row._id} className="hover:bg-violet-50/30 transition-colors">
                    <td className="py-2 text-xs font-medium text-gray-700">{row.engineerName || '—'}</td>
                    <td className="py-2 text-center text-xs font-bold text-gray-800">{row.total}</td>
                    <td className="py-2 text-center text-xs font-semibold text-emerald-600">{row.completed}</td>
                    <td className="py-2 text-center text-xs font-semibold text-blue-500">{row.inProgress}</td>
                    <td className="py-2 text-center text-xs font-semibold text-violet-500">{row.scheduled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4">No installations yet</p>
        )}
      </GlassCard>

      {/* Recent Leads */}
      {stats.recentLeads?.length > 0 && (
        <GlassCard className="!p-0 overflow-hidden" delay={400}>
          <div className="px-4 py-3 border-b border-white/60 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Recent Leads</h2>
              <p className="text-[11px] text-gray-400 mt-0.5 hidden sm:block">Latest activity across your pipeline</p>
            </div>
            <Link to="/leads" className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px]">
              <thead>
                <tr className="bg-white/40">
                  {['Company', 'Contact', 'Stage', 'Created'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60">
                {stats.recentLeads.map((lead: Lead) => (
                  <tr key={lead._id} className="hover:bg-violet-50/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs">
                      <Link to={`/leads/${lead._id}`} className="font-semibold text-violet-700 hover:underline">{lead.companyName}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{lead.contactName}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={lead.stage} /></td>
                    <td className="px-4 py-2.5 text-[11px] text-gray-400">{formatDate(lead.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
