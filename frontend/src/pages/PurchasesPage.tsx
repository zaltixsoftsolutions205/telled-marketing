import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Search, Send, RefreshCw,
  Receipt, Edit, Mail, Trash2, Download,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import ExcelImportButton from '@/components/common/ExcelImportButton';
import { purchasesApi } from '@/api/purchases';
import { leadsApi } from '@/api/leads';

// ─── Local flow-state store (persists in localStorage) ───────────────────────
type FlowData = {
  customerInvoiceSent?: boolean;
  customerInvoiceSentAt?: string;
  poForwardedToArk?: boolean;
  poForwardedToArkAt?: string;
  priceClearanceReceived?: boolean;
  priceClearanceReceivedAt?: string;
  poSentToArk?: boolean;
  poSentToArkAt?: string;
  arkInvoiceReceived?: boolean;
  arkInvoiceReceivedAt?: string;
  arkInvoiceAmount?: number;
};
const LS_KEY = 'telled_po_flow_v1';
const getFlowStore = (): Record<string, FlowData> => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
};
const saveFlow = (id: string, data: FlowData) => {
  const s = getFlowStore(); s[id] = { ...s[id], ...data };
  localStorage.setItem(LS_KEY, JSON.stringify(s));
};
const mergeFlow = (orders: PurchaseOrder[]): PurchaseOrder[] => {
  const s = getFlowStore();
  return orders.map(po => s[po._id] ? { ...po, ...s[po._id] } : po);
};
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Toast from '@/components/common/Toast';
import ContactEmailPicker from '@/components/common/ContactEmailPicker';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';
import type { PurchaseOrder, Lead } from '@/types';

// ─── 6-step PO flow ───────────────────────────────────────────────────────────
const FLOW_STEPS = [
  { num: 1, label: 'PO Received',              short: 'Received'   },
  { num: 2, label: 'Invoice Sent to Customer', short: 'Cust. Inv'  },
  { num: 3, label: 'PO Forwarded to ARK',      short: 'Fwd ARK'    },
  { num: 4, label: 'Price Clearance Received', short: 'Cleared'    },
  { num: 5, label: 'PO Sent to ARK',           short: 'PO to ARK'  },
  { num: 6, label: 'ARK Invoice Received',     short: 'Complete'   },
];

function getPoStep(po: PurchaseOrder): number {
  if (po.arkInvoiceReceived)     return 6;
  if (po.poSentToArk)            return 5;
  if (po.priceClearanceReceived) return 4;
  if (po.poForwardedToArk)       return 3;
  if (po.customerInvoiceSent)    return 2;
  return 1;
}

// mini 5-dot stepper shown in each row
function MiniStepper({ po }: { po: PurchaseOrder }) {
  const current = getPoStep(po);
  return (
    <div className="flex items-center gap-0.5">
      {FLOW_STEPS.map((s, i) => {
        const done   = current >= s.num;
        const active = current === s.num;
        return (
          <div key={s.num} className="flex items-center">
            <div title={s.label} className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 transition-all',
              done   ? 'bg-violet-600 text-white' :
              active ? 'bg-violet-200 text-violet-700 ring-1 ring-violet-400' :
                       'bg-gray-100 text-gray-400'
            )}>
              {done && current > s.num ? '✓' : s.num}
            </div>
            {i < FLOW_STEPS.length - 1 && (
              <div className={cn('w-3 h-0.5', current > s.num ? 'bg-violet-400' : 'bg-gray-200')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PurchasesPage() {
  const { user } = useAuthStore();
  const canEdit = user?.role === 'admin' || user?.role === 'sales';
  const [activeTab, setActiveTab] = useState<string>('all');

  const [orders, setOrders]   = useState<PurchaseOrder[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast]     = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3500);
  };

  // ── Create modal ─────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ leadId: '', amount: '', product: '', vendorName: '', vendorEmail: '', receivedDate: '', notes: '' });
  const [saving, setSaving] = useState(false);

  // ── Edit modal ───────────────────────────────────────────────────────────
  const [editTarget, setEditTarget]   = useState<PurchaseOrder | null>(null);
  const [editForm, setEditForm]       = useState({ amount: '', product: '', vendorName: '', vendorEmail: '', notes: '', receivedDate: '' });
  const [editSaving, setEditSaving]   = useState(false);

  // ── Send to ARK modal ────────────────────────────────────────────────────
  const [sendTarget, setSendTarget]       = useState<PurchaseOrder | null>(null);
  const [sendVendorEmail, setSendVendorEmail] = useState('');
  const [sendVendorCc, setSendVendorCc]   = useState('');
  const [sending, setSending]             = useState(false);

  // ── Delete ───────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
  const [deleting, setDeleting]         = useState(false);


  // ── Step 2: Send Invoice to Customer ────────────────────────────────────
  const [custInvTarget, setCustInvTarget] = useState<PurchaseOrder | null>(null);
  const [custInvEmail, setCustInvEmail]   = useState('');
  const [custInvBusy, setCustInvBusy]     = useState(false);

  // ── Step 4: Price Clearance (manual mark) ───────────────────────────────
  const [clearTarget, setClearTarget] = useState<PurchaseOrder | null>(null);
  const [clearBusy, setClearBusy]     = useState(false);

  // ── Step 5: Send PO to ARK (official) ───────────────────────────────────
  const [sendArkTarget, setSendArkTarget]   = useState<PurchaseOrder | null>(null);
  const [sendArkEmail, setSendArkEmail]     = useState('');
  const [sendArkBusy, setSendArkBusy]       = useState(false);

  // ── Step 6: ARK Invoice Received (manual mark) ──────────────────────────
  const [arkInvTarget, setArkInvTarget]   = useState<PurchaseOrder | null>(null);
  const [arkInvAmount, setArkInvAmount]   = useState('');
  const [arkInvBusy, setArkInvBusy]       = useState(false);

  // ─── Data loaders ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      const res = await purchasesApi.getAll(params);
      setOrders(mergeFlow(res.data || []));
      setTotal(res.pagination?.total ?? 0);
    } catch { setOrders([]); setTotal(0); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    try { const res = await leadsApi.getAll({ limit: 200 }); setLeads(res.data || []); } catch { setLeads([]); }
    setCreateForm({ leadId: '', amount: '', product: '', vendorName: '', vendorEmail: '', receivedDate: new Date().toISOString().slice(0, 10), notes: '' });
    setShowCreate(true);
  };

  const selectedLead = leads.find(l => l._id === createForm.leadId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.leadId) { showToast('Please select a customer', 'error'); return; }
    setSaving(true);
    try {
      await purchasesApi.create({ ...createForm, amount: Number(createForm.amount), receivedDate: createForm.receivedDate || new Date().toISOString().slice(0, 10) });
      setShowCreate(false); showToast('Purchase order created'); load();
    } catch (err: any) { showToast(err?.response?.data?.message || 'Failed to create PO', 'error'); }
    finally { setSaving(false); }
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditTarget(po);
    setEditForm({ amount: String(po.amount), product: po.product || '', vendorName: po.vendorName || '', vendorEmail: po.vendorEmail || '', notes: po.notes || '', receivedDate: po.receivedDate ? new Date(po.receivedDate).toISOString().slice(0, 10) : '' });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await purchasesApi.update(editTarget._id, { ...editForm, amount: Number(editForm.amount), receivedDate: editForm.receivedDate || editTarget.receivedDate });
      setEditTarget(null); showToast('Updated successfully'); load();
    } catch (err: any) { showToast(err?.response?.data?.message || 'Failed to update', 'error'); }
    finally { setEditSaving(false); }
  };

  const openSendModal = (po: PurchaseOrder) => { setSendTarget(po); setSendVendorEmail(po.vendorEmail || ''); setSendVendorCc(''); };

  const handleSendToArk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendTarget || !sendVendorEmail.trim()) { showToast('Please enter ARK email', 'error'); return; }
    setSending(true);
    try {
      await purchasesApi.forwardToArk(sendTarget._id, sendVendorEmail.trim(), sendTarget.vendorName, sendVendorCc.trim() || undefined);
      const flowData: FlowData = { poForwardedToArk: true, poForwardedToArkAt: new Date().toISOString() };
      saveFlow(sendTarget._id, flowData);
      setSendTarget(null); showToast('PO forwarded to ARK');
      setOrders(prev => mergeFlow(prev.map(o => o._id === sendTarget._id ? { ...o, ...flowData } : o)));
    } catch (err: any) { showToast(err?.response?.data?.message || 'Failed to send', 'error'); }
    finally { setSending(false); }
  };

  const downloadInvoice = (po: PurchaseOrder) => {
    const doc = new jsPDF();
    const lead = po.leadId as Lead;
    const pageW = doc.internal.pageSize.getWidth();

    // ── Header band ──────────────────────────────────────────────────────────
    doc.setFillColor(109, 40, 217); // violet-700
    doc.rect(0, 0, pageW, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('ZIEOS', 14, 28);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(po.poInvoiceNumber || 'INV-DRAFT', pageW - 14, 18, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Date: ${po.invoiceGeneratedAt ? new Date(po.invoiceGeneratedAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}`, pageW - 14, 28, { align: 'right' });

    doc.setTextColor(30, 30, 30);

    // ── Bill To ───────────────────────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(109, 40, 217);
    doc.text('BILL TO', 14, 52);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(lead?.companyName || '—', 14, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (lead?.contactPersonName) doc.text(lead.contactPersonName, 14, 67);
    if (lead?.email) doc.text(lead.email, 14, 73);

    // ── PO Reference ─────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(109, 40, 217);
    doc.text('PO REFERENCE', pageW - 80, 52);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    doc.text(po.poNumber, pageW - 80, 60);
    doc.text(`Received: ${new Date(po.receivedDate).toLocaleDateString('en-IN')}`, pageW - 80, 67);
    if (po.vendorName) doc.text(`ARK / Vendor: ${po.vendorName}`, pageW - 80, 74);

    // ── Divider ───────────────────────────────────────────────────────────────
    doc.setDrawColor(220, 220, 230);
    doc.line(14, 82, pageW - 14, 82);

    // ── Table header ─────────────────────────────────────────────────────────
    doc.setFillColor(245, 243, 255); // violet-50
    doc.rect(14, 86, pageW - 28, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(109, 40, 217);
    doc.text('DESCRIPTION', 18, 93);
    doc.text('AMOUNT', pageW - 18, 93, { align: 'right' });

    // ── Line item ─────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.text(po.product || 'Product / Service', 18, 107);
    if (po.notes) { doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.text(po.notes, 18, 114); }
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(`Rs. ${(po.invoiceAmount ?? po.amount).toLocaleString('en-IN')}`, pageW - 18, 107, { align: 'right' });

    // ── Divider ───────────────────────────────────────────────────────────────
    doc.setDrawColor(220, 220, 230);
    doc.line(14, 122, pageW - 14, 122);

    // ── Total ─────────────────────────────────────────────────────────────────
    doc.setFillColor(109, 40, 217);
    doc.rect(pageW - 80, 126, 66, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL', pageW - 76, 135);
    doc.text(`Rs. ${(po.invoiceAmount ?? po.amount).toLocaleString('en-IN')}`, pageW - 18, 135, { align: 'right' });

    // ── License info ─────────────────────────────────────────────────────────
    if (po.licenseKey || po.licenseFile) {
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(109, 40, 217);
      doc.text('LICENSE DETAILS', 14, 152);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      if (po.licenseKey)  doc.text(`License Key: ${po.licenseKey}`, 14, 160);
      if (po.licenseFile) doc.text(`License File: ${po.licenseFile}`, 14, 167);
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.internal.pageSize.getHeight() - 18;
    doc.setFillColor(245, 243, 255);
    doc.rect(0, footerY - 8, pageW, 26, 'F');
    doc.setTextColor(109, 40, 217);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Thank you for your business  •  ZIEOS', pageW / 2, footerY, { align: 'center' });
    doc.setTextColor(150, 150, 180);
    doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, pageW / 2, footerY + 6, { align: 'center' });

    doc.save(`${po.poInvoiceNumber || po.poNumber}-invoice.pdf`);
  };


  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await purchasesApi.delete(deleteTarget._id); setOrders(p => p.filter(o => o._id !== deleteTarget._id)); setTotal(p => p - 1); setDeleteTarget(null); }
    catch (err: any) { showToast(err?.response?.data?.message || 'Failed to delete', 'error'); }
    finally { setDeleting(false); }
  };

  const handleSyncEmails = async () => {
    setSyncing(true);
    try { await purchasesApi.syncEmails(); showToast('Sync completed'); await load(); }
    catch (err: any) { showToast(err?.response?.data?.message || 'Sync failed', 'error'); }
    finally { setSyncing(false); }
  };

  // ── Step 2: Send Invoice to Customer ─────────────────────────────────────
  const handleSendCustomerInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custInvTarget || !custInvEmail.trim()) { showToast('Customer email required', 'error'); return; }
    setCustInvBusy(true);
    try {
      await purchasesApi.sendCustomerInvoice(custInvTarget._id, custInvEmail.trim());
      const flowData: FlowData = { customerInvoiceSent: true, customerInvoiceSentAt: new Date().toISOString() };
      saveFlow(custInvTarget._id, flowData);
      setOrders(prev => mergeFlow(prev.map(o => o._id === custInvTarget._id ? { ...o, ...flowData } : o)));
      setCustInvTarget(null); showToast('Invoice sent to customer');
    } catch (err: any) { showToast(err?.response?.data?.message || 'Failed', 'error'); }
    finally { setCustInvBusy(false); }
  };

  // ── Step 4: Mark Price Clearance ─────────────────────────────────────────
  const handleMarkPriceClearance = async () => {
    if (!clearTarget) return;
    setClearBusy(true);
    try {
      await purchasesApi.markPriceClearance(clearTarget._id);
      const flowData: FlowData = { priceClearanceReceived: true, priceClearanceReceivedAt: new Date().toISOString() };
      saveFlow(clearTarget._id, flowData);
      setOrders(prev => mergeFlow(prev.map(o => o._id === clearTarget._id ? { ...o, ...flowData } : o)));
      setClearTarget(null); showToast('Price clearance marked');
    } catch { showToast('Failed', 'error'); }
    finally { setClearBusy(false); }
  };

  // ── Step 5: Send PO to ARK ───────────────────────────────────────────────
  const handleSendPoToArk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendArkTarget || !sendArkEmail.trim()) { showToast('ARK email required', 'error'); return; }
    setSendArkBusy(true);
    try {
      await purchasesApi.sendPoToArk(sendArkTarget._id, sendArkEmail.trim());
      const flowData: FlowData = { poSentToArk: true, poSentToArkAt: new Date().toISOString() };
      saveFlow(sendArkTarget._id, flowData);
      setOrders(prev => mergeFlow(prev.map(o => o._id === sendArkTarget._id ? { ...o, ...flowData } : o)));
      setSendArkTarget(null); showToast('PO sent to ARK');
    } catch (err: any) { showToast(err?.response?.data?.message || 'Failed', 'error'); }
    finally { setSendArkBusy(false); }
  };

  // ── Step 6: Mark ARK Invoice Received ────────────────────────────────────
  const handleMarkArkInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arkInvTarget) return;
    setArkInvBusy(true);
    try {
      await purchasesApi.markArkInvoice(arkInvTarget._id, arkInvAmount ? Number(arkInvAmount) : undefined);
      const flowData: FlowData = { arkInvoiceReceived: true, arkInvoiceReceivedAt: new Date().toISOString(), ...(arkInvAmount ? { arkInvoiceAmount: Number(arkInvAmount) } : {}) };
      saveFlow(arkInvTarget._id, flowData);
      setOrders(prev => mergeFlow(prev.map(o => o._id === arkInvTarget._id ? { ...o, ...flowData } : o)));
      setArkInvTarget(null); showToast('ARK invoice marked as received');
    } catch { showToast('Failed', 'error'); }
    finally { setArkInvBusy(false); }
  };

  const phaseOrders = (phase: number) => orders.filter(o => getPoStep(o) === phase);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelImportButton
            entityName="Purchase Orders"
            columnHint="poNumber, amount, vendorName, vendorEmail, receivedDate (YYYY-MM-DD), product, notes"
            onImport={async (rows) => {
              let imported = 0;
              for (const row of rows) {
                const amount = parseFloat(row.amount || '0');
                if (!amount) continue;
                try {
                  await purchasesApi.create({ amount, vendorName: row.vendorName || '', vendorEmail: row.vendorEmail || '', receivedDate: row.receivedDate || new Date().toISOString().split('T')[0], product: row.product || '', notes: row.notes || '' });
                  imported++;
                } catch { /* skip */ }
              }
              load();
              return { imported };
            }}
          />
          <button onClick={handleSyncEmails} disabled={syncing} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />{syncing ? 'Syncing...' : 'Sync Emails'}
          </button>
          {canEdit && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add PO</button>
          )}
        </div>
      </div>

      {/* ── Phase pills ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab('all')}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all',
            activeTab === 'all' ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700'
          )}
        >
          All
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-bold', activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>
            {orders.length}
          </span>
        </button>
        {FLOW_STEPS.map((s, i) => {
          const count = phaseOrders(s.num).length;
          const active = activeTab === String(s.num);
          return (
            <div key={s.num} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-gray-300 text-sm">→</span>}
              <button
                onClick={() => setActiveTab(String(s.num))}
                className={cn('flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all',
                  active ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700'
                )}
              >
                <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                  active ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'
                )}>{s.num}</span>
                {s.label}
                {count > 0 && (
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-bold', active ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700')}>
                    {count}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Search ───────────────────────────────────────────────────────────── */}
      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search PO number, product…" className="input-field pl-9" />
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : (() => {
          const visible = activeTab === 'all' ? orders : orders.filter(o => getPoStep(o) === Number(activeTab));
          const filtered = search ? visible.filter(o =>
            o.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
            (o.product || '').toLowerCase().includes(search.toLowerCase()) ||
            ((o.leadId as Lead)?.companyName || '').toLowerCase().includes(search.toLowerCase())
          ) : visible;

          if (filtered.length === 0) return (
            <div className="text-center text-gray-400 py-16">
              {search ? 'No matching purchase orders' : activeTab === 'all' ? 'No purchase orders yet. Click "Add PO" to create one.' : `No POs in phase ${activeTab}`}
            </div>
          );

          return (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['PO Number', 'Customer', 'Product', 'ARK / Vendor', 'Amount', 'Received', 'Phase', 'Action', ''].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(po => {
                    const step = getPoStep(po);
                    return (
                      <tr key={po._id} className="hover:bg-violet-50/20 transition-colors">
                        <td className="table-cell font-mono font-medium text-violet-700">{po.poNumber}</td>
                        <td className="table-cell">
                          <p className="font-medium text-gray-800">{(po.leadId as Lead)?.companyName || '—'}</p>
                          {(po.leadId as Lead)?.contactPersonName && <p className="text-xs text-gray-400">{(po.leadId as Lead).contactPersonName}</p>}
                        </td>
                        <td className="table-cell text-gray-500 text-sm">{po.product || '—'}</td>
                        <td className="table-cell text-sm">
                          {po.vendorName ? <><p>{po.vendorName}</p>{po.vendorEmail && <p className="text-xs text-gray-400">{po.vendorEmail}</p>}</> : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="table-cell font-semibold text-green-700">{formatCurrency(po.amount)}</td>
                        <td className="table-cell text-gray-400 text-xs">{formatDate(po.receivedDate)}</td>

                        {/* Phase badge */}
                        <td className="table-cell">
                          <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold',
                            step === 6 ? 'bg-emerald-100 text-emerald-700' :
                            step === 5 ? 'bg-blue-100 text-blue-700' :
                            step === 4 ? 'bg-teal-100 text-teal-700' :
                            step === 3 ? 'bg-amber-100 text-amber-700' :
                            step === 2 ? 'bg-sky-100 text-sky-700' :
                                         'bg-gray-100 text-gray-600'
                          )}>
                            <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[9px] font-bold">{step}</span>
                            {FLOW_STEPS[step - 1].short}
                          </div>
                        </td>

                        {/* Action button */}
                        <td className="table-cell">
                          {step === 1 && canEdit && (
                            <button onClick={() => { setCustInvTarget(po); setCustInvEmail((po.leadId as Lead)?.email || ''); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
                              <Receipt size={11} />Send Invoice
                            </button>
                          )}
                          {step === 2 && canEdit && (
                            <button onClick={() => openSendModal(po)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
                              <Send size={11} />Forward to ARK
                            </button>
                          )}
                          {step === 3 && canEdit && (
                            <button onClick={() => setClearTarget(po)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
                              <Mail size={11} />Mark Clearance
                            </button>
                          )}
                          {step === 4 && canEdit && (
                            <button onClick={() => { setSendArkTarget(po); setSendArkEmail(po.vendorEmail || ''); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
                              <Send size={11} />Send PO to ARK
                            </button>
                          )}
                          {step === 5 && canEdit && (
                            <button onClick={() => { setArkInvTarget(po); setArkInvAmount(''); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
                              <Receipt size={11} />Mark ARK Invoice
                            </button>
                          )}
                          {step === 6 && (
                            <span className="badge bg-emerald-100 text-emerald-700 text-xs px-2 py-1 whitespace-nowrap">✓ Complete</span>
                          )}
                        </td>

                        {/* Icons */}
                        <td className="table-cell">
                          <div className="flex items-center gap-1">
                            {po.invoiceGenerated && (
                              <button title="Download Invoice PDF" onClick={() => downloadInvoice(po)} className="p-1.5 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100">
                                <Download size={13} />
                              </button>
                            )}
                            {canEdit && <button title="Edit" onClick={() => openEdit(po)} className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100"><Edit size={13} /></button>}
                            {canEdit && <button title="Delete" onClick={() => setDeleteTarget(po)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={13} /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
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

      {/* ══ STEP 2 — Send Invoice to Customer ══════════════════════════════════ */}
      <Modal isOpen={!!custInvTarget} onClose={() => setCustInvTarget(null)} title={`Send Invoice to Customer — ${custInvTarget?.poNumber}`}>
        <form onSubmit={handleSendCustomerInvoice} className="space-y-4">
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-sm space-y-1">
            <p><strong>Customer:</strong> {(custInvTarget?.leadId as Lead)?.companyName}</p>
            <p><strong>Amount:</strong> {custInvTarget ? formatCurrency(custInvTarget.amount) : '—'}</p>
            <p><strong>Product:</strong> {custInvTarget?.product || '—'}</p>
          </div>
          <div>
            <label className="label">Customer Email *</label>
            <ContactEmailPicker required autoFocus placeholder="customer@example.com" value={custInvEmail} onChange={val => setCustInvEmail(val)} defaultContactType="TELLED" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setCustInvTarget(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={custInvBusy} className="btn-primary flex items-center gap-2">
              <Receipt size={14} />{custInvBusy ? 'Sending…' : 'Send Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══ STEP 3 — Forward PO to ARK ═════════════════════════════════════════ */}
      <Modal isOpen={!!sendTarget} onClose={() => { setSendTarget(null); setSendVendorEmail(''); }} title={`Forward PO to ARK — ${sendTarget?.poNumber}`}>
        <form onSubmit={handleSendToArk} className="space-y-4">
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-sm space-y-1">
            <p><strong>Customer:</strong> {(sendTarget?.leadId as Lead)?.companyName}</p>
            <p><strong>Amount:</strong> {sendTarget ? formatCurrency(sendTarget.amount) : '—'}</p>
            <p><strong>Product:</strong> {sendTarget?.product || '—'}</p>
          </div>
          <p className="text-xs text-gray-500">The same PO (unchanged) will be sent to ARK with a price clearance request.</p>
          <div>
            <label className="label">ARK Email *</label>
            <ContactEmailPicker required autoFocus placeholder="ark@example.com" value={sendVendorEmail} onChange={val => setSendVendorEmail(val)} defaultContactType="ARK" />
          </div>
          <div>
            <label className="label">CC</label>
            <ContactEmailPicker placeholder="CC (optional)" value={sendVendorCc} onChange={val => setSendVendorCc(val)} defaultContactType="ALL" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setSendTarget(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={sending} className="btn-primary flex items-center gap-2">
              <Send size={14} />{sending ? 'Sending…' : 'Forward to ARK'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══ STEP 4 — Mark Price Clearance Received ═════════════════════════════ */}
      <Modal isOpen={!!clearTarget} onClose={() => setClearTarget(null)} title="Mark Price Clearance Received">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm space-y-1">
            <p><strong>PO:</strong> {clearTarget?.poNumber}</p>
            <p><strong>ARK:</strong> {clearTarget?.vendorName || clearTarget?.vendorEmail || '—'}</p>
          </div>
          <p className="text-sm text-gray-600">
            Confirm that price clearance has been received from ARK.<br/>
            <span className="text-xs text-gray-400">(Email sync can also auto-detect this from your inbox.)</span>
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setClearTarget(null)} className="btn-secondary">Cancel</button>
            <button disabled={clearBusy} onClick={handleMarkPriceClearance} className="btn-primary flex items-center gap-2">
              <Mail size={14} />{clearBusy ? 'Marking…' : 'Mark as Received'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ══ STEP 5 — Send Official PO to ARK ══════════════════════════════════ */}
      <Modal isOpen={!!sendArkTarget} onClose={() => setSendArkTarget(null)} title={`Send Official PO to ARK — ${sendArkTarget?.poNumber}`}>
        <form onSubmit={handleSendPoToArk} className="space-y-4">
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-sm space-y-1">
            <p><strong>Customer:</strong> {(sendArkTarget?.leadId as Lead)?.companyName}</p>
            <p><strong>Amount:</strong> {sendArkTarget ? formatCurrency(sendArkTarget.amount) : '—'}</p>
            <p><strong>Product:</strong> {sendArkTarget?.product || '—'}</p>
          </div>
          <p className="text-xs text-gray-500">Send the official PO to ARK. ARK will process and send their invoice.</p>
          <div>
            <label className="label">ARK Email *</label>
            <ContactEmailPicker required autoFocus placeholder="ark@example.com" value={sendArkEmail} onChange={val => setSendArkEmail(val)} defaultContactType="ARK" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setSendArkTarget(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={sendArkBusy} className="btn-primary flex items-center gap-2">
              <Send size={14} />{sendArkBusy ? 'Sending…' : 'Send PO to ARK'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══ STEP 6 — Mark ARK Invoice Received ════════════════════════════════ */}
      <Modal isOpen={!!arkInvTarget} onClose={() => setArkInvTarget(null)} title="Mark ARK Invoice Received">
        <form onSubmit={handleMarkArkInvoice} className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm space-y-1">
            <p><strong>PO:</strong> {arkInvTarget?.poNumber}</p>
            <p><strong>ARK:</strong> {arkInvTarget?.vendorName || arkInvTarget?.vendorEmail || '—'}</p>
          </div>
          <p className="text-sm text-gray-600">
            Confirm ARK's invoice has been received.<br/>
            <span className="text-xs text-gray-400">(Email sync can also auto-detect this from your inbox.)</span>
          </p>
          <div>
            <label className="label">ARK Invoice Amount (₹)</label>
            <input type="number" step="0.01" className="input-field" placeholder="Enter invoice amount" value={arkInvAmount} onChange={e => setArkInvAmount(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setArkInvTarget(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={arkInvBusy} className="btn-primary flex items-center gap-2">
              <Receipt size={14} />{arkInvBusy ? 'Marking…' : 'Mark as Received'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Create PO modal ──────────────────────────────────────────────────── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Purchase Order" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Customer</p>
            <div>
              <label className="label">Customer *</label>
              <select required className="input-field" value={createForm.leadId} onChange={e => setCreateForm(f => ({ ...f, leadId: e.target.value }))}>
                <option value="">Select customer</option>
                {leads.map(l => <option key={l._id} value={l._id}>{l.companyName}</option>)}
              </select>
            </div>
            {selectedLead && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Contact Person</label><input readOnly className="input-field bg-white text-gray-600" value={selectedLead.contactPersonName || '—'} /></div>
                <div><label className="label">Email</label><input readOnly className="input-field bg-white text-gray-600" value={selectedLead.email || '—'} /></div>
              </div>
            )}
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">ARK / Vendor</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">ARK / Vendor Name</label><input className="input-field" value={createForm.vendorName} onChange={e => setCreateForm(f => ({ ...f, vendorName: e.target.value }))} /></div>
              <div><label className="label">ARK / Vendor Email</label><ContactEmailPicker placeholder="ark@example.com" value={createForm.vendorEmail} onChange={val => setCreateForm(f => ({ ...f, vendorEmail: val }))} defaultContactType="ARK" /></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Amount (₹) *</label><input required type="number" step="0.01" className="input-field" value={createForm.amount} onChange={e => setCreateForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><label className="label">Received Date *</label><input required type="date" className="input-field" value={createForm.receivedDate} onChange={e => setCreateForm(f => ({ ...f, receivedDate: e.target.value }))} /></div>
            <div className="col-span-2"><label className="label">Product/Service</label><input className="input-field" placeholder="e.g. Siemens PLC S7-1200" value={createForm.product} onChange={e => setCreateForm(f => ({ ...f, product: e.target.value }))} /></div>
          </div>
          <div><label className="label">Notes</label><textarea rows={2} className="input-field" value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save PO'}</button>
          </div>
        </form>
      </Modal>

      {/* ── Edit PO modal ────────────────────────────────────────────────────── */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit PO — ${editTarget?.poNumber}`} size="lg">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-violet-700 uppercase">Customer (read-only)</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Company</label><input readOnly className="input-field bg-white text-gray-600" value={(editTarget?.leadId as Lead)?.companyName || '—'} /></div>
              <div><label className="label">Contact</label><input readOnly className="input-field bg-white text-gray-600" value={(editTarget?.leadId as Lead)?.contactPersonName || '—'} /></div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase">ARK / Vendor</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">ARK / Vendor Name</label><input className="input-field" value={editForm.vendorName} onChange={e => setEditForm(f => ({ ...f, vendorName: e.target.value }))} /></div>
              <div><label className="label">ARK / Vendor Email</label><ContactEmailPicker placeholder="ark@example.com" value={editForm.vendorEmail} onChange={val => setEditForm(f => ({ ...f, vendorEmail: val }))} defaultContactType="ARK" /></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Amount (₹) *</label><input required type="number" step="0.01" className="input-field" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><label className="label">Received Date</label><input type="date" className="input-field" value={editForm.receivedDate} onChange={e => setEditForm(f => ({ ...f, receivedDate: e.target.value }))} /></div>
            <div className="col-span-2"><label className="label">Product/Service</label><input className="input-field" value={editForm.product} onChange={e => setEditForm(f => ({ ...f, product: e.target.value }))} /></div>
          </div>
          <div><label className="label">Notes</label><textarea rows={2} className="input-field" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setEditTarget(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={editSaving} className="btn-primary">{editSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>



      <ConfirmDialog isOpen={!!deleteTarget} title="Delete Purchase Order" message={`Delete PO ${deleteTarget?.poNumber}? This cannot be undone.`} confirmLabel="Delete" loading={deleting} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} danger />
    </div>
  );
}
