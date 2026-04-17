import { useEffect, useState, useCallback } from 'react';
import { Calendar, Plus, CheckCircle, XCircle, Clock } from 'lucide-react';
import ExcelImportButton from '@/components/common/ExcelImportButton';
import { leavesApi } from '@/api/leaves';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate } from '@/utils/formatters';
import type { Leave, User } from '@/types';

const LEAVE_TYPES = ['Casual', 'Sick', 'Annual', 'Unpaid'] as const;

const typeColors: Record<string, string> = {
  Casual: 'bg-blue-100 text-blue-800',
  Sick: 'bg-red-100 text-red-800',
  Annual: 'bg-green-100 text-green-800',
  Unpaid: 'bg-gray-100 text-gray-700',
};

const statusColors: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
};

export default function LeavePage() {
  const user = useAuthStore((s) => s.user);
  const isHR = user?.role === 'admin' || user?.role === 'hr_finance';
  const isEngineer = user?.role === 'engineer';

  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<User[]>([]);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');

  const [showApply, setShowApply] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type: 'Casual' as typeof LEAVE_TYPES[number],
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
    } catch (e) {
      console.error('LeavePage load:', e);
      setLeaves([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterType, filterEmployee, isHR]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isHR) {
      usersApi.getEngineers().then(e => setEmployees(e || [])).catch(() => {});
    }
  }, [isHR]);

  // Auto-calc days when dates change
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
      await leavesApi.apply({
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        days: Number(form.days),
        reason: form.reason,
      });
      setShowApply(false);
      setForm({ type: 'Casual', startDate: '', endDate: '', days: '', reason: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (leave: Leave) => {
    try {
      await leavesApi.approve(leave._id);
      load();
    } catch (e) {
      console.error('approve error', e);
    }
  };

  const openReject = (leave: Leave) => {
    setSelectedLeave(leave);
    setRejectionReason('');
    setShowReject(true);
  };

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

  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const monthLeaves = leaves.filter(l => {
    const d = new Date(l.startDate);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const pending = leaves.filter(l => l.status === 'Pending').length;
  const approved = leaves.filter(l => l.status === 'Approved').length;
  const rejected = leaves.filter(l => l.status === 'Rejected').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Leave Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} records</p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelImportButton
            entityName="Leaves"
            columnHint="type (Casual/Sick/Annual/Unpaid), startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), days, reason"
            onImport={async (rows) => {
              let imported = 0;
              for (const row of rows) {
                const startDate = row.startDate || row['start date'] || row.from || '';
                const endDate   = row.endDate   || row['end date']   || row.to   || '';
                if (!startDate || !endDate) continue;
                const t = row.type || row.Type || 'Casual';
                const type = (['Casual','Sick','Annual','Unpaid'].includes(t) ? t : 'Casual') as 'Casual'|'Sick'|'Annual'|'Unpaid';
                try {
                  await leavesApi.apply({ type, startDate, endDate, days: parseInt(row.days || '1'), reason: row.reason || '' });
                  imported++;
                } catch { /* skip */ }
              }
              load();
              return { imported };
            }}
          />
          {(isEngineer || isHR) && (
            <button onClick={() => setShowApply(true)} className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700">
              <Plus size={16} /> Apply Leave
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Calendar size={18} className="text-violet-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{monthLeaves.length}</p>
            <p className="text-xs text-gray-400">This Month</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{pending}</p>
            <p className="text-xs text-gray-400">Pending</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{approved}</p>
            <p className="text-xs text-gray-400">Approved</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <XCircle size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{rejected}</p>
            <p className="text-xs text-gray-400">Rejected</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Types</option>
          {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {isHR && (
          <select value={filterEmployee} onChange={(e) => { setFilterEmployee(e.target.value); setPage(1); }} className="input-field w-auto">
            <option value="">All Employees</option>
            {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : leaves.length === 0 ? (
          <div className="text-center text-gray-400 py-16 flex flex-col items-center gap-2">
            <Calendar size={36} className="opacity-30" />
            <p>No leave records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Employee</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Start Date</th>
                  <th className="table-header">End Date</th>
                  <th className="table-header">Days</th>
                  <th className="table-header">Reason</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Applied On</th>
                  {isHR && <th className="table-header">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leaves.map((leave) => {
                  const emp = leave.employeeId as User;
                  return (
                    <tr key={leave._id} className="hover:bg-violet-50/20 transition-colors">
                      <td className="table-cell font-medium">{emp?.name || '—'}</td>
                      <td className="table-cell">
                        <span className={`badge ${typeColors[leave.type] || 'bg-gray-100 text-gray-700'}`}>{leave.type}</span>
                      </td>
                      <td className="table-cell text-gray-500">{formatDate(leave.startDate)}</td>
                      <td className="table-cell text-gray-500">{formatDate(leave.endDate)}</td>
                      <td className="table-cell text-center font-semibold">{leave.days}</td>
                      <td className="table-cell text-gray-400 text-xs max-w-xs truncate" title={leave.reason}>
                        {leave.reason.length > 40 ? leave.reason.slice(0, 40) + '…' : leave.reason}
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${statusColors[leave.status] || 'bg-gray-100'}`}>{leave.status}</span>
                      </td>
                      <td className="table-cell text-gray-400">{formatDate(leave.createdAt)}</td>
                      {isHR && (
                        <td className="table-cell">
                          {leave.status === 'Pending' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApprove(leave)}
                                className="flex items-center gap-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded-lg font-medium"
                              >
                                <CheckCircle size={12} /> Approve
                              </button>
                              <button
                                onClick={() => openReject(leave)}
                                className="flex items-center gap-1 text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded-lg font-medium"
                              >
                                <XCircle size={12} /> Reject
                              </button>
                            </div>
                          )}
                          {leave.status !== 'Pending' && <span className="text-gray-300 text-xs">—</span>}
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

      {/* Apply Leave Modal */}
      <Modal isOpen={showApply} onClose={() => setShowApply(false)} title="Apply for Leave">
        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <label className="label">Leave Type *</label>
            <select
              required
              className="input-field"
              value={form.type}
              onChange={(e) => setForm(f => ({ ...f, type: e.target.value as typeof LEAVE_TYPES[number] }))}
            >
              {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date *</label>
              <input
                required
                type="date"
                className="input-field"
                value={form.startDate}
                onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">End Date *</label>
              <input
                required
                type="date"
                className="input-field"
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Days</label>
            <input
              type="number"
              className="input-field bg-gray-50"
              value={form.days}
              readOnly
              placeholder="Auto-calculated"
            />
          </div>
          <div>
            <label className="label">Reason *</label>
            <textarea
              required
              rows={3}
              className="input-field"
              value={form.reason}
              onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Describe the reason for leave…"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowApply(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary bg-green-600 hover:bg-green-700">
              {saving ? 'Submitting…' : 'Apply Leave'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={showReject} onClose={() => setShowReject(false)} title="Reject Leave">
        <form onSubmit={handleReject} className="space-y-4">
          <p className="text-sm text-gray-600">
            Rejecting leave for <strong>{(selectedLeave?.employeeId as User)?.name}</strong> — {selectedLeave?.days} day(s)
          </p>
          <div>
            <label className="label">Rejection Reason *</label>
            <textarea
              required
              rows={3}
              className="input-field"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Provide a reason for rejection…"
            />
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
