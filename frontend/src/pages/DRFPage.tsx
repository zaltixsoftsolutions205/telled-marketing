import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { drfApi } from '@/api/drf';
import { quotationsApi } from '@/api/quotations';
import { notify } from '@/store/notificationStore';
import { usersApi } from '@/api/users';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import {
  FileBadge, CheckCircle2, XCircle, Clock, AlertTriangle, Filter, UserCheck, FileText, Plus, Trash2, Mail, RefreshCw, RotateCcw, Send,
} from 'lucide-react';
import ContactEmailPicker from '@/components/common/ContactEmailPicker';
import ExcelImportButton from '@/components/common/ExcelImportButton';
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
      className={`bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3 hover:shadow-md transition-all ${onClick ? 'cursor-pointer hover:border-violet-200 hover:scale-[1.02] active:scale-[0.98]' : ''}`}
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
  const isSales     = currentUser?.role === 'sales' || isAdmin;

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

  // Quick approve/reject/reset state (admin only)
  const [quickAction, setQuickAction] = useState<{ drf: any; type: 'approve' | 'reject' | 'reset' } | null>(null);
  const [quickReason, setQuickReason] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState('');

  const handleQuickAction = async () => {
    if (!quickAction) return;
    setQuickSaving(true); setQuickError('');
    try {
      const company = (quickAction.drf as any).leadId?.companyName || 'DRF';
      if (quickAction.type === 'approve') {
        await drfApi.approve(quickAction.drf._id, { expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] });
        notify('DRF Approved', `DRF for "${company}" has been approved.`, 'drf', '/drfs');
      } else if (quickAction.type === 'reject') {
        if (!quickReason.trim()) { setQuickError('Reason is required'); setQuickSaving(false); return; }
        await drfApi.reject(quickAction.drf._id, { rejectionReason: quickReason });
        notify('DRF Rejected', `DRF for "${company}" has been rejected.`, 'drf', '/drfs');
      } else {
        await drfApi.resetToPending(quickAction.drf._id);
        notify('DRF Reset', `DRF for "${company}" reset to pending.`, 'drf', '/drfs');
      }
      setQuickAction(null); setQuickReason('');
      load();
    } catch { setQuickError('Action failed'); } finally { setQuickSaving(false); }
  };

  // Reassignment state (admin only)
  const [reassignTarget, setReassignTarget] = useState<any>(null);
  const [newOwnerId, setNewOwnerId]         = useState('');
  const [reassigning, setReassigning]       = useState(false);
  const [reassignError, setReassignError]   = useState('');

  // Delete state (admin only)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const handleDeleteDRF = async () => {
    if (!deleteTarget) return;
    await drfApi.delete(deleteTarget);
    notify('DRF Deleted', 'DRF record has been deleted.', 'drf');
    setDeleteTarget(null);
    load();
  };

  // Resend state
  const [resendTarget, setResendTarget] = useState<any>(null);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState('');

  const handleResend = async () => {
    if (!resendTarget) return;
    setResending(true); setResendError('');
    try {
      const updated = await drfApi.resend(resendTarget._id);
      notify('DRF Resent', `DRF email resent for "${resendTarget.leadId?.companyName || 'lead'}".`, 'drf', '/drfs');
      setDRFs(prev => prev.map(d => d._id === resendTarget._id ? { ...d, ...updated, status: 'Pending' } : d));
      setResendTarget(null);
    } catch (err: any) {
      setResendError(err?.response?.data?.message || 'Failed to resend DRF');
    } finally {
      setResending(false);
    }
  };

  const getDaysUntilResend = (drf: any): number => {
    if (!drf.rejectedDate) return 30;
    const daysSince = Math.floor((Date.now() - new Date(drf.rejectedDate).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - daysSince);
  };

  // Email sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ approved: string[]; rejected: string[]; scanned: number; errors: string[] } | null>(null);

  // Quotation modal state
  const [quotationDRF, setQuotationDRF] = useState<any>(null);
  const [qItems, setQItems] = useState([{ ...emptyItem }]);
  const [qForm, setQForm] = useState({ taxRate: 18, validUntil: '', terms: '', notes: '' });
  const [qToEmail, setQToEmail] = useState('');
  const [qCcEmail, setQCcEmail] = useState('');
  const [qSaving, setQSaving] = useState(false);
  const [qError, setQError] = useState('');

  // Resend Quotation modal state
  const [resendQuotationDRF, setResendQuotationDRF] = useState<any>(null);
  const [resendQEmail, setResendQEmail] = useState('');
  const [resendQCc, setResendQCc] = useState('');
  const [resendQSaving, setResendQSaving] = useState(false);
  const [resendQError, setResendQError] = useState('');

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
      const [analyticsData, drfRes, quotRes] = await Promise.all([
        drfApi.getAnalytics(),
        drfApi.getAll(params),
        quotationsApi.getAll({ limit: 500 }),
      ]);
      setAnalytics(analyticsData || {});
      // Mark DRFs whose lead already has a quotation
      const leadIdsWithQuotation = new Set(
        (quotRes.data || []).map((q: any) => q.leadId?._id || q.leadId)
      );
      const drfsWithFlag = (drfRes.data || []).map((d: any) => ({
        ...d,
        quotationSent: d.quotationSent || leadIdsWithQuotation.has(d.leadId?._id || d.leadId),
      }));
      setDRFs(drfsWithFlag);
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
    if (filterType === 'status') {
      setStatusFilter(filterValue);
    } else if (filterType === 'expiring') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      setToDate(thirtyDaysFromNow.toISOString().split('T')[0]);
      setStatusFilter('Pending');
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
      setReassignError((err as Error)?.message || 'Reassignment failed');
    } finally {
      setReassigning(false);
    }
  };

  const handleSyncEmails = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await drfApi.syncEmails();
      setSyncResult(result);
      if (result.approved.length || result.rejected.length) load();
    } catch (err: any) {
      setSyncResult({ approved: [], rejected: [], scanned: 0, errors: [err?.response?.data?.message || 'Sync failed'] });
    } finally {
      setSyncing(false);
    }
  };

  const openQuotationModal = (drf: any) => {
    setQuotationDRF(drf);
    setQItems([{ ...emptyItem }]);
    setQForm({ taxRate: 18, validUntil: '', terms: '', notes: '' });
    setQToEmail(drf.leadId?.email || '');
    setQCcEmail('');
    setQError('');
  };

  const openResendQuotationModal = (drf: any) => {
    setResendQuotationDRF(drf);
    setResendQEmail(drf.leadId?.email || '');
    setResendQCc('');
    setResendQError('');
  };

  const handleResendQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendQuotationDRF) return;
    if (!resendQEmail.trim()) { setResendQError('Recipient email is required'); return; }
    setResendQSaving(true); setResendQError('');
    try {
      // Find the latest quotation for this lead and resend it
      const quotRes = await quotationsApi.getAll({ leadId: resendQuotationDRF.leadId?._id, limit: 1 });
      const latestQuotation = quotRes.data?.[0];
      if (!latestQuotation) { setResendQError('No quotation found for this lead'); setResendQSaving(false); return; }
      await quotationsApi.sendEmail(latestQuotation._id, resendQEmail.trim(), resendQCc.trim() || undefined);
      notify('Quotation Resent', `Quotation resent to ${resendQEmail} for "${resendQuotationDRF.leadId?.companyName}".`, 'quotation', '/quotations');
      setResendQuotationDRF(null);
    } catch (err: any) {
      setResendQError(err?.response?.data?.message || 'Failed to resend quotation');
    } finally {
      setResendQSaving(false);
    }
  };

  const updateQItem = (idx: number, field: string, value: string | number) => {
    setQItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        updated.total = Number(updated.quantity) * Number(updated.unitPrice);
      }
      return updated;
    }));
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotationDRF) return;
    const validItems = qItems.filter(i => i.description.trim());
    if (!validItems.length) { setQError('Add at least one line item with a description.'); return; }
    setQSaving(true);
    setQError('');
    try {
      const created = await quotationsApi.create({
        leadId: quotationDRF.leadId?._id || quotationDRF.leadId,
        items: validItems,
        taxRate: qForm.taxRate,
        validUntil: qForm.validUntil || undefined,
        terms: qForm.terms || undefined,
        notes: qForm.notes || undefined,
      });
      // Close modal and mark success regardless of email result
      setDRFs(prev => prev.map(d => d._id === quotationDRF._id ? { ...d, quotationSent: true } : d));
      setQuotationDRF(null);
      notify('Quotation Created', `Quotation created for "${(quotationDRF.leadId as any)?.companyName || 'lead'}".`, 'quotation', '/quotations');
      // Try to send email in background — don't block on failure
      if (created?._id) quotationsApi.sendEmail(created._id, qToEmail.trim() || undefined, qCcEmail.trim() || undefined).catch(() => {});
    } catch (err: unknown) {
      setQError((err as any)?.response?.data?.message || 'Failed to create quotation');
    } finally {
      setQSaving(false);
    }
  };

  const qSubtotal = qItems.reduce((s, i) => s + (i.total || 0), 0);
  const qTax = (qSubtotal * qForm.taxRate) / 100;
  const qTotal = qSubtotal + qTax;

  if (loading && !analytics) return <LoadingSpinner className="h-64" />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DRF Management</h1>
          <p className="text-sm text-gray-500">Document Request Forms — {total} records</p>
        </div>
        <div className="flex items-center gap-3">
          <ExcelImportButton
            entityName="DRFs"
            columnHint="leadName (company name to match lead), notes"
            onImport={async (rows) => {
              let imported = 0;
              const leadsRes = await (await import('@/api/leads')).leadsApi.getAll({ limit: 500 });
              const leadList: { _id: string; companyName: string }[] = leadsRes.data || [];
              for (const row of rows) {
                const ln = (row.leadName || row.company || row.companyName || '').toLowerCase();
                const lead = leadList.find(l => l.companyName.toLowerCase().includes(ln));
                if (!lead) continue;
                try {
                  await drfApi.create({ leadId: lead._id, notes: row.notes || '' });
                  imported++;
                } catch { /* skip */ }
              }
              load();
              return { imported };
            }}
          />
          {isSales && !isAdmin && (
            <button
              onClick={handleSyncEmails}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-violet-200 text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100 disabled:opacity-60 transition-colors"
              title="Read inbox emails and auto-update DRF statuses"
            >
              {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
              {syncing ? 'Syncing…' : 'Sync Emails'}
            </button>
          )}
          {activeFilterTitle && (
            <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <Filter size={14} className="text-violet-600" />
              <span className="text-sm font-semibold text-violet-700">{activeFilterTitle}</span>
              <button onClick={resetFilters} className="text-xs bg-white px-2 py-1 rounded-full border border-violet-200 text-violet-700 hover:bg-violet-100">Clear</button>
            </div>
          )}
        </div>
      </div>

      {/* Email sync result banner */}
      {syncResult && (
        <div className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-3 ${
          syncResult.errors.length ? 'bg-red-50 border-red-200 text-red-800'
          : syncResult.approved.length || syncResult.rejected.length ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-gray-50 border-gray-200 text-gray-700'
        }`}>
          <Mail size={16} className="mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">
              {syncResult.errors.length ? 'Sync error' : `Scanned ${syncResult.scanned} email${syncResult.scanned !== 1 ? 's' : ''}`}
            </p>
            {syncResult.errors.length > 0 && (
              <p className="text-xs mt-0.5">{syncResult.errors[0]}</p>
            )}
            {(syncResult.approved.length > 0 || syncResult.rejected.length > 0) && (
              <p className="text-xs mt-0.5">
                {syncResult.approved.length > 0 && <span className="text-emerald-700 font-medium">✓ Approved: {syncResult.approved.join(', ')} </span>}
                {syncResult.rejected.length > 0 && <span className="text-red-700 font-medium">✗ Rejected: {syncResult.rejected.join(', ')}</span>}
              </p>
            )}
            {syncResult.approved.length === 0 && syncResult.rejected.length === 0 && !syncResult.errors.length && (
              <p className="text-xs mt-0.5 text-gray-500">No DRF approval/rejection emails found.</p>
            )}
          </div>
          <button onClick={() => setSyncResult(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard title="Total Sent"     value={analytics?.total ?? 0}        sub={`This month: ${analytics?.totalThisMonth ?? 0}`} icon={FileBadge}    color="text-violet-700"  bg="bg-violet-50"  onClick={() => handleCardClick('status', '', 'All DRFs')} />
        <StatCard title="Approved"       value={analytics?.approved ?? 0}      sub={`${analytics?.approvalRate ?? 0}% rate`}         icon={CheckCircle2} color="text-emerald-700" bg="bg-emerald-50" onClick={() => handleCardClick('status', 'Approved', 'Approved DRFs')} />
        <StatCard title="Rejected"       value={analytics?.rejected ?? 0}      sub={`${analytics?.rejectionRate ?? 0}% rate`}        icon={XCircle}      color="text-red-600"     bg="bg-red-50"     onClick={() => handleCardClick('status', 'Rejected', 'Rejected DRFs')} />
        <StatCard title="Pending"        value={analytics?.pending ?? 0}       sub="Awaiting decision"                               icon={Clock}        color="text-amber-700"   bg="bg-amber-50"   onClick={() => handleCardClick('status', 'Pending', 'Pending DRFs')} />
        <StatCard title="Expiring Soon"  value={analytics?.expiringSoon ?? 0}  sub="Within 30 days"                                  icon={AlertTriangle} color="text-orange-600" bg="bg-orange-50"  onClick={() => handleCardClick('expiring', 'expiring', 'Expiring Soon')} />
      </div>

      {/* Expiring list */}
      {analytics?.expiringList?.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
            <AlertTriangle size={14} className="text-orange-600" />
            <h2 className="text-sm font-semibold text-gray-900">Expiring in next 30 days</h2>
            <span className="ml-auto text-xs text-orange-600 font-medium">{analytics.expiringList.length} DRFs</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-32 overflow-y-auto">
            {analytics.expiringList.slice(0, 3).map((drf: any) => (
              <div key={drf._id} className="px-4 py-2 flex items-center justify-between hover:bg-orange-50/30 cursor-pointer text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-semibold text-violet-700">{drf.drfNumber}</span>
                  <span className="text-xs text-gray-600">{drf.leadId?.companyName}</span>
                </div>
                <span className="text-xs text-orange-600 font-medium">Expires {formatDate(drf.expiryDate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Filter DRFs</h2>
          <button onClick={resetFilters} className="ml-auto text-xs text-violet-600 hover:underline">Reset all filters</button>
        </div>
        <div className="grid grid-cols-6 gap-3">
          <select className="input-field text-sm py-2" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); setActiveFilterTitle(e.target.value ? `${e.target.value} DRFs` : ''); }}>
            <option value="">Status</option>
            {(['Pending','Approved','Rejected','Expired'] as DRFStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input-field text-sm py-2" value={salesFilter} onChange={(e) => { setSalesFilter(e.target.value); setPage(1); }}>
            <option value="">Sales Person</option>
            {salesUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
          <input className="input-field text-sm py-2" placeholder="OEM name..." value={oemFilter} onChange={(e) => { setOemFilter(e.target.value); setPage(1); }} />
          <input type="date" className="input-field text-sm py-2" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
          <input type="date" className="input-field text-sm py-2" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="multiVer" checked={multiVersion} onChange={(e) => { setMultiVersion(e.target.checked); setPage(1); }} className="w-4 h-4 accent-violet-600" />
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
              <button onClick={resetFilters} className="mt-2 text-violet-600 hover:text-violet-700 text-sm font-medium">Clear filters</button>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {drfs.map((drf: any) => (
                    <tr
                      key={drf._id}
                      className="hover:bg-violet-50/30 transition-colors text-sm"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-violet-700">
                        <Link to={`/drf/${drf._id}`} className="hover:underline">{drf.drfNumber}</Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link to={`/leads/${drf.leadId?._id}`} className="hover:text-violet-600 hover:underline">{drf.leadId?.companyName}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{drf.leadId?.contactPersonName || drf.leadId?.contactName || drf.leadId?.email || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{drf.leadId?.oemName || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${drf.version > 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          v{drf.version}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[drf.status as DRFStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                          {drf.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(drf.sentDate)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{drf.expiryDate ? formatDate(drf.expiryDate) : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{drf.createdBy?.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {drf.status === 'Approved' && isSales && !drf.quotationSent && (
                            <button
                              onClick={() => openQuotationModal(drf)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
                              title="Create & Send Quotation from this DRF"
                            >
                              <FileText size={12} />
                              Send Quotation
                            </button>
                          )}
                          {drf.status === 'Approved' && isSales && drf.quotationSent && (
                            <button
                              onClick={() => openResendQuotationModal(drf)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                              title="Resend Quotation email"
                            >
                              <Send size={12} />
                              Resend
                            </button>
                          )}
                          {drf.status === 'Rejected' && (() => {
                            const daysLeft = getDaysUntilResend(drf);
                            const canResend = daysLeft === 0;
                            return (
                              <>
                                <button
                                  onClick={() => canResend ? (setResendTarget(drf), setResendError('')) : undefined}
                                  disabled={!canResend}
                                  title={canResend ? 'Resend DRF email to OEM' : `Can resend in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs border rounded-md transition-colors ${
                                    canResend
                                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer'
                                      : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                                  }`}
                                >
                                  <RefreshCw size={12} />
                                  {canResend ? 'Resend' : `Resend in ${daysLeft}d`}
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => { setQuickAction({ drf, type: 'reset' }); setQuickReason(''); setQuickError(''); }}
                                    title="Reset to Pending"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
                                  >
                                    <RotateCcw size={12} /> Reset
                                  </button>
                                )}
                              </>
                            );
                          })()}
                          {isAdmin && drf.status === 'Pending' && (
                            <>
                              <button
                                onClick={() => { setQuickAction({ drf, type: 'approve' }); setQuickReason(''); setQuickError(''); }}
                                title="Approve"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
                              >
                                <CheckCircle2 size={12} /> Approve
                              </button>
                              <button
                                onClick={() => { setQuickAction({ drf, type: 'reject' }); setQuickReason(''); setQuickError(''); }}
                                title="Reject"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                              >
                                <XCircle size={12} /> Reject
                              </button>
                            </>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => { setReassignTarget(drf); setNewOwnerId(''); setReassignError(''); }}
                              title="Reassign DRF ownership"
                              className="p-1 text-gray-400 hover:text-violet-600 transition-colors"
                            >
                              <UserCheck size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(drf._id)}
                            title="Delete DRF"
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {total > 15 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-500">Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, total)} of {total}</p>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                  <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Resend DRF Confirmation Modal */}
      <Modal
        isOpen={!!resendTarget}
        onClose={() => { setResendTarget(null); setResendError(''); }}
        title="Resend DRF Email"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            The same OEM approval request email will be resent for{' '}
            <strong>{resendTarget?.leadId?.companyName}</strong> (attempt #{resendTarget?.attemptNumber}).
          </p>
          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
            The DRF status will reset to <strong>Pending</strong> while awaiting the new response.
          </p>
          {resendError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{resendError}</p>
          )}
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setResendTarget(null); setResendError(''); }} className="btn-secondary">Cancel</button>
            <button onClick={handleResend} disabled={resending} className="btn-primary flex items-center gap-2">
              <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
              {resending ? 'Sending…' : 'Resend Email'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Quick Approve / Reject / Reset Modal */}
      <Modal
        isOpen={!!quickAction}
        onClose={() => { setQuickAction(null); setQuickReason(''); setQuickError(''); }}
        title={quickAction?.type === 'approve' ? 'Approve DRF' : quickAction?.type === 'reject' ? 'Reject DRF' : 'Reset to Pending'}
        size="sm"
      >
        {quickAction && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">DRF</p>
              <p className="text-sm font-semibold text-gray-800">{quickAction.drf.drfNumber}</p>
              <p className="text-xs text-gray-500 mt-0.5">{quickAction.drf.leadId?.companyName}</p>
            </div>
            {quickAction.type === 'reject' && (
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Rejection Reason *</label>
                <textarea
                  className="input-field text-sm py-1.5 resize-none"
                  rows={3}
                  placeholder="Enter reason for rejection..."
                  value={quickReason}
                  onChange={(e) => setQuickReason(e.target.value)}
                />
              </div>
            )}
            {quickAction.type === 'reset' && (
              <p className="text-sm text-gray-600">This will reset the DRF status back to <strong>Pending</strong> and update the lead stage to <strong>OEM Submitted</strong>.</p>
            )}
            {quickAction.type === 'approve' && (
              <p className="text-sm text-gray-600">This will mark the DRF as <strong>Approved</strong> and update the lead stage to <strong>OEM Approved</strong>.</p>
            )}
            {quickError && <p className="text-xs text-red-600">{quickError}</p>}
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setQuickAction(null)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleQuickAction}
                disabled={quickSaving}
                className={`px-3 py-1.5 text-sm text-white rounded-md disabled:opacity-50 ${
                  quickAction.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  quickAction.type === 'reject'  ? 'bg-red-600 hover:bg-red-700' :
                  'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {quickSaving ? 'Saving…' : quickAction.type === 'approve' ? 'Approve' : quickAction.type === 'reject' ? 'Reject' : 'Reset to Pending'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteDRF}
        title="Delete DRF"
        message="This will permanently delete this DRF record. This cannot be undone."
        confirmLabel="Delete"
        danger
      />

      {/* Reassign Modal */}
      <Modal isOpen={!!reassignTarget} onClose={() => { setReassignTarget(null); setNewOwnerId(''); setReassignError(''); }} title="Reassign DRF Ownership" size="sm">
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">DRF</p>
          <p className="text-sm font-semibold text-gray-800">{reassignTarget?.drfNumber}</p>
          <p className="text-xs text-gray-500 mt-0.5">{reassignTarget?.leadId?.companyName} — owned by <span className="font-medium">{reassignTarget?.createdBy?.name}</span></p>
        </div>
        <form onSubmit={handleReassign} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Transfer to Sales Person *</label>
            <select required className="input-field text-sm" value={newOwnerId} onChange={(e) => setNewOwnerId(e.target.value)}>
              <option value="">Select a sales person…</option>
              {salesUsers.filter((u) => u._id !== reassignTarget?.createdBy?._id).map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>
          {reassignError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{reassignError}</div>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setReassignTarget(null)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={reassigning || !newOwnerId} className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50">
              {reassigning ? 'Reassigning…' : 'Confirm Reassign'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Quotation Modal */}
      <Modal isOpen={!!quotationDRF} onClose={() => setQuotationDRF(null)} title="Create Quotation" size="lg">
        {quotationDRF && (
          <div className="space-y-4">
            {/* DRF summary */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
              <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-800">Approved DRF: {quotationDRF.drfNumber}</p>
                <p className="text-xs text-emerald-700 mt-0.5">{quotationDRF.leadId?.companyName} — {quotationDRF.leadId?.oemName}</p>
              </div>
            </div>

            <form onSubmit={handleCreateQuotation} className="space-y-4">
              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-800">Line Items</label>
                  <button
                    type="button"
                    onClick={() => setQItems(prev => [...prev, { ...emptyItem }])}
                    className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700"
                  >
                    <Plus size={13} /> Add item
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-1">
                    <div className="col-span-5">Description *</div>
                    <div className="col-span-2 text-right">Qty</div>
                    <div className="col-span-2 text-right">Unit Price</div>
                    <div className="col-span-2 text-right">Total</div>
                    <div className="col-span-1"></div>
                  </div>
                  {qItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        className="input-field text-sm py-1.5 col-span-5"
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateQItem(idx, 'description', e.target.value)}
                      />
                      <input
                        type="number"
                        min="1"
                        className="input-field text-sm py-1.5 col-span-2 text-right"
                        value={item.quantity}
                        onChange={(e) => updateQItem(idx, 'quantity', Number(e.target.value))}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input-field text-sm py-1.5 col-span-2 text-right"
                        value={item.unitPrice}
                        onChange={(e) => updateQItem(idx, 'unitPrice', Number(e.target.value))}
                      />
                      <div className="col-span-2 text-right text-sm font-medium text-gray-700 pr-1">
                        {formatCurrency(item.total)}
                      </div>
                      <button
                        type="button"
                        onClick={() => setQItems(prev => prev.filter((_, i) => i !== idx))}
                        disabled={qItems.length === 1}
                        className="col-span-1 p-1 text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="mt-3 bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(qSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 items-center">
                    <span className="flex items-center gap-2">
                      Tax
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-14 px-1.5 py-0.5 text-xs border border-gray-300 rounded text-center"
                        value={qForm.taxRate}
                        onChange={(e) => setQForm(f => ({ ...f, taxRate: Number(e.target.value) }))}
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </span>
                    <span>{formatCurrency(qTax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                    <span>Total</span>
                    <span className="text-violet-700">{formatCurrency(qTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Extra fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Valid Until</label>
                  <input
                    type="date"
                    className="input-field text-sm py-1.5"
                    value={qForm.validUntil}
                    onChange={(e) => setQForm(f => ({ ...f, validUntil: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Terms</label>
                  <input
                    className="input-field text-sm py-1.5"
                    placeholder="Payment terms..."
                    value={qForm.terms}
                    onChange={(e) => setQForm(f => ({ ...f, terms: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Notes</label>
                <textarea
                  className="input-field text-sm py-1.5 resize-none"
                  rows={2}
                  placeholder="Additional notes..."
                  value={qForm.notes}
                  onChange={(e) => setQForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {/* Recipient email */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Send To (Email) *
                  <span className="ml-1 text-gray-400 font-normal">— quotation PDF will be emailed here</span>
                </label>
                <ContactEmailPicker
                  required
                  placeholder="customer@company.com"
                  value={qToEmail}
                  onChange={setQToEmail}
                  defaultContactType="CUSTOMER"
                />
              </div>

              {/* CC */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  CC
                  <span className="ml-1 text-gray-400 font-normal">— add as many as needed</span>
                </label>
                <ContactEmailPicker
                  placeholder="cc@example.com"
                  value={qCcEmail}
                  onChange={setQCcEmail}
                  defaultContactType="ALL"
                  applyLabel="Add to CC"
                />
              </div>

              {qError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{qError}</div>}

              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={() => setQuotationDRF(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={qSaving} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
                  <FileText size={14} />
                  {qSaving ? 'Sending…' : 'Create & Send Quotation'}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Resend Quotation Modal */}
      <Modal
        isOpen={!!resendQuotationDRF}
        onClose={() => setResendQuotationDRF(null)}
        title={`Resend Quotation — ${resendQuotationDRF?.leadId?.companyName || ''}`}
        size="sm"
      >
        {resendQuotationDRF && (
          <form onSubmit={handleResendQuotation} className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <p className="font-semibold">{resendQuotationDRF.drfNumber} — {resendQuotationDRF.leadId?.oemName}</p>
              <p className="mt-0.5 text-blue-600">The latest quotation PDF will be resent to the address below.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Recipient Email *
              </label>
              <ContactEmailPicker
                required
                autoFocus
                placeholder="customer@company.com"
                value={resendQEmail}
                onChange={setResendQEmail}
                defaultContactType="CUSTOMER"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                CC
                <span className="ml-1 text-xs text-gray-400 font-normal">optional</span>
              </label>
              <ContactEmailPicker
                placeholder="cc@example.com"
                value={resendQCc}
                onChange={setResendQCc}
                defaultContactType="ALL"
              />
            </div>

            {resendQError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                {resendQError}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={() => setResendQuotationDRF(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resendQSaving}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={14} />
                {resendQSaving ? 'Sending…' : 'Resend Quotation'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
