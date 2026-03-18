import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, CheckCircle, XCircle } from 'lucide-react';
import { engineerVisitsApi } from '@/api/engineerVisits';
import { accountsApi } from '@/api/accounts';
import { useAuthStore } from '@/store/authStore';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate, formatCurrency } from '@/utils/formatters';
import type { EngineerVisit, Account, User } from '@/types';

export default function EngineerVisitsPage() {
  const user = useAuthStore((s) => s.user);
  const [visits, setVisits] = useState<EngineerVisit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hrStatusFilter, setHrStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({
    accountId: '', visitDate: '', visitCharges: '', travelAllowance: '', additionalExpense: '', purpose: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (hrStatusFilter) params.hrStatus = hrStatusFilter;
      const res = await engineerVisitsApi.getAll(params);
      setVisits(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) { console.error('EngineerVisitsPage load:', err); setVisits([]); setTotal(0); } finally { setLoading(false); }
  }, [page, hrStatusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    try {
      const res = await accountsApi.getAll({ limit: 100 });
      setAccounts(res.data || []);
    } catch (err) { console.error('openCreate:', err); }
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await engineerVisitsApi.create({
        ...form,
        visitCharges: Number(form.visitCharges),
        travelAllowance: Number(form.travelAllowance),
        additionalExpense: Number(form.additionalExpense),
      });
      setShowCreate(false);
      setForm({ accountId: '', visitDate: '', visitCharges: '', travelAllowance: '', additionalExpense: '', purpose: '', notes: '' });
      load();
    } finally { setSaving(false); }
  };

  const handleApprove = async (visit: EngineerVisit, status: 'Approved' | 'Rejected') => {
    if (status === 'Approved') await engineerVisitsApi.approve(visit._id);
    else await engineerVisitsApi.reject(visit._id);
    load();
  };

  const isHR = user?.role === 'admin' || user?.role === 'hr_finance';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Engineer Visits</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'engineer') && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={16} /> Log Visit</button>
        )}
      </div>

      <div className="flex gap-3">
        <select value={hrStatusFilter} onChange={(e) => { setHrStatusFilter(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All HR Status</option>
          {['Pending', 'Approved', 'Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : visits.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No visits found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Engineer</th>
                  <th className="table-header">Account</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Visit Charges</th>
                  <th className="table-header">Travel</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">HR Status</th>
                  {isHR && <th className="table-header">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visits.map((visit) => (
                  <tr key={visit._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-medium">{(visit.engineerId as User)?.name}</td>
                    <td className="table-cell">{(visit.accountId as Account)?.accountName || '—'}</td>
                    <td className="table-cell text-gray-400">{formatDate(visit.visitDate)}</td>
                    <td className="table-cell">{formatCurrency(visit.visitCharges)}</td>
                    <td className="table-cell">{formatCurrency(visit.travelAllowance)}</td>
                    <td className="table-cell font-semibold text-violet-700">{formatCurrency(visit.totalAmount)}</td>
                    <td className="table-cell"><StatusBadge status={visit.hrStatus} /></td>
                    {isHR && (
                      <td className="table-cell">
                        {visit.hrStatus === 'Pending' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => handleApprove(visit, 'Approved')} className="p-1 text-green-600 hover:text-green-800">
                              <CheckCircle size={16} />
                            </button>
                            <button onClick={() => handleApprove(visit, 'Rejected')} className="p-1 text-red-500 hover:text-red-700">
                              <XCircle size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
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

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Log Engineer Visit">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Account (optional)</label>
            <select className="input-field" value={form.accountId} onChange={(e) => setForm(f => ({...f, accountId: e.target.value}))}>
              <option value="">None</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.accountName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Visit Date *</label>
              <input required type="date" className="input-field" value={form.visitDate} onChange={(e) => setForm(f => ({...f, visitDate: e.target.value}))} />
            </div>
            <div>
              <label className="label">Visit Charges (₹) *</label>
              <input required type="number" min="0" className="input-field" value={form.visitCharges} onChange={(e) => setForm(f => ({...f, visitCharges: e.target.value}))} />
            </div>
            <div>
              <label className="label">Travel Allowance (₹)</label>
              <input type="number" min="0" className="input-field" value={form.travelAllowance} onChange={(e) => setForm(f => ({...f, travelAllowance: e.target.value}))} />
            </div>
            <div>
              <label className="label">Additional Expense (₹)</label>
              <input type="number" min="0" className="input-field" value={form.additionalExpense} onChange={(e) => setForm(f => ({...f, additionalExpense: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="label">Purpose *</label>
            <input required className="input-field" value={form.purpose} onChange={(e) => setForm(f => ({...f, purpose: e.target.value}))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Log Visit'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
