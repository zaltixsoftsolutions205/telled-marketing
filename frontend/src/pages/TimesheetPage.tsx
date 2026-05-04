import { useEffect, useState, useCallback } from 'react';
import { Clock, Plus, Trash2, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { timesheetApi } from '@/api/timesheet';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate } from '@/utils/formatters';
import type { User } from '@/types';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const statusColors: Record<string, string> = {
  Submitted: 'bg-blue-100 text-blue-700',
  Approved:  'bg-green-100 text-green-700',
  Rejected:  'bg-red-100 text-red-700',
};


export default function TimesheetPage() {
  const user = useAuthStore((s) => s.user);
  const isManager = user?.role === 'admin' || user?.role === 'hr_finance';

  const now = new Date();
  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [employees, setEmployees] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: now.toISOString().slice(0, 10),
    taskType: '',
    description: '',
    hoursWorked: '',
    project: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20, month: filterMonth, year: filterYear };
      if (filterStatus) params.status = filterStatus;
      if (filterUser) params.userId = filterUser;
      else if (!isManager) params.userId = user?._id;
      const res = await timesheetApi.getAll(params);
      setEntries(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch {
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filterMonth, filterYear, filterStatus, filterUser, isManager, user?._id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isManager) {
      usersApi.getAll({ limit: 200 })
        .then(r => setEmployees((r.data || []).filter((u: User) => u.role !== 'admin')))
        .catch(() => {});
    }
  }, [isManager]);

  const openAdd = () => {
    setEditEntry(null);
    setForm({ date: now.toISOString().slice(0, 10), taskType: '', description: '', hoursWorked: '', project: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (entry: any) => {
    setEditEntry(entry);
    setForm({
      date: entry.date?.slice(0, 10) || '',
      taskType: entry.taskType || 'Development',
      description: entry.description || '',
      hoursWorked: String(entry.hoursWorked || ''),
      project: entry.project || '',
      notes: entry.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, hoursWorked: Number(form.hoursWorked) };
      if (editEntry) await timesheetApi.update(editEntry._id, body);
      else await timesheetApi.create(body);
      setShowModal(false);
      load();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this timesheet entry?')) return;
    await timesheetApi.delete(id);
    load();
  };

  const handleApprove = async (id: string) => {
    await timesheetApi.approve(id);
    load();
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    await timesheetApi.reject(rejectModal.id, rejectReason);
    setRejectModal(null);
    setRejectReason('');
    load();
  };

  // Summary stats for the filtered period
  const totalHours = entries.reduce((sum: number, e: any) => sum + (Number(e.hoursWorked) || 0), 0);
  const approvedHours = entries.filter((e: any) => e.status === 'Approved').reduce((sum: number, e: any) => sum + (Number(e.hoursWorked) || 0), 0);
  const pendingCount = entries.filter((e: any) => e.status === 'Submitted').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Timesheet</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} entries · {MONTHS_SHORT[filterMonth - 1]} {filterYear}</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Log Time
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Hours', value: `${totalHours}h`, color: 'text-violet-600', bg: 'bg-violet-100' },
          { label: 'Approved Hours', value: `${approvedHours}h`, color: 'text-green-600', bg: 'bg-green-100' },
          { label: 'Pending Approval', value: pendingCount, color: 'text-blue-600', bg: 'bg-blue-100' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="glass-card flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Clock size={18} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {isManager && (
          <select value={filterUser} onChange={(e) => { setFilterUser(e.target.value); setPage(1); }} className="input-field w-auto">
            <option value="">All Employees</option>
            {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name} ({emp.role})</option>)}
          </select>
        )}
        <select value={filterMonth} onChange={(e) => { setFilterMonth(Number(e.target.value)); setPage(1); }} className="input-field w-auto">
          {MONTHS_SHORT.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={filterYear} onChange={(e) => { setFilterYear(Number(e.target.value)); setPage(1); }} className="input-field w-28" min={2020} max={2099} />
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Statuses</option>
          <option value="Submitted">Submitted</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card !p-0 overflow-hidden hidden md:block">
        {loading ? <LoadingSpinner className="h-48" /> : entries.length === 0 ? (
          <div className="text-center text-gray-400 py-16 flex flex-col items-center gap-2">
            <Clock size={36} className="opacity-30" />
            <p>No timesheet entries for this period</p>
            <button onClick={openAdd} className="btn-primary mt-2 flex items-center gap-2">
              <Plus size={14} /> Log your first entry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {isManager && <th className="table-header">Employee</th>}
                  <th className="table-header">Date</th>
                  <th className="table-header">Task Type</th>
                  <th className="table-header">Description</th>
                  <th className="table-header">Project</th>
                  <th className="table-header">Hours</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry: any) => (
                  <>
                    <tr
                      key={entry._id}
                      className="hover:bg-violet-50/20 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === entry._id ? null : entry._id)}
                    >
                      {isManager && <td className="table-cell font-medium">{entry.userName || '—'}</td>}
                      <td className="table-cell text-gray-500 whitespace-nowrap">{formatDate(entry.date)}</td>
                      <td className="table-cell">
                        <span className="badge bg-gray-100 text-gray-700">{entry.taskType}</span>
                      </td>
                      <td className="table-cell max-w-xs truncate text-gray-700">{entry.description}</td>
                      <td className="table-cell text-gray-500">{entry.project || '—'}</td>
                      <td className="table-cell font-semibold text-gray-900">{entry.hoursWorked}h</td>
                      <td className="table-cell">
                        <span className={`badge ${statusColors[entry.status] || 'bg-gray-100 text-gray-700'}`}>{entry.status}</span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {isManager && entry.status === 'Submitted' && (
                            <>
                              <button
                                onClick={() => handleApprove(entry._id)}
                                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                                title="Approve"
                              >
                                <CheckCircle size={15} />
                              </button>
                              <button
                                onClick={() => { setRejectModal({ id: entry._id }); setRejectReason(''); }}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                title="Reject"
                              >
                                <XCircle size={15} />
                              </button>
                            </>
                          )}
                          {!isManager && entry.status === 'Submitted' && (
                            <>
                              <button
                                onClick={() => openEdit(entry)}
                                className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 px-2.5 py-1 rounded-lg font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(entry._id)}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          <span className="text-gray-300">
                            {expandedId === entry._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {expandedId === entry._id && entry.notes && (
                      <tr key={`${entry._id}-notes`} className="bg-violet-50/30">
                        <td colSpan={isManager ? 8 : 7} className="px-4 py-2 text-sm text-gray-500 italic">
                          Notes: {entry.notes}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
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

      {/* Mobile Card View */}
      {loading ? (
        <LoadingSpinner className="h-48 md:hidden" />
      ) : entries.length === 0 ? (
        <div className="md:hidden text-center text-gray-400 py-16 glass-card flex flex-col items-center gap-2">
          <Clock size={36} className="opacity-30" />
          <p>No timesheet entries for this period</p>
          <button onClick={openAdd} className="btn-primary mt-2 flex items-center gap-2">
            <Plus size={14} /> Log your first entry
          </button>
        </div>
      ) : (
        <div className="md:hidden space-y-3">
          {entries.map((entry: any) => (
            <div key={entry._id} className="glass-card !p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {isManager && <p className="font-medium text-gray-900 text-sm">{entry.userName || '—'}</p>}
                  <p className="text-xs text-gray-500">{formatDate(entry.date)}</p>
                  <span className="badge bg-gray-100 text-gray-700 text-xs mt-0.5 inline-block">{entry.taskType}</span>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`badge ${statusColors[entry.status] || 'bg-gray-100 text-gray-700'} text-xs`}>{entry.status}</span>
                  <span className="font-bold text-gray-900 text-sm">{entry.hoursWorked}h</span>
                </div>
              </div>
              <p className="text-sm text-gray-700 truncate">{entry.description}</p>
              {entry.project && <p className="text-xs text-gray-500"><span className="text-gray-400">Project:</span> {entry.project}</p>}
              {entry.notes && <p className="text-xs text-gray-500 italic truncate"><span className="text-gray-400">Notes:</span> {entry.notes}</p>}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                {isManager && entry.status === 'Submitted' && (
                  <>
                    <button onClick={() => handleApprove(entry._id)}
                      className="flex items-center gap-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2.5 py-1.5 rounded-lg font-medium">
                      <CheckCircle size={11} /> Approve
                    </button>
                    <button onClick={() => { setRejectModal({ id: entry._id }); setRejectReason(''); }}
                      className="flex items-center gap-1 text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2.5 py-1.5 rounded-lg font-medium">
                      <XCircle size={11} /> Reject
                    </button>
                  </>
                )}
                {!isManager && entry.status === 'Submitted' && (
                  <>
                    <button onClick={() => openEdit(entry)}
                      className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 px-2.5 py-1.5 rounded-lg font-medium">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(entry._id)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
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

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editEntry ? 'Edit Time Entry' : 'Log Time'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date *</label>
              <input required type="date" className="input-field" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Hours Worked *</label>
              <input required type="number" min="0.5" max="24" step="0.5" className="input-field" placeholder="e.g. 8" value={form.hoursWorked} onChange={(e) => setForm(f => ({ ...f, hoursWorked: e.target.value }))} />
            </div>
            <div>
              <label className="label">Task Type *</label>
              <input required type="text" className="input-field" placeholder="e.g. Development, Meeting…" value={form.taskType} onChange={(e) => setForm(f => ({ ...f, taskType: e.target.value }))} />
            </div>
            <div>
              <label className="label">Project / Account</label>
              <input type="text" className="input-field" placeholder="e.g. ABC Corp" value={form.project} onChange={(e) => setForm(f => ({ ...f, project: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Description *</label>
            <textarea required rows={3} className="input-field" placeholder="What did you work on?" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" placeholder="Any additional notes…" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : editEntry ? 'Update' : 'Log Time'}</button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Entry">
        <div className="space-y-4">
          <div>
            <label className="label">Reason for rejection</label>
            <textarea rows={3} className="input-field" placeholder="Enter reason…" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setRejectModal(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleReject} className="btn-primary bg-red-600 hover:bg-red-700">Reject</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
