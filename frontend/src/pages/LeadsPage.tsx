import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ExternalLink, Archive, Upload, X, CheckCircle, Trash2 } from 'lucide-react';
import { leadsApi } from '@/api/leads';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { formatDate } from '@/utils/formatters';
import type { Lead, User, LeadStatus } from '@/types';

const STATUS_COLORS: Record<LeadStatus, string> = {
  'New':           'bg-gray-100 text-gray-600',
  'Contacted':     'bg-blue-100 text-blue-700',
  'Qualified':     'bg-emerald-100 text-emerald-700',
  'Not Qualified': 'bg-red-100 text-red-600',
};

const STATUS_TABS: Array<LeadStatus | 'All'> = ['All', 'New', 'Contacted', 'Qualified', 'Not Qualified'];

// Parse CSV text into rows
function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
}

export default function LeadsPage() {
  const user = useAuthStore((s) => s.user);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<LeadStatus | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [salesUsers, setSalesUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    companyName: '', contactPersonName: '', email: '', phone: '',
    oemName: '', oemEmail: '', city: '', state: '', source: '', notes: '', assignedTo: '',
    status: 'New' as LeadStatus,
  });
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Excel/CSV import state
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Array<Record<string, string>>>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      if (statusTab !== 'All') params.status = statusTab;
      if (user?.role === 'sales') params.assignedTo = user._id;
      const res = await leadsApi.getAll(params);
      setLeads(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) { console.error('LeadsPage load:', err); setLeads([]); setTotal(0); } finally { setLoading(false); }
  }, [page, search, statusTab, user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (user?.role === 'admin') usersApi.getSalesmen().then(setSalesUsers).catch(() => {});
  }, [user?.role]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await leadsApi.create(form);
      setShowModal(false);
      setForm({ companyName:'', contactPersonName:'', email:'', phone:'', oemName:'', oemEmail:'', city:'', state:'', source:'', notes:'', assignedTo:'', status: 'New' });
      load();
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    setUpdatingStatus(leadId);
    try {
      await leadsApi.update(leadId, { status: newStatus });
      setLeads(prev => prev.map(l => l._id === leadId ? { ...l, status: newStatus } : l));
      if (newStatus === 'Qualified') {
        // Brief delay then reload to get updated drfEmailSent flag
        setTimeout(load, 2000);
      }
    } catch { /* ignore */ } finally { setUpdatingStatus(null); }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    await leadsApi.archive(archiveTarget);
    setArchiveTarget(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await leadsApi.delete(deleteTarget);
    setDeleteTarget(null);
    load();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportRows(parseCSV(text));
      setImportDone(0);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importRows.length) return;
    setImporting(true);
    try {
      const res = await leadsApi.importLeads(importRows);
      setImportDone(res.imported);
      setImportRows([]);
      load();
    } finally { setImporting(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total leads</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowImport(true); setImportDone(0); setImportRows([]); }} className="btn-secondary flex items-center gap-2">
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Lead
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button key={tab} onClick={() => { setStatusTab(tab); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${statusTab === tab ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search leads…" className="input-field pl-9" />
      </div>

      {/* Table */}
      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : leads.length === 0 ? (
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
                  <th className="table-header">Status</th>
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
                    <td className="table-cell text-gray-500">{lead.oemName || '—'}</td>
                    <td className="table-cell text-gray-400">{lead.phone}</td>
                    <td className="table-cell">
                      {updatingStatus === lead._id ? (
                        <span className="badge text-xs bg-violet-100 text-violet-600 animate-pulse">Updating…</span>
                      ) : (
                        <select
                          value={lead.status || 'New'}
                          onChange={(e) => handleStatusChange(lead._id, e.target.value as LeadStatus)}
                          className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer focus:ring-1 focus:ring-violet-400 ${STATUS_COLORS[lead.status as LeadStatus] || 'bg-gray-100 text-gray-600'}`}
                        >
                          {(['New', 'Contacted', 'Qualified', 'Not Qualified'] as LeadStatus[]).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="table-cell"><StatusBadge status={lead.stage} /></td>
                    <td className="table-cell">{(lead.assignedTo as User)?.name || '—'}</td>
                    <td className="table-cell text-gray-400">{formatDate(lead.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Link to={`/leads/${lead._id}`} className="p-1 hover:text-violet-600 text-gray-400">
                          <ExternalLink size={15} />
                        </Link>
                        {user?.role === 'admin' && (
                          <button onClick={() => setArchiveTarget(lead._id)} className="p-1 hover:text-orange-500 text-gray-400" title="Archive">
                            <Archive size={15} />
                          </button>
                        )}
                        <button onClick={() => setDeleteTarget(lead._id)} className="p-1 hover:text-red-600 text-gray-400" title="Delete permanently">
                          <Trash2 size={15} />
                        </button>
                      </div>
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
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Lead" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Company Name *</label>
              <input required className="input-field" value={form.companyName} onChange={(e) => setForm(f => ({...f, companyName: e.target.value}))} />
            </div>
            <div>
              <label className="label">Contact Person *</label>
              <input required className="input-field" value={form.contactPersonName} onChange={(e) => setForm(f => ({...f, contactPersonName: e.target.value}))} />
            </div>
            <div>
              <label className="label">Email *</label>
              <input required type="email" className="input-field" value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input required className="input-field" value={form.phone} onChange={(e) => setForm(f => ({...f, phone: e.target.value}))} />
            </div>
            <div>
              <label className="label">OEM Name *</label>
              <input required className="input-field" placeholder="e.g. Siemens, ABB..." value={form.oemName} onChange={(e) => setForm(f => ({...f, oemName: e.target.value}))} />
            </div>
            <div>
              <label className="label">OEM Email <span className="text-gray-400 font-normal">(DRF will be sent here)</span></label>
              <input type="email" className="input-field" placeholder="oem@company.com" value={form.oemEmail} onChange={(e) => setForm(f => ({...f, oemEmail: e.target.value}))} />
            </div>
            <div>
              <label className="label">Lead Status</label>
              <select className="input-field" value={form.status} onChange={(e) => setForm(f => ({...f, status: e.target.value as LeadStatus}))}>
                {(['New','Contacted','Qualified','Not Qualified'] as LeadStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
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
            <textarea rows={2} className="input-field" value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Create Lead'}</button>
          </div>
        </form>
      </Modal>

      {/* CSV Import Modal */}
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Leads from CSV">
        <div className="space-y-4">
          {importDone > 0 ? (
            <div className="text-center py-6">
              <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
              <p className="text-lg font-semibold text-gray-800">{importDone} leads imported!</p>
              <button onClick={() => setShowImport(false)} className="btn-primary mt-4">Done</button>
            </div>
          ) : (
            <>
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-sm text-violet-700">
                <p className="font-semibold mb-1">Expected CSV columns:</p>
                <p className="text-xs font-mono">companyName, contactPersonName, email, phone, oemName, source, city, state, notes</p>
              </div>
              <div>
                <label className="label">Upload CSV file</label>
                <input ref={fileRef} type="file" accept=".csv,.txt" className="input-field" onChange={handleFileChange} />
              </div>
              {importRows.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3 text-sm">
                  <p className="font-medium text-gray-700 mb-2">{importRows.length} rows detected — preview:</p>
                  <div className="overflow-x-auto max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead><tr>{Object.keys(importRows[0]).map(h => <th key={h} className="text-left px-2 py-1 text-gray-500 font-medium">{h}</th>)}</tr></thead>
                      <tbody>{importRows.slice(0,5).map((row, i) => <tr key={i}>{Object.values(row).map((v, j) => <td key={j} className="px-2 py-1 text-gray-700 border-t border-gray-100">{v || '—'}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowImport(false)} className="btn-secondary flex items-center gap-1"><X size={14} />Cancel</button>
                <button onClick={handleImport} disabled={!importRows.length || importing} className="btn-primary">
                  {importing ? 'Importing…' : `Import ${importRows.length} Leads`}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        title="Archive Lead"
        message="Are you sure you want to archive this lead?"
        confirmLabel="Archive"
        danger
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Lead Permanently"
        message="This will permanently delete the lead and cannot be undone. Are you sure?"
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
