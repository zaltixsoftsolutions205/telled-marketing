import { useEffect, useState, useCallback } from 'react';
import {
  Calendar, Plus, CheckCircle, XCircle, Clock, Settings,
  AlertTriangle, ChevronLeft, ChevronRight, Save, TrendingDown,
} from 'lucide-react';
import { leavesApi, LeavePolicy, LeaveBalance } from '@/api/leaves';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate } from '@/utils/formatters';
import type { Leave, User } from '@/types';

const LEAVE_TYPES = ['Casual', 'Sick', 'Annual', 'Unpaid'] as const;
type LeaveType = typeof LEAVE_TYPES[number];

const TYPE_META: Record<LeaveType, { color: string; bg: string; bar: string; light: string; dot: string }> = {
  Casual:  { color: 'text-blue-700',    bg: 'bg-blue-50',    bar: 'bg-blue-500',    light: 'bg-blue-100',    dot: 'bg-blue-400' },
  Sick:    { color: 'text-rose-700',    bg: 'bg-rose-50',    bar: 'bg-rose-500',    light: 'bg-rose-100',    dot: 'bg-rose-400' },
  Annual:  { color: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-500', light: 'bg-emerald-100', dot: 'bg-emerald-400' },
  Unpaid:  { color: 'text-gray-600',    bg: 'bg-gray-50',    bar: 'bg-gray-400',    light: 'bg-gray-100',    dot: 'bg-gray-400' },
};

const STATUS_STYLE: Record<string, { badge: string; icon: JSX.Element }> = {
  Pending:  { badge: 'bg-amber-100 text-amber-800',   icon: <Clock size={11} /> },
  Approved: { badge: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle size={11} /> },
  Rejected: { badge: 'bg-red-100 text-red-800',       icon: <XCircle size={11} /> },
};

const TYPE_BADGE: Record<string, string> = {
  Casual: 'bg-blue-100 text-blue-700',
  Sick:   'bg-rose-100 text-rose-700',
  Annual: 'bg-emerald-100 text-emerald-700',
  Unpaid: 'bg-gray-100 text-gray-600',
};

// ── Balance Card ───────────────────────────────────────────────────────────────
function BalanceCard({ type, data }: { type: LeaveType; data: { allocated: number; used: number; remaining: number } }) {
  const meta = TYPE_META[type];
  const pct = data.allocated > 0 ? Math.min(100, (data.used / data.allocated) * 100) : 0;
  const low = data.remaining <= 2 && data.allocated > 0;

  return (
    <div className="card !p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{type} Leave</p>
          <p className="text-3xl font-bold text-gray-900 mt-1 leading-none">{data.remaining}</p>
          <p className="text-xs text-gray-400 mt-0.5">days remaining</p>
        </div>
        <div className={`w-10 h-10 rounded-xl ${meta.light} flex items-center justify-center flex-shrink-0`}>
          <TrendingDown size={18} className={meta.color} />
        </div>
      </div>

      <div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${meta.bar}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-gray-400">
          <span>{data.used} used</span>
          <span className={low ? 'text-rose-500 font-medium' : ''}>{data.remaining}/{data.allocated}</span>
        </div>
      </div>

      {low && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 rounded-lg px-2.5 py-1.5">
          <AlertTriangle size={11} /> Low balance
        </div>
      )}
    </div>
  );
}

// ── Policy Editor ──────────────────────────────────────────────────────────────
function PolicyEditor({ onSaved }: { onSaved: () => void }) {
  const [policy, setPolicy] = useState<LeavePolicy>({ Casual: 12, Sick: 6, Annual: 15, Unpaid: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    leavesApi.getPolicy().then(p => { setPolicy(p); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await leavesApi.savePolicy(policy);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    } finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner className="h-32" />;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-gray-900">Annual Leave Entitlement</h3>
          <p className="text-xs text-gray-400 mt-0.5">Days each employee is entitled to per year</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
            <CheckCircle size={12} /> Saved
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {LEAVE_TYPES.map(type => {
          const meta = TYPE_META[type];
          return (
            <div key={type} className={`rounded-2xl ${meta.bg} border border-transparent p-4`}>
              <p className={`text-xs font-semibold ${meta.color} mb-3`}>{type} Leave</p>
              <input
                type="number" min={0} max={365}
                className="w-full text-center text-2xl font-bold bg-white border border-gray-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
                value={policy[type]}
                onChange={e => setPolicy(p => ({ ...p, [type]: Math.max(0, parseInt(e.target.value) || 0) }))}
              />
              <p className="text-center text-xs text-gray-400 mt-2">days / year</p>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save size={15} /> {saving ? 'Saving…' : 'Save Policy'}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LeavePage() {
  const user = useAuthStore(s => s.user);
  const isHR = user?.role === 'admin' || user?.role === 'hr';
  const isEmployee = user?.role === 'engineer' || user?.role === 'sales';

  const [activeTab, setActiveTab] = useState<'requests' | 'policy'>('requests');
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<User[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [balanceYear, setBalanceYear] = useState(new Date().getFullYear());

  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');

  const [showApply, setShowApply] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type: 'Casual' as LeaveType,
    startDate: '', endDate: '', days: '', reason: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.type = filterType;
      if (filterEmployee && isHR) params.employeeId = filterEmployee;
      const res = await leavesApi.getAll(params);
      setLeaves(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch { setLeaves([]); setTotal(0); }
    finally { setLoading(false); }
  }, [page, filterStatus, filterType, filterEmployee, isHR]);

  const loadBalance = useCallback(async () => {
    try { setBalance(await leavesApi.getBalance({ year: balanceYear })); } catch {}
  }, [balanceYear]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadBalance(); }, [loadBalance]);
  useEffect(() => {
    if (isHR) usersApi.getEngineers().then(e => setEmployees(e || [])).catch(() => {});
  }, [isHR]);

  useEffect(() => {
    if (form.startDate && form.endDate) {
      const diff = Math.max(1, Math.floor((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000) + 1);
      setForm(f => ({ ...f, days: String(diff) }));
    }
  }, [form.startDate, form.endDate]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await leavesApi.apply({ type: form.type, startDate: form.startDate, endDate: form.endDate, days: Number(form.days), reason: form.reason });
      setShowApply(false);
      setForm({ type: 'Casual', startDate: '', endDate: '', days: '', reason: '' });
      load(); loadBalance();
    } finally { setSaving(false); }
  };

  const handleApprove = async (leave: Leave) => {
    try { await leavesApi.approve(leave._id); load(); loadBalance(); } catch {}
  };

  const openReject = (leave: Leave) => { setSelectedLeave(leave); setRejectionReason(''); setShowReject(true); };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeave) return;
    setSaving(true);
    try {
      await leavesApi.reject(selectedLeave._id, { rejectionReason });
      setShowReject(false); setSelectedLeave(null); load();
    } finally { setSaving(false); }
  };

  const pending  = leaves.filter(l => l.status === 'Pending').length;
  const approved = leaves.filter(l => l.status === 'Approved').length;
  const rejected = leaves.filter(l => l.status === 'Rejected').length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">Leave Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} total requests</p>
        </div>
        <div className="flex items-center gap-2">
          {isHR && (
            <button
              onClick={() => setActiveTab(t => t === 'policy' ? 'requests' : 'policy')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                activeTab === 'policy'
                  ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600'
              }`}
            >
              <Settings size={15} /> Leave Policy
            </button>
          )}
          {(isEmployee || isHR) && (
            <button onClick={() => setShowApply(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Apply Leave
            </button>
          )}
        </div>
      </div>

      {/* ── Policy Editor ── */}
      {isHR && activeTab === 'policy' && <PolicyEditor onSaved={loadBalance} />}

      {/* ── Balance Cards ── */}
      {balance && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {isEmployee ? 'My Leave Balance' : 'Leave Balance Overview'}
            </h2>
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1 py-1">
              <button onClick={() => setBalanceYear(y => y - 1)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <ChevronLeft size={15} className="text-gray-500" />
              </button>
              <span className="text-sm font-semibold text-gray-700 px-2">{balanceYear}</span>
              <button onClick={() => setBalanceYear(y => y + 1)} disabled={balanceYear >= new Date().getFullYear()}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30">
                <ChevronRight size={15} className="text-gray-500" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {LEAVE_TYPES.map(type => (
              <BalanceCard key={type} type={type} data={balance[type]} />
            ))}
          </div>
        </div>
      )}

      {/* ── HR Summary Stats ── */}
      {isHR && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pending Approval', value: pending,  icon: <Clock size={16} />,        bg: 'bg-amber-100',   color: 'text-amber-600' },
            { label: 'Approved',         value: approved, icon: <CheckCircle size={16} />,   bg: 'bg-emerald-100', color: 'text-emerald-600' },
            { label: 'Rejected',         value: rejected, icon: <XCircle size={16} />,       bg: 'bg-red-100',     color: 'text-red-500' },
          ].map(s => (
            <div key={s.label} className="card !p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0 ${s.color}`}>
                {s.icon}
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 leading-none">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters + Table ── */}
      {activeTab === 'requests' && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2">
            {['', 'Pending', 'Approved', 'Rejected'].map(s => (
              <button key={s}
                onClick={() => { setFilterStatus(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  filterStatus === s
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600'
                }`}>
                {s || 'All'}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-1 self-stretch" />
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
              className="input-field !py-1.5 !text-xs w-auto">
              <option value="">All Types</option>
              {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {isHR && (
              <select value={filterEmployee} onChange={e => { setFilterEmployee(e.target.value); setPage(1); }}
                className="input-field !py-1.5 !text-xs w-auto">
                <option value="">All Employees</option>
                {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
              </select>
            )}
          </div>

          {/* Desktop table */}
          <div className="card !p-0 overflow-hidden hidden md:block">
            {loading ? <LoadingSpinner className="h-48" /> : leaves.length === 0 ? (
              <div className="text-center text-gray-400 py-16 flex flex-col items-center gap-2">
                <Calendar size={36} className="opacity-30" />
                <p className="text-sm">No leave records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {isHR && <th className="table-header">Employee</th>}
                      <th className="table-header">Type</th>
                      <th className="table-header">Period</th>
                      <th className="table-header text-center">Days</th>
                      <th className="table-header">Reason</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Applied On</th>
                      {isHR && <th className="table-header text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {leaves.map(leave => {
                      const emp = leave.employeeId as User;
                      const ss = STATUS_STYLE[leave.status] || STATUS_STYLE['Pending'];
                      return (
                        <tr key={leave._id} className="hover:bg-violet-50/20 transition-colors">
                          {isHR && (
                            <td className="table-cell">
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{emp?.name || '—'}</p>
                                <p className="text-xs text-gray-400">{emp?.email}</p>
                              </div>
                            </td>
                          )}
                          <td className="table-cell">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${TYPE_BADGE[leave.type] || 'bg-gray-100 text-gray-600'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${TYPE_META[leave.type as LeaveType]?.dot}`} />
                              {leave.type}
                            </span>
                          </td>
                          <td className="table-cell">
                            <p className="text-sm text-gray-700">{formatDate(leave.startDate)}</p>
                            <p className="text-xs text-gray-400">to {formatDate(leave.endDate)}</p>
                          </td>
                          <td className="table-cell text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gray-50 text-sm font-bold text-gray-800">
                              {leave.days}
                            </span>
                          </td>
                          <td className="table-cell text-gray-400 text-xs max-w-[160px] truncate" title={leave.reason}>
                            {leave.reason || '—'}
                          </td>
                          <td className="table-cell">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${ss.badge}`}>
                              {ss.icon} {leave.status}
                            </span>
                            {leave.rejectionReason && (
                              <p className="text-xs text-red-400 mt-0.5 flex items-center gap-1">
                                <AlertTriangle size={10} /> {leave.rejectionReason}
                              </p>
                            )}
                          </td>
                          <td className="table-cell text-gray-400 text-xs whitespace-nowrap">{formatDate(leave.createdAt)}</td>
                          {isHR && (
                            <td className="table-cell">
                              {leave.status === 'Pending' ? (
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => handleApprove(leave)}
                                    className="flex items-center gap-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                                    <CheckCircle size={11} /> Approve
                                  </button>
                                  <button onClick={() => openReject(leave)}
                                    className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                                    <XCircle size={11} /> Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {total > 20 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</p>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
                  <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile card view */}
          {loading ? (
            <LoadingSpinner className="h-48 md:hidden" />
          ) : leaves.length === 0 ? (
            <div className="md:hidden text-center text-gray-400 py-16 card flex flex-col items-center gap-2">
              <Calendar size={36} className="opacity-30" />
              <p className="text-sm">No leave records found</p>
            </div>
          ) : (
            <div className="md:hidden space-y-3">
              {leaves.map(leave => {
                const emp = leave.employeeId as User;
                const ss = STATUS_STYLE[leave.status] || STATUS_STYLE['Pending'];
                return (
                  <div key={leave._id} className="card !p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {isHR && <p className="font-semibold text-gray-900 text-sm">{emp?.name || '—'}</p>}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium ${TYPE_BADGE[leave.type] || 'bg-gray-100 text-gray-600'} mt-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${TYPE_META[leave.type as LeaveType]?.dot}`} />
                          {leave.type}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${ss.badge}`}>
                        {ss.icon} {leave.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                      <Calendar size={12} className="text-gray-400 flex-shrink-0" />
                      <span>{formatDate(leave.startDate)} — {formatDate(leave.endDate)}</span>
                      <span className="ml-auto font-bold text-gray-700">{leave.days}d</span>
                    </div>

                    {leave.reason && (
                      <p className="text-xs text-gray-400 truncate">{leave.reason}</p>
                    )}
                    {leave.rejectionReason && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle size={10} /> {leave.rejectionReason}
                      </p>
                    )}

                    {isHR && leave.status === 'Pending' && (
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                        <button onClick={() => handleApprove(leave)}
                          className="flex-1 flex items-center justify-center gap-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-1.5 rounded-lg font-medium">
                          <CheckCircle size={11} /> Approve
                        </button>
                        <button onClick={() => openReject(leave)}
                          className="flex-1 flex items-center justify-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-1.5 rounded-lg font-medium">
                          <XCircle size={11} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {total > 20 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</p>
                  <div className="flex gap-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
                    <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Apply Leave Modal ── */}
      <Modal isOpen={showApply} onClose={() => setShowApply(false)} title="Apply for Leave">
        <form onSubmit={handleApply} className="space-y-4">
          {balance && (
            <div className="grid grid-cols-4 gap-2">
              {LEAVE_TYPES.map(type => {
                const meta = TYPE_META[type];
                const b = balance[type];
                const selected = form.type === type;
                return (
                  <button key={type} type="button"
                    onClick={() => setForm(f => ({ ...f, type }))}
                    className={`rounded-xl p-3 border-2 text-center transition-all ${
                      selected ? `border-violet-500 ${meta.bg}` : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                    }`}>
                    <div className={`w-2 h-2 rounded-full ${meta.dot} mx-auto mb-1.5`} />
                    <div className={`text-xs font-semibold ${selected ? meta.color : 'text-gray-600'}`}>{type}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{b.remaining}d left</div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date *</label>
              <input required type="date" className="input-field" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="label">End Date *</label>
              <input required type="date" className="input-field" value={form.endDate} min={form.startDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>

          {form.days && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm border ${
              balance && Number(form.days) > balance[form.type].remaining
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-violet-50 border-violet-100 text-violet-700'
            }`}>
              <Calendar size={14} />
              <span className="font-medium">{form.days} day{Number(form.days) !== 1 ? 's' : ''} selected</span>
              {balance && Number(form.days) > balance[form.type].remaining && (
                <span className="ml-auto text-xs flex items-center gap-1">
                  <AlertTriangle size={11} /> Exceeds balance ({balance[form.type].remaining} left)
                </span>
              )}
            </div>
          )}

          <div>
            <label className="label">Reason *</label>
            <textarea required rows={3} className="input-field" value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Describe the reason for leave…" />
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowApply(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Reject Modal ── */}
      <Modal isOpen={showReject} onClose={() => setShowReject(false)} title="Reject Leave Request">
        <form onSubmit={handleReject} className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <XCircle size={16} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900">{(selectedLeave?.employeeId as User)?.name}</p>
              <p className="text-xs text-red-500 mt-0.5">
                {selectedLeave?.type} · {selectedLeave?.days} day(s) · {formatDate(selectedLeave?.startDate || '')} – {formatDate(selectedLeave?.endDate || '')}
              </p>
            </div>
          </div>
          <div>
            <label className="label">Rejection Reason *</label>
            <textarea required rows={3} className="input-field" value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Provide a reason for rejection…" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowReject(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50">
              {saving ? 'Rejecting…' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
