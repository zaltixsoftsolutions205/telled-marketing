import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { dashboardApi } from '@/api/dashboard';
import { formatCurrency, formatDate } from '@/utils/formatters';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { TrendingUp, Receipt, CalendarCheck, DollarSign, Activity, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

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

const invoiceStatusStyle: Record<string, string> = {
  'Paid':           'text-emerald-700 bg-emerald-50 border border-emerald-100',
  'Partially Paid': 'text-blue-700 bg-blue-50 border border-blue-100',
  'Unpaid':         'text-amber-700 bg-amber-50 border border-amber-100',
  'Overdue':        'text-red-700 bg-red-50 border border-red-100',
  'Cancelled':      'text-gray-500 bg-gray-50 border border-gray-200',
};

const salaryStatusStyle: Record<string, string> = {
  'Paid':       'text-emerald-700 bg-emerald-50',
  'Calculated': 'text-amber-700 bg-amber-50',
};

const visitStatusStyle: Record<string, string> = {
  Pending:  'text-amber-700 bg-amber-50 border border-amber-100',
  Approved: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
  Rejected: 'text-red-700 bg-red-50 border border-red-100',
};

export default function HRDashboard() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getHRStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-64" />;
  if (!stats) return <div className="text-center text-gray-400 mt-20">Failed to load dashboard</div>;

  return (
    <div className="space-y-5 sm:space-y-7 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">HR & Finance Dashboard</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">Finance & HR Overview</h1>
          <p className="text-sm text-gray-400 mt-0.5">Welcome back, {user?.name?.split(' ')[0]} — manage payroll and collections</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <Activity size={13} className="text-emerald-600" />
          <span className="text-xs sm:text-sm font-semibold text-emerald-700">Finance</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <StatCard
          title="Revenue Collected" value={formatCurrency(stats.invoices?.totalRevenue ?? 0)}
          sub={`out of ${stats.invoices?.total ?? 0} invoices`}
          icon={TrendingUp} color="text-emerald-700" bg="bg-emerald-50" border="border-emerald-400"
        />
        <StatCard
          title="Pending Invoices" value={(stats.invoices?.unpaid ?? 0) + (stats.invoices?.overdue ?? 0)}
          sub={`${stats.invoices?.overdue ?? 0} overdue · ${stats.invoices?.partialPaid ?? 0} partial`}
          icon={Receipt} color="text-red-600" bg="bg-red-50" border="border-red-400"
        />
        <StatCard
          title="Visit Approvals" value={stats.visits?.total ?? 0}
          sub={`${stats.visits?.pending ?? 0} pending · ${stats.visits?.approved ?? 0} approved`}
          icon={CalendarCheck} color="text-amber-700" bg="bg-amber-50" border="border-amber-400"
        />
        <StatCard
          title="Salary Pending" value={stats.salaries?.pending ?? 0}
          sub={`${stats.salaries?.paid ?? 0} paid · ₹${((stats.salaries?.totalPaid ?? 0) / 1000).toFixed(0)}k disbursed`}
          icon={DollarSign} color="text-violet-700" bg="bg-violet-50" border="border-violet-400"
        />
      </div>

      {/* Invoices + Visit Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Invoices */}
        <div className="card !p-0 overflow-hidden">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={15} className="text-emerald-600" />
              <h2 className="text-sm font-bold text-gray-900">Invoice Status</h2>
            </div>
            <Link to="/invoices" className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 whitespace-nowrap">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {!stats.allInvoices?.length ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle2 size={30} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No invoices yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead className="bg-gray-50/60">
                  <tr>
                    <th className="table-header">Invoice</th>
                    <th className="table-header">Account</th>
                    <th className="table-header">Amount</th>
                    <th className="table-header">Due</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.allInvoices?.map((inv: any) => (
                    <tr key={inv._id} className="hover:bg-emerald-50/20 transition-colors">
                      <td className="table-cell font-semibold text-gray-900 text-xs">{inv.invoiceNumber}</td>
                      <td className="table-cell text-gray-500 text-xs truncate max-w-[90px]">{inv.accountId?.companyName || inv.accountId?.accountName}</td>
                      <td className="table-cell font-bold text-gray-900 text-xs tabular-nums">{formatCurrency(inv.amount)}</td>
                      <td className="table-cell text-gray-400 text-xs">{formatDate(inv.dueDate)}</td>
                      <td className="table-cell">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${invoiceStatusStyle[inv.status] ?? ''}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Visit Approvals */}
        <div className="card !p-0 overflow-hidden">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck size={15} className="text-amber-600" />
              <h2 className="text-sm font-bold text-gray-900">Visit Approvals</h2>
            </div>
            <Link to="/engineer-visits" className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 whitespace-nowrap">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {!stats.pendingVisitsList?.length ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle2 size={30} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No completed visits yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {stats.pendingVisitsList?.map((visit: any) => (
                <div key={visit._id} className="px-4 py-3 sm:px-6 sm:py-4 hover:bg-amber-50/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{visit.engineerId?.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{visit.visitType || visit.purpose} · {visit.accountId?.companyName || 'No account'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-extrabold text-gray-900 text-sm tabular-nums">{formatCurrency(visit.totalAmount)}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${visitStatusStyle[visit.hrStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {visit.hrStatus}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Clock size={10} className="text-gray-400" />
                    <span className="text-xs text-gray-400">{formatDate(visit.visitDate || visit.scheduledDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Salary Records */}
      {stats.recentSalaries?.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign size={15} className="text-violet-600" />
              <h2 className="text-sm font-bold text-gray-900">Salary Records</h2>
            </div>
            <Link to="/salary" className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1 whitespace-nowrap">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="table-header">Employee</th>
                  <th className="table-header">Period</th>
                  <th className="table-header">Base</th>
                  <th className="table-header">Visit Charges</th>
                  <th className="table-header">Final Salary</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentSalaries?.map((sal: any) => (
                  <tr key={sal._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-semibold text-gray-900">{sal.employeeId?.name}</td>
                    <td className="table-cell text-gray-500">{sal.month}/{sal.year}</td>
                    <td className="table-cell text-gray-500">{formatCurrency(sal.baseSalary)}</td>
                    <td className="table-cell text-gray-500">{formatCurrency(sal.visitChargesTotal)}</td>
                    <td className="table-cell font-extrabold text-gray-900 tabular-nums">{formatCurrency(sal.finalSalary)}</td>
                    <td className="table-cell">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${salaryStatusStyle[sal.status] ?? ''}`}>
                        {sal.status}
                      </span>
                    </td>
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
