import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { dashboardApi } from '@/api/dashboard';
import { formatCurrency, formatDate } from '@/utils/formatters';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  Building2, Headphones, Wrench, CalendarCheck, Activity,
  Clock, CheckCircle2, AlertCircle, GraduationCap, ArrowRight,
} from 'lucide-react';

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

const installStatusStyle: Record<string, string> = {
  'Scheduled':   'bg-blue-100 text-blue-700',
  'In Progress': 'bg-violet-100 text-violet-700',
  'Completed':   'bg-emerald-100 text-emerald-700',
  'Cancelled':   'bg-gray-100 text-gray-500',
};

const priorityStyle: Record<string, string> = {
  Critical: 'bg-violet-100 text-violet-700',
  High:     'bg-blue-100 text-blue-700',
  Medium:   'bg-emerald-100 text-emerald-700',
  Low:      'bg-gray-100 text-gray-500',
};

export default function EngineerDashboard() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?._id) { setLoading(false); return; }
    dashboardApi.getEngineerStats(user._id).then(setStats).catch(console.error).finally(() => setLoading(false));
  }, [user?._id]);

  if (loading) return <LoadingSpinner className="h-64" />;
  if (!stats) return <div className="text-center text-gray-400 mt-20">Failed to load dashboard</div>;

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
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Engineer Dashboard</p>
          <h1 className="text-lg sm:text-xl font-extrabold text-gray-900">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-xs text-gray-400 mt-0.5">Your assignments and field work overview</p>
        </div>
        <div
          className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl px-3 py-1.5 border border-emerald-200/70"
          style={{ background: 'rgba(209,250,229,0.5)', backdropFilter: 'blur(8px)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <Activity size={11} className="text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700">My Work</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          title="My Accounts" value={stats.accounts?.total ?? 0}
          sub={`${stats.accounts?.active ?? 0} active`}
          icon={Building2} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          iconColor="text-emerald-700" delay={50}
        />
        <StatCard
          title="Open Tickets" value={stats.tickets?.open ?? 0}
          sub={`${stats.tickets?.critical ?? 0} critical`}
          icon={Headphones} gradient="bg-gradient-to-br from-violet-500 to-violet-700"
          iconColor="text-violet-700" delay={100}
        />
        <StatCard
          title="Installations" value={(stats.installations?.scheduled ?? 0) + (stats.installations?.inProgress ?? 0)}
          sub={`${stats.installations?.scheduled ?? 0} scheduled`}
          icon={Wrench} gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          iconColor="text-blue-700" delay={150}
        />
        <StatCard
          title="Pending Claims" value={stats.visits?.pending ?? 0}
          sub={`${stats.visits?.total ?? 0} total`}
          icon={CalendarCheck} gradient="bg-gradient-to-br from-violet-400 to-blue-600"
          iconColor="text-violet-700" delay={200}
        />
        <StatCard
          title="Resolved" value={stats.tickets?.resolved ?? 0}
          sub={`${stats.tickets?.open ?? 0} open`}
          icon={CheckCircle2} gradient="bg-gradient-to-br from-emerald-400 to-emerald-600"
          iconColor="text-emerald-700" delay={250}
        />
      </div>

      {/* Installations + Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

        {/* Upcoming Installations */}
        <GlassCard className="!p-0 overflow-hidden" delay={300}>
          <div className="px-4 py-3 border-b border-white/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench size={14} className="text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900">My Installations</h2>
            </div>
            <Link to="/installations" className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {stats.recentInstallations?.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle2 size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-xs text-gray-400">No active installations</p>
            </div>
          ) : (
            <div className="divide-y divide-white/60">
              {stats.recentInstallations?.map((inst: any) => (
                <div key={inst._id} className="px-4 py-3 hover:bg-blue-50/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-xs truncate">{inst.accountId?.companyName || inst.accountId?.accountName}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">{inst.siteAddress}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${installStatusStyle[inst.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {inst.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock size={10} className="text-gray-400" />
                    <span className="text-[11px] text-gray-400">{formatDate(inst.scheduledDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Open Tickets */}
        <GlassCard className="!p-0 overflow-hidden" delay={350}>
          <div className="px-4 py-3 border-b border-white/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Headphones size={14} className="text-violet-600" />
              <h2 className="text-sm font-bold text-gray-900">My Open Tickets</h2>
            </div>
            <Link to="/support" className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {stats.recentTickets?.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle2 size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-xs text-gray-400">No open tickets assigned</p>
            </div>
          ) : (
            <div className="divide-y divide-white/60">
              {stats.recentTickets?.map((ticket: any) => (
                <div key={ticket._id} className="px-4 py-3 hover:bg-violet-50/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-xs truncate">{ticket.subject}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">{ticket.accountId?.companyName || ticket.accountId?.accountName} · {ticket.ticketId}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${priorityStyle[ticket.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <AlertCircle size={10} className="text-gray-400" />
                    <span className="text-[11px] text-gray-400">{ticket.status} · {formatDate(ticket.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Recent Visit Claims */}
      {stats.recentVisits?.length > 0 && (
        <GlassCard className="!p-0 overflow-hidden" delay={400}>
          <div className="px-4 py-3 border-b border-white/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck size={14} className="text-violet-600" />
              <h2 className="text-sm font-bold text-gray-900">My Recent Visit Claims</h2>
            </div>
            <Link to="/visits-and-claims" className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="bg-white/40">
                  {['Purpose', 'Account', 'Date', 'Amount', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60">
                {stats.recentVisits?.map((visit: any) => (
                  <tr key={visit._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-900">{visit.purpose}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{visit.accountId?.companyName || visit.accountId?.accountName || '—'}</td>
                    <td className="px-4 py-2.5 text-[11px] text-gray-400">{formatDate(visit.visitDate)}</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-gray-900 tabular-nums">{formatCurrency(visit.totalAmount)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        visit.hrStatus === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                        visit.hrStatus === 'Rejected' ? 'bg-gray-100 text-gray-500' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {visit.hrStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/training',      label: 'Training',      Icon: GraduationCap, gradient: 'bg-gradient-to-br from-violet-500 to-violet-700' },
          { to: '/installations', label: 'Installations', Icon: Wrench,        gradient: 'bg-gradient-to-br from-blue-500 to-blue-700' },
          { to: '/support',       label: 'Support',       Icon: Headphones,    gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-700' },
          { to: '/accounts',      label: 'Accounts',      Icon: Building2,     gradient: 'bg-gradient-to-br from-violet-400 to-blue-600' },
        ].map(({ to, label, Icon, gradient }, i) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-2.5 p-3 rounded-2xl border border-white/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            style={{
              background: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div className={`w-8 h-8 rounded-xl ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon size={14} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-gray-700">{label}</span>
            <ArrowRight size={11} className="text-gray-300 group-hover:text-gray-500 ml-auto transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
