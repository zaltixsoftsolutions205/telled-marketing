import { useEffect, useState, useCallback } from 'react';
import {
  BarChart2, Clock, Wrench, BookOpen, Star,
  TrendingUp, CalendarCheck, Headphones,
  FileText, Users, CheckCircle2, Target,
} from 'lucide-react';
import { engineerVisitsApi } from '@/api/engineerVisits';
import { supportApi } from '@/api/support';
import { trainingApi } from '@/api/training';
import { usersApi } from '@/api/users';
import { leadsApi } from '@/api/leads';
import { quotationsApi } from '@/api/quotations';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import type { User } from '@/types';

interface EngPerf {
  engineer: User;
  totalVisits: number;
  completedVisits: number;
  scheduledVisits: number;
  visitsByType: Record<string, number>;
  totalCharges: number;
  hrApprovedVisits: number;
  openTickets: number;
  resolvedTickets: number;
  totalTickets: number;
  completedTrainings: number;
  totalTrainings: number;
  completionRate: number;
  resolutionRate: number;
  performanceScore: number;
}

interface SalesPerf {
  user: User;
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  leadsByStage: Record<string, number>;
  totalQuotations: number;
  acceptedQuotations: number;
  rejectedQuotations: number;
  pendingQuotations: number;
  conversionRate: number;
  quotationAcceptRate: number;
  performanceScore: number;
}

function ScoreBar({ value, max = 100, color = 'bg-violet-500' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon size={16} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function EngineerPerformancePage() {
  const user = useAuthStore((s) => s.user);
  const isSales = user?.role === 'sales';
  const isAdmin = user?.role === 'admin';

  const [engineers, setEngineers] = useState<User[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [perf, setPerf] = useState<EngPerf | null>(null);
  const [salesPerf, setSalesPerf] = useState<SalesPerf | null>(null);
  const [loading, setLoading] = useState(false);
  const [engLoading, setEngLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setEngLoading(true);
      try {
        if (isAdmin) {
          const engs = await usersApi.getEngineers();
          setEngineers(engs || []);
          if (engs?.length) setSelected(engs[0]._id);
        } else {
          setSelected(user?._id || '');
        }
      } catch {}
      setEngLoading(false);
    };
    load();
  }, [isAdmin, user]);

  const loadSalesPerf = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const [leadsRes, quotationsRes] = await Promise.all([
        leadsApi.getAll({ limit: 1000 }),
        quotationsApi.getAll({ limit: 1000 }),
      ]);

      const myLeads = (leadsRes.data || []).filter((l: any) =>
        (l.assignedTo?._id || l.assignedTo) === user._id
      );
      const myQuotations = (quotationsRes.data || []).filter((q: any) => {
        const leadId = q.leadId?._id || q.leadId;
        return myLeads.some((l: any) => l._id === leadId);
      });

      const newLeads       = myLeads.filter((l: any) => l.status === 'New').length;
      const qualifiedLeads = myLeads.filter((l: any) => l.status === 'Qualified').length;
      const convertedLeads = myLeads.filter((l: any) => l.stage === 'Converted' || l.stage === 'PO Received').length;

      const leadsByStage: Record<string, number> = {};
      for (const l of myLeads) {
        const s = l.stage || 'New';
        leadsByStage[s] = (leadsByStage[s] || 0) + 1;
      }

      const acceptedQuotations = myQuotations.filter((q: any) => q.status === 'Accepted').length;
      const rejectedQuotations = myQuotations.filter((q: any) => q.status === 'Rejected').length;
      const pendingQuotations  = myQuotations.filter((q: any) => q.status === 'Sent' || !q.status).length;

      const conversionRate     = myLeads.length ? Math.round((convertedLeads / myLeads.length) * 100) : 0;
      const quotationAcceptRate = myQuotations.length ? Math.round((acceptedQuotations / myQuotations.length) * 100) : 0;

      const score = Math.round(conversionRate * 0.5 + quotationAcceptRate * 0.5);

      setSalesPerf({
        user: user as unknown as User,
        totalLeads: myLeads.length,
        newLeads,
        qualifiedLeads,
        convertedLeads,
        leadsByStage,
        totalQuotations: myQuotations.length,
        acceptedQuotations,
        rejectedQuotations,
        pendingQuotations,
        conversionRate,
        quotationAcceptRate,
        performanceScore: score,
      });
    } catch (err) {
      console.error('loadSalesPerf:', err);
      setSalesPerf(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadPerf = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const [visitsRes, supportRes, trainingRes] = await Promise.all([
        engineerVisitsApi.getAll({ engineerId: selected, limit: 1000 }),
        supportApi.getAll({ limit: 1000 }),
        trainingApi.getAll({ limit: 1000 }),
      ]);

      const allVisits = visitsRes.data || [];
      const engineerVisits = allVisits.filter((v: any) =>
        (v.engineerId?._id || v.engineerId) === selected
      );
      const allTickets = (supportRes.data || []).filter((t: any) =>
        (t.assignedEngineer?._id || t.assignedEngineer) === selected
      );
      const allTrainings = (trainingRes.data || []).filter((t: any) =>
        (t.trainedBy?._id || t.trainedBy) === selected
      );

      const completed    = engineerVisits.filter((v: any) => v.status === 'Completed');
      const scheduled    = engineerVisits.filter((v: any) => v.status === 'Scheduled');
      const hrApproved   = engineerVisits.filter((v: any) => v.hrStatus === 'Approved');
      const totalCharges = completed.reduce((s: number, v: any) => s + (v.totalAmount || 0), 0);

      const visitsByType: Record<string, number> = {};
      for (const v of engineerVisits) {
        const t = v.visitType || 'Support';
        visitsByType[t] = (visitsByType[t] || 0) + 1;
      }

      const resolvedTickets = allTickets.filter((t: any) => t.status === 'Resolved' || t.status === 'Closed').length;
      const openTickets     = allTickets.filter((t: any) => t.status === 'Open' || t.status === 'In Progress').length;
      const completedTrain  = allTrainings.filter((t: any) => t.status === 'Completed').length;

      const completionRate = engineerVisits.length ? Math.round((completed.length / engineerVisits.length) * 100) : 0;
      const resolutionRate = allTickets.length ? Math.round((resolvedTickets / allTickets.length) * 100) : 0;
      const score = Math.round(
        completionRate * 0.4 +
        resolutionRate * 0.3 +
        (allTrainings.length ? (completedTrain / allTrainings.length) * 100 * 0.3 : 30)
      );

      const eng = engineers.find(e => e._id === selected) || user as unknown as User;
      setPerf({
        engineer: eng,
        totalVisits: engineerVisits.length,
        completedVisits: completed.length,
        scheduledVisits: scheduled.length,
        visitsByType,
        totalCharges,
        hrApprovedVisits: hrApproved.length,
        openTickets,
        resolvedTickets,
        totalTickets: allTickets.length,
        completedTrainings: completedTrain,
        totalTrainings: allTrainings.length,
        completionRate,
        resolutionRate,
        performanceScore: score,
      });
    } catch (err) {
      console.error('loadPerf:', err);
      setPerf(null);
    } finally {
      setLoading(false);
    }
  }, [selected, engineers, user]);

  useEffect(() => {
    if (isSales) loadSalesPerf();
    else loadPerf();
  }, [isSales, loadSalesPerf, loadPerf]);

  if (engLoading) return <LoadingSpinner className="h-64" />;

  // ── SALES VIEW ──
  if (isSales) {
    const sp = salesPerf;
    const scoreColor = sp
      ? sp.performanceScore >= 80 ? 'text-emerald-600'
      : sp.performanceScore >= 60 ? 'text-amber-600'
      : 'text-red-500'
      : 'text-gray-400';

    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Performance</h1>
          <p className="text-sm text-gray-500">Lead conversion, quotation & pipeline metrics</p>
        </div>

        {loading ? (
          <LoadingSpinner className="h-64" />
        ) : !sp ? (
          <div className="text-center text-gray-400 py-16">
            <BarChart2 size={40} className="mx-auto mb-2 opacity-30" />
            <p>No data available</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Score card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{sp.user?.name}</h2>
                  <p className="text-sm text-gray-500">{sp.user?.email}</p>
                </div>
                <div className="text-center">
                  <div className={`text-4xl font-black ${scoreColor}`}>{sp.performanceScore}</div>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 justify-center">
                    <Star size={10} className="text-amber-400" />
                    Performance Score
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Lead Conversion</span>
                    <span className="font-semibold text-violet-700">{sp.conversionRate}%</span>
                  </div>
                  <ScoreBar value={sp.conversionRate} color="bg-violet-500" />
                  <p className="text-xs text-gray-400 mt-1">{sp.convertedLeads}/{sp.totalLeads} leads converted</p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Quotation Accept Rate</span>
                    <span className="font-semibold text-blue-700">{sp.quotationAcceptRate}%</span>
                  </div>
                  <ScoreBar value={sp.quotationAcceptRate} color="bg-blue-500" />
                  <p className="text-xs text-gray-400 mt-1">{sp.acceptedQuotations}/{sp.totalQuotations} quotations accepted</p>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Leads"      value={sp.totalLeads}          sub="Assigned to me"               icon={Users}         color="bg-violet-500" />
              <StatCard label="Qualified"         value={sp.qualifiedLeads}      sub={`${sp.newLeads} new`}          icon={Target}        color="bg-blue-500"   />
              <StatCard label="Converted"         value={sp.convertedLeads}      sub="PO received / converted"      icon={CheckCircle2}  color="bg-emerald-500"/>
              <StatCard label="Quotations"        value={sp.totalQuotations}     sub={`${sp.pendingQuotations} pending`} icon={FileText}  color="bg-amber-500"  />
            </div>

            {/* Leads by stage */}
            {Object.keys(sp.leadsByStage).length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp size={15} className="text-gray-400" />
                  Leads by Stage
                </h2>
                <div className="space-y-3">
                  {Object.entries(sp.leadsByStage).map(([stage, count]) => {
                    const pct = sp.totalLeads ? Math.round((count / sp.totalLeads) * 100) : 0;
                    const colorMap: Record<string, string> = {
                      'New': 'bg-gray-400',
                      'OEM Submitted': 'bg-blue-400',
                      'OEM Approved': 'bg-indigo-400',
                      'OEM Rejected': 'bg-red-400',
                      'Quotation Sent': 'bg-amber-400',
                      'Negotiation': 'bg-orange-400',
                      'PO Received': 'bg-emerald-400',
                      'Converted': 'bg-violet-500',
                    };
                    return (
                      <div key={stage}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{stage}</span>
                          <span className="font-medium text-gray-800">{count} leads ({pct}%)</span>
                        </div>
                        <ScoreBar value={pct} color={colorMap[stage] || 'bg-gray-400'} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quotation breakdown */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText size={15} className="text-gray-400" />
                Quotation Breakdown
              </h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{sp.acceptedQuotations}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Accepted</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{sp.pendingQuotations}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Pending</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{sp.rejectedQuotations}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Rejected</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── ENGINEER / ADMIN VIEW ──
  const scoreColor = perf
    ? perf.performanceScore >= 80 ? 'text-emerald-600'
    : perf.performanceScore >= 60 ? 'text-amber-600'
    : 'text-red-500'
    : 'text-gray-400';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Engineer Performance</h1>
          <p className="text-sm text-gray-500">Visit completion, ticket resolution & training metrics</p>
        </div>
        {isAdmin && engineers.length > 0 && (
          <select
            className="input-field w-full sm:w-auto text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {engineers.map(e => (
              <option key={e._id} value={e._id}>{e.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <LoadingSpinner className="h-64" />
      ) : !perf ? (
        <div className="text-center text-gray-400 py-16">
          <BarChart2 size={40} className="mx-auto mb-2 opacity-30" />
          <p>No data available</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{perf.engineer?.name}</h2>
                <p className="text-sm text-gray-500">{perf.engineer?.email}</p>
              </div>
              <div className="text-center">
                <div className={`text-4xl font-black ${scoreColor}`}>{perf.performanceScore}</div>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 justify-center">
                  <Star size={10} className="text-amber-400" />
                  Performance Score
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Visit Completion</span>
                  <span className="font-semibold text-violet-700">{perf.completionRate}%</span>
                </div>
                <ScoreBar value={perf.completionRate} color="bg-violet-500" />
                <p className="text-xs text-gray-400 mt-1">{perf.completedVisits}/{perf.totalVisits} visits</p>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Ticket Resolution</span>
                  <span className="font-semibold text-blue-700">{perf.resolutionRate}%</span>
                </div>
                <ScoreBar value={perf.resolutionRate} color="bg-blue-500" />
                <p className="text-xs text-gray-400 mt-1">{perf.resolvedTickets}/{perf.totalTickets} tickets</p>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Training</span>
                  <span className="font-semibold text-emerald-700">
                    {perf.totalTrainings ? Math.round((perf.completedTrainings / perf.totalTrainings) * 100) : 0}%
                  </span>
                </div>
                <ScoreBar
                  value={perf.totalTrainings ? Math.round((perf.completedTrainings / perf.totalTrainings) * 100) : 0}
                  color="bg-emerald-500"
                />
                <p className="text-xs text-gray-400 mt-1">{perf.completedTrainings}/{perf.totalTrainings} trainings</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Visits"   value={perf.totalVisits}        sub="All time"                           icon={CalendarCheck} color="bg-violet-500" />
            <StatCard label="Scheduled"      value={perf.scheduledVisits}    sub="Upcoming"                           icon={Clock}         color="bg-blue-500"   />
            <StatCard label="Open Tickets"   value={perf.openTickets}        sub={`${perf.resolvedTickets} resolved`} icon={Headphones}    color="bg-amber-500"  />
            <StatCard label="Trainings Done" value={perf.completedTrainings} sub={`of ${perf.totalTrainings} total`} icon={BookOpen}      color="bg-emerald-500"/>
          </div>

          {Object.keys(perf.visitsByType).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Wrench size={15} className="text-gray-400" />
                Visits by Type
              </h2>
              <div className="space-y-3">
                {Object.entries(perf.visitsByType).map(([type, count]) => {
                  const pct = perf.totalVisits ? Math.round((count / perf.totalVisits) * 100) : 0;
                  const colorMap: Record<string, string> = {
                    Installation: 'bg-blue-400', Support: 'bg-violet-400',
                    Maintenance: 'bg-orange-400', Training: 'bg-emerald-400',
                  };
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{type}</span>
                        <span className="font-medium text-gray-800">{count} visits ({pct}%)</span>
                      </div>
                      <ScoreBar value={pct} color={colorMap[type] || 'bg-gray-400'} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={15} className="text-gray-400" />
              Visit Claims
            </h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{perf.completedVisits}</p>
                <p className="text-xs text-gray-500 mt-0.5">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{perf.hrApprovedVisits}</p>
                <p className="text-xs text-gray-500 mt-0.5">HR Approved</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-600">
                  ₹{perf.totalCharges.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Total Claimed</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
