import { useEffect, useState, useCallback } from 'react';
import { Plus, Search } from 'lucide-react';
import { installationsApi } from '@/api/installations';
import { accountsApi } from '@/api/accounts';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate } from '@/utils/formatters';
import type { Installation, Account, User } from '@/types';

const STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];

export default function InstallationsPage() {
  const user = useAuthStore((s) => s.user);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [engineers, setEngineers] = useState<User[]>([]);
  const [form, setForm] = useState({ accountId: '', scheduledDate: '', siteAddress: '', engineer: '', status: 'Scheduled', licenseVersion: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Installation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await installationsApi.getAll(params);
      setInstallations(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) { console.error('InstallationsPage load:', err); setInstallations([]); setTotal(0); } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    const [accRes, engRes] = await Promise.allSettled([
      accountsApi.getAll({ limit: 100 }),
      usersApi.getEngineers(),
    ]);
    setAccounts(accRes.status === 'fulfilled' ? accRes.value.data || [] : []);
    setEngineers(engRes.status === 'fulfilled' ? engRes.value || [] : []);
    setEditTarget(null);
    setForm({ accountId: '', scheduledDate: '', siteAddress: '', engineer: '', status: 'Scheduled', licenseVersion: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = async (inst: Installation) => {
    if (!accounts.length) {
      const [accRes, engRes] = await Promise.allSettled([accountsApi.getAll({ limit: 100 }), usersApi.getEngineers()]);
      setAccounts(accRes.status === 'fulfilled' ? accRes.value.data || [] : []);
      setEngineers(engRes.status === 'fulfilled' ? engRes.value || [] : []);
    }
    setEditTarget(inst);
    setForm({
      accountId: (inst.accountId as Account)?._id || '',
      scheduledDate: inst.scheduledDate?.slice(0, 10) || '',
      siteAddress: inst.siteAddress,
      engineer: (inst.engineer as User)?._id || '',
      status: inst.status,
      licenseVersion: inst.licenseVersion || '',
      notes: inst.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTarget) await installationsApi.update(editTarget._id, form);
      else await installationsApi.create(form);
      setShowModal(false);
      load();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Installations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'engineer') && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={16} /> Schedule</button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" className="input-field pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : installations.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No installations found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Account</th>
                  <th className="table-header">Site Address</th>
                  <th className="table-header">Engineer</th>
                  <th className="table-header">License Ver.</th>
                  <th className="table-header">Scheduled</th>
                  <th className="table-header">Completed</th>
                  <th className="table-header">Status</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {installations.map((inst) => (
                  <tr key={inst._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-medium">{(inst.accountId as Account)?.accountName}</td>
                    <td className="table-cell">{inst.siteAddress}</td>
                    <td className="table-cell">{(inst.engineer as User)?.name || '—'}</td>
                    <td className="table-cell text-gray-500">{inst.licenseVersion || <span className="text-gray-300">—</span>}</td>
                    <td className="table-cell text-gray-400">{formatDate(inst.scheduledDate)}</td>
                    <td className="table-cell text-gray-400">{inst.completedDate ? formatDate(inst.completedDate) : '—'}</td>
                    <td className="table-cell"><StatusBadge status={inst.status} /></td>
                    <td className="table-cell">
                      <button onClick={() => openEdit(inst)} className="text-xs text-violet-600 hover:text-violet-800 font-medium">Edit</button>
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Edit Installation' : 'Schedule Installation'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Account *</label>
            <select required className="input-field" value={form.accountId} onChange={(e) => setForm(f => ({...f, accountId: e.target.value}))}>
              <option value="">Select account</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.accountName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Site Address *</label>
            <input required className="input-field" value={form.siteAddress} onChange={(e) => setForm(f => ({...f, siteAddress: e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Engineer</label>
              <select className="input-field" value={form.engineer} onChange={(e) => setForm(f => ({...f, engineer: e.target.value}))}>
                <option value="">Select engineer</option>
                {engineers.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Scheduled Date *</label>
              <input required type="date" className="input-field" value={form.scheduledDate} onChange={(e) => setForm(f => ({...f, scheduledDate: e.target.value}))} />
            </div>
          </div>
          {editTarget && (
            <div>
              <label className="label">Status</label>
              <select className="input-field" value={form.status} onChange={(e) => setForm(f => ({...f, status: e.target.value}))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">License Version</label>
            <input className="input-field" placeholder="e.g. v2.1" value={form.licenseVersion} onChange={(e) => setForm(f => ({...f, licenseVersion: e.target.value}))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : editTarget ? 'Update' : 'Schedule'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
