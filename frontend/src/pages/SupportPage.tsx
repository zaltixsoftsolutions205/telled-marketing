import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, MessageSquarePlus } from 'lucide-react';
import { supportApi } from '@/api/support';
import { accountsApi } from '@/api/accounts';
import { useAuthStore } from '@/store/authStore';
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
  const [form, setForm] = useState({ accountId: '', subject: '', description: '', priority: 'Medium', status: 'Open', assignedTo: '' });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await supportApi.getAll(params);
      setTickets(res.data);
      setTotal(res.pagination?.total ?? 0);
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    const res = await accountsApi.getAll({ limit: 100 });
    setAccounts(res.data);
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await supportApi.create(form);
      setShowCreate(false);
      setForm({ accountId: '', subject: '', description: '', priority: 'Medium', status: 'Open', assignedTo: '' });
      load();
    } finally { setSaving(false); }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await supportApi.addNote(selected._id, note);
      setShowNote(false);
      setNote('');
      load();
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (ticket: SupportTicket, newStatus: string) => {
    await supportApi.update(ticket._id, { status: newStatus });
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={16} /> New Ticket</button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search tickets…" className="input-field pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : tickets.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No tickets found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Ticket ID</th>
                  <th className="table-header">Subject</th>
                  <th className="table-header">Account</th>
                  <th className="table-header">Priority</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Assigned</th>
                  <th className="table-header">Created</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tickets.map((ticket) => (
                  <tr key={ticket._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-mono text-xs">{ticket.ticketId}</td>
                    <td className="table-cell">
                      <button onClick={() => { setSelected(ticket); setShowDetail(true); }} className="text-violet-700 hover:underline font-medium text-left">
                        {ticket.subject}
                      </button>
                    </td>
                    <td className="table-cell">{(ticket.accountId as Account)?.accountName}</td>
                    <td className="table-cell"><StatusBadge status={ticket.priority} /></td>
                    <td className="table-cell">
                      <select
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="table-cell">{(ticket.assignedTo as User)?.name || '—'}</td>
                    <td className="table-cell text-gray-400 text-xs">{formatDateTime(ticket.createdAt)}</td>
                    <td className="table-cell">
                      <button onClick={() => { setSelected(ticket); setShowNote(true); }} className="p-1 hover:text-violet-600 text-gray-400" title="Add note">
                        <MessageSquarePlus size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 15 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 15)}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
              <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Support Ticket" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Account *</label>
            <select required className="input-field" value={form.accountId} onChange={(e) => setForm(f => ({...f, accountId: e.target.value}))}>
              <option value="">Select account</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.accountName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Subject *</label>
            <input required className="input-field" value={form.subject} onChange={(e) => setForm(f => ({...f, subject: e.target.value}))} />
          </div>
          <div>
            <label className="label">Description *</label>
            <textarea required rows={4} className="input-field" value={form.description} onChange={(e) => setForm(f => ({...f, description: e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Priority</label>
              <select className="input-field" value={form.priority} onChange={(e) => setForm(f => ({...f, priority: e.target.value}))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create Ticket'}</button>
          </div>
        </form>
      </Modal>

      {/* Add Note Modal */}
      <Modal isOpen={showNote} onClose={() => setShowNote(false)} title={`Add Note — ${selected?.ticketId}`} size="sm">
        <form onSubmit={handleAddNote} className="space-y-4">
          <div>
            <label className="label">Note *</label>
            <textarea required rows={4} className="input-field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Enter internal note…" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowNote(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding…' : 'Add Note'}</button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      {selected && (
        <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={selected.ticketId} size="lg">
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold text-gray-800">{selected.subject}</p>
              <p className="text-sm text-gray-600 mt-2">{selected.description}</p>
            </div>
            {selected.internalNotes?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Internal Notes</p>
                <div className="space-y-2">
                  {selected.internalNotes.map((n, i) => (
                    <div key={i} className="bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                      <p className="text-sm text-gray-700">{n.note}</p>
                      <p className="text-xs text-gray-400 mt-1">{(n.addedBy as User)?.name} • {formatDateTime(n.addedAt)}</p>
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
