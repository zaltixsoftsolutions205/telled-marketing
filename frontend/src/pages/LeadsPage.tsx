import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ExternalLink, Upload, X, CheckCircle, Trash2, Send, Mail, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import { notify } from '@/store/notificationStore';
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

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => normalizeHeader(h.replace(/^"|"$/g, '')));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
}

// Maps common Excel column header variations → internal field names
const COLUMN_ALIASES: Record<string, string> = {
  // companyName
  'company name': 'companyName', 'company': 'companyName', 'organization': 'companyName',
  'org name': 'companyName', 'firm name': 'companyName', 'business name': 'companyName',
  'account name': 'companyName', 'client name': 'companyName',
  // contactPersonName
  'contact person name': 'contactPersonName', 'contact person': 'contactPersonName',
  'contact name': 'contactPersonName', 'name': 'contactPersonName',
  'person name': 'contactPersonName', 'full name': 'contactPersonName',
  'contact': 'contactPersonName',
  // email
  'email address': 'email', 'e-mail': 'email', 'mail': 'email', 'email id': 'email',
  // phone
  'phone number': 'phone', 'mobile': 'phone', 'mobile number': 'phone',
  'contact number': 'phone', 'cell': 'phone', 'telephone': 'phone',
  // oemName
  'oem name': 'oemName', 'oem': 'oemName', 'vendor': 'oemName', 'vendor name': 'oemName',
  'product': 'oemName', 'product name': 'oemName',
  // source
  'lead source': 'source', 'referred by': 'source',
  // city / state
  'city name': 'city', 'location': 'city',
  'state name': 'state', 'province': 'state',
  // notes
  'note': 'notes', 'remarks': 'notes', 'comment': 'notes', 'comments': 'notes',
  // designation
  'designation': 'designation', 'title': 'designation', 'job title': 'designation',
};

function normalizeHeader(h: string): string {
  const lower = h.trim().toLowerCase();
  return COLUMN_ALIASES[lower] || h.trim();
}

function parseExcel(buffer: ArrayBuffer): Array<Record<string, string>> {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  return json.map(row => {
    const out: Record<string, string> = {};
    for (const key of Object.keys(row)) {
      const normalized = normalizeHeader(key);
      out[normalized] = String(row[key] ?? '').trim();
    }
    return out;
  });
}

const emptyForm = {
  companyName: '', contactPersonPrefix: 'Mr.', contactPersonName: '',
  designation: '', email: '', phone: '',
  address: '', website: '', annualTurnover: '',
  oemName: '', oemEmail: '', channelPartner: 'Telled Marketing',
  expectedClosure: '', source: '', city: '', state: '',
  assignedTo: '', status: 'New' as LeadStatus, notes: '',
};

const emptyDrfForm = {
  accountName: '', contactPersonPrefix: 'Mr.', contactPerson: '',
  designation: '', contactNo: '', email: '',
  address: '', website: '', annualTurnover: '',
  interestedModules: '', oemEmail: '', channelPartner: 'Telled Marketing',
  expectedClosure: '', partnerSalesRep: '',
};

export default function LeadsPage() {
  const user = useAuthStore((s) => s.user);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<LeadStatus | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [salesUsers, setSalesUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [editSaving, setEditSaving] = useState(false);

  const openEditModal = (lead: Lead) => {
    const cp = (lead.contactPersonName || lead.contactName || '');
    const prefix = cp.startsWith('Ms.') ? 'Ms.' : cp.startsWith('Dr.') ? 'Dr.' : 'Mr.';
    const name = cp.replace(/^((Mr|Ms|Dr)\.\s*)+/i, '').trim();
    setEditForm({
      companyName: lead.companyName || '',
      contactPersonPrefix: prefix,
      contactPersonName: name,
      designation: (lead as any).designation || '',
      email: lead.email || '',
      phone: lead.phone || '',
      address: (lead as any).address || lead.address || '',
      website: (lead as any).website || '',
      annualTurnover: (lead as any).annualTurnover || '',
      oemName: lead.oemName || '',
      oemEmail: (lead as any).oemEmail || lead.oemEmail || '',
      channelPartner: (lead as any).channelPartner || 'Telled Marketing',
      expectedClosure: (lead as any).expectedClosure || '',
      source: (lead as any).source || '',
      city: lead.city || '',
      state: lead.state || '',
      assignedTo: (lead.assignedTo as User)?._id || '',
      status: lead.status || 'New',
      notes: lead.notes || '',
    });
    setEditTarget(lead);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const { contactPersonPrefix, ...rest } = editForm;
      const updated = await leadsApi.update(editTarget._id, {
        ...rest,
        contactPersonName: `${contactPersonPrefix} ${editForm.contactPersonName}`.trim(),
      });
      setLeads(prev => prev.map(l => l._id === editTarget._id ? { ...l, ...updated } : l));
      notify('Lead Updated', `Lead "${editForm.companyName}" updated.`, 'lead', '/leads');
      setEditTarget(null);
    } finally { setEditSaving(false); }
  };

  // Send DRF modal
  const [drfTarget, setDrfTarget] = useState<Lead | null>(null);
  const [drfForm, setDrfForm] = useState({ ...emptyDrfForm });
  const [drfSaving, setDrfSaving] = useState(false);
  const [drfError, setDrfError] = useState('');

  // CSV import
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
    } catch { setLeads([]); setTotal(0); } finally { setLoading(false); }
  }, [page, search, statusTab, user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (user?.role === 'admin') usersApi.getSalesmen().then(setSalesUsers).catch(() => {});
  }, [user?.role]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { contactPersonPrefix, ...rest } = form;
      await leadsApi.create({
        ...rest,
        contactPersonName: `${contactPersonPrefix} ${form.contactPersonName}`.trim(),
      });
      notify('Lead Created', `New lead "${form.companyName}" added successfully.`, 'lead', '/leads');
      setShowModal(false);
      setForm({ ...emptyForm });
      load();
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    setUpdatingStatus(leadId);
    try {
      await leadsApi.update(leadId, { status: newStatus });
      setLeads(prev => prev.map(l => l._id === leadId ? { ...l, status: newStatus } : l));
    } catch { } finally { setUpdatingStatus(null); }
  };

  const openDrfModal = (lead: Lead) => {
    const assignedUser = lead.assignedTo as User;
    const cp = lead.contactPersonName || lead.contactName || '';
    const cpPrefix = cp.startsWith('Ms.') ? 'Ms.' : cp.startsWith('Dr.') ? 'Dr.' : 'Mr.';
    const cpName = cp.replace(/^((Mr|Ms|Dr)\.\s*)+/i, '').trim();
    setDrfForm({
      accountName: lead.companyName || '',
      contactPersonPrefix: cpPrefix,
      contactPerson: cpName,
      designation: (lead as any).designation || '',
      contactNo: lead.phone || '',
      email: lead.email || '',
      address: (lead as any).address || '',
      website: (lead as any).website || '',
      annualTurnover: (lead as any).annualTurnover || '',
      interestedModules: lead.oemName || '',
      oemEmail: (lead as any).oemEmail || '',
      channelPartner: (lead as any).channelPartner || 'Telled Marketing',
      expectedClosure: (lead as any).expectedClosure || '',
      partnerSalesRep: assignedUser?.name || user?.name || '',
    });
    setDrfError('');
    setDrfTarget(lead);
  };

  const handleSendDrf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drfTarget) return;
    if (!drfForm.oemEmail) { setDrfError('OEM Email is required'); return; }
    setDrfSaving(true); setDrfError('');
    try {
      await leadsApi.sendDrf(drfTarget._id, {
        accountName: drfForm.accountName,
        contactPerson: `${drfForm.contactPersonPrefix} ${drfForm.contactPerson}`.trim(),
        designation: drfForm.designation,
        contactNo: drfForm.contactNo,
        email: drfForm.email,
        address: drfForm.address,
        website: drfForm.website,
        annualTurnover: drfForm.annualTurnover,
        interestedModules: drfForm.interestedModules,
        oemEmail: drfForm.oemEmail,
        channelPartner: drfForm.channelPartner,
        expectedClosure: drfForm.expectedClosure,
        partnerSalesRep: drfForm.partnerSalesRep,
      });
      setLeads(prev => prev.map(l => l._id === drfTarget._id ? { ...l, drfEmailSent: true } as any : l));
      notify('DRF Sent', `DRF email sent for "${drfTarget.companyName}".`, 'drf', '/drfs');
      setDrfTarget(null);
    } catch (err: any) {
      setDrfError(err?.response?.data?.message || 'Failed to send DRF');
    } finally { setDrfSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await leadsApi.delete(deleteTarget);
    notify('Lead Deleted', 'Lead has been removed.', 'lead');
    setDeleteTarget(null);
    load();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();
    if (isExcel) {
      reader.onload = (ev) => {
        const rows = parseExcel(ev.target?.result as ArrayBuffer);
        setImportRows(rows);
        setImportDone(0);
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (ev) => { setImportRows(parseCSV(ev.target?.result as string)); setImportDone(0); };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!importRows.length) return;
    setImporting(true);
    try {
      const res = await leadsApi.importLeads(importRows);
      setImportDone(res.imported);
      notify('Leads Imported', `${res.imported} lead(s) imported from file.`, 'lead', '/leads');
      setImportRows([]);
      load();
    } finally { setImporting(false); }
  };

  const f = (field: keyof typeof form, val: string) => setForm(p => ({ ...p, [field]: val }));
  const df = (field: keyof typeof drfForm, val: string) => setDrfForm(p => ({ ...p, [field]: val }));
  const ef = (field: keyof typeof emptyForm, val: string) => setEditForm(p => ({ ...p, [field]: val }));

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total leads</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setShowImport(true); setImportDone(0); setImportRows([]); }} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={14} /> <span className="hidden sm:inline">Import Excel / CSV</span><span className="sm:hidden">Import</span>
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> <span className="hidden sm:inline">New Lead</span><span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button key={tab} onClick={() => { setStatusTab(tab); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${statusTab === tab ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-sm">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search leads…" className="input-field pl-9" />
      </div>

      {/* Desktop Table */}
      <div className="glass-card !p-0 overflow-hidden hidden md:block">
        {loading ? <LoadingSpinner className="h-48" /> : leads.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No leads found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Company</th>
                  <th className="table-header">Contact Person</th>
                  <th className="table-header">Designation</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">E-mail</th>
                  <th className="table-header">OEM / Modules</th>
                  <th className="table-header">OEM Email</th>
                  <th className="table-header">Channel Partner</th>
                  <th className="table-header">Expected Closure</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Stage</th>
                  <th className="table-header">Assigned To</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map((lead) => (
                  <tr key={lead._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-medium text-violet-700 whitespace-nowrap">
                      <Link to={`/leads/${lead._id}`} className="hover:underline">{lead.companyName}</Link>
                    </td>
                    <td className="table-cell whitespace-nowrap">{lead.contactPersonName || lead.contactName || '—'}</td>
                    <td className="table-cell text-gray-500">{(lead as any).designation || '—'}</td>
                    <td className="table-cell text-gray-400 whitespace-nowrap">{lead.phone || '—'}</td>
                    <td className="table-cell text-gray-500">{lead.email || '—'}</td>
                    <td className="table-cell text-gray-500">{lead.oemName || '—'}</td>
                    <td className="table-cell text-gray-400">{(lead as any).oemEmail || lead.oemEmail || '—'}</td>
                    <td className="table-cell text-gray-500">{(lead as any).channelPartner || '—'}</td>
                    <td className="table-cell text-gray-500 whitespace-nowrap">{(lead as any).expectedClosure || '—'}</td>
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
                    <td className="table-cell whitespace-nowrap">{(lead.assignedTo as User)?.name || '—'}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <Link to={`/leads/${lead._id}`} title="View Details"
                          className="p-1.5 rounded-md hover:bg-violet-100 hover:text-violet-600 text-gray-400 transition-colors">
                          <ExternalLink size={13} />
                        </Link>
                        <button onClick={() => openEditModal(lead)} title="Edit"
                          className="p-1.5 rounded-md hover:bg-amber-100 hover:text-amber-600 text-gray-400 transition-colors">
                          <Pencil size={13} />
                        </button>
                        {lead.status === 'Qualified' && (
                          (lead as any).drfEmailSent ? (
                            <span title="DRF sent" className="p-1.5 text-green-500"><CheckCircle size={13} /></span>
                          ) : (
                            <button onClick={() => openDrfModal(lead)} title="Send DRF"
                              className="p-1.5 rounded-md hover:bg-blue-100 hover:text-blue-600 text-blue-400 transition-colors">
                              <Send size={13} />
                            </button>
                          )
                        )}
                        <button onClick={() => setDeleteTarget(lead._id)} title="Delete"
                          className="p-1.5 rounded-md hover:bg-red-100 hover:text-red-600 text-gray-400 transition-colors">
                          <Trash2 size={13} />
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

      {/* Mobile Card View */}
      {!loading && leads.length > 0 && (
        <div className="md:hidden space-y-3">
          {leads.map((lead) => (
            <div key={lead._id} className="glass-card !p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link to={`/leads/${lead._id}`} className="font-semibold text-violet-700 hover:underline text-sm">{lead.companyName}</Link>
                  <p className="text-xs text-gray-500 mt-0.5">{lead.contactPersonName || lead.contactName}{(lead as any).designation ? ` · ${(lead as any).designation}` : ''}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{lead.phone || ''}{lead.email ? ` · ${lead.email}` : ''}</p>
                </div>
                <StatusBadge status={lead.stage} />
              </div>
              {((lead as any).oemEmail || lead.oemEmail || (lead as any).channelPartner || (lead as any).expectedClosure) && (
                <div className="text-xs text-gray-500 space-y-0.5">
                  {(lead.oemName) && <p><span className="text-gray-400">OEM:</span> {lead.oemName}</p>}
                  {((lead as any).oemEmail || lead.oemEmail) && <p><span className="text-gray-400">OEM Email:</span> {(lead as any).oemEmail || lead.oemEmail}</p>}
                  {(lead as any).channelPartner && <p><span className="text-gray-400">Channel Partner:</span> {(lead as any).channelPartner}</p>}
                  {(lead as any).expectedClosure && <p><span className="text-gray-400">Closure:</span> {(lead as any).expectedClosure}</p>}
                </div>
              )}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-gray-500">{lead.oemName || '—'}</span>
                {updatingStatus === lead._id ? (
                  <span className="badge text-xs bg-violet-100 text-violet-600 animate-pulse">Updating…</span>
                ) : (
                  <select
                    value={lead.status || 'New'}
                    onChange={(e) => handleStatusChange(lead._id, e.target.value as LeadStatus)}
                    className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer ${STATUS_COLORS[lead.status as LeadStatus] || 'bg-gray-100 text-gray-600'}`}
                  >
                    {(['New', 'Contacted', 'Qualified', 'Not Qualified'] as LeadStatus[]).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <span className="text-xs text-gray-400">{(lead.assignedTo as User)?.name || '—'} · {formatDate(lead.createdAt)}</span>
                <div className="flex items-center gap-1.5">
                  <Link to={`/leads/${lead._id}`} title="View Details"
                    className="p-1.5 rounded-md hover:bg-violet-100 hover:text-violet-600 text-gray-400">
                    <ExternalLink size={14} />
                  </Link>
                  <button onClick={() => openEditModal(lead)} title="Edit"
                    className="p-1.5 rounded-md hover:bg-amber-100 hover:text-amber-600 text-gray-400">
                    <Pencil size={14} />
                  </button>
                  {lead.status === 'Qualified' && (
                    (lead as any).drfEmailSent ? (
                      <span title="DRF sent" className="p-1.5 text-green-500"><CheckCircle size={14} /></span>
                    ) : (
                      <button onClick={() => openDrfModal(lead)} title="Send DRF"
                        className="p-1.5 rounded-md hover:bg-blue-100 hover:text-blue-600 text-blue-400">
                        <Send size={14} />
                      </button>
                    )
                  )}
                  <button onClick={() => setDeleteTarget(lead._id)} title="Delete"
                    className="p-1.5 rounded-md hover:bg-red-100 hover:text-red-600 text-gray-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && leads.length === 0 && (
        <div className="md:hidden text-center text-gray-400 py-16 glass-card">No leads found</div>
      )}

      {/* ── New Lead Modal ── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Lead" size="lg">
        <form onSubmit={handleCreate} className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="label text-xs">Account Name *</label>
              <input required className="input-field py-1.5 text-sm" placeholder="Company name" value={form.companyName} onChange={(e) => f('companyName', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Contact Person *</label>
              <div className="flex gap-1">
                <select className="input-field py-1.5 text-sm w-20 flex-shrink-0" value={form.contactPersonPrefix} onChange={(e) => f('contactPersonPrefix', e.target.value)}>
                  <option>Mr.</option><option>Ms.</option><option>Dr.</option>
                </select>
                <input required className="input-field py-1.5 text-sm flex-1" placeholder="Full name" value={form.contactPersonName} onChange={(e) => f('contactPersonName', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label text-xs">Designation</label>
              <input className="input-field py-1.5 text-sm" placeholder="e.g. IT Manager" value={form.designation} onChange={(e) => f('designation', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Contact No. *</label>
              <input required className="input-field py-1.5 text-sm" value={form.phone} onChange={(e) => f('phone', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">E-mail *</label>
              <input required type="email" className="input-field py-1.5 text-sm" value={form.email} onChange={(e) => f('email', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label text-xs">Address & Location</label>
              <input className="input-field py-1.5 text-sm" placeholder="Full address" value={form.address} onChange={(e) => f('address', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Web Site</label>
              <input className="input-field py-1.5 text-sm" placeholder="https://" value={form.website} onChange={(e) => f('website', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Annual Turnover</label>
              <input className="input-field py-1.5 text-sm" placeholder="e.g. 5 Crore" value={form.annualTurnover} onChange={(e) => f('annualTurnover', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">OEM / Modules *</label>
              <input required className="input-field py-1.5 text-sm" placeholder="e.g. Ansys, Siemens" value={form.oemName} onChange={(e) => f('oemName', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">OEM Email</label>
              <input type="email" className="input-field py-1.5 text-sm" placeholder="oem@company.com" value={form.oemEmail} onChange={(e) => f('oemEmail', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Channel Partner</label>
              <input className="input-field py-1.5 text-sm" value={form.channelPartner} onChange={(e) => f('channelPartner', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Expected Closure</label>
              <input className="input-field py-1.5 text-sm" placeholder="e.g. Q2 2026" value={form.expectedClosure} onChange={(e) => f('expectedClosure', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">City</label>
              <input className="input-field py-1.5 text-sm" value={form.city} onChange={(e) => f('city', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">State</label>
              <input className="input-field py-1.5 text-sm" value={form.state} onChange={(e) => f('state', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Status</label>
              <select className="input-field py-1.5 text-sm" value={form.status} onChange={(e) => f('status', e.target.value)}>
                {(['New','Contacted','Qualified','Not Qualified'] as LeadStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Source</label>
              <select className="input-field py-1.5 text-sm" value={form.source} onChange={(e) => f('source', e.target.value)}>
                <option value="">Select</option>
                {['Cold Call','Email','Referral','Website','Exhibition','LinkedIn','Other'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {user?.role === 'admin' && (
              <div className="col-span-2">
                <label className="label text-xs">Assign To</label>
                <select className="input-field py-1.5 text-sm" value={form.assignedTo} onChange={(e) => f('assignedTo', e.target.value)}>
                  <option value="">Unassigned</option>
                  {salesUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="label text-xs">Notes</label>
              <textarea rows={2} className="input-field py-1.5 text-sm" value={form.notes} onChange={(e) => f('notes', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary py-1.5 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary py-1.5 text-sm">{saving ? 'Saving…' : 'Create Lead'}</button>
          </div>
        </form>
      </Modal>

      {/* ── Send DRF Modal ── */}
      <Modal isOpen={!!drfTarget} onClose={() => setDrfTarget(null)} title="Send DRF" size="lg">
        {drfTarget && (
          <form onSubmit={handleSendDrf} className="space-y-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 rounded-lg border border-violet-100">
              <Mail size={14} className="text-violet-600 flex-shrink-0" />
              <p className="text-xs text-violet-700">Fill in the details below. The DRF email will be sent to the OEM email you enter.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Account Name & Group Name *</label>
                <input required className="input-field" value={drfForm.accountName} onChange={(e) => df('accountName', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address & Location</label>
                <input className="input-field" value={drfForm.address} onChange={(e) => df('address', e.target.value)} />
              </div>
              <div>
                <label className="label">Web Site</label>
                <input className="input-field" placeholder="https://" value={drfForm.website} onChange={(e) => df('website', e.target.value)} />
              </div>
              <div>
                <label className="label">Annual Turnover</label>
                <input className="input-field" placeholder="e.g. 5 Crore" value={drfForm.annualTurnover} onChange={(e) => df('annualTurnover', e.target.value)} />
              </div>
              <div>
                <label className="label">Contact Person *</label>
                <div className="flex gap-2">
                  <select className="input-field w-20 flex-shrink-0" value={drfForm.contactPersonPrefix} onChange={(e) => df('contactPersonPrefix', e.target.value)}>
                    <option>Mr.</option><option>Ms.</option><option>Dr.</option>
                  </select>
                  <input required className="input-field flex-1" value={drfForm.contactPerson} onChange={(e) => df('contactPerson', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Designation</label>
                <input className="input-field" value={drfForm.designation} onChange={(e) => df('designation', e.target.value)} />
              </div>
              <div>
                <label className="label">Contact No.</label>
                <input className="input-field" value={drfForm.contactNo} onChange={(e) => df('contactNo', e.target.value)} />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input type="email" className="input-field" value={drfForm.email} onChange={(e) => df('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Partner Sales Rep</label>
                <input className="input-field" value={drfForm.partnerSalesRep} onChange={(e) => df('partnerSalesRep', e.target.value)} />
              </div>
              <div>
                <label className="label">Channel Partner</label>
                <input className="input-field" value={drfForm.channelPartner} onChange={(e) => df('channelPartner', e.target.value)} />
              </div>
              <div>
                <label className="label">Potential / Interested Modules</label>
                <input className="input-field" value={drfForm.interestedModules} onChange={(e) => df('interestedModules', e.target.value)} />
              </div>
              <div>
                <label className="label">Expected Closure</label>
                <input className="input-field" placeholder="e.g. Q2 2026" value={drfForm.expectedClosure} onChange={(e) => df('expectedClosure', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Send To — OEM Email *</label>
                <input required type="email" className="input-field" placeholder="oem@company.com" value={drfForm.oemEmail} onChange={(e) => df('oemEmail', e.target.value)} />
              </div>
            </div>

            {drfError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{drfError}</p>}

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setDrfTarget(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={drfSaving} className="btn-primary flex items-center gap-2">
                <Send size={14} />
                {drfSaving ? 'Sending…' : 'Send DRF'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Edit Lead Modal ── */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Lead" size="lg">
        {editTarget && (
          <form onSubmit={handleEdit} className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="label text-xs">Account Name *</label>
                <input required className="input-field py-1.5 text-sm" placeholder="Company name" value={editForm.companyName} onChange={(e) => ef('companyName', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Contact Person *</label>
                <div className="flex gap-1">
                  <select className="input-field py-1.5 text-sm w-20 flex-shrink-0" value={editForm.contactPersonPrefix} onChange={(e) => ef('contactPersonPrefix', e.target.value)}>
                    <option>Mr.</option><option>Ms.</option><option>Dr.</option>
                  </select>
                  <input required className="input-field py-1.5 text-sm flex-1" placeholder="Full name" value={editForm.contactPersonName} onChange={(e) => ef('contactPersonName', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label text-xs">Designation</label>
                <input className="input-field py-1.5 text-sm" placeholder="e.g. IT Manager" value={editForm.designation} onChange={(e) => ef('designation', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Contact No. *</label>
                <input required className="input-field py-1.5 text-sm" value={editForm.phone} onChange={(e) => ef('phone', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">E-mail *</label>
                <input required type="email" className="input-field py-1.5 text-sm" value={editForm.email} onChange={(e) => ef('email', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label text-xs">Address & Location</label>
                <input className="input-field py-1.5 text-sm" placeholder="Full address" value={editForm.address} onChange={(e) => ef('address', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Web Site</label>
                <input className="input-field py-1.5 text-sm" placeholder="https://" value={editForm.website} onChange={(e) => ef('website', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Annual Turnover</label>
                <input className="input-field py-1.5 text-sm" placeholder="e.g. 5 Crore" value={editForm.annualTurnover} onChange={(e) => ef('annualTurnover', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">OEM / Modules *</label>
                <input required className="input-field py-1.5 text-sm" placeholder="e.g. Ansys, Siemens" value={editForm.oemName} onChange={(e) => ef('oemName', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">OEM Email</label>
                <input type="email" className="input-field py-1.5 text-sm" placeholder="oem@company.com" value={editForm.oemEmail} onChange={(e) => ef('oemEmail', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Channel Partner</label>
                <input className="input-field py-1.5 text-sm" value={editForm.channelPartner} onChange={(e) => ef('channelPartner', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Expected Closure</label>
                <input className="input-field py-1.5 text-sm" placeholder="e.g. Q2 2026" value={editForm.expectedClosure} onChange={(e) => ef('expectedClosure', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">City</label>
                <input className="input-field py-1.5 text-sm" value={editForm.city} onChange={(e) => ef('city', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">State</label>
                <input className="input-field py-1.5 text-sm" value={editForm.state} onChange={(e) => ef('state', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Status</label>
                <select className="input-field py-1.5 text-sm" value={editForm.status} onChange={(e) => ef('status', e.target.value)}>
                  {(['New','Contacted','Qualified','Not Qualified'] as LeadStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">Source</label>
                <select className="input-field py-1.5 text-sm" value={editForm.source} onChange={(e) => ef('source', e.target.value)}>
                  <option value="">Select</option>
                  {['Cold Call','Email','Referral','Website','Exhibition','LinkedIn','Other'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {user?.role === 'admin' && (
                <div className="col-span-2">
                  <label className="label text-xs">Assign To</label>
                  <select className="input-field py-1.5 text-sm" value={editForm.assignedTo} onChange={(e) => ef('assignedTo', e.target.value)}>
                    <option value="">Unassigned</option>
                    {salesUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <label className="label text-xs">Notes</label>
                <textarea rows={2} className="input-field py-1.5 text-sm" value={editForm.notes} onChange={(e) => ef('notes', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setEditTarget(null)} className="btn-secondary py-1.5 text-sm">Cancel</button>
              <button type="submit" disabled={editSaving} className="btn-primary py-1.5 text-sm">{editSaving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* CSV Import Modal */}
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Leads from Excel / CSV">
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
                <p className="font-semibold mb-1">Supported columns (any order, flexible naming):</p>
                <p className="text-xs font-mono">companyName, contactPersonName, email, phone, oemName, source, city, state, notes, designation</p>
                <p className="text-xs mt-1 text-violet-500">Common variations like "Company Name", "Contact Person", "Mobile", "Organization" are auto-mapped.</p>
              </div>
              {importRows.length > 0 && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  Detected columns: <span className="font-mono text-gray-700">{Object.keys(importRows[0]).join(', ')}</span>
                </div>
              )}
              <div>
                <label className="label">Upload Excel or CSV file</label>
                <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="input-field" onChange={handleFileChange} />
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
