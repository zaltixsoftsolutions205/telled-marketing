import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, ExternalLink, Plus, Trash2, Wrench, GraduationCap, ChevronDown, ChevronUp } from 'lucide-react';
import ExcelImportButton from '@/components/common/ExcelImportButton';
import { accountsApi } from '@/api/accounts';
import { leadsApi } from '@/api/leads';
import { installationsApi } from '@/api/installations';
import { trainingApi } from '@/api/training';
import { useAuthStore } from '@/store/authStore';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { formatDate } from '@/utils/formatters';
import type { Account, Lead, User, Installation, Training } from '@/types';

type InstForm  = { scheduledDate: string; siteAddress: string; status: string; licenseVersion: string; notes: string };
type TrainForm = { mode: string; trainingDate: string; notes: string; status: string };

const INST_STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];
const MODE_STYLE: Record<string, string> = {
  Online:  'bg-blue-100 text-blue-700',
  Offline: 'bg-gray-100 text-gray-700',
  Hybrid:  'bg-violet-100 text-violet-700',
};

function AscInput({ acc }: { acc: Account }) {
  const [value, setValue] = useState(acc.asc || '');
  const [savedValue, setSavedValue] = useState(acc.asc || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(acc.asc || '');
    setSavedValue(acc.asc || '');
  }, [acc._id, acc.asc]);

  useEffect(() => {
    if (value === savedValue) return;

    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        await accountsApi.update(acc._id, { asc: value });
        setSavedValue(value);
      } catch (err) {
        console.error('save ASC:', err);
      } finally {
        setSaving(false);
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [acc._id, value, savedValue]);

  return (
    <div className="min-w-[120px]">
      <input
        className="input-field h-8 text-xs"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ASC"
      />
      {saving && <p className="text-[10px] text-gray-400 mt-0.5">Saving...</p>}
    </div>
  );
}

function AccountStatusInput({ acc }: { acc: Account }) {
  const [value, setValue] = useState<'Active' | 'Inactive'>(acc.status === 'Active' ? 'Active' : 'Inactive');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(acc.status === 'Active' ? 'Active' : 'Inactive');
  }, [acc._id, acc.status]);

  const handleChange = async (newStatus: 'Active' | 'Inactive') => {
    setValue(newStatus);
    setSaving(true);
    try {
      await accountsApi.update(acc._id, { status: newStatus });
    } catch (err) {
      console.error('save account status:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[180px] sm:max-w-none">
      <select
        className="input-field h-9 text-xs w-full"
        value={value}
        onChange={(e) => handleChange(e.target.value as 'Active' | 'Inactive')}
      >
        <option value="Active">Active</option>
        <option value="Inactive">Inactive</option>
      </select>
      {saving && <p className="text-[10px] text-gray-400 mt-0.5">Saving...</p>}
    </div>
  );
}

// ─── Expanded panel content (shared between desktop row + mobile card) ────────
function EngineerSubPanelContent({
  accountId,
  currentUserId,
}: {
  accountId: string;
  currentUserId: string;
}) {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [trainings, setTrainings]         = useState<Training[]>([]);
  const [loading, setLoading]             = useState(true);

  const [showInstModal,  setShowInstModal]  = useState(false);
  const [editInst,       setEditInst]       = useState<Installation | null>(null);
  const [instForm,       setInstForm]       = useState<InstForm>({ scheduledDate: '', siteAddress: '', status: 'Scheduled', licenseVersion: '', notes: '' });
  const [savingInst,     setSavingInst]     = useState(false);

  const [showTrainModal, setShowTrainModal] = useState(false);
  const [trainForm,      setTrainForm]      = useState<TrainForm>({ mode: 'Online', trainingDate: '', notes: '', status: 'Pending' });
  const [savingTrain,    setSavingTrain]    = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [inst, train] = await Promise.all([
        installationsApi.getByAccount(accountId).catch(() => []),
        trainingApi.getByAccount(accountId).catch(() => []),
      ]);
      setInstallations((inst as Installation[]) || []);
      setTrainings((train as Training[]) || []);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { reload(); }, [reload]);

  const openAddInst = () => {
    setEditInst(null);
    setInstForm({ scheduledDate: '', siteAddress: '', status: 'Scheduled', licenseVersion: '', notes: '' });
    setShowInstModal(true);
  };
  const openEditInst = (inst: Installation) => {
    setEditInst(inst);
    setInstForm({
      scheduledDate: inst.scheduledDate?.slice(0, 10) || '',
      siteAddress:   inst.siteAddress,
      status:        inst.status,
      licenseVersion: inst.licenseVersion || '',
      notes:         inst.notes || '',
    });
    setShowInstModal(true);
  };
  const handleInstSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInst(true);
    try {
      if (editInst) await installationsApi.update(editInst._id, { ...instForm, accountId, engineer: currentUserId });
      else          await installationsApi.create({ ...instForm, accountId, engineer: currentUserId });
      setShowInstModal(false);
      reload();
    } finally { setSavingInst(false); }
  };

  const openAddTrain = () => {
    setTrainForm({ mode: 'Online', trainingDate: '', notes: '', status: 'Pending' });
    setShowTrainModal(true);
  };
  const handleTrainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTrain(true);
    try {
      await trainingApi.create({ ...trainForm, accountId, trainedBy: currentUserId });
      setShowTrainModal(false);
      reload();
    } finally { setSavingTrain(false); }
  };

  if (loading) return <div className="py-8 text-center text-xs text-gray-400">Loading…</div>;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Installations ── */}
        <div className="rounded-xl border border-violet-100 bg-violet-50/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-violet-100 bg-violet-50">
            <div className="flex items-center gap-2">
              <Wrench size={13} className="text-violet-600" />
              <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">Installations</span>
              <span className="text-[10px] bg-violet-100 text-violet-600 font-semibold px-1.5 py-0.5 rounded-full">{installations.length}</span>
            </div>
            <button
              onClick={openAddInst}
              className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 bg-white border border-violet-200 rounded-lg px-2.5 py-1 hover:bg-violet-50 transition-colors"
            >
              <Plus size={11} /> Schedule
            </button>
          </div>

          {installations.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <Wrench size={20} className="text-violet-200 mx-auto mb-1.5" />
              <p className="text-xs text-gray-400">No installations scheduled yet</p>
            </div>
          ) : (
            <div className="divide-y divide-violet-100/60">
              {installations.map(inst => (
                <div key={inst._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-violet-50/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{inst.siteAddress}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {formatDate(inst.scheduledDate)}
                      {inst.licenseVersion && <span className="ml-2 font-medium text-violet-600">{inst.licenseVersion}</span>}
                    </p>
                  </div>
                  <StatusBadge status={inst.status} />
                  <button
                    onClick={() => openEditInst(inst)}
                    className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 shrink-0 hover:underline"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Training ── */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-emerald-100 bg-emerald-50">
            <div className="flex items-center gap-2">
              <GraduationCap size={13} className="text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Training</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-600 font-semibold px-1.5 py-0.5 rounded-full">{trainings.length}</span>
            </div>
            <button
              onClick={openAddTrain}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800 bg-white border border-emerald-200 rounded-lg px-2.5 py-1 hover:bg-emerald-50 transition-colors"
            >
              <Plus size={11} /> Record
            </button>
          </div>

          {trainings.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <GraduationCap size={20} className="text-emerald-200 mx-auto mb-1.5" />
              <p className="text-xs text-gray-400">No training records yet</p>
            </div>
          ) : (
            <div className="divide-y divide-emerald-100/60">
              {trainings.map((tr: any) => (
                <div key={tr._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{tr.customerName || '—'}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(tr.trainingDate)}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${MODE_STYLE[tr.mode] ?? ''}`}>{tr.mode}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${tr.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{tr.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Installation Modal */}
      <Modal isOpen={showInstModal} onClose={() => setShowInstModal(false)} title={editInst ? 'Edit Installation' : 'Schedule Installation'}>
        <form onSubmit={handleInstSubmit} className="space-y-4">
          <div>
            <label className="label">Site Address *</label>
            <input required className="input-field" value={instForm.siteAddress} onChange={e => setInstForm(f => ({ ...f, siteAddress: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Scheduled Date *</label>
              <input required type="date" className="input-field" value={instForm.scheduledDate} onChange={e => setInstForm(f => ({ ...f, scheduledDate: e.target.value }))} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input-field" value={instForm.status} onChange={e => setInstForm(f => ({ ...f, status: e.target.value }))}>
                {INST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">License Version</label>
            <input className="input-field" placeholder="e.g. v2.1" value={instForm.licenseVersion} onChange={e => setInstForm(f => ({ ...f, licenseVersion: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={instForm.notes} onChange={e => setInstForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowInstModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={savingInst} className="btn-primary">{savingInst ? 'Saving…' : editInst ? 'Update' : 'Schedule'}</button>
          </div>
        </form>
      </Modal>

      {/* Training Modal */}
      <Modal isOpen={showTrainModal} onClose={() => setShowTrainModal(false)} title="Record Training">
        <form onSubmit={handleTrainSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Training Mode *</label>
              <select required className="input-field" value={trainForm.mode} onChange={e => setTrainForm(f => ({ ...f, mode: e.target.value }))}>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input-field" value={trainForm.status} onChange={e => setTrainForm(f => ({ ...f, status: e.target.value }))}>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Training Date *</label>
            <input required type="date" className="input-field" value={trainForm.trainingDate} onChange={e => setTrainForm(f => ({ ...f, trainingDate: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={3} className="input-field" value={trainForm.notes} onChange={e => setTrainForm(f => ({ ...f, notes: e.target.value }))} placeholder="Topics covered, participants, etc." />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowTrainModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={savingTrain} className="btn-primary">{savingTrain ? 'Saving…' : 'Record Training'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─── Toggle button + expandable row wrapper ───────────────────────────────────
function EngineerExpandRow({ acc, currentUserId, colSpan }: { acc: Account; currentUserId: string; colSpan: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="hover:bg-violet-50/20 transition-colors">
        <td className="table-cell text-gray-500">{acc.accountNumber ? `#${acc.accountNumber}` : '—'}</td>
        <td className="table-cell font-medium text-violet-700">
          <Link to={`/accounts/${acc._id}`} className="hover:underline">{acc.accountName}</Link>
        </td>
        <td className="table-cell">
          {(acc.leadId as Lead)?.companyName || acc.accountName || <span className="text-gray-300">—</span>}
        </td>
        <td className="table-cell">
          {(acc.assignedEngineer as User)?.name || <span className="text-gray-300">—</span>}
        </td>
        <td className="table-cell">
          {(acc.assignedSales as User)?.name || <span className="text-gray-300">—</span>}
        </td>
        <td className="table-cell"><AccountStatusInput acc={acc} /></td>
        <td className="table-cell text-gray-400">{formatDate(acc.createdAt)}</td>
        <td className="table-cell">
          <AscInput acc={acc} />
        </td>
        <td className="table-cell">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOpen(o => !o)}
              title={open ? 'Hide details' : 'Show installations & training'}
              className={`p-1.5 rounded-md transition-colors ${open ? 'bg-violet-100 text-violet-600' : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50'}`}
            >
              {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <Link to={`/accounts/${acc._id}`} className="p-1 hover:text-violet-600 text-gray-400 inline-block">
              <ExternalLink size={15} />
            </Link>
          </div>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={colSpan} className="px-4 pb-4 pt-0 bg-gray-50/60">
            <div className="border-t border-gray-100 pt-4">
              <EngineerSubPanelContent accountId={acc._id} currentUserId={currentUserId} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main AccountsPage ────────────────────────────────────────────────────────

export default function AccountsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isHRorAdmin = currentUser?.role === 'admin' || currentUser?.role === 'hr' || currentUser?.role === 'finance';
  const isEngineer  = currentUser?.role === 'engineer';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'unassigned' | 'assigned' | 'all'>(isEngineer ? 'assigned' : 'all');

  const [showConvert, setShowConvert] = useState(false);
  const [eligibleLeads, setEligibleLeads] = useState<Lead[]>([]);
  const [convertForm, setConvertForm] = useState({ leadId: '', accountName: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await accountsApi.delete(deleteTarget._id);
      setAccounts(prev => prev.filter(a => a._id !== deleteTarget._id));
      setTotal(prev => prev - 1);
      setDeleteTarget(null);
    } catch (err) { console.error('delete account:', err); }
    finally { setDeleting(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      const res = await accountsApi.getAll(params);
      setAccounts(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) {
      console.error('AccountsPage load:', err);
      setAccounts([]);
      setTotal(0);
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const filteredAccounts = accounts.filter(acc => {
    if (activeTab === 'assigned')   return !!acc.assignedEngineer;
    if (activeTab === 'unassigned') return !acc.assignedEngineer;
    return true;
  });

  const assignedCount   = accounts.filter(a =>  a.assignedEngineer).length;
  const unassignedCount = accounts.filter(a => !a.assignedEngineer).length;

  const openConvert = async () => {
    try {
      const res = await leadsApi.getAll({ stage: 'PO Received', limit: 100 });
      setEligibleLeads(res.data || []);
    } catch { setEligibleLeads([]); }
    setShowConvert(true);
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await accountsApi.convert(convertForm as { leadId: string; accountName: string; notes?: string });
      setShowConvert(false);
      setConvertForm({ leadId: '', accountName: '', notes: '' });
      load();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total accounts</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExcelImportButton
            entityName="Accounts"
            columnHint="leadName (company name to match lead), accountName (optional override), notes"
            onImport={async (rows) => {
              let imported = 0;
              const leadsRes = await leadsApi.getAll({ limit: 500 });
              const leadList: { _id: string; companyName: string }[] = leadsRes.data || [];
              for (const row of rows) {
                const ln = (row.leadName || row.companyName || row.company || row['lead name'] || '').toLowerCase();
                if (!ln) continue;
                const lead = leadList.find(l => l.companyName.toLowerCase().includes(ln));
                if (!lead) continue;
                try {
                  await accountsApi.convert({ leadId: lead._id, accountName: row.accountName || row['account name'] || lead.companyName, notes: row.notes || '' });
                  imported++;
                } catch { /* skip */ }
              }
              load();
              return { imported };
            }}
          />
          <button onClick={openConvert} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Convert Lead
          </button>
        </div>
      </div>

      <div className="relative w-full sm:max-w-xs">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search accounts…"
          className="input-field pl-9"
        />
      </div>

      {/* Tabs */}
      {(isHRorAdmin || isEngineer) && (
        <div className="flex gap-1 border-b border-gray-200">
          {isHRorAdmin ? (
            <>
              <button onClick={() => setActiveTab('all')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all' ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-violet-600'}`}>
                All Accounts <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{accounts.length}</span>
              </button>
              <button onClick={() => setActiveTab('unassigned')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'unassigned' ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-violet-600'}`}>
                Not Assigned <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{unassignedCount}</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setActiveTab('assigned')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'assigned' ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-violet-600'}`}>
                My Accounts <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{assignedCount}</span>
              </button>
              <button onClick={() => setActiveTab('all')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all' ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-violet-600'}`}>
                All Accounts <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{accounts.length}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Desktop Table */}
      <div className="glass-card !p-0 overflow-hidden hidden md:block">
        {loading ? (
          <LoadingSpinner className="h-48" />
        ) : filteredAccounts.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            {activeTab === 'unassigned' ? 'All accounts are assigned' : 'No accounts found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Account Number</th>
                  <th className="table-header">Account Name</th>
                  <th className="table-header">Company</th>
                  <th className="table-header">Engineer</th>
                  <th className="table-header">Sales</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Created</th>
                  <th className="table-header">ASC</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAccounts.map((acc) =>
                  isEngineer ? (
                    <EngineerExpandRow
                      key={acc._id}
                      acc={acc}
                      currentUserId={currentUser?._id || ''}
                      colSpan={9}
                    />
                  ) : (
                    <tr key={acc._id} className="hover:bg-violet-50/20 transition-colors">
                      <td className="table-cell text-gray-500">{acc.accountNumber ? `#${acc.accountNumber}` : '—'}</td>
                      <td className="table-cell font-medium text-violet-700">
                        <Link to={`/accounts/${acc._id}`} className="hover:underline">{acc.accountName}</Link>
                      </td>
                      <td className="table-cell">
                        {(acc.leadId as Lead)?.companyName || acc.accountName || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-cell">
                        {(acc.assignedEngineer as User)?.name || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-cell">
                        {(acc.assignedSales as User)?.name || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-cell"><AccountStatusInput acc={acc} /></td>
                      <td className="table-cell text-gray-400">{formatDate(acc.createdAt)}</td>
                      <td className="table-cell">
                        <AscInput acc={acc} />
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <Link to={`/accounts/${acc._id}`} className="p-1 hover:text-violet-600 text-gray-400 inline-block">
                            <ExternalLink size={15} />
                          </Link>
                          <button onClick={() => setDeleteTarget(acc)} className="p-1 hover:text-red-600 text-gray-400 transition-colors" title="Delete Account">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
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
      {loading ? (
        <LoadingSpinner className="h-48 md:hidden" />
      ) : filteredAccounts.length === 0 ? (
        <div className="md:hidden text-center text-gray-400 py-16 glass-card">
          {activeTab === 'unassigned' ? 'All accounts are assigned' : 'No accounts found'}
        </div>
      ) : (
        <div className="md:hidden space-y-3">
          {filteredAccounts.map((acc) => (
            <MobileAccountCard
              key={acc._id}
              acc={acc}
              isEngineer={isEngineer}
              currentUserId={currentUser?._id || ''}
              onDelete={() => setDeleteTarget(acc)}
            />
          ))}
          {total > 15 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 15)}</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
                <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Convert Modal */}
      <Modal isOpen={showConvert} onClose={() => setShowConvert(false)} title="Convert Lead to Account">
        <form onSubmit={handleConvert} className="space-y-4">
          <div>
            <label className="label">Lead (PO Received) *</label>
            <select required className="input-field" value={convertForm.leadId} onChange={(e) => {
              const lead = eligibleLeads.find(l => l._id === e.target.value);
              setConvertForm(f => ({ ...f, leadId: e.target.value, accountName: lead?.companyName || '' }));
            }}>
              <option value="">Select lead</option>
              {eligibleLeads.map(l => <option key={l._id} value={l._id}>{l.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Account Name *</label>
            <input required className="input-field" value={convertForm.accountName} onChange={(e) => setConvertForm(f => ({ ...f, accountName: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={convertForm.notes} onChange={(e) => setConvertForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowConvert(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Converting…' : 'Convert'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Account"
        message={`Are you sure you want to delete "${deleteTarget?.accountName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}

// ─── Mobile account card ──────────────────────────────────────────────────────
function MobileAccountCard({
  acc, isEngineer, currentUserId, onDelete,
}: {
  acc: Account;
  isEngineer: boolean;
  currentUserId: string;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass-card !p-0 overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-500 truncate"><span className="font-semibold text-gray-700">Account Number:</span> {acc.accountNumber ? `#${acc.accountNumber}` : '—'}</p>
            <Link to={`/accounts/${acc._id}`} className="font-semibold text-violet-700 hover:underline text-sm block truncate">
              {acc.accountName}
            </Link>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {(acc.leadId as Lead)?.companyName || acc.accountName}
            </p>
          </div>
          <AccountStatusInput acc={acc} />
        </div>
        <div className="text-xs text-gray-500 space-y-1">
          {(acc.assignedEngineer as User)?.name && (
            <p><span className="text-gray-400">Engineer:</span> {(acc.assignedEngineer as User).name}</p>
          )}
          {(acc.assignedSales as User)?.name && (
            <p><span className="text-gray-400">Sales:</span> {(acc.assignedSales as User).name}</p>
          )}
          <p><span className="text-gray-400">Created:</span> {formatDate(acc.createdAt)}</p>
          <div>
            <p className="text-gray-400 mb-1">ASC:</p>
            <AscInput acc={acc} />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <Link to={`/accounts/${acc._id}`} className="p-1.5 rounded-md hover:bg-violet-100 hover:text-violet-600 text-gray-400">
            <ExternalLink size={14} />
          </Link>
          {!isEngineer && (
            <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-red-100 hover:text-red-600 text-gray-400 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
          {isEngineer && (
            <button
              onClick={() => setOpen(o => !o)}
              className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${open ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600'}`}
            >
              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Installations & Training
            </button>
          )}
        </div>
      </div>

      {isEngineer && open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50/40">
          <EngineerSubPanelContent accountId={acc._id} currentUserId={currentUserId} />
        </div>
      )}
    </div>
  );
}
