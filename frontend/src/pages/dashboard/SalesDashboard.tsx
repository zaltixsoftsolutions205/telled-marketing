import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { leadsApi } from '@/api/leads';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  Users, TrendingUp, Target, CheckCircle2, XCircle,
  ArrowRight, Activity, BarChart2,
} from 'lucide-react';
import type { Lead, SalesStatus } from '@/types';
import { SALES_STATUSES } from '@/types';

const STAGE_TO_SALES_STATUS: Record<string, SalesStatus> = {
  'New':           'Uninitiated',
  'OEM Submitted': 'Sales meeting follow-up',
  'OEM Approved':  'Sales meeting follow-up',
  'OEM Rejected':  'Rejected, at Sales discussion stage',
  'OEM Expired':   'Rejected, at Sales discussion stage',
  'Technical Done':'Under technical Demo',
  'Quotation Sent':'Under Proposal submission Process',
  'Negotiation':   'Under Proposal submission Process',
  'PO Received':   'Under PO-Followup',
  'Converted':     'Closed, and now a Customer',
};

const deriveSalesStatus = (lead: Lead): SalesStatus => {
  if (lead.salesStatus?.startsWith('Rejected')) return lead.salesStatus;
  return STAGE_TO_SALES_STATUS[lead.stage] ?? lead.salesStatus ?? 'Uninitiated';
};

// ─── Color map per salesStatus ────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; text: string; bar: string }> = {
  'Uninitiated':                        { bg: 'bg-gray-100',    text: 'text-gray-600',   bar: 'bg-gray-400' },
  'Sales meeting follow-up':            { bg: 'bg-blue-100',    text: 'text-blue-700',   bar: 'bg-blue-500' },
  'Under technical Demo':               { bg: 'bg-violet-100',  text: 'text-violet-700', bar: 'bg-violet-500' },
  'Under Proposal submission Process':  { bg: 'bg-amber-100',   text: 'text-amber-700',  bar: 'bg-amber-500' },
  'Under PO-Followup':                  { bg: 'bg-orange-100',  text: 'text-orange-700', bar: 'bg-orange-500' },
  'Under payment follow-up':            { bg: 'bg-sky-100',     text: 'text-sky-700',    bar: 'bg-sky-500' },
  'Closed, and now a Customer':         { bg: 'bg-emerald-100', text: 'text-emerald-700',bar: 'bg-emerald-500' },
  'Rejected, at Sales discussion stage':{ bg: 'bg-red-100',     text: 'text-red-600',    bar: 'bg-red-400' },
  'Rejected, at Tech Demo Stage':       { bg: 'bg-red-100',     text: 'text-red-600',    bar: 'bg-red-400' },
  'Rejected, at PO follow-up stage':    { bg: 'bg-red-100',     text: 'text-red-600',    bar: 'bg-red-400' },
  'Rejected, at Payment follow-up stage':{ bg: 'bg-red-100',    text: 'text-red-600',    bar: 'bg-red-400' },
  'Rejected, at license generation stage':{ bg: 'bg-red-100',   text: 'text-red-600',    bar: 'bg-red-400' },
};

const ACTIVE_STATUSES: SalesStatus[] = [
  'Uninitiated',
  'Sales meeting follow-up',
  'Under technical Demo',
  'Under Proposal submission Process',
  'Under PO-Followup',
  'Under payment follow-up',
];

const REJECTED_STATUSES: SalesStatus[] = SALES_STATUSES.filter(s => s.startsWith('Rejected'));

function StatCard({ title, value, sub, icon: Icon, color, bg, border }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; bg: string; border: string;
}) {
  return (
    <div className={`card border-l-4 ${border} hover:shadow-lg transition-all duration-200 group`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{title}</p>
          <p className={`text-2xl font-extrabold mt-1.5 ${color} leading-none tabular-nums`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1.5 leading-snug">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-2xl ${bg} flex items-center justify-center flex-shrink-0 ml-3 group-hover:scale-110 transition-transform`}>
          <Icon size={18} className={color} />
        </div>
      </div>
    </div>
  );
}

export default function SalesDashboard() {
  const user = useAuthStore((s) => s.user);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leadsApi.getAll({ limit: 500 })
      .then(res => setLeads(res.data || []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-64" />;

  // ── Compute funnel counts ─────────────────────────────────────────────────
  const counts: Record<string, number> = {};
  SALES_STATUSES.forEach(s => { counts[s] = 0; });
  // Use derived status (from stage) so counts stay in sync without manual updates
  leads.forEach(l => {
    const s = deriveSalesStatus(l);
    counts[s] = (counts[s] || 0) + 1;
  });

  const totalLeads   = leads.length;
  const activeDeals  = ACTIVE_STATUSES.reduce((sum, s) => sum + (counts[s] || 0), 0);
  const closedDeals  = counts['Closed, and now a Customer'] || 0;
  const rejectedDeals= REJECTED_STATUSES.reduce((sum, s) => sum + (counts[s] || 0), 0);
  const conversionRate = totalLeads > 0 ? Math.round((closedDeals / totalLeads) * 100) : 0;

  const maxCount = Math.max(...ACTIVE_STATUSES.map(s => counts[s] || 0), 1);

  // Recent 5 leads
  const recentLeads = [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Sales Dashboard</p>
          <h1 className="text-xl font-extrabold text-gray-900">Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Track your deal pipeline and lifecycle status</p>
        </div>
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 self-start">
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <Activity size={13} className="text-violet-600" />
          <span className="text-sm font-semibold text-violet-700">My Pipeline</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Leads" value={totalLeads}
          sub={`${activeDeals} active deals`}
          icon={Users} color="text-violet-700" bg="bg-violet-50" border="border-violet-400" />
        <StatCard title="Closed (Customers)" value={closedDeals}
          sub={`${conversionRate}% conversion rate`}
          icon={CheckCircle2} color="text-emerald-700" bg="bg-emerald-50" border="border-emerald-400" />
        <StatCard title="Active Deals" value={activeDeals}
          sub="In pipeline stages"
          icon={Target} color="text-blue-700" bg="bg-blue-50" border="border-blue-400" />
        <StatCard title="Lost / Rejected" value={rejectedDeals}
          sub={`${totalLeads > 0 ? Math.round((rejectedDeals / totalLeads) * 100) : 0}% rejection rate`}
          icon={XCircle} color="text-red-600" bg="bg-red-50" border="border-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Sales Funnel ── */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center gap-2 mb-5">
            <BarChart2 size={16} className="text-violet-600" />
            <h2 className="font-semibold text-gray-800">Sales Lifecycle Funnel</h2>
          </div>
          <div className="space-y-2.5">
            {ACTIVE_STATUSES.map(status => {
              const count = counts[status] || 0;
              const pct = Math.round((count / maxCount) * 100);
              const style = STATUS_STYLE[status] || STATUS_STYLE['Uninitiated'];
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>{status}</span>
                    <span className="text-xs font-bold text-gray-700 tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${style.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Conversion stats row */}
          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span className="text-gray-600">Closed: <strong className="text-emerald-700">{closedDeals}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
              <span className="text-gray-600">Rejected: <strong className="text-red-600">{rejectedDeals}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-violet-600" />
              <span className="text-gray-600">Conversion: <strong className="text-violet-700">{conversionRate}%</strong></span>
            </div>
          </div>
        </div>

        {/* ── Rejected Breakdown ── */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <XCircle size={15} className="text-red-500" />
            <h2 className="font-semibold text-gray-800">Rejection Breakdown</h2>
          </div>
          {REJECTED_STATUSES.every(s => (counts[s] || 0) === 0) ? (
            <p className="text-sm text-gray-400 text-center py-6">No rejected deals yet</p>
          ) : (
            <div className="space-y-2">
              {REJECTED_STATUSES.map(status => {
                const count = counts[status] || 0;
                if (count === 0) return null;
                return (
                  <div key={status} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-600 flex-1 pr-2 leading-tight">{status.replace('Rejected, at ', '')}</span>
                    <span className="badge bg-red-100 text-red-600 text-xs font-bold flex-shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* All-status breakdown */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">All Status Counts</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {SALES_STATUSES.map(s => {
                const c = counts[s] || 0;
                const style = STATUS_STYLE[s];
                return (
                  <div key={s} className="flex items-center justify-between text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${style?.bg} ${style?.text} truncate max-w-[140px]`}>{s}</span>
                    <span className="font-bold text-gray-700 ml-1">{c}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Leads ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Users size={15} className="text-violet-600" /> Recent Leads
          </h2>
          <Link to="/zieos/leads" className="text-xs text-violet-600 hover:underline flex items-center gap-1">
            View all <ArrowRight size={11} />
          </Link>
        </div>
        {recentLeads.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No leads yet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentLeads.map(lead => {
              const ss = deriveSalesStatus(lead);
              const style = STATUS_STYLE[ss];
              return (
                <div key={lead._id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/zieos/leads/${lead._id}`} className="text-sm font-semibold text-gray-800 hover:text-violet-700 truncate block">{lead.companyName}</Link>
                    <p className="text-xs text-gray-400 truncate">{lead.contactPersonName || lead.contactName || '—'}</p>
                  </div>
                  <span className={`badge text-[10px] font-medium flex-shrink-0 ${style?.bg} ${style?.text}`}>{ss}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
