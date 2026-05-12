import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { drfApi } from '@/api/drf';
import { quotationsApi } from '@/api/quotations';
import { purchasesApi } from '@/api/purchases';
import QuotationModal from '@/components/common/QuotationModal';
import { notify } from '@/store/notificationStore';
import { usersApi } from '@/api/users';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import {
  FileBadge, CheckCircle2, XCircle, Clock, AlertTriangle, Filter, UserCheck, FileText, Trash2, Mail, RefreshCw, RotateCcw, CalendarClock, X,
} from 'lucide-react';
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
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ approved: string[]; rejected: string[]; scanned: number; skipped: string[]; errors: string[] } | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Quotation modal — now handled by QuotationModal component
  const [quotationDRF, setQuotationDRF] = useState<any>(null);

  // Extension composer modal state
  const [extensionDRF, setExtensionDRF]             = useState<any>(null);
  const [extToEmail, setExtToEmail]                 = useState('');
  const [extToName, setExtToName]                   = useState('');
  const [extSubject, setExtSubject]                 = useState('');
  const [extMessage, setExtMessage]                 = useState('');
  const [extNewExpiry, setExtNewExpiry]             = useState('');
  const [extensionSending, setExtensionSending]     = useState(false);

  const getExpiryDays = (drf: any): number | null => {
    if (!drf.expiryDate) return null;
    return Math.ceil((new Date(drf.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const openExtensionModal = (drf: any) => {
    const company  = drf.leadId?.companyName || '';
    const oem      = drf.leadId?.oemName || '';
    const expiry   = drf.expiryDate ? new Date(drf.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const owner    = drf.createdBy?.name || currentUser?.name || '';
    setExtensionDRF(drf);
    setExtToEmail(drf.leadId?.oemEmail || drf.oemEmail || '');
    setExtToName('');
    setExtSubject(`DRF Extension Request — ${drf.drfNumber} — ${company}`);
    setExtMessage(
      `We are writing to request an extension for the DRF approval for ${company}.\n\n` +
      `DRF Number: ${drf.drfNumber}\n` +
      `OEM / Brand: ${oem}\n` +
      `Current Expiry: ${expiry}\n\n` +
      `We are actively working with the customer and request your support in extending the DRF validity. Kindly reply with the new valid-until date at your earliest convenience.\n\n` +
      `Regards,\n${owner}`
    );
    setExtNewExpiry('');
  };

  const handleSendExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extensionDRF) return;
    if (!extToEmail.trim()) return;
    setExtensionSending(true);
    try {
      await drfApi.requestExtension(extensionDRF._id, {
        toEmail:            extToEmail.trim(),
        toName:             extToName.trim() || undefined,
        customSubject:      extSubject.trim(),
        customMessage:      extMessage.trim(),
        requestedNewExpiry: extNewExpiry || undefined,
      });
      notify('Extension Email Sent', `Extension email sent for DRF ${extensionDRF.drfNumber}.`, 'drf', '/drfs');
      setDRFs(prev => prev.map(d => d._id === extensionDRF._id ? { ...d, extensionRequested: true } : d));
      setExtensionDRF(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to send extension email');
    } finally {
      setExtensionSending(false);
    }
  };

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
      const [analyticsData, drfRes, quotRes, poRes] = await Promise.all([
        drfApi.getAnalytics(),
        drfApi.getAll(params),
        quotationsApi.getAll({ limit: 500 }),
        purchasesApi.getAll({ limit: 500 }),
      ]);
      setAnalytics(analyticsData || {});
      // Mark DRFs whose lead already has a quotation or a PO
      const leadIdsWithQuotation = new Set(
        (quotRes.data || []).map((q: any) => q.leadId?._id || q.leadId)
      );
      const leadIdsWithPO = new Set(
        (poRes.data || []).map((p: any) => p.leadId?._id || p.leadId)
      );
      const drfsWithFlag = (drfRes.data || []).map((d: any) => ({
        ...d,
        quotationSent: d.quotationSent || leadIdsWithQuotation.has(d.leadId?._id || d.leadId),
        poReceived: leadIdsWithPO.has(d.leadId?._id || d.leadId),
      }));
      setDRFs(drfsWithFlag);
      setTotal(drfRes.pagination?.total ?? 0);

      // Auto-resend rejected DRFs whose 30-day cooldown has passed (non-admin only)
      if (!isAdmin) {
        const eligible = drfsWithFlag.filter((d: any) => {
          if (d.status !== 'Rejected' || !d.rejectedDate) return false;
          const daysSince = Math.floor((Date.now() - new Date(d.rejectedDate).getTime()) / (1000 * 60 * 60 * 24));
          return daysSince >= 30;
        });
        for (const drf of eligible) {
          drfApi.resend(drf._id)
            .then(() => notify('DRF Auto-Resent', `DRF for "${drf.leadId?.companyName || 'lead'}" auto-resent after 30-day cooldown.`, 'drf', '/drfs'))
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error('DRFPage load:', err);
      setAnalytics({});
      setDRFs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, salesFilter, oemFilter, fromDate, toDate, multiVersion, isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { usersApi.getSalesmen().then(setSalesUsers).catch(() => {}); }, []);

  // Auto-sync emails on page open + every 2 minutes (only for non-admin sales users)
  const silentSync = useCallback(async () => {
    if (isAdmin) return;
    setAutoSyncing(true);
    try {
      const result = await drfApi.syncEmails();
      if (result.approved?.length || result.rejected?.length) {
        load();
        setSyncResult(result);
      }
    } catch { /* silent — don't show errors for background sync */ }
    finally { setAutoSyncing(false); }
  }, [isAdmin]);

  useEffect(() => {
    silentSync(); // run immediately on mount
    syncIntervalRef.current = setInterval(silentSync, 2 * 60 * 1000); // every 2 min
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [silentSync]);


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
      setSyncResult({ approved: [], rejected: [], scanned: 0, skipped: [], errors: [err?.response?.data?.message || 'Sync failed'] });
    } finally {
      setSyncing(false);
    }
  };

  const openQuotationModal = (drf: any) => setQuotationDRF(drf);

  if (loading && !analytics) return <LoadingSpinner className="h-64" />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DRF Management</h1>
          <p className="text-sm text-gray-500">Document Request Forms — {total} records</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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
            <div className="flex items-center gap-2">
              {autoSyncing && (
                <span className="flex items-center gap-1.5 text-xs text-violet-500 bg-violet-50 border border-violet-200 px-2.5 py-1.5 rounded-lg">
                  <RefreshCw size={11} className="animate-spin" /> Checking emails…
                </span>
              )}
              <button
                onClick={handleSyncEmails}
                disabled={syncing || autoSyncing}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-violet-200 text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100 disabled:opacity-60 transition-colors"
                title="Manually check inbox for OEM replies and update DRF statuses"
              >
                {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                {syncing ? 'Syncing…' : 'Sync Emails'}
              </button>
            </div>
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
              <div className="text-xs mt-0.5 text-gray-500 space-y-0.5">
                <p>No DRF approval/rejection emails found.</p>
                {syncResult.skipped?.length > 0 && (
                  <details className="cursor-pointer">
                    <summary className="text-gray-400 hover:text-gray-600">{syncResult.skipped.length} email{syncResult.skipped.length !== 1 ? 's' : ''} skipped — click to see why</summary>
                    <ul className="mt-1 space-y-0.5 pl-2 border-l border-gray-200">
                      {syncResult.skipped.map((s, i) => <li key={i} className="text-gray-400">{s}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
          <button onClick={() => setSyncResult(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <StatCard title="Total Sent"     value={analytics?.total ?? 0}        sub={`This month: ${analytics?.totalThisMonth ?? 0}`} icon={FileBadge}    color="text-violet-700"  bg="bg-violet-50"  onClick={() => handleCardClick('status', '', 'All DRFs')} />
        <StatCard title="Approved"       value={analytics?.approved ?? 0}      sub={`${analytics?.approvalRate ?? 0}% rate`}         icon={CheckCircle2} color="text-emerald-700" bg="bg-emerald-50" onClick={() => handleCardClick('status', 'Approved', 'Approved DRFs')} />
        <StatCard title="Rejected"       value={analytics?.rejected ?? 0}      sub={`${analytics?.rejectionRate ?? 0}% rate`}        icon={XCircle}      color="text-red-600"     bg="bg-red-50"     onClick={() => handleCardClick('status', 'Rejected', 'Rejected DRFs')} />
        <StatCard title="Pending"        value={analytics?.pending ?? 0}       sub="Awaiting decision"                               icon={Clock}        color="text-amber-700"   bg="bg-amber-50"   onClick={() => handleCardClick('status', 'Pending', 'Pending DRFs')} />
        <StatCard title="Expiring Soon"  value={analytics?.expiringSoon ?? 0}  sub="Within 30 days"                                  icon={AlertTriangle} color="text-orange-600" bg="bg-orange-50"  onClick={() => handleCardClick('expiring', 'expiring', 'Expiring Soon')} />
      </div>

      {/* 7-day expiry alert */}
      {(() => {
        const expiring7 = drfs.filter((d: any) => {
          if (d.status !== 'Pending' && d.status !== 'Approved') return false;
          if (d.extensionRequested) return false;
          const days = getExpiryDays(d);
          return days !== null && days >= 0 && days <= 7;
        });
        if (!expiring7.length) return null;
        return (
          <div className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
            <div className="px-4 py-2.5 bg-amber-100 border-b border-amber-200 flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-amber-800">
                {expiring7.length} DRF{expiring7.length > 1 ? 's' : ''} expiring within 7 days — send extension before they expire
              </span>
            </div>
            <div className="divide-y divide-amber-100">
              {expiring7.map((drf: any) => {
                const days = getExpiryDays(drf);
                return (
                  <div key={drf._id} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-amber-100/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-semibold text-violet-700 flex-shrink-0">{drf.drfNumber}</span>
                      <span className="text-sm font-medium text-gray-800 truncate">{drf.leadId?.companyName}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">{drf.leadId?.oemName || '—'}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs font-semibold ${days === 0 ? 'text-red-600' : days !== null && days <= 3 ? 'text-red-500' : 'text-amber-700'}`}>
                        {days === 0 ? 'Expires today' : `${days}d left — expires ${formatDate(drf.expiryDate)}`}
                      </span>
                      <button
                        onClick={() => openExtensionModal(drf)}
                        disabled={extensionSending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        <CalendarClock size={12} />
                        {extensionSending ? 'Sending…' : 'Send Extension Mail'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Filter DRFs</h2>
          <button onClick={resetFilters} className="ml-auto text-xs text-violet-600 hover:underline">Reset all filters</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
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
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hidden md:block">
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OEM Reply</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid Until</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DRF Extension</th>
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
                      <td className="px-4 py-3 max-w-[220px]">
                        {(() => {
                          const replies: any[] = drf.oemReplies || [];
                          if (replies.length === 0) return <span className="text-gray-300 text-xs">No reply yet</span>;
                          const latest = replies[replies.length - 1];
                          const decColor = latest.decision === 'Approved' ? 'text-emerald-700' : latest.decision === 'Rejected' ? 'text-red-600' : 'text-gray-500';
                          return (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold uppercase ${decColor}`}>{latest.decision}</span>
                                {replies.length > 1 && (
                                  <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded font-medium">{replies.length} replies</span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 truncate" title={latest.bodyText}>{latest.bodyText}</p>
                              <p className="text-[10px] text-gray-400">{latest.fromEmail} · {new Date(latest.receivedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(drf.sentDate)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {drf.expiryDate ? (
                          (() => {
                            const days = getExpiryDays(drf);
                            const isWarning = days !== null && days <= 7 && days >= 0;
                            const isExpired = days !== null && days < 0;
                            return (
                              <span className={isExpired ? 'text-red-500 font-medium' : isWarning ? 'text-amber-600 font-medium' : ''}>
                                {formatDate(drf.expiryDate)}
                                {isWarning && ` (${days}d left)`}
                                {isExpired && ' (expired)'}
                              </span>
                            );
                          })()
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{drf.createdBy?.name || drf.createdBy?.email || '—'}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          if (drf.status === 'Rejected') {
                            return (
                              <button
                                disabled
                                title="DRF was rejected — extension not applicable"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-50 text-red-500 border border-red-200 rounded-lg cursor-not-allowed opacity-70"
                              >
                                <XCircle size={12} />
                                Rejected
                              </button>
                            );
                          }
                          if (drf.extensionRequested) {
                            return (
                              <button
                                disabled
                                title="Extension email has already been sent"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg cursor-not-allowed opacity-80"
                              >
                                <CalendarClock size={12} />
                                Extended
                              </button>
                            );
                          }
                          const days = getExpiryDays(drf);
                          if (drf.status === 'Approved' && days !== null && days <= 7) {
                            return (
                              <button
                                onClick={() => openExtensionModal(drf)}
                                disabled={extensionSending}
                                title={`Valid until expiring in ${days} day${days !== 1 ? 's' : ''} — click to send extension email`}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <CalendarClock size={12} />
                                {extensionSending ? 'Sending…' : `Extend (${days}d)`}
                              </button>
                            );
                          }
                          if (drf.status === 'Approved' && days !== null && days > 7) {
                            return (
                              <button
                                disabled
                                title={`Extension available within 7 days of expiry — ${days} days remaining`}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200 rounded-lg cursor-not-allowed"
                              >
                                <CalendarClock size={12} />
                                {days}d left
                              </button>
                            );
                          }
                          if (drf.status === 'Approved') {
                            return (
                              <button
                                disabled
                                title="Extension not applicable"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-50 text-green-600 border border-green-200 rounded-lg cursor-not-allowed opacity-70"
                              >
                                <CheckCircle2 size={12} />
                                Approved
                              </button>
                            );
                          }
                          if (drf.status === 'Pending' && days !== null && days <= 7) {
                            return (
                              <button
                                onClick={() => openExtensionModal(drf)}
                                disabled={extensionSending}
                                title={`Expiring in ${days} day${days !== 1 ? 's' : ''} — click to send DRF extension email`}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <CalendarClock size={12} />
                                {extensionSending ? 'Sending…' : `Extend (${days}d)`}
                              </button>
                            );
                          }
                          if (drf.status === 'Pending') {
                            return (
                              <button
                                disabled
                                title={days !== null ? `Extension available within 7 days of expiry — ${days} days remaining` : 'No expiry date set'}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200 rounded-lg cursor-not-allowed"
                              >
                                <CalendarClock size={12} />
                                {days !== null ? `${days}d left` : 'Pending'}
                              </button>
                            );
                          }
                          return (
                            <button
                              disabled
                              title="No extension action available"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200 rounded-lg cursor-not-allowed opacity-60"
                            >
                              <CalendarClock size={12} />
                              N/A
                            </button>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {drf.status === 'Approved' && (
                            drf.poReceived ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium bg-emerald-100 text-emerald-700">
                                <CheckCircle2 size={11} /> PO Received
                              </span>
                            ) : (
                              <button
                                onClick={() => { setResendTarget(drf); setResendError(''); }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                                title="Resend DRF to OEM"
                              >
                                <RefreshCw size={12} /> Resend DRF
                              </button>
                            )
                          )}
                          {drf.status === 'Rejected' && (() => {
                            const daysLeft = getDaysUntilResend(drf);
                            return (
                              <>
                                <button
                                  onClick={() => { setResendTarget(drf); setResendError(''); }}
                                  title={daysLeft > 0 ? `Auto-resend in ${daysLeft}d — or click to resend now` : 'Resend DRF email to OEM'}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer rounded-md transition-colors"
                                >
                                  <RefreshCw size={12} />
                                  {daysLeft > 0 ? `Resend (${daysLeft}d left)` : 'Resend'}
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

      {/* Mobile Card View */}
      {loading ? (
        <LoadingSpinner className="h-48 md:hidden" />
      ) : drfs.length === 0 ? (
        <div className="md:hidden text-center text-gray-400 py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-sm">No DRFs found</p>
        </div>
      ) : (
        <div className="md:hidden space-y-3">
          {drfs.map((drf: any) => (
            <div key={drf._id} className="glass-card !p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link to={`/drf/${drf._id}`} className="font-mono font-semibold text-violet-700 hover:underline text-sm">{drf.drfNumber}</Link>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">
                    <Link to={`/leads/${drf.leadId?._id}`} className="hover:text-violet-600">{drf.leadId?.companyName}</Link>
                  </p>
                  {drf.leadId?.oemName && <p className="text-xs text-gray-500">{drf.leadId.oemName}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[drf.status as DRFStatus] ?? 'bg-gray-100 text-gray-600'}`}>{drf.status}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${drf.version > 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>v{drf.version}</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                {drf.createdBy?.name && <p><span className="text-gray-400">Owner:</span> {drf.createdBy.name}</p>}
                {drf.sentDate && <p><span className="text-gray-400">Sent:</span> {formatDate(drf.sentDate)}</p>}
                {drf.expiryDate && (() => {
                  const days = getExpiryDays(drf);
                  const isWarning = days !== null && days <= 7 && days >= 0;
                  const isExpired = days !== null && days < 0;
                  return <p><span className="text-gray-400">Expires:</span> <span className={isExpired ? 'text-red-500 font-medium' : isWarning ? 'text-amber-600 font-medium' : ''}>{formatDate(drf.expiryDate)}{isWarning && ` (${days}d left)`}{isExpired && ' (expired)'}</span></p>;
                })()}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-gray-100">
                {drf.status === 'Approved' && !drf.poReceived && (
                  <button onClick={() => { setResendTarget(drf); setResendError(''); }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100">
                    <RefreshCw size={12} /> Resend DRF
                  </button>
                )}
                {drf.status === 'Approved' && drf.poReceived && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium bg-emerald-100 text-emerald-700">
                    <CheckCircle2 size={11} /> PO Received
                  </span>
                )}
                {drf.status === 'Rejected' && (
                  <button onClick={() => { setResendTarget(drf); setResendError(''); }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100">
                    <RefreshCw size={12} /> Resend
                  </button>
                )}
                {isAdmin && drf.status === 'Pending' && (
                  <>
                    <button onClick={() => { setQuickAction({ drf, type: 'approve' }); setQuickReason(''); setQuickError(''); }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100">
                      <CheckCircle2 size={12} /> Approve
                    </button>
                    <button onClick={() => { setQuickAction({ drf, type: 'reject' }); setQuickReason(''); setQuickError(''); }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100">
                      <XCircle size={12} /> Reject
                    </button>
                  </>
                )}
                {isAdmin && (
                  <button onClick={() => { setReassignTarget(drf); setNewOwnerId(''); setReassignError(''); }}
                    className="p-1 text-gray-400 hover:text-violet-600 transition-colors">
                    <UserCheck size={16} />
                  </button>
                )}
                <button onClick={() => setDeleteTarget(drf._id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors ml-auto">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {total > 15 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, total)} of {total}</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50">Previous</button>
                <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resend DRF Confirmation Modal */}
      <Modal
        isOpen={!!resendTarget}
        onClose={() => { setResendTarget(null); setResendError(''); }}
        title="Resend DRF Email"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            The OEM approval request email will be resent for{' '}
            <strong>{resendTarget?.leadId?.companyName}</strong>.
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

      {/* ── Quotation Modal (template or upload) ── */}
      {quotationDRF && (
        <QuotationModal
          drf={quotationDRF}
          onClose={() => setQuotationDRF(null)}
          onSuccess={(drfId) => {
            setDRFs(prev => prev.map(d => d._id === drfId ? { ...d, quotationSent: true } : d));
            setQuotationDRF(null);
          }}
        />
      )}

      {/* ── Extension Email Composer Modal ── */}
      <Modal isOpen={!!extensionDRF} onClose={() => setExtensionDRF(null)} title="Send Extension Request Email" size="lg">
        {extensionDRF && (
          <form onSubmit={handleSendExtension} className="space-y-4">
            {/* DRF Info banner */}
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <CalendarClock size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800">{extensionDRF.drfNumber} — {extensionDRF.leadId?.companyName}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  OEM: {extensionDRF.leadId?.oemName || '—'} &nbsp;·&nbsp; Expires: {extensionDRF.expiryDate ? formatDate(extensionDRF.expiryDate) : '—'}
                  {(() => { const d = getExpiryDays(extensionDRF); return d !== null ? ` (${d <= 0 ? 'expired' : `${d}d left`})` : ''; })()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* To email */}
              <div>
                <label className="label">Send To (OEM Email) *</label>
                <input required type="email" className="input-field" value={extToEmail}
                  onChange={e => setExtToEmail(e.target.value)}
                  placeholder="oem@company.com" />
              </div>
              {/* To name */}
              <div>
                <label className="label">Recipient Name</label>
                <input className="input-field" value={extToName}
                  onChange={e => setExtToName(e.target.value)}
                  placeholder="e.g. Mr. Sharma (optional)" />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="label">Email Subject *</label>
              <input required className="input-field" value={extSubject}
                onChange={e => setExtSubject(e.target.value)} />
            </div>

            {/* Message body */}
            <div>
              <label className="label">Email Message *</label>
              <p className="text-[11px] text-gray-400 mb-1">Edit this message — DRF details table will be appended automatically below.</p>
              <textarea required rows={8} className="input-field font-mono text-xs leading-relaxed"
                value={extMessage} onChange={e => setExtMessage(e.target.value)} />
            </div>

            {/* Requested new expiry */}
            <div>
              <label className="label">Requested New Expiry Date <span className="text-gray-400 font-normal">(optional — shown in email table)</span></label>
              <input type="date" className="input-field" value={extNewExpiry}
                onChange={e => setExtNewExpiry(e.target.value)} />
            </div>

            {/* What will be in the email — info box */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-600">The email will automatically include:</p>
              <ul className="text-xs text-gray-500 space-y-0.5 list-inside list-disc">
                <li>Your custom message above</li>
                <li>DRF Number, Company Name, OEM/Brand, Current Expiry{extNewExpiry ? ', Requested New Expiry' : ''}</li>
                <li>Your name and email as the sender signature</li>
                <li>Request to reply with new valid-until date</li>
              </ul>
            </div>

            <div className="flex gap-3 justify-end pt-1 border-t border-gray-100">
              <button type="button" onClick={() => setExtensionDRF(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={extensionSending} className="btn-primary flex items-center gap-2">
                <Mail size={14} />
                {extensionSending ? 'Sending…' : 'Send Extension Email'}
              </button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
}
