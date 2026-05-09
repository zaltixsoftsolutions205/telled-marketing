import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { dashboardApi } from '@/api/dashboard';
import { formatCurrency } from '@/utils/formatters';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  TrendingUp, Building2, Receipt, Headphones, Users,
  Activity, FileBadge, ArrowRight, AlertTriangle, UserCog,
  CheckCircle2, Clock, Wrench, DollarSign,
} from 'lucide-react';

// ── Shared glass components ────────────────────────────────────────────────

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

function StatCard({ title, value, sub, icon: Icon, gradient, iconColor, delay = 0 }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; gradient: string; iconColor: string; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/60 p-4 transition-all duration-500 hover:shadow-lg hover:-translate-y-0.5 cursor-default ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
      style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 2px 16px rgba(124,58,237,0.06), 0 1px 4px rgba(0,0,0,0.04)', transitionDelay: `${delay}ms` }}
    >
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
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${gradient} opacity-60`} />
    </div>
  );
}

function ActionItem({ label, sub, value, to, icon: Icon, iconBg, textColor, delay = 0, disabled = false }: {
  label: string; sub?: string; value: number | string; to: string;
  icon: React.ElementType; iconBg: string; textColor: string; delay?: number; disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  const cls = `flex items-center justify-between p-3 rounded-xl border border-white/70 hover:border-white transition-all duration-300 hover:shadow-md hover:-translate-x-0.5 group ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'}`;
  const inner = (
    <>
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
    </>
  );
  if (disabled) return <div className={cls} style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)', transitionDelay: `${delay}ms`, opacity: 0.5, cursor: 'not-allowed' }}>{inner}</div>;
  return <Link to={to} className={cls} style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)', transitionDelay: `${delay}ms` }}>{inner}</Link>;
}

// ── ManagerDashboard ───────────────────────────────────────────────────────

export default function ManagerDashboard() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const perms: string[] = (user as any)?.permissions ?? [];
  const has = (p: string) => perms.length === 0 || perms.includes(p);

  useEffect(() => {
    dashboardApi.getAdminStats()
      .then(setStats)
      .catch(() => setStats({}))
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
          <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-0.5">Manager Dashboard</p>
          <h1 className="text-lg sm:text-xl font-extrabold text-gray-900">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Overview of your team's activity · {perms.length} module{perms.length !== 1 ? 's' : ''} enabled
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl px-3 py-1.5 border border-purple-200/70"
          style={{ background: 'rgba(233,213,255,0.4)', backdropFilter: 'blur(8px)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          <Activity size={11} className="text-purple-600" />
          <span className="text-xs font-semibold text-purple-700">Manager</span>
        </div>
      </div>

      {/* Stat Cards — only show for permitted modules */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {has('leads') && (
          <StatCard
            title="Total Leads" value={stats.leads?.total ?? 0}
            sub={`${stats.leads?.new ?? 0} new · ${stats.leads?.converted ?? 0} converted`}
            icon={Users} gradient="bg-gradient-to-br from-violet-500 to-violet-700"
            iconColor="text-violet-700" delay={50}
          />
        )}
        {has('accounts') && (
          <StatCard
            title="Active Accounts" value={stats.accounts?.active ?? 0}
            sub={`${stats.accounts?.total ?? 0} total`}
            icon={Building2} gradient="bg-gradient-to-br from-blue-500 to-blue-700"
            iconColor="text-blue-700" delay={100}
          />
        )}
        {has('invoices') && (
          <StatCard
            title="Revenue Collected" value={formatCurrency(stats.invoices?.totalRevenue ?? 0)}
            sub={`${stats.invoices?.pending ?? 0} invoices pending`}
            icon={TrendingUp} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
            iconColor="text-emerald-700" delay={150}
          />
        )}
        {has('support') && (
          <StatCard
            title="Open Tickets" value={stats.tickets?.open ?? 0}
            sub={`${stats.tickets?.critical ?? 0} critical`}
            icon={Headphones} gradient="bg-gradient-to-br from-violet-400 to-blue-600"
            iconColor="text-blue-700" delay={200}
          />
        )}
        {!has('leads') && !has('accounts') && !has('invoices') && !has('support') && (
          <div className="col-span-4 text-center py-8 text-gray-400">
            <p className="text-sm">No stat modules enabled. Contact admin to assign permissions.</p>
          </div>
        )}
      </div>

      {/* Action Required + Team */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

        {/* Action Required */}
        <GlassCard delay={250}>
          <div className="mb-3">
            <h2 className="text-sm font-bold text-gray-900">Action Required</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Items needing attention</p>
          </div>
          <div className="space-y-2">
            {has('leads') && (
              <ActionItem
                label="DRFs Pending" sub="Waiting for approval"
                value={stats.drfs?.pending ?? 0} to="/drfs" icon={FileBadge}
                iconBg="bg-gradient-to-br from-violet-500 to-violet-700" textColor="text-violet-700" delay={300}
              />
            )}
            {has('leads') && (
              <ActionItem
                label="DRFs Expiring Soon" sub="Expiring in next 7 days"
                value={stats.drfs?.expiringSoon ?? 0} to="/drfs" icon={AlertTriangle}
                iconBg="bg-gradient-to-br from-amber-400 to-orange-500" textColor="text-amber-700" delay={350}
              />
            )}
            {has('invoices') && (
              <ActionItem
                label="Overdue Invoices" sub="Past due date"
                value={stats.invoices?.overdue ?? 0} to="/invoices" icon={Receipt}
                iconBg="bg-gradient-to-br from-emerald-500 to-emerald-700" textColor="text-emerald-700" delay={400}
              />
            )}
            {has('support') && (
              <ActionItem
                label="Open Tickets" sub="Unresolved support tickets"
                value={stats.tickets?.open ?? 0} to="/support" icon={Headphones}
                iconBg="bg-gradient-to-br from-violet-400 to-blue-600" textColor="text-violet-700" delay={450}
              />
            )}
            {has('salary') && (
              <ActionItem
                label="Salary Pending" sub="This month's payroll"
                value={stats.salary?.pending ?? 0} to="/salary" icon={DollarSign}
                iconBg="bg-gradient-to-br from-green-500 to-emerald-600" textColor="text-green-700" delay={500}
              />
            )}
            {!has('leads') && !has('invoices') && !has('support') && !has('salary') && (
              <p className="text-xs text-gray-400 py-4 text-center">No action items for your current modules</p>
            )}
          </div>
        </GlassCard>

        {/* My Team */}
        <GlassCard delay={280}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">My Team</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Employees you manage</p>
            </div>
            <Link to="/users" className="text-[10px] font-semibold text-purple-600 hover:underline flex items-center gap-1">
              Manage <ArrowRight size={10} />
            </Link>
          </div>
          {(stats.users?.total ?? 0) === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <UserCog size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">No employees created yet</p>
              <Link to="/users" className="btn-primary mt-3 text-xs inline-flex items-center gap-1.5 px-4 py-2">
                <Users size={12} /> Add First Employee
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {[
                { label: 'Sales', key: 'sales', color: 'bg-blue-500', textColor: 'text-blue-700' },
                { label: 'Engineers', key: 'engineer', color: 'bg-emerald-500', textColor: 'text-emerald-700' },
                { label: 'HR', key: 'hr', color: 'bg-amber-500', textColor: 'text-amber-700' },
                { label: 'Finance', key: 'finance', color: 'bg-orange-500', textColor: 'text-orange-700' },
              ].map(({ label, key, color, textColor }) => {
                const count = stats.users?.[key] ?? 0;
                const total = stats.users?.total ?? 1;
                return count > 0 ? (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all duration-700`}
                        style={{ width: `${Math.round((count / total) * 100)}%` }} />
                    </div>
                    <span className={`text-xs font-bold ${textColor} w-5 text-right`}>{count}</span>
                  </div>
                ) : null;
              })}
              <p className="text-[10px] text-gray-400 pt-1">{stats.users?.total ?? 0} total · {stats.users?.active ?? 0} active</p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Installations — if permitted */}
      {has('installations') && (
        <GlassCard delay={350}>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Installations Overview</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Status across engineers</p>
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
          {(stats.installations?.total ?? 0) > 0 ? (
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="flex h-full rounded-full overflow-hidden">
                <div className="bg-emerald-500 transition-all duration-700"
                  style={{ width: `${Math.round(((stats.installations?.completed ?? 0) / (stats.installations?.total ?? 1)) * 100)}%` }} />
                <div className="bg-blue-500 transition-all duration-700"
                  style={{ width: `${Math.round(((stats.installations?.inProgress ?? 0) / (stats.installations?.total ?? 1)) * 100)}%` }} />
                <div className="bg-violet-500 transition-all duration-700"
                  style={{ width: `${Math.round(((stats.installations?.scheduled ?? 0) / (stats.installations?.total ?? 1)) * 100)}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center">No installations recorded yet</p>
          )}
        </GlassCard>
      )}

      {/* Quick Links */}
      <GlassCard delay={400}>
        <h2 className="text-sm font-bold text-gray-900 mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Team Members', to: '/users', icon: UserCog, color: 'bg-purple-100 text-purple-700', always: true },
            { label: 'Leads', to: '/leads', icon: Users, color: 'bg-violet-100 text-violet-700', perm: 'leads' },
            { label: 'Accounts', to: '/accounts', icon: Building2, color: 'bg-blue-100 text-blue-700', perm: 'accounts' },
            { label: 'Invoices', to: '/invoices', icon: Receipt, color: 'bg-emerald-100 text-emerald-700', perm: 'invoices' },
            { label: 'Support', to: '/support', icon: Headphones, color: 'bg-amber-100 text-amber-700', perm: 'support' },
            { label: 'Salary', to: '/salary', icon: DollarSign, color: 'bg-green-100 text-green-700', perm: 'salary' },
            { label: 'Attendance', to: '/attendance', icon: Clock, color: 'bg-sky-100 text-sky-700', perm: 'attendance' },
            { label: 'Installations', to: '/installations', icon: Wrench, color: 'bg-teal-100 text-teal-700', perm: 'installations' },
          ]
            .filter(item => item.always || has(item.perm!))
            .map(item => (
              <Link key={item.to} to={item.to}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl ${item.color} hover:opacity-80 transition-all text-center`}>
                <item.icon size={18} />
                <span className="text-[11px] font-semibold leading-tight">{item.label}</span>
              </Link>
            ))}
        </div>
      </GlassCard>

    </div>
  );
}
