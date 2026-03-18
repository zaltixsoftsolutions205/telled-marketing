// import { useEffect, useState, useCallback } from 'react';
// import { Link, useNavigate } from 'react-router-dom';
// import { drfApi } from '@/api/drf';
// import { quotationsApi } from '@/api/quotations';
// import { usersApi } from '@/api/users';
// import LoadingSpinner from '@/components/common/LoadingSpinner';
// import Modal from '@/components/common/Modal';
// import { formatDate, formatCurrency } from '@/utils/formatters';
// import { useAuthStore } from '@/store/authStore';
// import {
//   FileBadge, CheckCircle2, XCircle, Clock, AlertTriangle, Filter, UserCheck, FileText, Plus, Trash2,
// } from 'lucide-react';
// import type { User } from '@/types';

// const emptyItem = { description: '', quantity: 1, unitPrice: 0, total: 0 };

// type DRFStatus = 'Pending' | 'Approved' | 'Rejected' | 'Expired';

// const STATUS_STYLE: Record<DRFStatus, string> = {
//   Pending:  'bg-amber-100 text-amber-700',
//   Approved: 'bg-emerald-100 text-emerald-700',
//   Rejected: 'bg-red-100 text-red-700',
//   Expired:  'bg-gray-100 text-gray-600',
// };

// function StatCard({ title, value, sub, icon: Icon, color, bg }: {
//   title: string; value: string | number; sub?: string;
//   icon: React.ElementType; color: string; bg: string;
// }) {
//   return (
//     <div className="card flex items-start gap-4 hover:shadow-md transition-shadow">
//       <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center flex-shrink-0`}>
//         <Icon size={22} className={color} />
//       </div>
//       <div>
//         <p className="text-sm text-gray-500 font-medium">{title}</p>
//         <p className={`text-2xl font-black mt-0.5 ${color}`}>{value}</p>
//         {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
//       </div>
//     </div>
//   );
// }

// export default function DRFPage() {
//   const currentUser = useAuthStore((s) => s.user);
//   const isAdmin     = currentUser?.role === 'admin';
//   const navigate    = useNavigate();

//   const [analytics, setAnalytics]   = useState<any>(null);
//   const [drfs, setDRFs]             = useState<any[]>([]);
//   const [total, setTotal]           = useState(0);
//   const [loading, setLoading]       = useState(true);
//   const [salesUsers, setSalesUsers] = useState<User[]>([]);
//   const [statusFilter, setStatusFilter] = useState('');
//   const [salesFilter, setSalesFilter]   = useState('');
//   const [oemFilter, setOemFilter]       = useState('');
//   const [fromDate, setFromDate]         = useState('');
//   const [toDate, setToDate]             = useState('');
//   const [multiVersion, setMultiVersion] = useState(false);
//   const [page, setPage]                 = useState(1);

//   // Reassignment state (admin only)
//   const [reassignTarget, setReassignTarget] = useState<any>(null);
//   const [newOwnerId, setNewOwnerId]         = useState('');
//   const [reassigning, setReassigning]       = useState(false);
//   const [reassignError, setReassignError]   = useState('');

//   // Quotation modal
//   const [quotationDRF, setQuotationDRF] = useState<any>(null);
//   const [qItems, setQItems] = useState([{ ...emptyItem }]);
//   const [qForm, setQForm] = useState({ taxRate: 18, validUntil: '', terms: '', notes: '' });
//   const [qSaving, setQSaving] = useState(false);
//   const [qError, setQError] = useState('');

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const params: Record<string, unknown> = { page, limit: 15 };
//       if (statusFilter) params.status      = statusFilter;
//       if (salesFilter)  params.salesPerson = salesFilter;
//       if (oemFilter)    params.oemName     = oemFilter;
//       if (fromDate)     params.from        = fromDate;
//       if (toDate)       params.to          = toDate;
//       if (multiVersion) params.multiVersion = 'true';
//       const [analyticsData, drfRes] = await Promise.all([drfApi.getAnalytics(), drfApi.getAll(params)]);
//       setAnalytics(analyticsData || {});
//       setDRFs(drfRes.data || []);
//       setTotal(drfRes.pagination?.total ?? 0);
//     } catch (err) { console.error('DRFPage load:', err); setAnalytics({}); setDRFs([]); setTotal(0); } finally { setLoading(false); }
//   }, [page, statusFilter, salesFilter, oemFilter, fromDate, toDate, multiVersion]);

//   useEffect(() => { load(); }, [load]);
//   useEffect(() => { usersApi.getSalesmen().then(setSalesUsers).catch(() => {}); }, []);

//   const resetFilters = () => {
//     setStatusFilter(''); setSalesFilter(''); setOemFilter('');
//     setFromDate(''); setToDate(''); setMultiVersion(false); setPage(1);
//   };

//   const handleReassign = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!reassignTarget || !newOwnerId) return;
//     setReassigning(true);
//     setReassignError('');
//     try {
//       await drfApi.reassign(reassignTarget._id, newOwnerId);
//       setReassignTarget(null);
//       setNewOwnerId('');
//       load();
//     } catch (err: unknown) {
//       const msg = (err as Error)?.message || 'Reassignment failed';
//       setReassignError(msg);
//     } finally { setReassigning(false); }
//   };

//   if (loading && !analytics) return <LoadingSpinner className="h-64" />;

//   return (
//     <div className="space-y-6 animate-fade-in">
//       <div>
//         <h1 className="page-header">DRF Management</h1>
//         <p className="text-sm text-gray-500 mt-0.5">Document Request Forms — {total} records</p>
//       </div>

//       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//         <StatCard title="Total DRFs Sent"  value={analytics?.total ?? 0}    sub={`This month: ${analytics?.totalThisMonth ?? 0}`} icon={FileBadge}    color="text-violet-700"  bg="bg-violet-50"  />
//         <StatCard title="DRFs Approved"    value={analytics?.approved ?? 0} sub={`${analytics?.approvalRate ?? 0}% approval rate`} icon={CheckCircle2} color="text-emerald-700" bg="bg-emerald-50" />
//         <StatCard title="DRFs Rejected"    value={analytics?.rejected ?? 0} sub={`${analytics?.rejectionRate ?? 0}% rejection rate`} icon={XCircle}    color="text-red-600"     bg="bg-red-50"     />
//       </div>

//       {analytics && (
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <StatCard title="Pending Review" value={analytics.pending ?? 0} sub="Awaiting decision" icon={Clock}         color="text-amber-700"  bg="bg-amber-50"  />
//           <StatCard title="Expiring Soon"  value={analytics.expiringSoon ?? 0} sub="Within 30 days" icon={AlertTriangle} color="text-orange-600" bg="bg-orange-50" />
//         </div>
//       )}

//       {analytics?.expiringList?.length > 0 && (
//         <div className="card !p-0 overflow-hidden">
//           <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
//             <AlertTriangle size={16} className="text-orange-500" />
//             <h2 className="font-semibold text-gray-900">Expiring DRFs (next 30 days)</h2>
//           </div>
//           <div className="divide-y divide-gray-50">
//             {analytics.expiringList.slice(0, 5).map((drf: any) => (
//               <div key={drf._id} className="px-6 py-3 flex items-center justify-between hover:bg-orange-50/30">
//                 <div>
//                   <p className="text-sm font-semibold text-gray-800">{drf.drfNumber}</p>
//                   <p className="text-xs text-gray-500">{drf.leadId?.companyName} — {drf.leadId?.oemName}</p>
//                 </div>
//                 <div className="text-right">
//                   <p className="text-xs font-medium text-orange-600">Expires {formatDate(drf.expiryDate)}</p>
//                   <p className="text-xs text-gray-400">by {drf.createdBy?.name}</p>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Filters */}
//       <div className="card">
//         <div className="flex items-center gap-2 mb-4">
//           <Filter size={16} className="text-gray-500" />
//           <h2 className="section-title !mb-0">Filter DRFs</h2>
//           <button onClick={resetFilters} className="ml-auto text-xs text-violet-600 hover:underline">Reset</button>
//         </div>
//         <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
//           <select className="input-field" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
//             <option value="">All Statuses</option>
//             {(['Pending','Approved','Rejected','Expired'] as DRFStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
//           </select>
//           <select className="input-field" value={salesFilter} onChange={(e) => { setSalesFilter(e.target.value); setPage(1); }}>
//             <option value="">All Sales Persons</option>
//             {salesUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
//           </select>
//           <input className="input-field" placeholder="Filter by OEM..." value={oemFilter} onChange={(e) => { setOemFilter(e.target.value); setPage(1); }} />
//           <div>
//             <label className="label text-xs">From Date</label>
//             <input type="date" className="input-field" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
//           </div>
//           <div>
//             <label className="label text-xs">To Date</label>
//             <input type="date" className="input-field" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
//           </div>
//           <div className="flex items-center gap-3 pt-5">
//             <input type="checkbox" id="multiVer" checked={multiVersion} onChange={(e) => { setMultiVersion(e.target.checked); setPage(1); }} className="w-4 h-4 accent-violet-600" />
//             <label htmlFor="multiVer" className="text-sm text-gray-700 cursor-pointer">Multi-version DRFs only</label>
//           </div>
//         </div>
//       </div>

//       {/* DRF Table */}
//       <div className="glass-card !p-0 overflow-hidden">
//         {loading ? (
//           <LoadingSpinner className="h-48" />
//         ) : drfs.length === 0 ? (
//           <div className="text-center text-gray-400 py-16">No DRFs found</div>
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full">
//               <thead className="bg-gray-50 border-b border-gray-100">
//                 <tr>
//                   <th className="table-header">DRF #</th>
//                   <th className="table-header">Company</th>
//                   <th className="table-header">Contact Person</th>
//                   <th className="table-header">OEM</th>
//                   <th className="table-header">Version</th>
//                   <th className="table-header">Status</th>
//                   <th className="table-header">Sent Date</th>
//                   <th className="table-header">Expiry</th>
//                   <th className="table-header">Owner</th>
//                   {isAdmin && <th className="table-header">Actions</th>}
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-gray-50">
//                 {drfs.map((drf: any) => (
//                   <tr key={drf._id} className="hover:bg-violet-50/20 transition-colors">
//                     <td className="table-cell font-mono text-xs font-semibold text-violet-700">
//                       <Link to={`/leads/${drf.leadId?._id}`} className="hover:underline">{drf.drfNumber}</Link>
//                     </td>
//                     <td className="table-cell font-medium">
//                       <Link to={`/leads/${drf.leadId?._id}`} className="hover:text-violet-600 hover:underline">{drf.leadId?.companyName}</Link>
//                     </td>
//                     <td className="table-cell text-gray-500">{drf.leadId?.contactPersonName || drf.leadId?.contactName || '—'}</td>
//                     <td className="table-cell text-gray-500">{drf.leadId?.oemName || '—'}</td>
//                     <td className="table-cell text-center">
//                       <span className={`badge ${drf.version > 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>v{drf.version}</span>
//                     </td>
//                     <td className="table-cell">
//                       <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLE[drf.status as DRFStatus] ?? ''}`}>{drf.status}</span>
//                     </td>
//                     <td className="table-cell text-gray-400">{formatDate(drf.sentDate)}</td>
//                     <td className="table-cell text-gray-400">{drf.expiryDate ? formatDate(drf.expiryDate) : '—'}</td>
//                     <td className="table-cell text-gray-500">{drf.createdBy?.name}</td>
//                     {isAdmin && (
//                       <td className="table-cell">
//                         <button
//                           onClick={() => { setReassignTarget(drf); setNewOwnerId(''); setReassignError(''); }}
//                           title="Reassign DRF ownership"
//                           className="p-1 text-gray-400 hover:text-violet-600 flex items-center gap-1 text-xs"
//                         >
//                           <UserCheck size={15} /> Reassign
//                         </button>
//                       </td>
//                     )}
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//         {total > 15 && (
//           <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
//             <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 15)}</p>
//             <div className="flex gap-2">
//               <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
//               <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Reassign Modal (admin only) */}
//       <Modal
//         isOpen={!!reassignTarget}
//         onClose={() => { setReassignTarget(null); setNewOwnerId(''); setReassignError(''); }}
//         title="Reassign DRF Ownership"
//         size="sm"
//       >
//         <div className="mb-4 p-3 bg-gray-50 rounded-xl">
//           <p className="text-xs text-gray-500 mb-1">DRF</p>
//           <p className="text-sm font-semibold text-gray-800">{reassignTarget?.drfNumber}</p>
//           <p className="text-xs text-gray-500 mt-0.5">{reassignTarget?.leadId?.companyName} — owned by <span className="font-medium">{reassignTarget?.createdBy?.name}</span></p>
//         </div>
//         <form onSubmit={handleReassign} className="space-y-4">
//           <div>
//             <label className="label">Transfer to Sales Person *</label>
//             <select required className="input-field" value={newOwnerId}
//               onChange={(e) => setNewOwnerId(e.target.value)}>
//               <option value="">Select a sales person…</option>
//               {salesUsers
//                 .filter((u) => u._id !== reassignTarget?.createdBy?._id)
//                 .map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
//             </select>
//           </div>
//           {reassignError && (
//             <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{reassignError}</div>
//           )}
//           <div className="flex gap-3 justify-end">
//             <button type="button" onClick={() => setReassignTarget(null)} className="btn-secondary">Cancel</button>
//             <button type="submit" disabled={reassigning || !newOwnerId} className="btn-primary">
//               {reassigning ? 'Reassigning…' : 'Confirm Reassign'}
//             </button>
//           </div>
//         </form>
//       </Modal>
//     </div>
//   );
// }
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { drfApi } from '@/api/drf';
import { quotationsApi } from '@/api/quotations';
import { usersApi } from '@/api/users';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import {
  FileBadge, CheckCircle2, XCircle, Clock, AlertTriangle, Filter, UserCheck, FileText, Plus, Trash2,
} from 'lucide-react';
import type { User } from '@/types';

const emptyItem = { description: '', quantity: 1, unitPrice: 0, total: 0 };

type DRFStatus = 'Pending' | 'Approved' | 'Rejected' | 'Expired';

const STATUS_STYLE: Record<DRFStatus, string> = {
  Pending:  'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
  Expired:  'bg-gray-100 text-gray-600',
};

function StatCard({ title, value, sub, icon: Icon, color, bg, onClick }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; bg: string;
  onClick?: () => void;
}) {
  return (
    <div 
      className={`bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3 hover:shadow-md transition-all cursor-pointer ${onClick ? 'hover:border-violet-200 hover:scale-[1.02] active:scale-[0.98]' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => onClick && (e.key === 'Enter' || e.key === ' ') && onClick()}
    >
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{title}</p>
        <div className="flex items-baseline gap-2">
          <p className={`text-lg font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function DRFPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin     = currentUser?.role === 'admin';
  const navigate    = useNavigate();

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
  const [activeFilterTitle, setActiveFilterTitle] = useState<string>('');

  // Reassignment state (admin only)
  const [reassignTarget, setReassignTarget] = useState<any>(null);
  const [newOwnerId, setNewOwnerId]         = useState('');
  const [reassigning, setReassigning]       = useState(false);
  const [reassignError, setReassignError]   = useState('');

  // Quotation modal
  const [quotationDRF, setQuotationDRF] = useState<any>(null);
  const [qItems, setQItems] = useState([{ ...emptyItem }]);
  const [qForm, setQForm] = useState({ taxRate: 18, validUntil: '', terms: '', notes: '' });
  const [qSaving, setQSaving] = useState(false);
  const [qError, setQError] = useState('');

  const load = useCallback(async (preserveFilterInfo = false) => {
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
      setAnalytics(analyticsData || {});
      setDRFs(drfRes.data || []);
      setTotal(drfRes.pagination?.total ?? 0);
    } catch (err) { 
      console.error('DRFPage load:', err); 
      setAnalytics({}); 
      setDRFs([]); 
      setTotal(0); 
    } finally { 
      setLoading(false); 
    }
  }, [page, statusFilter, salesFilter, oemFilter, fromDate, toDate, multiVersion]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { usersApi.getSalesmen().then(setSalesUsers).catch(() => {}); }, []);

  const resetFilters = () => {
    setStatusFilter(''); 
    setSalesFilter(''); 
    setOemFilter('');
    setFromDate(''); 
    setToDate(''); 
    setMultiVersion(false); 
    setPage(1);
    setActiveFilterTitle('');
  };

  const handleCardClick = (filterType: string, filterValue: string, title: string) => {
    setPage(1);
    
    switch(filterType) {
      case 'status':
        setStatusFilter(filterValue);
        break;
      case 'expiring':
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const toDateStr = thirtyDaysFromNow.toISOString().split('T')[0];
        setToDate(toDateStr);
        setStatusFilter('Pending');
        break;
      default:
        break;
    }
    
    setActiveFilterTitle(title);
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
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DRF Management</h1>
          <p className="text-sm text-gray-500">
            Document Request Forms — {total} records
          </p>
        </div>
        {activeFilterTitle && (
          <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <Filter size={14} className="text-violet-600" />
            <span className="text-sm text-gray-700">
              <span className="font-semibold text-violet-700">{activeFilterTitle}</span>
            </span>
            <button 
              onClick={resetFilters}
              className="text-xs bg-white px-2 py-1 rounded-full border border-violet-200 text-violet-700 hover:bg-violet-100 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Small Stats Cards - All in one line */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard 
          title="Total Sent"  
          value={analytics?.total ?? 0}    
          sub={`This month: ${analytics?.totalThisMonth ?? 0}`} 
          icon={FileBadge}    
          color="text-violet-700"  
          bg="bg-violet-50"  
          onClick={() => handleCardClick('status', '', 'All DRFs')}
        />
        <StatCard 
          title="Approved"    
          value={analytics?.approved ?? 0} 
          sub={`${analytics?.approvalRate ?? 0}% rate`} 
          icon={CheckCircle2} 
          color="text-emerald-700" 
          bg="bg-emerald-50" 
          onClick={() => handleCardClick('status', 'Approved', 'Approved DRFs')}
        />
        <StatCard 
          title="Rejected"    
          value={analytics?.rejected ?? 0} 
          sub={`${analytics?.rejectionRate ?? 0}% rate`} 
          icon={XCircle}    
          color="text-red-600"     
          bg="bg-red-50"     
          onClick={() => handleCardClick('status', 'Rejected', 'Rejected DRFs')}
        />
        <StatCard 
          title="Pending" 
          value={analytics?.pending ?? 0} 
          sub="Awaiting decision" 
          icon={Clock}         
          color="text-amber-700"  
          bg="bg-amber-50"  
          onClick={() => handleCardClick('status', 'Pending', 'Pending DRFs')}
        />
        <StatCard 
          title="Expiring Soon"  
          value={analytics?.expiringSoon ?? 0} 
          sub="Within 30 days" 
          icon={AlertTriangle} 
          color="text-orange-600" 
          bg="bg-orange-50" 
          onClick={() => handleCardClick('expiring', 'expiring', 'Expiring Soon')}
        />
      </div>

      {/* Expiring List - Only show if there are expiring DRFs */}
      {analytics?.expiringList?.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
            <AlertTriangle size={14} className="text-orange-600" />
            <h2 className="text-sm font-semibold text-gray-900">Expiring in next 30 days</h2>
            <span className="ml-auto text-xs text-orange-600 font-medium">{analytics.expiringList.length} DRFs</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-32 overflow-y-auto">
            {analytics.expiringList.slice(0, 3).map((drf: any) => (
              <div 
                key={drf._id} 
                className="px-4 py-2 flex items-center justify-between hover:bg-orange-50/30 cursor-pointer transition-colors text-sm"
                onClick={() => {
                  setStatusFilter('Pending');
                  setActiveFilterTitle(`Expiring: ${drf.drfNumber}`);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setStatusFilter('Pending');
                    setActiveFilterTitle(`Expiring: ${drf.drfNumber}`);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-semibold text-violet-700">{drf.drfNumber}</span>
                  <span className="text-xs text-gray-600">{drf.leadId?.companyName}</span>
                </div>
                <div className="text-xs text-orange-600 font-medium">
                  Expires {formatDate(drf.expiryDate)}
                </div>
              </div>
            ))}
            {analytics.expiringList.length > 3 && (
              <div className="px-4 py-2 text-center border-t border-gray-100">
                <button 
                  onClick={() => handleCardClick('expiring', 'expiring', 'All Expiring DRFs')}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                >
                  +{analytics.expiringList.length - 3} more expiring DRFs
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Filter DRFs</h2>
          <button onClick={resetFilters} className="ml-auto text-xs text-violet-600 hover:underline">Reset all filters</button>
        </div>
        <div className="grid grid-cols-6 gap-3">
          <select 
            className="input-field text-sm py-2" 
            value={statusFilter} 
            onChange={(e) => { 
              setStatusFilter(e.target.value); 
              setPage(1);
              setActiveFilterTitle(e.target.value ? `${e.target.value} DRFs` : '');
            }}
          >
            <option value="">Status</option>
            {(['Pending','Approved','Rejected','Expired'] as DRFStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          
          <select 
            className="input-field text-sm py-2" 
            value={salesFilter} 
            onChange={(e) => { 
              setSalesFilter(e.target.value); 
              setPage(1);
              const salesPerson = salesUsers.find(u => u._id === e.target.value);
              setActiveFilterTitle(salesPerson ? `Sales: ${salesPerson.name}` : '');
            }}
          >
            <option value="">Sales Person</option>
            {salesUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
          
          <input 
            className="input-field text-sm py-2" 
            placeholder="OEM name..." 
            value={oemFilter} 
            onChange={(e) => { 
              setOemFilter(e.target.value); 
              setPage(1);
              setActiveFilterTitle(e.target.value ? `OEM: ${e.target.value}` : '');
            }} 
          />
          
          <input 
            type="date" 
            className="input-field text-sm py-2" 
            value={fromDate} 
            onChange={(e) => { 
              setFromDate(e.target.value); 
              setPage(1);
              if (e.target.value) setActiveFilterTitle(`From: ${e.target.value}`);
            }} 
            placeholder="From date"
          />
          
          <input 
            type="date" 
            className="input-field text-sm py-2" 
            value={toDate} 
            onChange={(e) => { 
              setToDate(e.target.value); 
              setPage(1);
              if (e.target.value) setActiveFilterTitle(`To: ${e.target.value}`);
            }} 
            placeholder="To date"
          />
          
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="multiVer" 
              checked={multiVersion} 
              onChange={(e) => { 
                setMultiVersion(e.target.checked); 
                setPage(1);
                setActiveFilterTitle(e.target.checked ? 'Multi-version DRFs' : '');
              }} 
              className="w-4 h-4 accent-violet-600" 
            />
            <label htmlFor="multiVer" className="text-sm text-gray-600 cursor-pointer whitespace-nowrap">Multi-version</label>
          </div>
        </div>
      </div>

      {/* DRF Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="h-48" />
        ) : drfs.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <p className="text-sm">No DRFs found</p>
            {activeFilterTitle && (
              <button 
                onClick={resetFilters}
                className="mt-2 text-violet-600 hover:text-violet-700 text-sm font-medium"
              >
                Clear filters to see all DRFs
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DRF #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OEM</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ver</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                    {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {drfs.map((drf: any) => (
                    <tr 
                      key={drf._id} 
                      className="hover:bg-violet-50/30 transition-colors cursor-pointer text-sm"
                      onClick={() => navigate(`/drf/${drf._id}`)}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          navigate(`/drf/${drf._id}`);
                        }
                      }}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-violet-700">
                        <Link to={`/drf/${drf._id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{drf.drfNumber}</Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link to={`/leads/${drf.leadId?._id}`} className="hover:text-violet-600 hover:underline" onClick={(e) => e.stopPropagation()}>{drf.leadId?.companyName}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{drf.leadId?.contactPersonName || drf.leadId?.contactName || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{drf.leadId?.oemName || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          drf.version > 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          v{drf.version}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_STYLE[drf.status as DRFStatus] ?? 'bg-gray-100 text-gray-600'
                        }`}>
                          {drf.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(drf.sentDate)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{drf.expiryDate ? formatDate(drf.expiryDate) : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{drf.createdBy?.name}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { 
                              e.stopPropagation();
                              setReassignTarget(drf); 
                              setNewOwnerId(''); 
                              setReassignError(''); 
                            }}
                            title="Reassign DRF ownership"
                            className="p-1 text-gray-400 hover:text-violet-600 transition-colors"
                          >
                            <UserCheck size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {total > 15 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-500">
                  Showing {((page - 1) * 15) + 1} to {Math.min(page * 15, total)} of {total} results
                </p>
                <div className="flex gap-2">
                  <button 
                    disabled={page === 1} 
                    onClick={() => setPage(p => p - 1)} 
                    className="px-3 py-1 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button 
                    disabled={page >= Math.ceil(total / 15)} 
                    onClick={() => setPage(p => p + 1)} 
                    className="px-3 py-1 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reassign Modal (admin only) */}
      <Modal
        isOpen={!!reassignTarget}
        onClose={() => { setReassignTarget(null); setNewOwnerId(''); setReassignError(''); }}
        title="Reassign DRF Ownership"
        size="sm"
      >
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">DRF</p>
          <p className="text-sm font-semibold text-gray-800">{reassignTarget?.drfNumber}</p>
          <p className="text-xs text-gray-500 mt-0.5">{reassignTarget?.leadId?.companyName} — owned by <span className="font-medium">{reassignTarget?.createdBy?.name}</span></p>
        </div>
        <form onSubmit={handleReassign} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Transfer to Sales Person *</label>
            <select required className="input-field text-sm" value={newOwnerId}
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
            <button type="button" onClick={() => setReassignTarget(null)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={reassigning || !newOwnerId} className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50">
              {reassigning ? 'Reassigning…' : 'Confirm Reassign'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}