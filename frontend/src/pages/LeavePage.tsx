import { useEffect, useState, useCallback } from 'react';
import {
  Calendar, Plus, CheckCircle, XCircle, Clock, Settings,
  AlertTriangle, ChevronLeft, ChevronRight, Save,
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

const TYPE_META: Record<LeaveType, { color: string; bg: string; bar: string; light: string; icon: string }> = {
  Casual:  { color: 'text-blue-700',   bg: 'bg-blue-50',   bar: 'bg-blue-500',   light: 'bg-blue-100',  icon: '🏖️' },
  Sick:    { color: 'text-rose-700',   bg: 'bg-rose-50',   bar: 'bg-rose-500',   light: 'bg-rose-100',  icon: '🤒' },
  Annual:  { color: 'text-emerald-700',bg: 'bg-emerald-50',bar: 'bg-emerald-500',light: 'bg-emerald-100',icon: '🌴' },
  Unpaid:  { color: 'text-gray-600',   bg: 'bg-gray-50',   bar: 'bg-gray-400',   light: 'bg-gray-100',  icon: '📋' },
};

const statusColors: Record<string, string> = {
  Pending:  'bg-amber-100 text-amber-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-red-100 text-red-800',
};
const typeColors: Record<string, string> = {
  Casual: 'bg-blue-100 text-blue-800',
  Sick:   'bg-rose-100 text-rose-800',
  Annual: 'bg-emerald-100 text-emerald-800',
  Unpaid: 'bg-gray-100 text-gray-700',
};

// ── Balance Card ───────────────────────────────────────────────────────────────
function BalanceCard({ type, data }: { type: LeaveType; data: { allocated: number; used: number; remaining: number } }) {
  const meta = TYPE_META[type];
  const pct = data.allocated > 0 ? Math.min(100, (data.used / data.allocated) * 100) : 0;
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden`}>
      <div className={`px-5 pt-5 pb-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{meta.icon}</span>
            <span className={`text-sm font-semibold ${meta.color}`}>{type} Leave</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.light} ${meta.color}`}>
            {data.allocated} days/yr
          </span>
        </div>

        <div className="flex items-end gap-1 mb-1">
          <span className="text-3xl font-bold text-gray-900">{data.remaining}</span>
          <span className="text-sm text-gray-400 mb-1">remaining</span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${meta.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{data.used} used</span>
          <span>{data.allocated} allocated</span>
        </div>
      </div>
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
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="h-32" />;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-gray-900 text-base">Annual Leave Entitlement</h3>
          <p className="text-xs text-gray-400 mt-0.5">Set the number of days each employee is entitled to per year</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
            <CheckCircle size={12} /> Saved successfully
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {LEAVE_TYPES.map(type => {
          const meta = TYPE_META[type];
          return (
            <div key={type} className={`rounded-2xl border-2 border-transparent ${meta.bg} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{meta.icon}</span>
                <span className={`text-sm font-semibold ${meta.color}`}>{type}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={365}
                  className="w-full text-center text-2xl font-bold bg-white border border-gray-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={policy[type]}
                  onChange={e => setPolicy(p => ({ ...p, [type]: Math.max(0, parseInt(e.target.value) || 0) }))}
                />
              </div>
              <p className="text-center text-xs text-gray-400 mt-2">days / year</p>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save size={15} />
          {saving ? 'Saving…' : 'Save Policy'}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LeavePage() {
  const user = useAuthStore(s => s.user);
  const isHR = user?.role === 'admin' || user?.role === 'hr_finance';
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
    startDate: '',
    endDate: '',
    days: '',
    reason: '',
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
    } catch {
      setLeaves([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterType, filterEmployee, isHR]);

  const loadBalance = useCallback(async () => {
    try {
      const b = await leavesApi.getBalance({ year: balanceYear });
      setBalance(b);
    } catch {}
  }, [balanceYear]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadBalance(); }, [loadBalance]);
  useEffect(() => {
    if (isHR) {
      usersApi.getEngineers().then(e => setEmployees(e || [])).catch(() => {});
    }
  }, [isHR]);

  useEffect(() => {
    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);
      const diff = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
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
      load();
      loadBalance();
    } finally {
      setSaving(false);
    }
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
      setShowReject(false);
      setSelectedLeave(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const pending  = leaves.filter(l => l.status === 'Pending').length;
  const approved = leaves.filter(l => l.status === 'Approved').length;
  const rejected = leaves.filter(l => l.status === 'Rejected').length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">Leave Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} records</p>
        </div>
        <div className="flex items-center gap-2">
          {isHR && (
            <button
              onClick={() => setActiveTab(t => t === 'policy' ? 'requests' : 'policy')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                activeTab === 'policy'
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300'
              }`}
            >
              <Settings size={15} />
              Leave Policy
            </button>
          )}
          {(isEmployee || isHR) && (
            <button onClick={() => setShowApply(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Apply Leave
            </button>
          )}
        </div>
      </div>

      {/* Policy Editor (HR only) */}
      {isHR && activeTab === 'policy' && (
        <PolicyEditor onSaved={loadBalance} />
      )}

      {/* Leave Balance Cards — employee view + HR summary */}
      {balance && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              {isEmployee ? 'My Leave Balance' : 'Balance Overview'}
            </h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <button onClick={() => setBalanceYear(y => y - 1)} className="p-1 rounded-lg hover:bg-gray-100">
                <ChevronLeft size={16} />
              </button>
              <span className="font-medium text-gray-700 w-12 text-center">{balanceYear}</span>
              <button onClick={() => setBalanceYear(y => y + 1)} className="p-1 rounded-lg hover:bg-gray-100" disabled={balanceYear >= new Date().getFullYear()}>
                <ChevronRight size={16} />
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

      {/* HR Stats Row */}
      {isHR && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card flex items-center gap-4 !p-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Clock size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pending}</p>
              <p className="text-xs text-gray-400">Pending</p>
            </div>
          </div>
          <div className="card flex items-center gap-4 !p-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{approved}</p>
              <p className="text-xs text-gray-400">Approved</p>
            </div>
          </div>
          <div className="card flex items-center gap-4 !p-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <XCircle size={18} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{rejected}</p>
              <p className="text-xs text-gray-400">Rejected</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {activeTab === 'requests' && (
        <div className="flex flex-wrap gap-3">
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="input-field w-auto">
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} className="input-field w-auto">
            <option value="">All Types</option>
            {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {isHR && (
            <select value={filterEmployee} onChange={e => { setFilterEmployee(e.target.value); setPage(1); }} className="input-field w-auto">
              <option value="">All Employees</option>
              {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Leave Table */}
      {activeTab === 'requests' && (
        <div className="card !p-0 overflow-hidden">
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
                    <th className="table-header">Start</th>
                    <th className="table-header">End</th>
                    <th className="table-header">Days</th>
                    <th className="table-header">Reason</th>
                    <th className="table-header">Status</th>
                    {isHR && <th className="table-header">Rejection Reason</th>}
                    <th className="table-header">Applied</th>
                    {isHR && <th className="table-header">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leaves.map(leave => {
                    const emp = leave.employeeId as User;
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
                          <span className={`badge ${typeColors[leave.type] || 'bg-gray-100 text-gray-700'}`}>
                            {TYPE_META[leave.type as LeaveType]?.icon} {leave.type}
                          </span>
                        </td>
                        <td className="table-cell text-gray-500">{formatDate(leave.startDate)}</td>
                        <td className="table-cell text-gray-500">{formatDate(leave.endDate)}</td>
                        <td className="table-cell text-center">
                          <span className="font-bold text-gray-800">{leave.days}</span>
                        </td>
                        <td className="table-cell text-gray-400 text-xs max-w-[180px] truncate" title={leave.reason}>
                          {leave.reason}
                        </td>
                        <td className="table-cell">
                          <span className={`badge ${statusColors[leave.status] || 'bg-gray-100'}`}>
                            {leave.status === 'Pending' && <Clock size={10} className="inline mr-1" />}
                            {leave.status === 'Approved' && <CheckCircle size={10} className="inline mr-1" />}
                            {leave.status === 'Rejected' && <XCircle size={10} className="inline mr-1" />}
                            {leave.status}
                          </span>
                        </td>
                        {isHR && (
                          <td className="table-cell text-xs text-gray-400">
                            {leave.rejectionReason ? (
                              <span className="flex items-start gap-1 text-red-600">
                                <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                                {leave.rejectionReason}
                              </span>
                            ) : '—'}
                          </td>
                        )}
                        <td className="table-cell text-gray-400 text-xs">{formatDate(leave.createdAt)}</td>
                        {isHR && (
                          <td className="table-cell">
                            {leave.status === 'Pending' ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleApprove(leave)}
                                  className="flex items-center gap-1 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                                >
                                  <CheckCircle size={11} /> Approve
                                </button>
                                <button
                                  onClick={() => openReject(leave)}
                                  className="flex items-center gap-1 text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                                >
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
      )}

      {/* Apply Leave Modal */}
      <Modal isOpen={showApply} onClose={() => setShowApply(false)} title="Apply for Leave">
        <form onSubmit={handleApply} className="space-y-4">
          {/* Balance hint */}
          {balance && (
            <div className="grid grid-cols-4 gap-2">
              {LEAVE_TYPES.map(type => {
                const meta = TYPE_META[type];
                const b = balance[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type }))}
                    className={`rounded-xl p-2 border-2 text-center transition-all ${
                      form.type === type ? `border-violet-500 ${meta.bg}` : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="text-base">{meta.icon}</div>
                    <div className={`text-xs font-semibold ${meta.color}`}>{type}</div>
                    <div className="text-xs text-gray-400">{b.remaining} left</div>
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
            <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-4 py-2.5 text-sm">
              <Calendar size={14} className="text-violet-500" />
              <span className="text-violet-700 font-medium">{form.days} day{Number(form.days) !== 1 ? 's' : ''} selected</span>
              {balance && Number(form.days) > balance[form.type].remaining && (
                <span className="ml-auto text-xs text-rose-600 flex items-center gap-1">
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
              {saving ? 'Submitting…' : 'Apply Leave'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={showReject} onClose={() => setShowReject(false)} title="Reject Leave Request">
        <form onSubmit={handleReject} className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
            <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">
                {(selectedLeave?.employeeId as User)?.name}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                {selectedLeave?.type} leave · {selectedLeave?.days} day(s) · {formatDate(selectedLeave?.startDate || '')} – {formatDate(selectedLeave?.endDate || '')}
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
            <button type="submit" disabled={saving} className="btn-primary bg-red-600 hover:bg-red-700">
              {saving ? 'Rejecting…' : 'Reject Leave'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
