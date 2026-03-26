import { useEffect, useState, useCallback } from 'react';
import {
  Plus, CheckCircle, XCircle, CalendarCheck, Clock, Wrench,
  Headphones, BookOpen, BarChart2, ChevronRight, Search, CheckCircle2,
} from 'lucide-react';
import { engineerVisitsApi } from '@/api/engineerVisits';
import { accountsApi } from '@/api/accounts';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate, formatDateTime, formatCurrency } from '@/utils/formatters';
import type { Account, User } from '@/types';

type VisitType = 'Installation' | 'Support' | 'Maintenance' | 'Training';
type VisitStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
type HRStatus = 'Pending' | 'Approved' | 'Rejected';

const VISIT_TYPE_STYLE: Record<VisitType, { color: string; bg: string; icon: React.ElementType }> = {
  Installation: { color: 'text-blue-700',   bg: 'bg-blue-50',   icon: Wrench },
  Support:      { color: 'text-violet-700', bg: 'bg-violet-50', icon: Headphones },
  Maintenance:  { color: 'text-orange-700', bg: 'bg-orange-50', icon: CalendarCheck },
  Training:     { color: 'text-emerald-700',bg: 'bg-emerald-50',icon: BookOpen },
};

const STATUS_STYLE: Record<VisitStatus, string> = {
  Scheduled:   'bg-blue-100 text-blue-700',
  'In Progress':'bg-amber-100 text-amber-700',
  Completed:   'bg-emerald-100 text-emerald-700',
  Cancelled:   'bg-gray-100 text-gray-500',
};

const HR_STYLE: Record<HRStatus, string> = {
  Pending:  'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-600',
};

type Tab = 'scheduled' | 'active' | 'completed' | 'all' | 'hr';

export default function EngineerVisitsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const isHR    = user?.role === 'admin' || user?.role === 'hr_finance';
  const isEngineer = user?.role === 'engineer' || isAdmin;

  const [visits, setVisits] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Schedule modal
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    visitType: 'Support' as VisitType,
    scheduledDate: '',
    accountId: '',
    engineerId: '',
    notes: '',
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [engineers, setEngineers] = useState<User[]>([]);
  const [schedSaving, setSchedSaving] = useState(false);

  // Complete modal
  const [showComplete, setShowComplete] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<any>(null);
  const [completeForm, setCompleteForm] = useState({
    workNotes: '',
    visitCharges: '0',
    travelAllowance: '0',
    additionalExpense: '0',
  });
  const [compSaving, setCompSaving] = useState(false);

  // HR reject reason
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejSaving, setRejSaving] = useState(false);

  const buildParams = useCallback(() => {
    const params: Record<string, unknown> = { page, limit: 15 };
    if (tab === 'scheduled')  params.status = 'Scheduled';
    if (tab === 'active')     params.status = 'In Progress';
    if (tab === 'completed')  params.status = 'Completed';
    if (tab === 'hr')         params.hrStatus = 'Pending';
    if (typeFilter)           params.visitType = typeFilter;
    if (search)               params.search = search;
    return params;
  }, [page, tab, typeFilter, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await engineerVisitsApi.getAll(buildParams());
      setVisits(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) {
      console.error('EngineerVisitsPage load:', err);
      setVisits([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { load(); }, [load]);

  const openSchedule = async () => {
    const [accRes, engRes] = await Promise.allSettled([
      accountsApi.getAll({ limit: 100 }),
      usersApi.getEngineers(),
    ]);
    setAccounts(accRes.status === 'fulfilled' ? accRes.value.data || [] : []);
    setEngineers(engRes.status === 'fulfilled' ? engRes.value || [] : []);
    setScheduleForm({ visitType: 'Support', scheduledDate: '', accountId: '', engineerId: user?._id || '', notes: '' });
    setShowSchedule(true);
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSchedSaving(true);
    try {
      await engineerVisitsApi.schedule({
        ...scheduleForm,
        engineerId: scheduleForm.engineerId || user?._id,
      });
      setShowSchedule(false);
      load();
    } catch (err) {
      console.error('schedule visit:', err);
    } finally {
      setSchedSaving(false);
    }
  };

  const openComplete = (visit: any) => {
    setCompleteTarget(visit);
    setCompleteForm({
      workNotes: '',
      visitCharges: String(visit.visitCharges || 0),
      travelAllowance: String(visit.travelAllowance || 0),
      additionalExpense: String(visit.additionalExpense || 0),
    });
    setShowComplete(true);
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeTarget) return;
    setCompSaving(true);
    try {
      await engineerVisitsApi.complete(completeTarget._id, {
        workNotes: completeForm.workNotes,
        visitCharges: Number(completeForm.visitCharges),
        travelAllowance: Number(completeForm.travelAllowance),
        additionalExpense: Number(completeForm.additionalExpense),
      });
      setShowComplete(false);
      setCompleteTarget(null);
      load();
    } catch (err) {
      console.error('complete visit:', err);
    } finally {
      setCompSaving(false);
    }
  };

  const handleStatusChange = async (visit: any, status: string) => {
    try {
      await engineerVisitsApi.updateStatus(visit._id, status);
      load();
    } catch {}
  };

  const handleApprove = async (visit: any) => {
    try {
      await engineerVisitsApi.approve(visit._id);
      load();
    } catch {}
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    setRejSaving(true);
    try {
      await engineerVisitsApi.reject(rejectTarget._id, rejectReason);
      setRejectTarget(null);
      setRejectReason('');
      load();
    } catch {} finally {
      setRejSaving(false);
    }
  };

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'all',       label: 'All Visits' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'active',    label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
    ...(isHR ? [{ key: 'hr' as Tab, label: 'HR Approval' }] : []),
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Engineer Visits</h1>
          <p className="text-sm text-gray-500">{total} records</p>
        </div>
        {isEngineer && (
          <button onClick={openSchedule} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Schedule Visit
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search…"
            className="input-field pl-8 py-2 text-sm w-48"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="input-field py-2 text-sm w-auto"
        >
          <option value="">All Types</option>
          {(['Installation', 'Support', 'Maintenance', 'Training'] as VisitType[]).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="h-48" />
        ) : visits.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <CalendarCheck size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No visits found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engineer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Charges</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">HR</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visits.map((visit: any) => {
                    const vt = (visit.visitType || 'Support') as VisitType;
                    const typeInfo = VISIT_TYPE_STYLE[vt] ?? VISIT_TYPE_STYLE.Support;
                    const TypeIcon = typeInfo.icon;
                    const canComplete = isEngineer && (visit.status === 'Scheduled' || visit.status === 'In Progress');
                    const canApproveHR = isHR && visit.status === 'Completed' && visit.hrStatus === 'Pending';

                    return (
                      <tr key={visit._id} className="hover:bg-gray-50 transition-colors text-sm">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${typeInfo.bg} ${typeInfo.color}`}>
                            <TypeIcon size={12} />
                            {vt}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">{visit.engineerId?.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{visit.accountId?.companyName || visit.accountId?.accountName || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {visit.scheduledDate ? formatDateTime(visit.scheduledDate) : formatDate(visit.visitDate)}
                        </td>
                        <td className="px-4 py-3">
                          {visit.status ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[visit.status as VisitStatus] ?? ''}`}>
                              {visit.status}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">
                          {visit.totalAmount ? formatCurrency(visit.totalAmount) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${HR_STYLE[visit.hrStatus as HRStatus] ?? ''}`}>
                            {visit.hrStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {/* Status progression (for scheduled/active) */}
                            {isEngineer && visit.status === 'Scheduled' && (
                              <button
                                onClick={() => handleStatusChange(visit, 'In Progress')}
                                className="px-2 py-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100"
                                title="Start visit"
                              >
                                Start
                              </button>
                            )}
                            {/* Complete */}
                            {canComplete && (
                              <button
                                onClick={() => openComplete(visit)}
                                className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 flex items-center gap-1"
                              >
                                <CheckCircle2 size={11} /> Complete
                              </button>
                            )}
                            {/* HR actions */}
                            {canApproveHR && (
                              <>
                                <button
                                  onClick={() => handleApprove(visit)}
                                  className="p-1 text-emerald-600 hover:text-emerald-800"
                                  title="Approve"
                                >
                                  <CheckCircle size={15} />
                                </button>
                                <button
                                  onClick={() => { setRejectTarget(visit); setRejectReason(''); }}
                                  className="p-1 text-red-500 hover:text-red-700"
                                  title="Reject"
                                >
                                  <XCircle size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {total > 15 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-500">Showing {((page-1)*15)+1}–{Math.min(page*15,total)} of {total}</p>
                <div className="flex gap-2">
                  <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="px-3 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50">Prev</button>
                  <button disabled={page>=Math.ceil(total/15)} onClick={() => setPage(p=>p+1)} className="px-3 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Schedule Visit Modal */}
      <Modal isOpen={showSchedule} onClose={() => setShowSchedule(false)} title="Schedule Visit">
        <form onSubmit={handleSchedule} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Visit Type *</label>
              <select
                required
                className="input-field text-sm"
                value={scheduleForm.visitType}
                onChange={(e) => setScheduleForm(f => ({ ...f, visitType: e.target.value as VisitType }))}
              >
                {['Installation', 'Support', 'Maintenance', 'Training'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Scheduled Date & Time *</label>
              <input
                required
                type="datetime-local"
                className="input-field text-sm"
                value={scheduleForm.scheduledDate}
                onChange={(e) => setScheduleForm(f => ({ ...f, scheduledDate: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Account</label>
            <select
              className="input-field text-sm"
              value={scheduleForm.accountId}
              onChange={(e) => setScheduleForm(f => ({ ...f, accountId: e.target.value }))}
            >
              <option value="">Select account (optional)</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.accountName}</option>)}
            </select>
          </div>

          {isAdmin && (
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Assign Engineer *</label>
              <select
                required={isAdmin}
                className="input-field text-sm"
                value={scheduleForm.engineerId}
                onChange={(e) => setScheduleForm(f => ({ ...f, engineerId: e.target.value }))}
              >
                <option value="">Select engineer</option>
                {engineers.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Notes</label>
            <textarea
              className="input-field text-sm resize-none"
              rows={3}
              placeholder="Visit purpose, special instructions…"
              value={scheduleForm.notes}
              onChange={(e) => setScheduleForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowSchedule(false)} className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={schedSaving} className="btn-primary text-sm">
              {schedSaving ? 'Scheduling…' : 'Schedule Visit'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Complete Visit Modal */}
      <Modal isOpen={showComplete} onClose={() => setShowComplete(false)} title="Mark Visit Complete">
        {completeTarget && (
          <form onSubmit={handleComplete} className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <p className="font-medium text-gray-800">{completeTarget.visitType} Visit</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {completeTarget.accountId?.companyName || completeTarget.accountId?.accountName || '—'} • {formatDateTime(completeTarget.scheduledDate || completeTarget.visitDate)}
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Work Done / Notes *</label>
              <textarea
                required
                className="input-field text-sm resize-none"
                rows={4}
                placeholder="Describe work completed, observations, follow-ups needed…"
                value={completeForm.workNotes}
                onChange={(e) => setCompleteForm(f => ({ ...f, workNotes: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Visit Charges (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="input-field text-sm"
                  value={completeForm.visitCharges}
                  onChange={(e) => setCompleteForm(f => ({ ...f, visitCharges: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Travel Allowance (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="input-field text-sm"
                  value={completeForm.travelAllowance}
                  onChange={(e) => setCompleteForm(f => ({ ...f, travelAllowance: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Additional Expense (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="input-field text-sm"
                  value={completeForm.additionalExpense}
                  onChange={(e) => setCompleteForm(f => ({ ...f, additionalExpense: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowComplete(false)} className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={compSaving} className="btn-primary text-sm flex items-center gap-2">
                <CheckCircle2 size={14} />
                {compSaving ? 'Saving…' : 'Mark Complete'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Reject Modal (HR) */}
      <Modal isOpen={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject Visit Claim" size="sm">
        <form onSubmit={handleReject} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Reason for Rejection</label>
            <textarea
              className="input-field text-sm resize-none"
              rows={3}
              placeholder="Enter reason…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setRejectTarget(null)} className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={rejSaving} className="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
              {rejSaving ? 'Rejecting…' : 'Reject Claim'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
