import { useEffect, useState, useCallback } from 'react';
import { CalendarCheck, Plus, Users, UserCheck, UserX, Clock } from 'lucide-react';
import { attendanceApi } from '@/api/attendance';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate } from '@/utils/formatters';
import type { Attendance, User } from '@/types';

const STATUS_OPTIONS = ['Present', 'Absent', 'Half Day', 'Leave', 'Holiday'] as const;

const statusColors: Record<string, string> = {
  Present: 'bg-green-100 text-green-800',
  Absent: 'bg-red-100 text-red-800',
  'Half Day': 'bg-amber-100 text-amber-800',
  Leave: 'bg-blue-100 text-blue-800',
  Holiday: 'bg-gray-100 text-gray-700',
};

export default function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const isHR = user?.role === 'admin' || user?.role === 'hr_finance';
  const isEngineer = user?.role === 'engineer';

  const now = new Date();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<User[]>([]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState<Attendance | null>(null);
  const [saving, setSaving] = useState(false);
  const [todaySummary, setTodaySummary] = useState<Record<string, number>>({});

  const [form, setForm] = useState({
    employeeId: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'Present' as typeof STATUS_OPTIONS[number],
    checkIn: '',
    checkOut: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20, month: filterMonth, year: filterYear };
      if (filterEmployee) params.employeeId = filterEmployee;
      if (filterStatus) params.status = filterStatus;
      const res = await attendanceApi.getAll(params);
      setRecords(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (e) {
      console.error('AttendancePage load:', e);
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filterEmployee, filterMonth, filterYear, filterStatus]);

  const loadTodaySummary = useCallback(async () => {
    try {
      const today = new Date();
      const summary = await attendanceApi.getSummary({
        month: today.getMonth() + 1,
        year: today.getFullYear(),
      });
      setTodaySummary(summary || {});
    } catch (e) {
      console.error('summary error', e);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadTodaySummary(); }, [loadTodaySummary]);

  useEffect(() => {
    if (isHR) {
      usersApi.getAll({ limit: 200 })
        .then(r => setEmployees((r.data || []).filter((u: User) => u.role !== 'admin')))
        .catch(() => {});
    }
  }, [isHR]);

  const openMark = () => {
    setEditRecord(null);
    setForm({ employeeId: '', date: new Date().toISOString().slice(0, 10), status: 'Present', checkIn: '', checkOut: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (rec: Attendance) => {
    setEditRecord(rec);
    const emp = rec.employeeId as User;
    setForm({
      employeeId: emp?._id || (rec.employeeId as string),
      date: rec.date.slice(0, 10),
      status: rec.status,
      checkIn: rec.checkIn ? new Date(rec.checkIn).toTimeString().slice(0, 5) : '',
      checkOut: rec.checkOut ? new Date(rec.checkOut).toTimeString().slice(0, 5) : '',
      notes: rec.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        employeeId: form.employeeId,
        date: form.date,
        status: form.status,
        notes: form.notes || undefined,
      };
      if (form.checkIn) body.checkIn = `${form.date}T${form.checkIn}:00`;
      if (form.checkOut) body.checkOut = `${form.date}T${form.checkOut}:00`;

      if (editRecord) {
        await attendanceApi.update(editRecord._id, body);
      } else {
        await attendanceApi.mark(body);
      }
      setShowModal(false);
      load();
      loadTodaySummary();
    } catch (e) {
      console.error('mark error', e);
    } finally {
      setSaving(false);
    }
  };

  const totalPresent = todaySummary['Present'] || 0;
  const totalAbsent = todaySummary['Absent'] || 0;
  const totalOnLeave = todaySummary['Leave'] || 0;
  const totalEmployees = employees.length;

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} records</p>
        </div>
        {isHR && (
          <button onClick={openMark} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Mark Attendance
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Users size={18} className="text-violet-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
            <p className="text-xs text-gray-400">Total Employees</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <UserCheck size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalPresent}</p>
            <p className="text-xs text-gray-400">Present this month</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <UserX size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalAbsent}</p>
            <p className="text-xs text-gray-400">Absent this month</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Clock size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalOnLeave}</p>
            <p className="text-xs text-gray-400">On Leave this month</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {isHR && (
          <select
            value={filterEmployee}
            onChange={(e) => { setFilterEmployee(e.target.value); setPage(1); }}
            className="input-field w-auto"
          >
            <option value="">All Employees</option>
            {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name} ({emp.role})</option>)}
          </select>
        )}
        <select
          value={filterMonth}
          onChange={(e) => { setFilterMonth(Number(e.target.value)); setPage(1); }}
          className="input-field w-auto"
        >
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input
          type="number"
          value={filterYear}
          onChange={(e) => { setFilterYear(Number(e.target.value)); setPage(1); }}
          className="input-field w-28"
          min={2020}
          max={2099}
        />
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="input-field w-auto"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : records.length === 0 ? (
          <div className="text-center text-gray-400 py-16 flex flex-col items-center gap-2">
            <CalendarCheck size={36} className="opacity-30" />
            <p>No attendance records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Employee</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Check In</th>
                  <th className="table-header">Check Out</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Notes</th>
                  {isHR && <th className="table-header">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((rec) => {
                  const emp = rec.employeeId as User;
                  return (
                    <tr key={rec._id} className="hover:bg-violet-50/20 transition-colors">
                      <td className="table-cell font-medium">{emp?.name || '—'}</td>
                      <td className="table-cell text-gray-500">{formatDate(rec.date)}</td>
                      <td className="table-cell text-gray-500">
                        {rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="table-cell text-gray-500">
                        {rec.checkOut ? new Date(rec.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${statusColors[rec.status] || 'bg-gray-100 text-gray-700'}`}>{rec.status}</span>
                      </td>
                      <td className="table-cell text-gray-400 text-xs max-w-xs truncate">{rec.notes || '—'}</td>
                      {isHR && (
                        <td className="table-cell">
                          <button
                            onClick={() => openEdit(rec)}
                            className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 px-2.5 py-1 rounded-lg font-medium"
                          >
                            Edit
                          </button>
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

      {/* Mark / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editRecord ? 'Edit Attendance' : 'Mark Attendance'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editRecord && (
            <div>
              <label className="label">Employee *</label>
              <select
                required
                className="input-field"
                value={form.employeeId}
                onChange={(e) => setForm(f => ({ ...f, employeeId: e.target.value }))}
              >
                <option value="">Select employee</option>
                {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name} ({emp.role})</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date *</label>
              <input
                required
                type="date"
                className="input-field"
                value={form.date}
                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Status *</label>
              <select
                required
                className="input-field"
                value={form.status}
                onChange={(e) => setForm(f => ({ ...f, status: e.target.value as typeof STATUS_OPTIONS[number] }))}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Check In</label>
              <input
                type="time"
                className="input-field"
                value={form.checkIn}
                onChange={(e) => setForm(f => ({ ...f, checkIn: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Check Out</label>
              <input
                type="time"
                className="input-field"
                value={form.checkOut}
                onChange={(e) => setForm(f => ({ ...f, checkOut: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              rows={2}
              className="input-field"
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : editRecord ? 'Update' : 'Mark Attendance'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
