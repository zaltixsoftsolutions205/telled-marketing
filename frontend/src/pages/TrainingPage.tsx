import { useEffect, useState, useCallback } from 'react';
import { Plus, Search } from 'lucide-react';
import ExcelImportButton from '@/components/common/ExcelImportButton';
import { trainingApi } from '@/api/training';
import { accountsApi } from '@/api/accounts';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate } from '@/utils/formatters';
import type { Training, Account } from '@/types';

type TrainingStatus = 'Pending' | 'Completed';
type TrainingMode   = 'Online' | 'Offline' | 'Hybrid';

const STATUS_STYLE: Record<TrainingStatus, string> = {
  Pending:   'bg-amber-100 text-amber-700',
  Completed: 'bg-emerald-100 text-emerald-700',
};

const MODE_STYLE: Record<TrainingMode, string> = {
  Online:  'bg-blue-100 text-blue-700',
  Offline: 'bg-gray-100 text-gray-700',
  Hybrid:  'bg-violet-100 text-violet-700',
};

export default function TrainingPage() {
  const user = useAuthStore((s) => s.user);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    accountId: '', mode: 'Online' as TrainingMode, trainingDate: '', notes: '', status: 'Pending' as TrainingStatus,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      if (modeFilter)   params.mode   = modeFilter;
      if (user?.role === 'engineer') params.engineerId = user._id;
      const res = await trainingApi.getAll(params);
      // Filter by search client-side
      const data = search
        ? (res.data || []).filter((t: any) =>
            t.customerName?.toLowerCase().includes(search.toLowerCase()) ||
            t.accountId?.accountName?.toLowerCase().includes(search.toLowerCase())
          )
        : (res.data || []);
      setTrainings(data as Training[]);
      setTotal(search ? data.length : res.pagination?.total ?? 0);
    } catch (err) { console.error('TrainingPage load:', err); setTrainings([]); setTotal(0); } finally { setLoading(false); }
  }, [page, statusFilter, modeFilter, user, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    try {
      const res = await accountsApi.getAll({ limit: 100 });
      setAccounts(res.data || []);
    } catch (err) { console.error('openCreate:', err); }
    setForm({ accountId: '', mode: 'Online', trainingDate: '', notes: '', status: 'Pending' });
    setShowModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await trainingApi.create({ ...form, trainedBy: user?._id });
      setShowModal(false);
      load();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Training</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} training records</p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelImportButton
            entityName="Trainings"
            columnHint="accountName, customerName, trainingDate (YYYY-MM-DD), mode (Online/Offline/Hybrid), notes"
            onImport={async (rows) => {
              let imported = 0;
              const accs = await accountsApi.getAll({ limit: 500 });
              const accList: { _id: string; accountName: string }[] = accs.data || [];
              for (const row of rows) {
                const date = row.trainingDate || row['training date'] || row.date || '';
                if (!date) continue;
                const name = (row.accountName || row.account || '').toLowerCase();
                const acc = accList.find(a => a.accountName.toLowerCase().includes(name));
                if (!acc && !row.customerName) continue;
                const modeRaw = (row.mode || 'Offline');
                const mode = (['Online','Offline','Hybrid'].includes(modeRaw) ? modeRaw : 'Offline') as 'Online'|'Offline'|'Hybrid';
                try {
                  await trainingApi.create({ accountId: acc?._id, customerName: row.customerName || row['customer name'] || '', trainingDate: date, mode, notes: row.notes || '' });
                  imported++;
                } catch { /* skip */ }
              }
              load();
              return { imported };
            }}
          />
          {(user?.role === 'engineer' || user?.role === 'admin') && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Record Training
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by customer..."
            className="input-field pl-9"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Completed">Completed</option>
        </select>
        <select value={modeFilter} onChange={(e) => { setModeFilter(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Modes</option>
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
          <option value="Hybrid">Hybrid</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card !p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="h-48" />
        ) : trainings.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No training records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Customer / Account</th>
                  <th className="table-header">Mode</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Training Date</th>
                  <th className="table-header">Trained By</th>
                  <th className="table-header">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {trainings.map((tr) => (
                  <tr key={tr._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-medium text-gray-900">
                      {tr.customerName}
                    </td>
                    <td className="table-cell">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${MODE_STYLE[tr.mode] ?? ''}`}>{tr.mode}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLE[tr.status] ?? ''}`}>{tr.status}</span>
                    </td>
                    <td className="table-cell text-gray-400">{formatDate(tr.trainingDate)}</td>
                    <td className="table-cell text-gray-500">{(tr.trainedBy as any)?.name || '—'}</td>
                    <td className="table-cell text-gray-400 max-w-xs truncate">{tr.notes || '—'}</td>
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
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Training">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Account / Customer *</label>
            <select required className="input-field" value={form.accountId} onChange={(e) => setForm(f => ({...f, accountId: e.target.value}))}>
              <option value="">Select account</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.accountName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Training Mode *</label>
              <select required className="input-field" value={form.mode} onChange={(e) => setForm(f => ({...f, mode: e.target.value as TrainingMode}))}>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input-field" value={form.status} onChange={(e) => setForm(f => ({...f, status: e.target.value as TrainingStatus}))}>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Training Date *</label>
            <input required type="date" className="input-field" value={form.trainingDate} onChange={(e) => setForm(f => ({...f, trainingDate: e.target.value}))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={3} className="input-field" value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} placeholder="Topics covered, participants, etc." />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Record Training'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
