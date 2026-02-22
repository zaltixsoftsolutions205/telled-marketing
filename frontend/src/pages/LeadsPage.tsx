import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ExternalLink, Archive } from 'lucide-react';
import { leadsApi } from '@/api/leads';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { formatDate } from '@/utils/formatters';
import type { Lead, User } from '@/types';

type DRFTab = 'All' | 'DRFs Sent' | 'DRFs Approved' | 'DRFs Rejected' | 'DRFs Expired';

const DRF_TABS: DRFTab[] = ['All', 'DRFs Sent', 'DRFs Approved', 'DRFs Rejected', 'DRFs Expired'];

const TAB_STAGE: Record<DRFTab, string> = {
  'All': '',
  'DRFs Sent': 'DRF Submitted',
  'DRFs Approved': 'DRF Approved',
  'DRFs Rejected': 'DRF Rejected',
  'DRFs Expired': 'DRF Expired',
};

export default function LeadsPage() {
  const user = useAuthStore((s) => s.user);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<DRFTab>('All');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);
  const [salesUsers, setSalesUsers] = useState<User[]>([]);

  const [form, setForm] = useState({
    companyName: '', contactPersonName: '', email: '', phone: '',
    oemName: '', city: '', state: '', source: '', notes: '', assignedTo: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      if (TAB_STAGE[activeTab]) params.stage = TAB_STAGE[activeTab];
      if (user?.role === 'sales') params.assignedTo = user._id;
      const res = await leadsApi.getAll(params);
      setLeads(res.data);
      setTotal(res.pagination?.total ?? 0);
    } finally { setLoading(false); }
  }, [page, search, activeTab, user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (user?.role === 'admin') usersApi.getSalesmen().then(setSalesUsers).catch(() => {});
  }, [user?.role]);

  const handleTabChange = (tab: DRFTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await leadsApi.create(form);
      setShowModal(false);
      setForm({ companyName:'', contactPersonName:'', email:'', phone:'', oemName:'', city:'', state:'', source:'', notes:'', assignedTo:'' });
      load();
    } finally { setSaving(false); }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    await leadsApi.archive(archiveTarget);
    setArchiveTarget(null);
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total leads</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Lead
        </button>
      </div>

      {/* DRF Status Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {DRF_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search leads…"
          className="input-field pl-9"
        />
      </div>

      {/* Table */}
      <div className="glass-card !p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="h-48" />
        ) : leads.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No leads found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Company</th>
                  <th className="table-header">Contact Person</th>
                  <th className="table-header">OEM</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">Stage</th>
                  <th className="table-header">Assigned To</th>
                  <th className="table-header">Created</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map((lead) => (
                  <tr key={lead._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-medium text-violet-700">
                      <Link to={`/leads/${lead._id}`} className="hover:underline">{lead.companyName}</Link>
                    </td>
                    <td className="table-cell">{lead.contactPersonName || lead.contactName}</td>
                    <td className="table-cell text-gray-500">{lead.oemName || <span className="text-gray-300">—</span>}</td>
                    <td className="table-cell text-gray-400">{lead.phone}</td>
                    <td className="table-cell"><StatusBadge status={lead.stage} /></td>
                    <td className="table-cell">{(lead.assignedTo as User)?.name || <span className="text-gray-300">—</span>}</td>
                    <td className="table-cell text-gray-400">{formatDate(lead.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Link to={`/leads/${lead._id}`} className="p-1 hover:text-violet-600 text-gray-400">
                          <ExternalLink size={15} />
                        </Link>
                        {user?.role === 'admin' && (
                          <button onClick={() => setArchiveTarget(lead._id)} className="p-1 hover:text-red-500 text-gray-400">
                            <Archive size={15} />
                          </button>
                        )}
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
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Lead" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Company Name *</label>
              <input required className="input-field" value={form.companyName} onChange={(e) => setForm(f => ({...f, companyName: e.target.value}))} />
            </div>
            <div>
              <label className="label">Contact Person Name *</label>
              <input required className="input-field" placeholder="Primary contact at the company" value={form.contactPersonName} onChange={(e) => setForm(f => ({...f, contactPersonName: e.target.value}))} />
            </div>
            <div>
              <label className="label">Contact Email *</label>
              <input required type="email" className="input-field" value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input required className="input-field" value={form.phone} onChange={(e) => setForm(f => ({...f, phone: e.target.value}))} />
            </div>
            <div>
              <label className="label">OEM Name *</label>
              <select required className="input-field" value={form.oemName} onChange={(e) => setForm(f => ({...f, oemName: e.target.value}))}>
                <option value="">Select OEM</option>
                {['Siemens','ABB','Schneider Electric','Rockwell Automation','Honeywell','Mitsubishi Electric','Other'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Source</label>
              <select className="input-field" value={form.source} onChange={(e) => setForm(f => ({...f, source: e.target.value}))}>
                <option value="">Select source</option>
                {['Cold Call','Email','Referral','Website','Exhibition','LinkedIn','Other'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">City</label>
              <input className="input-field" value={form.city} onChange={(e) => setForm(f => ({...f, city: e.target.value}))} />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input-field" value={form.state} onChange={(e) => setForm(f => ({...f, state: e.target.value}))} />
            </div>
            {user?.role === 'admin' && (
              <div>
                <label className="label">Assign To</label>
                <select className="input-field" value={form.assignedTo} onChange={(e) => setForm(f => ({...f, assignedTo: e.target.value}))}>
                  <option value="">Unassigned</option>
                  {salesUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={3} className="input-field" value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Create Lead'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        title="Archive Lead"
        message="Are you sure you want to archive this lead? It will be hidden from the main list."
        confirmLabel="Archive"
        danger
      />
    </div>
  );
}
