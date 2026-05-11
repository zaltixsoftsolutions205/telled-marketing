// frontend/src/pages/SupportPage.tsx
import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, MessageSquarePlus, Eye, CheckCircle, XCircle, Clock, RotateCcw, ThumbsUp, AlertTriangle, RefreshCw, Mail, ArrowRightLeft } from 'lucide-react';
import ExcelImportButton from '@/components/common/ExcelImportButton';
import { supportApi } from '@/api/support';
import { accountsApi } from '@/api/accounts';
import { useAuthStore } from '@/store/authStore';
import api from '@/api/axios';
import { mockUsers } from '@/mock/store';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDateTime } from '@/utils/formatters';
import type { SupportTicket, Account, User } from '@/types';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Reopened'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

function daysAgo(dateStr?: string): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function daysLeft(dateStr: string | undefined, window: number): number {
  if (!dateStr) return window;
  return Math.max(0, window - daysAgo(dateStr));
}

export default function SupportPage() {
  const user = useAuthStore((s) => s.user);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [engineers, setEngineers] = useState<User[]>([]);
  const [form, setForm] = useState({ accountId: '', subject: '', description: '', priority: 'Medium', assignedTo: '' });
  const [note, setNote] = useState('');
  const [statusUpdateNote, setStatusUpdateNote] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [resolvedBy, setResolvedBy] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [transferEngineerId, setTransferEngineerId] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ createdTickets: string[]; scanned: number; errors: string[] } | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const res = await supportApi.getAll(params);
      setTickets(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch {
      showMessage('Failed to load tickets', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => {
    // Email sync only works when connected to real backend — skip in mock/demo mode
  }, [user]);

  const loadAccounts = async () => {
    try { const res = await accountsApi.getAll({ limit: 100 }); setAccounts(res.data || []); } catch {}
  };
  const loadEngineers = async () => {
    try {
      const list = await mockUsers.getEngineers();
      setEngineers(list || []);
    } catch {
      try { const { data } = await api.get('/users', { params: { role: 'engineer', limit: 100 } }); setEngineers(data.data || []); } catch {}
    }
  };

  const openCreate = async () => { await Promise.all([loadAccounts(), loadEngineers()]); setShowCreate(true); };

  const openTransfer = async (ticket: SupportTicket) => {
    setSelected(ticket);
    setTransferEngineerId('');
    setTransferNote('');
    if (!engineers.length) await loadEngineers();
    setShowTransfer(true);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !transferEngineerId) return;
    setSaving(true);
    try {
      await supportApi.transfer(selected._id, transferEngineerId, transferNote, user?._id || '');
      setShowTransfer(false);
      setTransferEngineerId('');
      setTransferNote('');
      loadTickets();
      const eng = engineers.find(e => e._id === transferEngineerId);
      showMessage(`Ticket ${selected.ticketId} transferred to ${eng?.name || 'engineer'}`, 'success');
    } catch {
      showMessage('Failed to transfer ticket', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncEmails = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      // In production this calls the real backend IMAP sync
      const { data } = await api.post('/support-email/sync');
      const result = data.data || {};
      setSyncResult({ createdTickets: result.createdTickets || [], scanned: result.scanned ?? 0, errors: [] });
      if (result.createdTickets?.length > 0) loadTickets();
    } catch {
      // Backend not available (demo/mock mode)
      setSyncResult({ createdTickets: [], scanned: -1, errors: [] });
    } finally {
      setSyncing(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await supportApi.create(form);
      setShowCreate(false);
      setForm({ accountId: '', subject: '', description: '', priority: 'Medium', assignedTo: '' });
      loadTickets();
      showMessage('Ticket created successfully', 'success');
    } catch { showMessage('Failed to create ticket', 'error'); }
    finally { setSaving(false); }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await supportApi.addNote(selected._id, note);
      setShowNote(false); setNote('');
      loadTickets(); showMessage('Note added', 'success');
    } catch { showMessage('Failed to add note', 'error'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (ticket: SupportTicket, newStatus: string, updateNote?: string) => {
    try {
      await supportApi.update(ticket._id, { status: newStatus, ...(updateNote ? { updateNote } : {}) });
      loadTickets();
      showMessage(`Status updated to ${newStatus}`, 'success');
    } catch (err: any) {
      showMessage(err?.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  const openStatusUpdateModal = (ticket: SupportTicket, newStatus: string) => {
    setSelected({ ...ticket, status: newStatus as any });
    setStatusUpdateNote('');
    setShowStatusUpdate(true);
  };

  const handleStatusUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await handleStatusChange(selected, selected.status, statusUpdateNote);
      setShowStatusUpdate(false); setStatusUpdateNote('');
    } finally { setSaving(false); }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await supportApi.resolve(selected._id, resolveNote, resolvedBy);
      setShowResolve(false); setResolveNote(''); setResolvedBy('');
      loadTickets(); showMessage('Ticket resolved. Customer notified for feedback.', 'success');
    } catch (err: any) {
      showMessage(err?.response?.data?.message || 'Failed to resolve', 'error');
    } finally { setSaving(false); }
  };

  const handleFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await supportApi.submitFeedback(selected._id, feedbackText);
      setShowFeedback(false); setFeedbackText('');
      loadTickets(); showMessage('Feedback saved. Ticket closed.', 'success');
    } catch (err: any) {
      showMessage(err?.response?.data?.message || 'Failed', 'error');
    } finally { setSaving(false); }
  };

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await supportApi.reopen(selected._id, reopenReason);
      setShowReopen(false); setReopenReason('');
      loadTickets(); showMessage('Ticket reopened. Auto-spawns new ticket after 3 days if unresolved.', 'info');
    } catch (err: any) {
      showMessage(err?.response?.data?.message || 'Failed to reopen', 'error');
    } finally { setSaving(false); }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-700';
      case 'High': return 'bg-orange-100 text-orange-700';
      case 'Medium': return 'bg-yellow-100 text-yellow-700';
      case 'Low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const canResolve = (t: SupportTicket) => (user?.role === 'admin' || user?.role === 'engineer') && (t.status === 'Open' || t.status === 'In Progress' || t.status === 'Reopened');
  const canFeedback = (t: SupportTicket) => (user?.role === 'admin' || user?.role === 'engineer') && t.status === 'Resolved';
  const canReopen = (t: SupportTicket) => {
    if (t.status !== 'Closed') return false;
    if (!t.closedAt) return false;
    return daysAgo(t.closedAt) <= 3;
  };

  const allowedStatusOptions = (current: string) => {
    if (current === 'Closed') return ['Closed'];
    if (current === 'Resolved') return ['Resolved'];
    return ['Open', 'In Progress', 'Reopened'];
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-500 text-white' :
          message.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
        }`}>
          {message.type === 'success' && <CheckCircle size={16} />}
          {message.type === 'error' && <XCircle size={16} />}
          {message.type === 'info' && <Clock size={16} />}
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total tickets</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {(user?.role === 'admin' || user?.role === 'engineer') && (
            <button
              onClick={handleSyncEmails}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-violet-200 text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100 disabled:opacity-60 transition-colors"
              title="Scan inbox and pull in new support emails as tickets"
            >
              {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
              {syncing ? 'Syncing…' : 'Sync Emails'}
            </button>
          )}
          <ExcelImportButton
            entityName="Support Tickets"
            columnHint="accountName, subject, description, priority (Low/Medium/High/Critical)"
            onImport={async (rows) => {
              let imported = 0;
              const accs = await accountsApi.getAll({ limit: 500 });
              const accList: { _id: string; accountName: string }[] = accs.data || [];
              for (const row of rows) {
                const subject = row.subject || row.Subject || '';
                if (!subject) continue;
                const name = (row.accountName || row.account || '').toLowerCase();
                const acc = accList.find(a => a.accountName.toLowerCase().includes(name));
                if (!acc) continue;
                const p = row.priority || 'Medium';
                const priority = (['Low','Medium','High','Critical'].includes(p) ? p : 'Medium') as 'Low'|'Medium'|'High'|'Critical';
                try { await supportApi.create({ accountId: acc._id, subject, description: row.description || row.desc || '', priority }); imported++; } catch {}
              }
              loadTickets(); return { imported };
            }}
          />
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
            <Plus size={16} /> New Ticket
          </button>
        </div>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-3 ${
          syncResult.errors.length ? 'bg-red-50 border-red-200 text-red-800'
          : syncResult.createdTickets.length ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-gray-50 border-gray-200 text-gray-700'
        }`}>
          <Mail size={16} className="mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">
              {syncResult.errors.length ? 'Sync error' : syncResult.scanned === -1 ? 'Email sync runs on the server' : `Scanned ${syncResult.scanned} email${syncResult.scanned !== 1 ? 's' : ''}`}
            </p>
            {syncResult.errors.length > 0 && <p className="text-xs mt-0.5">{syncResult.errors[0]}</p>}
            {syncResult.scanned === -1 && <p className="text-xs mt-0.5 text-gray-500">New support emails are picked up automatically every 5 minutes from each engineer's inbox.</p>}
            {syncResult.createdTickets.length > 0 && (
              <p className="text-xs mt-0.5 text-emerald-700 font-medium">✓ {syncResult.createdTickets.length} new ticket{syncResult.createdTickets.length !== 1 ? 's' : ''} created</p>
            )}
            {syncResult.scanned >= 0 && syncResult.createdTickets.length === 0 && !syncResult.errors.length && (
              <p className="text-xs mt-0.5 text-gray-500">No new support emails found.</p>
            )}
          </div>
          <button onClick={() => setSyncResult(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </div>
      )}

      {/* Lifecycle info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 flex flex-wrap gap-4">
        <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-600" /> <strong>Resolved</strong> → closes after customer feedback</span>
        <span className="flex items-center gap-1"><Clock size={14} className="text-orange-600" /> <strong>No feedback in 3 days</strong> → auto force-closed</span>
        <span className="flex items-center gap-1"><RotateCcw size={14} className="text-violet-600" /> <strong>Reopen within 3 days</strong> of closing</span>
        <span className="flex items-center gap-1"><AlertTriangle size={14} className="text-red-500" /> <strong>Reopened 3 days</strong> → new ticket auto-created</span>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Desktop Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hidden md:block">
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No tickets found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map((ticket) => {
                  const resolvedDaysLeft = ticket.status === 'Resolved' ? daysLeft(ticket.resolvedAt, 3) : null;
                  const reopenedDaysLeft = ticket.status === 'Reopened' ? daysLeft(ticket.reopenedAt, 3) : null;
                  const reopenDaysLeft = ticket.status === 'Closed' ? daysLeft(ticket.closedAt, 3) : null;
                  return (
                    <tr key={ticket._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono">{ticket.ticketId}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setSelected(ticket); setShowDetail(true); }}
                          className="text-violet-600 hover:underline font-medium text-left max-w-[200px] truncate block">
                          {ticket.subject}
                        </button>
                        {ticket.parentTicketId && <p className="text-xs text-orange-500 mt-0.5">Follow-up ticket</p>}
                      </td>
                      <td className="px-4 py-3 text-sm">{(ticket.accountId as Account)?.accountName || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                      </td>
                      <td className="px-4 py-3">
                        {(user?.role === 'engineer' || user?.role === 'admin') && !['Closed', 'Resolved'].includes(ticket.status) ? (
                          <select value={ticket.status}
                            onChange={(e) => { if (ticket.status !== e.target.value) openStatusUpdateModal(ticket, e.target.value); }}
                            className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500">
                            {allowedStatusOptions(ticket.status).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <StatusBadge status={ticket.status} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {resolvedDaysLeft !== null && (
                          <span className={`flex items-center gap-1 ${resolvedDaysLeft <= 1 ? 'text-red-600 font-semibold' : 'text-orange-500'}`}>
                            <Clock size={12} /> {resolvedDaysLeft}d left (feedback)
                          </span>
                        )}
                        {reopenedDaysLeft !== null && (
                          <span className={`flex items-center gap-1 ${reopenedDaysLeft <= 1 ? 'text-red-600 font-semibold' : 'text-violet-600'}`}>
                            <AlertTriangle size={12} /> {reopenedDaysLeft}d left (new ticket)
                          </span>
                        )}
                        {reopenDaysLeft !== null && reopenDaysLeft > 0 && (
                          <span className="flex items-center gap-1 text-blue-500">
                            <RotateCcw size={12} /> {reopenDaysLeft}d to reopen
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>{(ticket.assignedEngineer as User)?.name || (ticket.assignedTo as User)?.name || 'Unassigned'}</div>
                        {(ticket as any).resolvedBy && <div className="text-xs text-green-600 mt-0.5">Solved by: {(ticket as any).resolvedBy}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(ticket.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 items-center flex-wrap">
                          <button onClick={() => { setSelected(ticket); setShowNote(true); }}
                            className="p-1.5 text-gray-400 hover:text-violet-600 transition-colors rounded" title="Add note">
                            <MessageSquarePlus size={15} />
                          </button>
                          <button onClick={() => { setSelected(ticket); setShowDetail(true); }}
                            className="p-1.5 text-gray-400 hover:text-violet-600 transition-colors rounded" title="View details">
                            <Eye size={15} />
                          </button>
                          {(user?.role === 'admin' || user?.role === 'engineer') && !['Closed'].includes(ticket.status) && (
                            <button onClick={() => openTransfer(ticket)}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors rounded" title="Transfer to another engineer">
                              <ArrowRightLeft size={15} />
                            </button>
                          )}
                          {canResolve(ticket) && (
                            <button onClick={() => { setSelected(ticket); setShowResolve(true); }}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium" title="Mark resolved">
                              Resolve
                            </button>
                          )}
                          {canFeedback(ticket) && (
                            <button onClick={() => { setSelected(ticket); setShowFeedback(true); }}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium flex items-center gap-1">
                              <ThumbsUp size={11} /> Feedback
                            </button>
                          )}
                          {canReopen(ticket) && (
                            <button onClick={() => { setSelected(ticket); setShowReopen(true); }}
                              className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 font-medium flex items-center gap-1">
                              <RotateCcw size={11} /> Reopen
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > 15 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, total)} of {total}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Prev</button>
              <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      {loading ? (
        <div className="md:hidden flex justify-center py-12"><LoadingSpinner /></div>
      ) : tickets.length === 0 ? (
        <div className="md:hidden text-center py-12 text-gray-500 glass-card">No tickets found</div>
      ) : (
        <div className="md:hidden space-y-3">
          {tickets.map((ticket) => {
            const resolvedDaysLeft = ticket.status === 'Resolved' ? daysLeft(ticket.resolvedAt, 3) : null;
            const reopenedDaysLeft = ticket.status === 'Reopened' ? daysLeft(ticket.reopenedAt, 3) : null;
            const reopenDaysLeft = ticket.status === 'Closed' ? daysLeft(ticket.closedAt, 3) : null;
            return (
              <div key={ticket._id} className="glass-card !p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <button onClick={() => { setSelected(ticket); setShowDetail(true); }}
                      className="text-violet-600 hover:underline font-semibold text-sm text-left truncate block w-full">
                      {ticket.subject}
                    </button>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{ticket.ticketId}</p>
                    {ticket.parentTicketId && <p className="text-xs text-orange-500">Follow-up ticket</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                    <StatusBadge status={ticket.status} />
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  {(ticket.accountId as Account)?.accountName && (
                    <p><span className="text-gray-400">Account:</span> {(ticket.accountId as Account).accountName}</p>
                  )}
                  {((ticket.assignedEngineer as User)?.name || (ticket.assignedTo as User)?.name) && (
                    <p><span className="text-gray-400">Assigned:</span> {(ticket.assignedEngineer as User)?.name || (ticket.assignedTo as User)?.name}</p>
                  )}
                  {(ticket as any).resolvedBy && (
                    <p><span className="text-green-500">Solved by:</span> <span className="text-green-700 font-medium">{(ticket as any).resolvedBy}</span></p>
                  )}
                </div>
                {(resolvedDaysLeft !== null || reopenedDaysLeft !== null || (reopenDaysLeft !== null && reopenDaysLeft > 0)) && (
                  <div className="text-xs space-y-0.5">
                    {resolvedDaysLeft !== null && (
                      <span className={`flex items-center gap-1 ${resolvedDaysLeft <= 1 ? 'text-red-600 font-semibold' : 'text-orange-500'}`}>
                        <Clock size={11} /> {resolvedDaysLeft}d left (feedback)
                      </span>
                    )}
                    {reopenedDaysLeft !== null && (
                      <span className={`flex items-center gap-1 ${reopenedDaysLeft <= 1 ? 'text-red-600 font-semibold' : 'text-violet-600'}`}>
                        <AlertTriangle size={11} /> {reopenedDaysLeft}d left (new ticket)
                      </span>
                    )}
                    {reopenDaysLeft !== null && reopenDaysLeft > 0 && (
                      <span className="flex items-center gap-1 text-blue-500">
                        <RotateCcw size={11} /> {reopenDaysLeft}d to reopen
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-gray-100">
                  <button onClick={() => { setSelected(ticket); setShowNote(true); }}
                    className="p-1.5 text-gray-400 hover:text-violet-600 rounded" title="Add note">
                    <MessageSquarePlus size={14} />
                  </button>
                  <button onClick={() => { setSelected(ticket); setShowDetail(true); }}
                    className="p-1.5 text-gray-400 hover:text-violet-600 rounded" title="View details">
                    <Eye size={14} />
                  </button>
                  {(user?.role === 'admin' || user?.role === 'engineer') && !['Closed'].includes(ticket.status) && (
                    <button onClick={() => openTransfer(ticket)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 rounded" title="Transfer to engineer">
                      <ArrowRightLeft size={14} />
                    </button>
                  )}
                  {(user?.role === 'engineer' || user?.role === 'admin') && !['Closed', 'Resolved'].includes(ticket.status) && (
                    <select value={ticket.status}
                      onChange={(e) => { if (ticket.status !== e.target.value) openStatusUpdateModal(ticket, e.target.value); }}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500">
                      {allowedStatusOptions(ticket.status).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  {canResolve(ticket) && (
                    <button onClick={() => { setSelected(ticket); setShowResolve(true); }}
                      className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium">
                      Resolve
                    </button>
                  )}
                  {canFeedback(ticket) && (
                    <button onClick={() => { setSelected(ticket); setShowFeedback(true); }}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium flex items-center gap-1">
                      <ThumbsUp size={11} /> Feedback
                    </button>
                  )}
                  {canReopen(ticket) && (
                    <button onClick={() => { setSelected(ticket); setShowReopen(true); }}
                      className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 font-medium flex items-center gap-1">
                      <RotateCcw size={11} /> Reopen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {total > 15 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, total)} of {total}</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 text-sm">Prev</button>
                <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 text-sm">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Ticket Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Support Ticket" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account *</label>
            <select required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={form.accountId} onChange={(e) => setForm(f => ({ ...f, accountId: e.target.value }))}>
              <option value="">Select account</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.accountName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
            <input required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={form.subject} onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea required rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign Engineer</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={form.assignedTo} onChange={(e) => setForm(f => ({ ...f, assignedTo: e.target.value }))}>
                <option value="">Optional</option>
                {engineers.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Note Modal */}
      <Modal isOpen={showNote} onClose={() => setShowNote(false)} title={`Add Note — ${selected?.ticketId}`} size="md">
        <form onSubmit={handleAddNote} className="space-y-4">
          <textarea required rows={5} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note (staff only)..." />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowNote(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Status Update Modal */}
      <Modal isOpen={showStatusUpdate} onClose={() => setShowStatusUpdate(false)} title={`Update Status — ${selected?.ticketId}`} size="md">
        <form onSubmit={handleStatusUpdateSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={selected?.status || 'Open'}
              onChange={(e) => setSelected(prev => prev ? { ...prev, status: e.target.value as any } : null)}>
              {allowedStatusOptions(selected?.status || 'Open').map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Update Note (optional)</label>
            <textarea rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={statusUpdateNote} onChange={(e) => setStatusUpdateNote(e.target.value)}
              placeholder="Note sent to customer via email..." />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowStatusUpdate(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {saving ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Resolve Ticket Modal */}
      <Modal isOpen={showResolve} onClose={() => setShowResolve(false)} title={`Resolve Ticket — ${selected?.ticketId}`} size="md">
        <form onSubmit={handleResolve} className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            Marking as Resolved will email the customer requesting feedback. Ticket auto-closes after <strong>3 days</strong> if no feedback.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resolved By <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={resolvedBy}
              onChange={(e) => setResolvedBy(e.target.value)}
              placeholder="Name of person who resolved this issue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Note (optional)</label>
            <textarea rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={resolveNote} onChange={(e) => setResolveNote(e.target.value)}
              placeholder="Describe how the issue was resolved..." />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowResolve(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Resolving...' : 'Mark Resolved & Notify Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer Feedback Modal */}
      <Modal isOpen={showFeedback} onClose={() => setShowFeedback(false)} title={`Customer Feedback — ${selected?.ticketId}`} size="md">
        <form onSubmit={handleFeedback} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            Record customer feedback to officially close this ticket.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Feedback *</label>
            <textarea required rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="e.g. Issue confirmed resolved, working fine now..." />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowFeedback(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Feedback & Close Ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reopen Modal */}
      <Modal isOpen={showReopen} onClose={() => setShowReopen(false)} title={`Reopen Ticket — ${selected?.ticketId}`} size="md">
        <form onSubmit={handleReopen} className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
            Reopened tickets must be resolved within <strong>3 days</strong> or a new ticket will be automatically created.
            {selected?.closedAt && (
              <p className="mt-1">Reopen window: <strong>{daysLeft(selected.closedAt, 3)} days remaining</strong></p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Reopening *</label>
            <textarea required rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={reopenReason} onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Why is this ticket being reopened?..." />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowReopen(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
              {saving ? 'Reopening...' : 'Reopen Ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Ticket Modal */}
      <Modal isOpen={showTransfer} onClose={() => setShowTransfer(false)} title={`Transfer Ticket — ${selected?.ticketId}`} size="md">
        <form onSubmit={handleTransfer} className="space-y-4">
          {/* Ticket summary */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Ticket Details</p>
            <p className="text-sm font-medium text-gray-800">{selected?.subject}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="font-mono text-indigo-600">{selected?.ticketId}</span>
              <span>·</span>
              <span>{(selected?.accountId as Account)?.accountName || '—'}</span>
              <span>·</span>
              <span>Currently: <span className="font-medium text-gray-700">{(selected?.assignedEngineer as User)?.name || (selected?.assignedTo as User)?.name || 'Unassigned'}</span></span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transfer To *</label>
            <select
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={transferEngineerId}
              onChange={(e) => setTransferEngineerId(e.target.value)}
            >
              <option value="">Select engineer</option>
              {engineers
                .filter(e => e._id !== ((selected?.assignedEngineer as User)?._id || (selected?.assignedTo as User)?._id))
                .map(e => <option key={e._id} value={e._id}>{e.name}</option>)
              }
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Note (sent in mail)</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="Reason for transfer or additional context for the new engineer…"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
            <Mail size={13} className="mt-0.5 shrink-0" />
            <span>A transfer notification email will be sent to the new engineer with the ticket ID <strong>{selected?.ticketId}</strong> and the original query.</span>
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => setShowTransfer(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || !transferEngineerId} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              <ArrowRightLeft size={14} />
              {saving ? 'Transferring…' : 'Transfer Ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Ticket Detail Modal */}
      {selected && (
        <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={`Ticket: ${selected.ticketId}`} size="lg">
          <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-2">
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selected.subject}</h3>
                {selected.parentTicketId && (
                  <p className="text-xs text-orange-600 mt-0.5 font-medium">Follow-up ticket (spawned from reopened ticket)</p>
                )}
                <div className="flex gap-2 mt-1 flex-wrap">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selected.priority)}`}>{selected.priority}</span>
                  <StatusBadge status={selected.status} />
                  {selected.reopenCount ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Reopened {selected.reopenCount}x</span> : null}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Description</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selected.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500">Account</p><p className="font-medium">{(selected.accountId as Account)?.accountName || '—'}</p></div>
                <div><p className="text-gray-500">Assigned Engineer</p><p className="font-medium">{(selected.assignedEngineer as User)?.name || (selected.assignedTo as User)?.name || 'Unassigned'}</p></div>
                <div><p className="text-gray-500">Created</p><p className="font-medium">{formatDateTime(selected.createdAt)}</p></div>
                {(selected as any).resolvedBy && <div><p className="text-gray-500">Resolved By</p><p className="font-medium text-green-700">{(selected as any).resolvedBy}</p></div>}
                {selected.resolvedAt && <div><p className="text-gray-500">Resolved At</p><p className="font-medium">{formatDateTime(selected.resolvedAt)}</p></div>}
                {selected.closedAt && <div><p className="text-gray-500">Closed At</p><p className="font-medium">{formatDateTime(selected.closedAt)}</p></div>}
                {selected.reopenedAt && <div><p className="text-gray-500">Reopened At</p><p className="font-medium">{formatDateTime(selected.reopenedAt)}</p></div>}
              </div>

              {selected.customerFeedback && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-green-700 mb-1">Customer Feedback</p>
                  <p className="text-sm text-green-800">{selected.customerFeedback}</p>
                  {selected.customerFeedbackAt && <p className="text-xs text-green-600 mt-1">{formatDateTime(selected.customerFeedbackAt)}</p>}
                </div>
              )}

              {selected.status === 'Resolved' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
                  <strong>Awaiting customer feedback.</strong> Auto-closes in {daysLeft(selected.resolvedAt, 3)} days.
                </div>
              )}
              {selected.status === 'Reopened' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                  <strong>Reopened.</strong> New ticket auto-created in {daysLeft(selected.reopenedAt, 3)} days if unresolved.
                </div>
              )}
            </div>

            {selected.internalNotes && selected.internalNotes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <MessageSquarePlus size={14} /> Internal Notes ({selected.internalNotes.length})
                </h4>
                <div className="space-y-3">
                  {selected.internalNotes.map((n, idx) => (
                    <div key={idx} className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.note}</p>
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-gray-500">Added by: {(n.addedBy as User)?.name || 'System'}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(n.addedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
