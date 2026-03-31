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

const installStatusStyle: Record<string, string> = {
  'Scheduled':   'text-blue-700 bg-blue-50 border border-blue-100',
  'In Progress': 'text-amber-700 bg-amber-50 border border-amber-100',
  'Completed':   'text-emerald-700 bg-emerald-50 border border-emerald-100',
  'Cancelled':   'text-gray-500 bg-gray-50 border border-gray-100',
};

const priorityStyle: Record<string, string> = {
  Critical: 'text-red-700 bg-red-50 border border-red-100',
  High:     'text-orange-700 bg-orange-50 border border-orange-100',
  Medium:   'text-yellow-700 bg-yellow-50 border border-yellow-100',
  Low:      'text-green-700 bg-green-50 border border-green-100',
};

const visitStatusStyle: Record<string, string> = {
  Pending:  'text-amber-700 bg-amber-50',
  Approved: 'text-emerald-700 bg-emerald-50',
  Rejected: 'text-red-700 bg-red-50',
};

export default function EngineerDashboard() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?._id) dashboardApi.getEngineerStats(user._id).then(setStats).catch(console.error).finally(() => setLoading(false));
  }, [user?._id]);

  if (loading) return <LoadingSpinner className="h-64" />;
  if (!stats) return <div className="text-center text-gray-400 mt-20">Failed to load dashboard</div>;

  return (
    <div className="space-y-5 sm:space-y-7 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Engineer Dashboard</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">Hey, {user?.name?.split(' ')[0]} 👷</h1>
          <p className="text-sm text-gray-400 mt-0.5">Your assignments and field work overview</p>
        </div>
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-teal-500" />
          <Activity size={13} className="text-teal-600" />
          <span className="text-xs sm:text-sm font-semibold text-teal-700">My Work</span>
        </div>
      </div>

      {/* Stat Cards — 2 cols on mobile, 3 on tablet, 5 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          title="My Accounts" value={stats.accounts?.total ?? 0}
          sub={`${stats.accounts?.active ?? 0} active`}
          icon={Building2} color="text-teal-700" bg="bg-teal-50" border="border-teal-400"
        />
        <StatCard
          title="Open Tickets" value={stats.tickets?.open ?? 0}
          sub={`${stats.tickets?.critical ?? 0} critical`}
          icon={Headphones} color="text-rose-600" bg="bg-rose-50" border="border-rose-400"
        />
        <StatCard
          title="Installations" value={stats.installations?.scheduled ?? 0 + stats.installations?.inProgress ?? 0}
          sub={`${stats.installations?.scheduled ?? 0} sched.`}
          icon={Wrench} color="text-violet-700" bg="bg-violet-50" border="border-violet-400"
        />
        <StatCard
          title="Pending Claims" value={stats.visits?.pending ?? 0}
          sub={`${stats.visits?.total ?? 0} total`}
          icon={CalendarCheck} color="text-amber-700" bg="bg-amber-50" border="border-amber-400"
        />
        <StatCard
          title="Resolved" value={stats.tickets?.resolved ?? 0}
          sub={`${stats.tickets?.open ?? 0} open`}
          icon={CheckCircle2} color="text-emerald-700" bg="bg-emerald-50" border="border-emerald-400"
        />
      </div>

      {/* Installations + Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Upcoming Installations */}
        <div className="card !p-0 overflow-hidden">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench size={15} className="text-violet-600" />
              <h2 className="text-sm font-bold text-gray-900">My Installations</h2>
            </div>
            <Link to="/installations" className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 whitespace-nowrap">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {stats.recentInstallations?.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle2 size={30} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No active installations</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {stats.recentInstallations?.map((inst: any) => (
                <div key={inst._id} className="px-4 py-3 sm:px-6 sm:py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{(inst.accountId?.companyName || inst.accountId?.accountName)}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{inst.siteAddress}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${installStatusStyle[inst.status] ?? ''}`}>
                      {inst.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Clock size={10} className="text-gray-400" />
                    <span className="text-xs text-gray-400">{formatDate(inst.scheduledDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Open Tickets */}
        <div className="card !p-0 overflow-hidden">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Headphones size={15} className="text-rose-600" />
              <h2 className="text-sm font-bold text-gray-900">My Open Tickets</h2>
            </div>
            <Link to="/support" className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 whitespace-nowrap">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {stats.recentTickets?.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle2 size={30} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No open tickets assigned</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {stats.recentTickets?.map((ticket: any) => (
                <div key={ticket._id} className="px-4 py-3 sm:px-6 sm:py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{ticket.subject}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{(ticket.accountId?.companyName || ticket.accountId?.accountName)} · {ticket.ticketId}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${priorityStyle[ticket.priority] ?? ''}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <AlertCircle size={10} className="text-gray-400" />
                    <span className="text-xs text-gray-400">{ticket.status} · {formatDate(ticket.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Visit Claims */}
      {stats.recentVisits?.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck size={15} className="text-amber-600" />
              <h2 className="text-sm font-bold text-gray-900">My Recent Visit Claims</h2>
            </div>
            <Link to="/engineer-visits" className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 whitespace-nowrap">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="table-header">Purpose</th>
                  <th className="table-header">Account</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentVisits?.map((visit: any) => (
                  <tr key={visit._id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="table-cell font-semibold text-gray-900">{visit.purpose}</td>
                    <td className="table-cell text-gray-500">{(visit.accountId?.companyName || visit.accountId?.accountName) ?? '—'}</td>
                    <td className="table-cell text-gray-400 text-xs">{formatDate(visit.visitDate)}</td>
                    <td className="table-cell font-bold text-gray-900 tabular-nums">{formatCurrency(visit.totalAmount)}</td>
                    <td className="table-cell">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${visitStatusStyle[visit.hrStatus] ?? ''}`}>
                        {visit.hrStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/training',      label: 'Training',      Icon: GraduationCap, color: 'text-violet-600',  bg: 'bg-violet-50',  hover: 'group-hover:bg-violet-100'  },
          { to: '/installations', label: 'Installations', Icon: Wrench,        color: 'text-teal-600',    bg: 'bg-teal-50',    hover: 'group-hover:bg-teal-100'    },
          { to: '/support',       label: 'Support',       Icon: Headphones,    color: 'text-rose-600',    bg: 'bg-rose-50',    hover: 'group-hover:bg-rose-100'    },
          { to: '/accounts',      label: 'Accounts',      Icon: Building2,     color: 'text-emerald-600', bg: 'bg-emerald-50', hover: 'group-hover:bg-emerald-100' },
        ].map(({ to, label, Icon, color, bg, hover }) => (
          <Link
            key={to}
            to={to}
            className="card flex items-center gap-2.5 sm:gap-3 hover:border-violet-200 hover:shadow-md transition-all group !p-3 sm:!p-4"
          >
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${bg} ${hover} flex items-center justify-center flex-shrink-0 transition-colors`}>
              <Icon size={15} className={color} />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-gray-700">{label}</span>
            <ArrowRight size={12} className="text-gray-300 group-hover:text-gray-500 ml-auto transition-colors hidden sm:block" />
          </Link>
        ))}
      </div>
    </div>
  );
}
