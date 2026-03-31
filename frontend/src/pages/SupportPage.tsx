// frontend/src/pages/SupportPage.tsx
import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, MessageSquarePlus, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supportApi } from '@/api/support';
import { accountsApi } from '@/api/accounts';
import { useAuthStore } from '@/store/authStore';
import api from '@/api/axios';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDateTime } from '@/utils/formatters';
import type { SupportTicket, Account, User } from '@/types';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

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
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [engineers, setEngineers] = useState<User[]>([]);
  const [form, setForm] = useState({
    accountId: '',
    subject: '',
    description: '',
    priority: 'Medium',
    assignedTo: ''
  });
  const [note, setNote] = useState('');
  const [statusUpdateNote, setStatusUpdateNote] = useState('');
  const [saving, setSaving] = useState(false);
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
    } catch (err) {
      console.error('Load error:', err);
      showMessage('Failed to load tickets', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Silent background email sync every 30 seconds
  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'engineer') return;
    const silentSync = async () => {
      try {
        const { data } = await api.post('/support-email/sync');
        if (data.data?.createdTickets?.length > 0) {
          loadTickets();
        }
      } catch {}
    };
    silentSync();
    const interval = setInterval(silentSync, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const loadAccounts = async () => {
    try {
      const res = await accountsApi.getAll({ limit: 100 });
      setAccounts(res.data || []);
    } catch (err) {
      console.error('Load accounts error:', err);
      showMessage('Failed to load accounts', 'error');
    }
  };

  const loadEngineers = async () => {
    try {
      const { data } = await api.get('/users', { params: { role: 'engineer', limit: 100 } });
      setEngineers(data.data || []);
    } catch (err) {
      console.error('Load engineers error:', err);
    }
  };

  const openCreate = async () => {
    await Promise.all([loadAccounts(), loadEngineers()]);
    setShowCreate(true);
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
    } catch (err) {
      showMessage('Failed to create ticket', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await supportApi.addNote(selected._id, note);
      setShowNote(false);
      setNote('');
      loadTickets();
      showMessage('Note added successfully', 'success');
    } catch (err) {
      showMessage('Failed to add note', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (ticket: SupportTicket, newStatus: string, updateNote?: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (updateNote) {
        updateData.updateNote = updateNote;
      }
      await supportApi.update(ticket._id, updateData);
      loadTickets();
      showMessage(`Status updated to ${newStatus}`, 'success');
    } catch (err) {
      showMessage('Failed to update status', 'error');
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
      setShowStatusUpdate(false);
      setStatusUpdateNote('');
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="space-y-6">
      {/* Message Toast */}
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

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total tickets</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Plus size={16} /> New Ticket
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets by ID, subject, or description..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No tickets found
          </div>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map((ticket) => (
                  <tr key={ticket._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono">{ticket.ticketId}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelected(ticket); setShowDetail(true); }}
                        className="text-violet-600 hover:underline font-medium text-left"
                      >
                        {ticket.subject}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">{(ticket.accountId as Account)?.accountName || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user?.role === 'engineer' || user?.role === 'admin' ? (
                        <select
                          value={ticket.status}
                          onChange={(e) => {
                            if (ticket.status !== e.target.value) {
                              openStatusUpdateModal(ticket, e.target.value);
                            }
                          }}
                          className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        >
                          {STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={ticket.status} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{(ticket.assignedEngineer as User)?.name || (ticket.assignedTo as User)?.name || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(ticket.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setSelected(ticket); setShowNote(true); }}
                          className="p-1 text-gray-400 hover:text-violet-600 transition-colors"
                          title="Add internal note"
                        >
                          <MessageSquarePlus size={16} />
                        </button>
                        <button
                          onClick={() => { setSelected(ticket); setShowDetail(true); }}
                          className="p-1 text-gray-400 hover:text-violet-600 transition-colors"
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {total > 15 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Showing {((page - 1) * 15) + 1} to {Math.min(page * 15, total)} of {total} tickets
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Prev
              </button>
              <button
                disabled={page >= Math.ceil(total / 15)}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Support Ticket" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account *</label>
            <select
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={form.accountId}
              onChange={(e) => setForm(f => ({ ...f, accountId: e.target.value }))}
            >
              <option value="">Select account</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.accountName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
            <input
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={form.subject}
              onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={form.priority}
                onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To (Engineer)</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={form.assignedTo}
                onChange={(e) => setForm(f => ({ ...f, assignedTo: e.target.value }))}
              >
                <option value="">Select engineer (optional)</option>
                {engineers.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Note Modal */}
      <Modal isOpen={showNote} onClose={() => setShowNote(false)} title={`Add Internal Note - ${selected?.ticketId}`} size="md">
        <form onSubmit={handleAddNote} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note *</label>
            <textarea
              required
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter internal note (only visible to staff)..."
            />
            <p className="text-xs text-gray-500 mt-1">Internal notes are only visible to staff members</p>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowNote(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Status Update Modal with Note */}
      <Modal isOpen={showStatusUpdate} onClose={() => setShowStatusUpdate(false)} title={`Update Ticket Status - ${selected?.ticketId}`} size="md">
        <form onSubmit={handleStatusUpdateSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={selected?.status || 'Open'}
              onChange={(e) => setSelected(prev => prev ? { ...prev, status: e.target.value as any } : null)}
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Update Note (Optional)</label>
            <textarea
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={statusUpdateNote}
              onChange={(e) => setStatusUpdateNote(e.target.value)}
              placeholder="Add a note about this status update (will be sent to customer via email)..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Customer will be notified of this status change via email
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowStatusUpdate(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {saving ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Ticket Detail Modal */}
      {selected && (
        <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={`Ticket: ${selected.ticketId}`} size="lg">
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
            {/* Ticket Info */}
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selected.subject}</h3>
                <div className="flex gap-2 mt-1">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selected.priority)}`}>
                    {selected.priority}
                  </span>
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Description</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selected.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Account</p>
                  <p className="font-medium">{(selected.accountId as Account)?.accountName || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Assigned Engineer</p>
                  <p className="font-medium">{(selected.assignedTo as User)?.name || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Created By</p>
                  <p className="font-medium">{(selected.createdBy as User)?.name || 'System'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Created At</p>
                  <p className="font-medium">{formatDateTime(selected.createdAt)}</p>
                </div>
                {selected.lastResponseAt && (
                  <div>
                    <p className="text-gray-500">Last Response</p>
                    <p className="font-medium">{formatDateTime(selected.lastResponseAt)}</p>
                  </div>
                )}
                {selected.closedAt && (
                  <div>
                    <p className="text-gray-500">Closed At</p>
                    <p className="font-medium">{formatDateTime(selected.closedAt)}</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Internal Notes */}
            {selected.internalNotes && selected.internalNotes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <MessageSquarePlus size={14} />
                  Internal Notes ({selected.internalNotes.length})
                </h4>
                <div className="space-y-3">
                  {selected.internalNotes.map((note, idx) => (
                    <div key={idx} className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.note}</p>
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-gray-500">
                          Added by: {(note.addedBy as User)?.name || 'System'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDateTime(note.addedAt)}
                        </p>
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