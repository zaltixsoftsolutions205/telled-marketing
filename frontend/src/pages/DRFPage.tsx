import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { drfApi } from '@/api/drf';
import { usersApi } from '@/api/users';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  FileBadge, CheckCircle2, XCircle, Clock, AlertTriangle, Users, Filter, UserCheck,
} from 'lucide-react';
import type { User } from '@/types';

type DRFStatus = 'Pending' | 'Approved' | 'Rejected' | 'Expired';

const STATUS_STYLE: Record<DRFStatus, string> = {
  Pending:  'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
  Expired:  'bg-gray-100 text-gray-600',
};

function StatCard({ title, value, sub, icon: Icon, color, bg }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="card flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} className={color} />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className={`text-2xl font-black mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DRFPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin     = currentUser?.role === 'admin';

  const [analytics, setAnalytics]   = useState<any>(null);
  const [drfs, setDRFs]             = useState<any[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [salesUsers, setSalesUsers] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [salesFilter, setSalesFilter]   = useState('');
  const [oemFilter, setOemFilter]       = useState('');
  const [fromDate, setFromDate]         = useState('');
  const [toDate, setToDate]             = useState('');
  const [multiVersion, setMultiVersion] = useState(false);
  const [page, setPage]                 = useState(1);

  // Reassignment state (admin only)
  const [reassignTarget, setReassignTarget] = useState<any>(null);
  const [newOwnerId, setNewOwnerId]         = useState('');
  const [reassigning, setReassigning]       = useState(false);
  const [reassignError, setReassignError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (statusFilter) params.status      = statusFilter;
      if (salesFilter)  params.salesPerson = salesFilter;
      if (oemFilter)    params.oemName     = oemFilter;
      if (fromDate)     params.from        = fromDate;
      if (toDate)       params.to          = toDate;
      if (multiVersion) params.multiVersion = 'true';
      const [analyticsData, drfRes] = await Promise.all([drfApi.getAnalytics(), drfApi.getAll(params)]);
      setAnalytics(analyticsData);
      setDRFs(drfRes.data);
      setTotal(drfRes.pagination?.total ?? 0);
    } finally { setLoading(false); }
  }, [page, statusFilter, salesFilter, oemFilter, fromDate, toDate, multiVersion]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { usersApi.getSalesmen().then(setSalesUsers).catch(() => {}); }, []);

  const resetFilters = () => {
    setStatusFilter(''); setSalesFilter(''); setOemFilter('');
    setFromDate(''); setToDate(''); setMultiVersion(false); setPage(1);
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignTarget || !newOwnerId) return;
    setReassigning(true);
    setReassignError('');
    try {
      await drfApi.reassign(reassignTarget._id, newOwnerId);
      setReassignTarget(null);
      setNewOwnerId('');
      load();
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Reassignment failed';
      setReassignError(msg);
    } finally { setReassigning(false); }
  };

  if (loading && !analytics) return <LoadingSpinner className="h-64" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">DRF Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Document Request Forms — {total} records</p>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Total DRFs"    value={analytics.total}        sub={`This month: ${analytics.totalThisMonth ?? 0}`} icon={FileBadge}     color="text-violet-700"  bg="bg-violet-50"  />
          <StatCard title="Pending"       value={analytics.pending}      sub="Awaiting review"                                 icon={Clock}         color="text-amber-700"   bg="bg-amber-50"   />
          <StatCard title="Approved"      value={analytics.approved}     sub={`${analytics.approvalRate}% approval rate`}      icon={CheckCircle2}  color="text-emerald-700" bg="bg-emerald-50" />
          <StatCard title="Rejected"      value={analytics.rejected}     sub={`${analytics.rejectionRate}% rejection rate`}    icon={XCircle}       color="text-red-600"     bg="bg-red-50"     />
          <StatCard title="Expiring Soon" value={analytics.expiringSoon} sub="Within 30 days"                                  icon={AlertTriangle} color="text-orange-600"  bg="bg-orange-50"  />
        </div>
      )}

      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} className="text-violet-600" />
              <h2 className="section-title !mb-0">DRFs by Sales Person</h2>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analytics.drfBySalesPerson} layout="vertical" barSize={16} margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={72} />
                <Tooltip cursor={{ fill: '#f5f3ff' }} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                <Bar dataKey="approved" name="Approved" fill="#10b981" radius={[0, 4, 4, 0]} stackId="a" />
                <Bar dataKey="rejected" name="Rejected" fill="#ef4444" radius={[0, 4, 4, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <XCircle size={16} className="text-red-500" />
              <h2 className="section-title !mb-0">Rejection Reasons</h2>
            </div>
            {analytics.rejectionReasons.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">No rejections yet</div>
            ) : (
              <div className="space-y-2">
                {analytics.rejectionReasons.map((r: any) => (
                  <div key={r.reason} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <p className="text-sm text-gray-700 truncate flex-1">{r.reason}</p>
                    <span className="badge bg-red-100 text-red-700 ml-3 flex-shrink-0">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {analytics?.expiringList?.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" />
            <h2 className="font-semibold text-gray-900">Expiring DRFs (next 30 days)</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {analytics.expiringList.slice(0, 5).map((drf: any) => (
              <div key={drf._id} className="px-6 py-3 flex items-center justify-between hover:bg-orange-50/30">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{drf.drfNumber}</p>
                  <p className="text-xs text-gray-500">{drf.leadId?.companyName} — {drf.leadId?.oemName}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-orange-600">Expires {formatDate(drf.expiryDate)}</p>
                  <p className="text-xs text-gray-400">by {drf.createdBy?.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-gray-500" />
          <h2 className="section-title !mb-0">Filter DRFs</h2>
          <button onClick={resetFilters} className="ml-auto text-xs text-violet-600 hover:underline">Reset</button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <select className="input-field" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {(['Pending','Approved','Rejected','Expired'] as DRFStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input-field" value={salesFilter} onChange={(e) => { setSalesFilter(e.target.value); setPage(1); }}>
            <option value="">All Sales Persons</option>
            {salesUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
          <input className="input-field" placeholder="Filter by OEM..." value={oemFilter} onChange={(e) => { setOemFilter(e.target.value); setPage(1); }} />
          <div>
            <label className="label text-xs">From Date</label>
            <input type="date" className="input-field" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="label text-xs">To Date</label>
            <input type="date" className="input-field" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <input type="checkbox" id="multiVer" checked={multiVersion} onChange={(e) => { setMultiVersion(e.target.checked); setPage(1); }} className="w-4 h-4 accent-violet-600" />
            <label htmlFor="multiVer" className="text-sm text-gray-700 cursor-pointer">Multi-version DRFs only</label>
          </div>
        </div>
      </div>

      {/* DRF Table */}
      <div className="glass-card !p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="h-48" />
        ) : drfs.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No DRFs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">DRF #</th>
                  <th className="table-header">Company</th>
                  <th className="table-header">Contact Person</th>
                  <th className="table-header">OEM</th>
                  <th className="table-header">Version</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Sent Date</th>
                  <th className="table-header">Expiry</th>
                  <th className="table-header">Owner</th>
                  {isAdmin && <th className="table-header">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {drfs.map((drf: any) => (
                  <tr key={drf._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-mono text-xs font-semibold text-violet-700">
                      <Link to={`/leads/${drf.leadId?._id}`} className="hover:underline">{drf.drfNumber}</Link>
                    </td>
                    <td className="table-cell font-medium">
                      <Link to={`/leads/${drf.leadId?._id}`} className="hover:text-violet-600 hover:underline">{drf.leadId?.companyName}</Link>
                    </td>
                    <td className="table-cell text-gray-500">{drf.leadId?.contactPersonName || drf.leadId?.contactName || '—'}</td>
                    <td className="table-cell text-gray-500">{drf.leadId?.oemName || '—'}</td>
                    <td className="table-cell text-center">
                      <span className={`badge ${drf.version > 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>v{drf.version}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLE[drf.status as DRFStatus] ?? ''}`}>{drf.status}</span>
                    </td>
                    <td className="table-cell text-gray-400">{formatDate(drf.sentDate)}</td>
                    <td className="table-cell text-gray-400">{drf.expiryDate ? formatDate(drf.expiryDate) : '—'}</td>
                    <td className="table-cell text-gray-500">{drf.createdBy?.name}</td>
                    {isAdmin && (
                      <td className="table-cell">
                        <button
                          onClick={() => { setReassignTarget(drf); setNewOwnerId(''); setReassignError(''); }}
                          title="Reassign DRF ownership"
                          className="p-1 text-gray-400 hover:text-violet-600 flex items-center gap-1 text-xs"
                        >
                          <UserCheck size={15} /> Reassign
                        </button>
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

      {/* Reassign Modal (admin only) */}
      <Modal
        isOpen={!!reassignTarget}
        onClose={() => { setReassignTarget(null); setNewOwnerId(''); setReassignError(''); }}
        title="Reassign DRF Ownership"
        size="sm"
      >
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">DRF</p>
          <p className="text-sm font-semibold text-gray-800">{reassignTarget?.drfNumber}</p>
          <p className="text-xs text-gray-500 mt-0.5">{reassignTarget?.leadId?.companyName} — owned by <span className="font-medium">{reassignTarget?.createdBy?.name}</span></p>
        </div>
        <form onSubmit={handleReassign} className="space-y-4">
          <div>
            <label className="label">Transfer to Sales Person *</label>
            <select required className="input-field" value={newOwnerId}
              onChange={(e) => setNewOwnerId(e.target.value)}>
              <option value="">Select a sales person…</option>
              {salesUsers
                .filter((u) => u._id !== reassignTarget?.createdBy?._id)
                .map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>
          {reassignError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{reassignError}</div>
          )}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setReassignTarget(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={reassigning || !newOwnerId} className="btn-primary">
              {reassigning ? 'Reassigning…' : 'Confirm Reassign'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
