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

const STATUS_STYLE: Record<string, { bg: string; text: string; bar: string }> = {
  'Uninitiated':                          { bg: 'bg-gray-100',    text: 'text-gray-600',   bar: 'bg-gray-400' },
  'Sales meeting follow-up':              { bg: 'bg-blue-100',    text: 'text-blue-700',   bar: 'bg-blue-500' },
  'Under technical Demo':                 { bg: 'bg-violet-100',  text: 'text-violet-700', bar: 'bg-violet-500' },
  'Under Proposal submission Process':    { bg: 'bg-blue-100',    text: 'text-blue-700',   bar: 'bg-blue-400' },
  'Under PO-Followup':                    { bg: 'bg-violet-100',  text: 'text-violet-700', bar: 'bg-violet-400' },
  'Under payment follow-up':              { bg: 'bg-emerald-100', text: 'text-emerald-700',bar: 'bg-emerald-500' },
  'Closed, and now a Customer':           { bg: 'bg-emerald-100', text: 'text-emerald-700',bar: 'bg-emerald-500' },
  'Rejected, at Sales discussion stage':  { bg: 'bg-gray-100',    text: 'text-gray-500',   bar: 'bg-gray-400' },
  'Rejected, at Tech Demo Stage':         { bg: 'bg-gray-100',    text: 'text-gray-500',   bar: 'bg-gray-400' },
  'Rejected, at PO follow-up stage':      { bg: 'bg-gray-100',    text: 'text-gray-500',   bar: 'bg-gray-400' },
  'Rejected, at Payment follow-up stage': { bg: 'bg-gray-100',    text: 'text-gray-500',   bar: 'bg-gray-400' },
  'Rejected, at license generation stage':{ bg: 'bg-gray-100',    text: 'text-gray-500',   bar: 'bg-gray-400' },
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

  const counts: Record<string, number> = {};
  SALES_STATUSES.forEach(s => { counts[s] = 0; });
  leads.forEach(l => {
    const s = deriveSalesStatus(l);
    counts[s] = (counts[s] || 0) + 1;
  });

  const totalLeads    = leads.length;
  const activeDeals   = ACTIVE_STATUSES.reduce((sum, s) => sum + (counts[s] || 0), 0);
  const closedDeals   = counts['Closed, and now a Customer'] || 0;
  const rejectedDeals = REJECTED_STATUSES.reduce((sum, s) => sum + (counts[s] || 0), 0);
  const conversionRate = totalLeads > 0 ? Math.round((closedDeals / totalLeads) * 100) : 0;
  const maxCount = Math.max(...ACTIVE_STATUSES.map(s => counts[s] || 0), 1);
  const recentLeads = [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

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
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sales Dashboard</p>
          <h1 className="text-lg sm:text-xl font-extrabold text-gray-900">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-xs text-gray-400 mt-0.5">Track your deal pipeline and lifecycle status</p>
        </div>
        <div
          className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl px-3 py-1.5 border border-blue-200/70"
          style={{ background: 'rgba(219,234,254,0.5)', backdropFilter: 'blur(8px)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <Activity size={11} className="text-blue-600" />
          <span className="text-xs font-semibold text-blue-700">My Pipeline</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Leads" value={totalLeads}
          sub={`${activeDeals} active deals`}
          icon={Users} gradient="bg-gradient-to-br from-violet-500 to-violet-700"
          iconColor="text-violet-700" delay={50} />
        <StatCard title="Closed (Won)" value={closedDeals}
          sub={`${conversionRate}% conversion rate`}
          icon={CheckCircle2} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          iconColor="text-emerald-700" delay={100} />
        <StatCard title="Active Deals" value={activeDeals}
          sub="In pipeline stages"
          icon={Target} gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          iconColor="text-blue-700" delay={150} />
        <StatCard title="Lost / Rejected" value={rejectedDeals}
          sub={`${totalLeads > 0 ? Math.round((rejectedDeals / totalLeads) * 100) : 0}% rejection rate`}
          icon={XCircle} gradient="bg-gradient-to-br from-violet-400 to-blue-600"
          iconColor="text-violet-700" delay={200} />
      </div>

      {/* Funnel + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">

        {/* Sales Funnel */}
        <GlassCard className="lg:col-span-2" delay={250}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={15} className="text-violet-600" />
            <h2 className="text-sm font-bold text-gray-900">Sales Lifecycle Funnel</h2>
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
                    <div className={`h-full rounded-full transition-all duration-700 ${style.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-white/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-gray-600">Closed: <strong className="text-emerald-700">{closedDeals}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" />
              <span className="text-gray-600">Rejected: <strong className="text-gray-600">{rejectedDeals}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-violet-600" />
              <span className="text-gray-600">Conversion: <strong className="text-violet-700">{conversionRate}%</strong></span>
            </div>
          </div>
        </GlassCard>

        {/* Rejected Breakdown */}
        <GlassCard delay={300}>
          <div className="flex items-center gap-2 mb-4">
            <XCircle size={14} className="text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900">Rejection Breakdown</h2>
          </div>
          {REJECTED_STATUSES.every(s => (counts[s] || 0) === 0) ? (
            <p className="text-xs text-gray-400 text-center py-6">No rejected deals yet</p>
          ) : (
            <div className="space-y-2">
              {REJECTED_STATUSES.map(status => {
                const count = counts[status] || 0;
                if (count === 0) return null;
                return (
                  <div key={status} className="flex items-center justify-between py-1.5 border-b border-white/60 last:border-0">
                    <span className="text-xs text-gray-600 flex-1 pr-2 leading-tight">{status.replace('Rejected, at ', '')}</span>
                    <span className="badge bg-gray-100 text-gray-600 text-xs font-bold flex-shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-white/60">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">All Status Counts</p>
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
        </GlassCard>
      </div>

      {/* Recent Leads */}
      {recentLeads.length > 0 && (
        <GlassCard className="!p-0 overflow-hidden" delay={350}>
          <div className="px-4 py-3 border-b border-white/60 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Recent Leads</h2>
              <p className="text-[11px] text-gray-400 mt-0.5 hidden sm:block">Latest activity in your pipeline</p>
            </div>
            <Link to="/leads" className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-white/60">
            {recentLeads.map(lead => {
              const ss = deriveSalesStatus(lead);
              const style = STATUS_STYLE[ss];
              return (
                <div key={lead._id} className="flex items-center justify-between px-4 py-2.5 hover:bg-violet-50/30 transition-colors gap-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/leads/${lead._id}`} className="text-xs font-semibold text-violet-700 hover:underline truncate block">{lead.companyName}</Link>
                    <p className="text-[11px] text-gray-400 truncate">{lead.contactPersonName || lead.contactName || '—'}</p>
                  </div>
                  <span className={`badge text-[10px] font-medium flex-shrink-0 ${style?.bg} ${style?.text}`}>{ss}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
