import { useEffect, useState, useCallback } from 'react';
import {
  BarChart2, CheckCircle2, Clock, Wrench, BookOpen, Star,
  TrendingUp, Users, CalendarCheck, Headphones,
} from 'lucide-react';
import { engineerVisitsApi } from '@/api/engineerVisits';
import { supportApi } from '@/api/support';
import { trainingApi } from '@/api/training';
import { usersApi } from '@/api/users';
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
  const isAdmin = user?.role === 'admin';

  const [engineers, setEngineers] = useState<User[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [perf, setPerf] = useState<EngPerf | null>(null);
  const [loading, setLoading] = useState(false);
  const [engLoading, setEngLoading] = useState(true);

  // Load engineers list (admin sees all, engineer sees self)
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

  const loadPerf = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      // Fetch visits for this engineer
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

      const resolvedTickets  = allTickets.filter((t: any) => t.status === 'Resolved' || t.status === 'Closed').length;
      const openTickets      = allTickets.filter((t: any) => t.status === 'Open' || t.status === 'In Progress').length;
      const completedTrain   = allTrainings.filter((t: any) => t.status === 'Completed').length;

      const completionRate = engineerVisits.length
        ? Math.round((completed.length / engineerVisits.length) * 100)
        : 0;
      const resolutionRate = allTickets.length
        ? Math.round((resolvedTickets / allTickets.length) * 100)
        : 0;

      // Performance score: weighted composite
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

  useEffect(() => { loadPerf(); }, [loadPerf]);

  const scoreColor = perf
    ? perf.performanceScore >= 80 ? 'text-emerald-600'
    : perf.performanceScore >= 60 ? 'text-amber-600'
    : 'text-red-500'
    : 'text-gray-400';

  if (engLoading) return <LoadingSpinner className="h-64" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Engineer Performance</h1>
          <p className="text-sm text-gray-500">Visit completion, ticket resolution & training metrics</p>
        </div>
        {isAdmin && engineers.length > 0 && (
          <select
            className="input-field w-auto text-sm"
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
          {/* Performance Score */}
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

            <div className="grid grid-cols-3 gap-6">
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

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Visits"     value={perf.totalVisits}     sub="All time"                          icon={CalendarCheck}  color="bg-violet-500" />
            <StatCard label="Scheduled"        value={perf.scheduledVisits} sub="Upcoming"                          icon={Clock}          color="bg-blue-500"   />
            <StatCard label="Open Tickets"     value={perf.openTickets}     sub={`${perf.resolvedTickets} resolved`} icon={Headphones}     color="bg-amber-500"  />
            <StatCard label="Trainings Done"   value={perf.completedTrainings} sub={`of ${perf.totalTrainings} total`} icon={BookOpen}    color="bg-emerald-500"/>
          </div>

          {/* Visits by type */}
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
                    Installation: 'bg-blue-400',
                    Support: 'bg-violet-400',
                    Maintenance: 'bg-orange-400',
                    Training: 'bg-emerald-400',
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

          {/* HR Approval stats */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={15} className="text-gray-400" />
              Visit Claims
            </h2>
            <div className="grid grid-cols-3 gap-4 text-center">
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
