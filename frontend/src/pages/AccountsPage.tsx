import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { accountsApi } from '@/api/accounts';
import { leadsApi } from '@/api/leads';
import { useAuthStore } from '@/store/authStore';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { formatDate } from '@/utils/formatters';
import type { Account, Lead, User } from '@/types';

export default function AccountsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isHRorAdmin = currentUser?.role === 'admin' || currentUser?.role === 'hr_finance';
  const isEngineer  = currentUser?.role === 'engineer';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Engineers see only their assigned accounts; everyone else sees all
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
    } catch (err) {
      console.error('delete account:', err);
    } finally {
      setDeleting(false);
    }
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
    } finally {
      setLoading(false);
    }
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
    } catch (err) {
      console.error('openConvert:', err);
      setEligibleLeads([]);
    }
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
    } finally {
      setSaving(false);
    }
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
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search accounts…"
          className="input-field pl-9"
        />
      </div>

      {/* Tabs — only shown when there are multiple views */}
      {(isHRorAdmin || isEngineer) && (
        <div className="flex gap-1 border-b border-gray-200">
          {isHRorAdmin ? (
            <>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all' ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-violet-600'}`}
              >
                All Accounts <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{accounts.length}</span>
              </button>
              <button
                onClick={() => setActiveTab('unassigned')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'unassigned' ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-violet-600'}`}
              >
                Not Assigned <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{unassignedCount}</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab('assigned')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'assigned' ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-violet-600'}`}
              >
                My Accounts <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{assignedCount}</span>
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all' ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-violet-600'}`}
              >
                All Accounts <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{accounts.length}</span>
              </button>
            </>
          )}
        </div>
      )}

      <div className="glass-card !p-0 overflow-hidden">
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
                {filteredAccounts.map((acc) => (
                  <tr key={acc._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-medium text-violet-700">
                      <Link to={`/accounts/${acc._id}`} className="hover:underline">
                        {acc.accountName}
                      </Link>
                    </td>
                    <td className="table-cell">
                      {(acc.leadId as Lead)?.companyName || acc.accountName || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="table-cell">
                      {(acc.assignedEngineer as User)?.name || (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {(acc.assignedSales as User)?.name || (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={acc.status} />
                    </td>
                    <td className="table-cell text-gray-400">
                      {formatDate(acc.createdAt)}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/accounts/${acc._id}`}
                          className="p-1 hover:text-violet-600 text-gray-400 inline-block"
                        >
                          <ExternalLink size={15} />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(acc)}
                          className="p-1 hover:text-red-600 text-gray-400 transition-colors"
                          title="Delete Account"
                        >
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
            <p className="text-sm text-gray-500">
              Page {page} of {Math.ceil(total / 15)}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="btn-secondary py-1 px-3 text-sm"
              >
                Prev
              </button>
              <button
                disabled={page >= Math.ceil(total / 15)}
                onClick={() => setPage(p => p + 1)}
                className="btn-secondary py-1 px-3 text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showConvert} onClose={() => setShowConvert(false)} title="Convert Lead to Account">
        <form onSubmit={handleConvert} className="space-y-4">
          <div>
            <label className="label">Lead (PO Received) *</label>
            <select
              required
              className="input-field"
              value={convertForm.leadId}
              onChange={(e) => {
                const lead = eligibleLeads.find(l => l._id === e.target.value);
                setConvertForm(f => ({
                  ...f,
                  leadId: e.target.value,
                  accountName: lead?.companyName || ''
                }));
              }}
            >
              <option value="">Select lead</option>
              {eligibleLeads.map(l => (
                <option key={l._id} value={l._id}>
                  {l.companyName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Account Name *</label>
            <input
              required
              className="input-field"
              value={convertForm.accountName}
              onChange={(e) =>
                setConvertForm(f => ({ ...f, accountName: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              rows={2}
              className="input-field"
              value={convertForm.notes}
              onChange={(e) =>
                setConvertForm(f => ({ ...f, notes: e.target.value }))
              }
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setShowConvert(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Converting…' : 'Convert'}
            </button>
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