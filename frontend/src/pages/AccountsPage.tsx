import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, ExternalLink, Plus } from 'lucide-react';
import { accountsApi } from '@/api/accounts';
import { leadsApi } from '@/api/leads';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate } from '@/utils/formatters';
import type { Account, Lead, User } from '@/types';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showConvert, setShowConvert] = useState(false);
  const [eligibleLeads, setEligibleLeads] = useState<Lead[]>([]);
  const [convertForm, setConvertForm] = useState({ leadId: '', accountName: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      const res = await accountsApi.getAll(params);
      setAccounts(res.data);
      setTotal(res.pagination?.total ?? 0);
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const openConvert = async () => {
    const res = await leadsApi.getAll({ stage: 'PO Received', limit: 100 });
    setEligibleLeads(res.data);
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total accounts</p>
        </div>
        <button onClick={openConvert} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Convert Lead
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search accounts…" className="input-field pl-9" />
      </div>

      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : accounts.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No accounts found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Account Name</th>
                  <th className="table-header">Company</th>
                  <th className="table-header">Engineer</th>
                  <th className="table-header">Sales</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Created</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {accounts.map((acc) => (
                  <tr key={acc._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-medium text-violet-700">
                      <Link to={`/accounts/${acc._id}`} className="hover:underline">{acc.accountName}</Link>
                    </td>
                    <td className="table-cell">{(acc.leadId as Lead)?.companyName}</td>
                    <td className="table-cell">{(acc.assignedEngineer as User)?.name || <span className="text-gray-300">—</span>}</td>
                    <td className="table-cell">{(acc.assignedSales as User)?.name || <span className="text-gray-300">—</span>}</td>
                    <td className="table-cell"><StatusBadge status={acc.status} /></td>
                    <td className="table-cell text-gray-400">{formatDate(acc.createdAt)}</td>
                    <td className="table-cell">
                      <Link to={`/accounts/${acc._id}`} className="p-1 hover:text-violet-600 text-gray-400 inline-block">
                        <ExternalLink size={15} />
                      </Link>
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

      <Modal isOpen={showConvert} onClose={() => setShowConvert(false)} title="Convert Lead to Account">
        <form onSubmit={handleConvert} className="space-y-4">
          <div>
            <label className="label">Lead (PO Received) *</label>
            <select required className="input-field" value={convertForm.leadId} onChange={(e) => {
              const lead = eligibleLeads.find(l => l._id === e.target.value);
              setConvertForm(f => ({...f, leadId: e.target.value, accountName: lead?.companyName || ''}));
            }}>
              <option value="">Select lead</option>
              {eligibleLeads.map(l => <option key={l._id} value={l._id}>{l.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Account Name *</label>
            <input required className="input-field" value={convertForm.accountName} onChange={(e) => setConvertForm(f => ({...f, accountName: e.target.value}))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={convertForm.notes} onChange={(e) => setConvertForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowConvert(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Converting…' : 'Convert'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
