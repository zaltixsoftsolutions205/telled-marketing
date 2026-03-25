// frontend/src/pages/SupportPage.tsx
import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, MessageSquarePlus, RefreshCw, Eye } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
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
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await supportApi.getAll(params);
      setTickets(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const loadAccounts = async () => {
    const res = await accountsApi.getAll({ limit: 100 });
    setAccounts(res.data || []);
  };

  const loadEngineers = async () => {
    const { data } = await api.get('/users', { params: { role: 'engineer', limit: 100 } });
    setEngineers(data.data || []);
  };

  const openCreate = async () => {
    await Promise.all([loadAccounts(), loadEngineers()]);
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await supportApi.create(form);
      setShowCreate(false);
      setForm({ accountId: '', subject: '', description: '', priority: 'Medium', assignedTo: '' });
      loadTickets();
      setMessage({ text: 'Ticket created successfully', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ text: 'Failed to create ticket', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
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
      setMessage({ text: 'Note added successfully', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ text: 'Failed to add note', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (ticket: SupportTicket, newStatus: string) => {
    try {
      await supportApi.update(ticket._id, { status: newStatus });
      loadTickets();
      setMessage({ text: `Status updated to ${newStatus}`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ text: 'Failed to update status', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleManualSync = async () => {
    if (!user || user.role !== 'admin') return;
    
    setSyncing(true);
    try {
      const { data } = await api.post('/support-email/sync');
      const created = data.data.createdTickets?.length || 0;
      if (created > 0) {
        setMessage({ text: `Created ${created} tickets from emails`, type: 'success' });
        loadTickets();
      } else {
        setMessage({ text: 'No new support emails found', type: 'info' as any });
      }
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ text: 'Failed to sync emails', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Message Toast */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg ${
          message.type === 'success' ? 'bg-green-500 text-white' : 
          message.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total tickets</p>
        </div>
        <div className="flex gap-3">
          {user?.role === 'admin' && (
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Emails'}
            </button>
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            <Plus size={16} /> New Ticket
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
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
                  <tr key={ticket._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono">{ticket.ticketId}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelected(ticket); setShowDetail(true); }}
                        className="text-violet-600 hover:underline"
                      >
                        {ticket.subject}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">{(ticket.accountId as Account)?.accountName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        ticket.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                        ticket.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                        ticket.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user?.role === 'engineer' || user?.role === 'admin' ? (
                        <select
                          value={ticket.status}
                          onChange={(e) => handleStatusChange(ticket, e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <StatusBadge status={ticket.status} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{(ticket.assignedTo as User)?.name || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(ticket.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelected(ticket); setShowNote(true); }}
                        className="p-1 text-gray-400 hover:text-violet-600"
                        title="Add note"
                      >
                        <MessageSquarePlus size={16} />
                      </button>
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
              Page {page} of {Math.ceil(total / 15)}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
              >
                Prev
              </button>
              <button
                disabled={page >= Math.ceil(total / 15)}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Support Ticket">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account *</label>
            <select
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={form.subject}
              onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                value={form.priority}
                onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                value={form.assignedTo}
                onChange={(e) => setForm(f => ({ ...f, assignedTo: e.target.value }))}
              >
                <option value="">Select engineer</option>
                {engineers.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border  border-gray-300 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-violet-600 text-white rounded-lg">
              {saving ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Note Modal */}
      <Modal isOpen={showNote} onClose={() => setShowNote(false)} title={`Add Note - ${selected?.ticketId}`}>
        <form onSubmit={handleAddNote} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter internal note..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowNote(false)} className="px-4 py-2 border border-gray-300 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-violet-600 text-white rounded-lg">
              {saving ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Ticket Detail Modal */}
      {selected && (
        <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={selected.ticketId}>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{selected.subject}</h3>
              <p className="text-gray-600 mt-2">{selected.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Account</p>
                <p className="font-medium">{(selected.accountId as Account)?.accountName}</p>
              </div>
              <div>
                <p className="text-gray-500">Assigned To</p>
                <p className="font-medium">{(selected.assignedTo as User)?.name || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-gray-500">Priority</p>
                <p className="font-medium">{selected.priority}</p>
              </div>
              <div>
                <p className="text-gray-500">Status</p>
                <p className="font-medium">{selected.status}</p>
              </div>
              <div>
                <p className="text-gray-500">Created</p>
                <p className="font-medium">{formatDateTime(selected.createdAt)}</p>
              </div>
              <div>
                <p className="text-gray-500">Last Response</p>
                <p className="font-medium">{selected.lastResponseAt ? formatDateTime(selected.lastResponseAt) : 'Never'}</p>
              </div>
            </div>
            {selected.internalNotes?.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Internal Notes</h4>
                <div className="space-y-2">
                  {selected.internalNotes.map((note, idx) => (
                    <div key={idx} className="bg-yellow-50 p-3 rounded-lg">
                      <p className="text-sm">{note.note}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(note.addedBy as User)?.name} • {formatDateTime(note.addedAt)}
                      </p>
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