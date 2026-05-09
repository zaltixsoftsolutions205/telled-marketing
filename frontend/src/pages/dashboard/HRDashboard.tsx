import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { dashboardApi } from '@/api/dashboard';
import { formatCurrency, formatDate } from '@/utils/formatters';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  Users, UserCheck, DollarSign, FileCheck,
  ArrowRight, Clock, CheckCircle2, TrendingUp,
  Receipt, CalendarCheck, Activity,
} from 'lucide-react';

function useCountUp(target: number, duration = 1000, started = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!started || target === 0) { setValue(target); return; }
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setValue(target); clearInterval(timer); }
      else setValue(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, started]);
  return value;
}

function StatCard({
  title, rawValue, displayValue, sub, icon: Icon, gradient, iconColor, delay = 0,
}: {
  title: string; rawValue: number; displayValue?: string; sub?: string;
  icon: React.ElementType; gradient: string; iconColor: string; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  const count = useCountUp(rawValue, 1000, visible);

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
          <p className={`text-2xl font-extrabold mt-1 leading-none tabular-nums ${iconColor}`}>
            {displayValue ?? count.toLocaleString()}
          </p>
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

function BarChart({ data, color, label, visible }: {
  data: { label: string; value: number }[];
  color: string; label: string; visible: boolean;
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { if (visible) { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t); } }, [visible]);

  const max = Math.max(...data.map(d => d.value), 1);
  const H = 110; const barW = 28; const gap = 14;
  const svgW = data.length * (barW + gap) - gap;

  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">{label}</p>
      {max === 0 || data.every(d => d.value === 0) ? (
        <div className="flex items-center justify-center h-28 text-gray-300 text-xs">No data yet</div>
      ) : (
        <svg viewBox={`0 0 ${svgW} ${H + 20}`} className="w-full overflow-visible">
          {data.map((d, i) => {
            const barH = animated ? Math.max(4, (d.value / max) * H) : 4;
            const x = i * (barW + gap);
            return (
              <g key={i}>
                <rect
                  x={x} y={H - barH} width={barW} height={barH} rx={6} className={color}
                  style={{ transition: `height 0.7s cubic-bezier(.22,1,.36,1) ${i * 80}ms, y 0.7s cubic-bezier(.22,1,.36,1) ${i * 80}ms` }}
                />
                {d.value > 0 && (
                  <text x={x + barW / 2} y={H - barH - 5} textAnchor="middle" fontSize="9" fill="#6b7280" fontWeight="600">
                    {d.value > 999 ? `${(d.value / 1000).toFixed(0)}k` : d.value}
                  </text>
                )}
                <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize="9" fill="#9ca3af">{d.label}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function DonutChart({ segments, label, centerText, visible }: {
  segments: { label: string; value: number; color: string }[];
  label: string; centerText: string; visible: boolean;
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { if (visible) { const t = setTimeout(() => setAnimated(true), 400); return () => clearTimeout(t); } }, [visible]);

  const total = segments.reduce((s, d) => s + d.value, 0);
  const R = 48; const cx = 60; const cy = 60; const stroke = 18;
  const circumference = 2 * Math.PI * R;

  let angle = -Math.PI / 2;
  const arcs = segments.map(seg => {
    const frac = total > 0 ? seg.value / total : 0;
    const sweep = frac * 2 * Math.PI;
    angle += sweep;
    return { ...seg, frac };
  });

  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">{label}</p>
      {total === 0 ? (
        <div className="flex items-center justify-center h-28 text-gray-300 text-xs">No data yet</div>
      ) : (
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 120 120" className="w-24 h-24 flex-shrink-0">
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
            {(() => {
              let a = -Math.PI / 2;
              return arcs.map((arc, i) => {
                const sweep = arc.frac * 2 * Math.PI;
                const x1 = cx + R * Math.cos(a);
                const y1 = cy + R * Math.sin(a);
                a += sweep;
                const x2 = cx + R * Math.cos(a);
                const y2 = cy + R * Math.sin(a);
                const large = sweep > Math.PI ? 1 : 0;
                const dashLen = animated ? arc.frac * circumference : 0;
                const dashOff = -arcs.slice(0, i).reduce((s, a2) => s + a2.frac * circumference, 0);
                return (
                  <circle key={i} cx={cx} cy={cy} r={R} fill="none"
                    stroke={arc.color} strokeWidth={stroke}
                    strokeDasharray={`${dashLen} ${circumference}`}
                    strokeDashoffset={dashOff}
                    strokeLinecap="round"
                    style={{ transition: `stroke-dasharray 0.8s cubic-bezier(.22,1,.36,1) ${i * 120}ms` }}
                    transform={`rotate(-90 ${cx} ${cy})`}
                  />
                );
              });
            })()}
            <text x={cx} y={cy - 5} textAnchor="middle" fontSize="16" fontWeight="800" fill="#111827">{centerText}</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#9ca3af">total</text>
          </svg>
          <div className="space-y-1.5 flex-1">
            {segments.map(seg => (
              <div key={seg.label} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                  <span className="text-xs text-gray-500">{seg.label}</span>
                </div>
                <span className="text-xs font-bold text-gray-800">{seg.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const salaryStatusStyle: Record<string, string> = {
  Paid:       'bg-emerald-100 text-emerald-700',
  Calculated: 'bg-blue-100 text-blue-700',
};
const invoiceStatusStyle: Record<string, string> = {
  'Paid':           'bg-emerald-100 text-emerald-700',
  'Partially Paid': 'bg-blue-100 text-blue-700',
  'Unpaid':         'bg-violet-100 text-violet-700',
  'Overdue':        'bg-gray-100 text-gray-600',
};

export default function HRDashboard() {
  const user = useAuthStore((s) => s.user);
  const isHR = user?.role === 'hr' || user?.role === 'admin';
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    dashboardApi.getHRStats()
      .then(s => { setStats(s); setTimeout(() => setVisible(true), 80); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-64" />;
  if (!stats) return <div className="text-center text-gray-400 mt-20">Failed to load dashboard</div>;

  const payrollTrendData = (stats.payrollTrend || []).map((d: any) => ({ label: d.label, value: d.total }));
  const visitTrendData   = (stats.visitTrend   || []).map((d: any) => ({ label: d.label, value: d.count }));

  const roleColorMap: Record<string, string> = {
    admin: '#7c3aed', sales: '#3b82f6', engineer: '#10b981', hr: '#6366f1', finance: '#0ea5e9',
  };
  const roleSegments = (stats.roleBreakdown || []).map((r: any) => ({
    label: r.role.charAt(0).toUpperCase() + r.role.slice(1),
    value: r.count,
    color: roleColorMap[r.role] || '#9ca3af',
  }));

  const visitClaimSegments = [
    { label: 'Pending',  value: stats.visitClaims?.pending  || 0, color: '#6366f1' },
    { label: 'Approved', value: stats.visitClaims?.approved || 0, color: '#10b981' },
    { label: 'Rejected', value: stats.visitClaims?.rejected || 0, color: '#94a3b8' },
  ];

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
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
            {isHR ? 'HR Dashboard' : 'Finance Dashboard'}
          </p>
          <h1 className="text-lg sm:text-xl font-extrabold text-gray-900">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isHR ? 'People, payroll and attendance overview' : 'Revenue, invoices and payments overview'}
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl px-3 py-1.5 border border-violet-200/70"
          style={{ background: 'rgba(237,233,254,0.5)', backdropFilter: 'blur(8px)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          <Activity size={11} className="text-violet-600" />
          <span className="text-xs font-semibold text-violet-700">{isHR ? 'HR Active' : 'Finance Active'}</span>
        </div>
      </div>

      {/* Stat Cards — HR */}
      {isHR && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Total Employees" rawValue={stats.employees?.total ?? 0}
            sub={`${stats.employees?.active ?? 0} active · ${stats.employees?.inactive ?? 0} inactive`}
            icon={Users} gradient="bg-gradient-to-br from-violet-500 to-violet-700"
            iconColor="text-violet-700" delay={50} />
          <StatCard title="Present Today" rawValue={stats.employees?.presentToday ?? 0}
            sub={`of ${stats.employees?.active ?? 0} active`}
            icon={UserCheck} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
            iconColor="text-emerald-700" delay={100} />
          <StatCard title="Payroll This Month" rawValue={stats.payroll?.thisMonth ?? 0}
            displayValue={formatCurrency(stats.payroll?.thisMonth ?? 0)}
            sub={`${stats.payroll?.pending ?? 0} pending · ${stats.payroll?.paid ?? 0} paid`}
            icon={DollarSign} gradient="bg-gradient-to-br from-blue-500 to-blue-700"
            iconColor="text-blue-700" delay={150} />
          <StatCard title="Visit Claims" rawValue={stats.visitClaims?.total ?? 0}
            sub={`${stats.visitClaims?.pending ?? 0} pending · ${stats.visitClaims?.approved ?? 0} approved`}
            icon={FileCheck} gradient="bg-gradient-to-br from-violet-400 to-blue-600"
            iconColor="text-violet-700" delay={200} />
        </div>
      )}

      {/* Stat Cards — Finance */}
      {!isHR && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Revenue Collected" rawValue={stats.invoices?.totalRevenue ?? 0}
            displayValue={formatCurrency(stats.invoices?.totalRevenue ?? 0)}
            sub={`out of ${stats.invoices?.total ?? 0} invoices`}
            icon={TrendingUp} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
            iconColor="text-emerald-700" delay={50} />
          <StatCard title="Pending Invoices" rawValue={(stats.invoices?.unpaid ?? 0) + (stats.invoices?.overdue ?? 0)}
            sub={`${stats.invoices?.overdue ?? 0} overdue · ${stats.invoices?.partialPaid ?? 0} partial`}
            icon={Receipt} gradient="bg-gradient-to-br from-violet-500 to-violet-700"
            iconColor="text-violet-700" delay={100} />
          <StatCard title="Visit Claims" rawValue={stats.visitClaims?.total ?? 0}
            sub={`${stats.visitClaims?.pending ?? 0} pending`}
            icon={CalendarCheck} gradient="bg-gradient-to-br from-blue-500 to-blue-700"
            iconColor="text-blue-700" delay={150} />
          <StatCard title="Salary Pending" rawValue={stats.salaries?.pending ?? 0}
            sub={`${stats.salaries?.paid ?? 0} paid`}
            icon={DollarSign} gradient="bg-gradient-to-br from-violet-400 to-blue-600"
            iconColor="text-violet-700" delay={200} />
        </div>
      )}

      {/* Charts Row — HR only */}
      {isHR && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <GlassCard className="md:col-span-2" delay={250}>
            <BarChart data={payrollTrendData} color="fill-violet-400"
              label="Payroll Trend — Last 6 Months (₹)" visible={visible} />
          </GlassCard>
          <GlassCard delay={300}>
            <DonutChart segments={visitClaimSegments} label="Visit Claims Breakdown"
              centerText={String(stats.visitClaims?.total ?? 0)} visible={visible} />
          </GlassCard>
          <GlassCard delay={350}>
            <DonutChart segments={roleSegments} label="Team by Role"
              centerText={String(stats.employees?.total ?? 0)} visible={visible} />
          </GlassCard>
        </div>
      )}

      {isHR && (
        <GlassCard delay={400}>
          <BarChart data={visitTrendData} color="fill-blue-400"
            label="Visit Claims Submitted — Last 6 Months" visible={visible} />
        </GlassCard>
      )}

      {/* Recent Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

        {/* Pending Visit Approvals */}
        <GlassCard className="!p-0 overflow-hidden" delay={isHR ? 450 : 250}>
          <div className="px-4 py-3 border-b border-white/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck size={14} className="text-violet-600" />
              <h2 className="text-sm font-bold text-gray-900">Pending Visit Approvals</h2>
            </div>
            <Link to="/visits-and-claims" className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {!stats.pendingVisitsList?.length ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-xs text-gray-400">No pending visits</p>
            </div>
          ) : (
            <div className="divide-y divide-white/60">
              {stats.pendingVisitsList.map((visit: any) => (
                <div key={visit._id} className="px-4 py-3 hover:bg-violet-50/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-xs">{visit.engineerId?.name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">{visit.visitType || visit.purpose} · {visit.accountId?.companyName || 'No account'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-gray-900 text-xs">{formatCurrency(visit.totalAmount)}</p>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block bg-blue-100 text-blue-700">
                        {visit.hrStatus}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock size={10} className="text-gray-400" />
                    <span className="text-[11px] text-gray-400">{formatDate(visit.visitDate || visit.scheduledDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Salary Records (HR) / Invoice Status (Finance) */}
        {isHR ? (
          <GlassCard className="!p-0 overflow-hidden" delay={500}>
            <div className="px-4 py-3 border-b border-white/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign size={14} className="text-violet-600" />
                <h2 className="text-sm font-bold text-gray-900">Recent Salary Records</h2>
              </div>
              <Link to="/salary" className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {!stats.recentSalaries?.length ? (
              <div className="px-5 py-10 text-center">
                <CheckCircle2 size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">No salary records yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px]">
                  <thead>
                    <tr className="bg-white/40">
                      {['Employee', 'Period', 'Salary', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/60">
                    {stats.recentSalaries.map((sal: any) => (
                      <tr key={sal._id} className="hover:bg-violet-50/20 transition-colors">
                        <td className="px-4 py-2.5 text-xs font-semibold text-gray-900">{sal.employeeId?.name}</td>
                        <td className="px-4 py-2.5 text-[11px] text-gray-500">{sal.month}/{sal.year}</td>
                        <td className="px-4 py-2.5 text-xs font-bold text-gray-900 tabular-nums">{formatCurrency(sal.finalSalary)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${salaryStatusStyle[sal.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {sal.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        ) : (
          <GlassCard className="!p-0 overflow-hidden" delay={300}>
            <div className="px-4 py-3 border-b border-white/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={14} className="text-emerald-600" />
                <h2 className="text-sm font-bold text-gray-900">Invoice Status</h2>
              </div>
              <Link to="/invoices" className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {!stats.allInvoices?.length ? (
              <div className="px-5 py-10 text-center">
                <CheckCircle2 size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">No invoices yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px]">
                  <thead>
                    <tr className="bg-white/40">
                      {['Invoice', 'Account', 'Amount', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/60">
                    {stats.allInvoices.map((inv: any) => (
                      <tr key={inv._id} className="hover:bg-emerald-50/20 transition-colors">
                        <td className="px-4 py-2.5 text-xs font-semibold text-gray-900">{inv.invoiceNumber}</td>
                        <td className="px-4 py-2.5 text-[11px] text-gray-500 truncate max-w-[90px]">{inv.accountId?.companyName || inv.accountId?.accountName}</td>
                        <td className="px-4 py-2.5 text-xs font-bold text-gray-900 tabular-nums">{formatCurrency(inv.amount)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${invoiceStatusStyle[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        )}
      </div>
    </div>
  );
}
