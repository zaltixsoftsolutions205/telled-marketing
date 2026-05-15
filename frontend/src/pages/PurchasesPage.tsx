import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Search, Edit, Trash2, ChevronDown, ChevronUp,
  Send, Mail, CheckCircle, Building2, FileText,
  Receipt, Key, X, Upload, Package, RefreshCw,
} from 'lucide-react';
import { purchasesApi } from '@/api/purchases';
import { leadsApi } from '@/api/leads';
import { accountsApi } from '@/api/accounts';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Toast from '@/components/common/Toast';
import ContactEmailPicker from '@/components/common/ContactEmailPicker';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';
import type { PurchaseOrder, Lead, POLineItem } from '@/types';

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: 'PO Added',               short: 'Added',         icon: Package },
  { num: 2, label: 'Forward PO to ARK',      short: 'Fwd to ARK',    icon: Send },
  { num: 3, label: 'ARK Response',           short: 'ARK Response',  icon: Mail },
  { num: 4, label: 'Docs to Customer',       short: 'Cust. Docs',    icon: FileText },
  { num: 5, label: 'Invoice to ARK',         short: 'ARK Invoice',   icon: Receipt },
  { num: 6, label: 'Docs to ARK',            short: 'ARK Docs',      icon: Upload },
  { num: 7, label: 'License Generation',     short: 'License',       icon: Key },
  { num: 8, label: 'Final Invoice',          short: 'Final Inv.',     icon: CheckCircle },
];

const STEP_COLORS: Record<number, string> = {
  1: 'bg-gray-100 text-gray-600',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-sky-100 text-sky-700',
  5: 'bg-orange-100 text-orange-700',
  6: 'bg-teal-100 text-teal-700',
  7: 'bg-violet-100 text-violet-700',
  8: 'bg-emerald-100 text-emerald-700',
};

// ─── Mini Step Progress Bar ───────────────────────────────────────────────────
function MiniStepper({ step, completed }: { step: number; completed: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      {STEPS.map((s, i) => {
        const done = completed || step > s.num;
        const active = !completed && step === s.num;
        return (
          <div key={s.num} className="flex items-center">
            <div
              title={s.label}
              className={cn(
                'w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0',
                done ? 'bg-emerald-500 text-white' :
                active ? 'bg-violet-600 text-white ring-1 ring-violet-300' :
                'bg-gray-100 text-gray-400'
              )}
            >
              {done ? '✓' : s.num}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('w-2 h-0.5', done ? 'bg-emerald-400' : 'bg-gray-200')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step Progress Bar (large, for modal) ─────────────────────────────────────
function StepProgressBar({ step, completed }: { step: number; completed: boolean }) {
  return (
    <div className="flex items-center w-full overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = completed || step > s.num;
        const active = !completed && step === s.num;
        const Icon = s.icon;
        return (
          <div key={s.num} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                done ? 'bg-emerald-500 border-emerald-500 text-white' :
                active ? 'bg-violet-600 border-violet-600 text-white' :
                'bg-white border-gray-200 text-gray-400'
              )}>
                {done ? <CheckCircle size={14} /> : <Icon size={13} />}
              </div>
              <span className={cn(
                'text-[9px] mt-1 font-medium text-center leading-tight max-w-[52px]',
                done ? 'text-emerald-600' : active ? 'text-violet-700' : 'text-gray-400'
              )}>
                {s.short}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mb-4 mx-0.5', done ? 'bg-emerald-400' : 'bg-gray-200')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Products display ─────────────────────────────────────────────────────────
function ProductsList({ po }: { po: PurchaseOrder }) {
  if (po.items && po.items.length > 0) {
    return (
      <div className="space-y-0.5">
        {po.items.map((item, i) => (
          <p key={i} className="text-xs text-gray-600 truncate">
            {item.product} {item.quantity > 1 ? `×${item.quantity}` : ''}
          </p>
        ))}
      </div>
    );
  }
  return <span className="text-sm text-gray-500">{po.product || '—'}</span>;
}

// ─── Line Items Table (for create/edit) ───────────────────────────────────────
function LineItemsTable({
  items,
  onChange,
}: {
  items: Partial<POLineItem>[];
  onChange: (items: Partial<POLineItem>[]) => void;
}) {
  const update = (i: number, field: keyof POLineItem, val: string | number) => {
    const next = items.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: val };
      if (field === 'quantity' || field === 'unitPrice') {
        updated.amount = (Number(updated.quantity) || 0) * (Number(updated.unitPrice) || 0);
      }
      return updated;
    });
    onChange(next);
  };

  const addRow = () => onChange([...items, { product: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  const removeRow = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Product / Service</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-600 text-xs w-20">Qty</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-600 text-xs w-28">Unit Price (₹)</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-600 text-xs w-28">Amount (₹)</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, i) => (
              <tr key={i}>
                <td className="px-2 py-1.5">
                  <input
                    className="input-field text-sm py-1"
                    placeholder="Product name"
                    value={item.product || ''}
                    onChange={e => update(i, 'product', e.target.value)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    className="input-field text-sm py-1 text-right"
                    value={item.quantity ?? 1}
                    onChange={e => update(i, 'quantity', e.target.value)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="input-field text-sm py-1 text-right"
                    value={item.unitPrice ?? 0}
                    onChange={e => update(i, 'unitPrice', e.target.value)}
                  />
                </td>
                <td className="px-3 py-1.5 text-right font-medium text-gray-700">
                  {formatCurrency(Number(item.amount) || 0)}
                </td>
                <td className="px-2 py-1.5">
                  {items.length > 1 && (
                    <button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-violet-50 border-t border-violet-200">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-violet-700">Total</td>
              <td className="px-3 py-2 text-right font-bold text-violet-700">{formatCurrency(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium"
      >
        <Plus size={14} /> Add Line Item
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PurchasesPage() {
  const { user } = useAuthStore();
  const canEdit = user?.role === 'admin' || user?.role === 'sales';
  const canFinance = user?.role === 'admin' || user?.role === 'finance';

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | number>('all');
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);

  // Detail modal
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    leadId: '', vendorName: '', vendorEmail: '', receivedDate: '', notes: '', paymentTerms: '',
  });
  const [lineItems, setLineItems] = useState<Partial<POLineItem>[]>([{ product: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<PurchaseOrder | null>(null);
  const [editForm, setEditForm] = useState({ vendorName: '', vendorEmail: '', notes: '', receivedDate: '', paymentTerms: '' });
  const [editItems, setEditItems] = useState<Partial<POLineItem>[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Step 2 modal
  const [step2Target, setStep2Target] = useState<PurchaseOrder | null>(null);
  const [step2Form, setStep2Form] = useState({ arkEmail: '', arkName: '', docName: '' });
  const [step2File, setStep2File] = useState<File | null>(null);

  // Step 3 modal
  const [step3Target, setStep3Target] = useState<PurchaseOrder | null>(null);
  const [step3Files, setStep3Files] = useState<File[]>([]);
  const [step3DocNames, setStep3DocNames] = useState('');

  // Step 4 modal
  const [step4Target, setStep4Target] = useState<PurchaseOrder | null>(null);
  const [step4Email, setStep4Email] = useState('');
  const [step4Files, setStep4Files] = useState<File[]>([]);

  // Step 5 modal
  const [step5Target, setStep5Target] = useState<PurchaseOrder | null>(null);
  const [step5Form, setStep5Form] = useState({ arkEmail: '', docName: '' });
  const [step5File, setStep5File] = useState<File | null>(null);

  // Step 6 modal
  const [step6Target, setStep6Target] = useState<PurchaseOrder | null>(null);
  const [step6Email, setStep6Email] = useState('');
  const [step6Files, setStep6Files] = useState<File[]>([]);

  // Step 7 modal
  const [step7Target, setStep7Target] = useState<PurchaseOrder | null>(null);

  // Step 8 modal
  const [step8Target, setStep8Target] = useState<PurchaseOrder | null>(null);
  const [step8Form, setStep8Form] = useState({ customerEmail: '', amount: '', convertToAccount: false, accountName: '' });
  const [step8File, setStep8File] = useState<File | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      if (typeof activeTab === 'number') params.step = activeTab;
      const res = await purchasesApi.getAll(params);
      setOrders(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch { setOrders([]); setTotal(0); }
    finally { setLoading(false); }
  }, [page, search, activeTab]);

  useEffect(() => { load(); }, [load]);

  const refreshSelected = async (id: string) => {
    try {
      const fresh = await purchasesApi.getById(id);
      if (fresh) setSelected(fresh as PurchaseOrder);
    } catch { /* ignore */ }
    await load();
  };

  const act = async (fn: () => Promise<unknown>, successMsg: string, closeModal?: () => void) => {
    setBusy(true);
    try {
      await fn();
      if (selected) await refreshSelected(selected._id);
      else await load();
      showToast(successMsg);
      closeModal?.();
    } catch (e: any) {
      showToast(e?.response?.data?.message || e?.message || 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openCreate = async () => {
    try { const res = await leadsApi.getAll({ limit: 200 }); setLeads(res.data || []); } catch { setLeads([]); }
    setCreateForm({ leadId: '', vendorName: '', vendorEmail: '', receivedDate: new Date().toISOString().slice(0, 10), notes: '', paymentTerms: '' });
    setLineItems([{ product: '', quantity: 1, unitPrice: 0, amount: 0 }]);
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.leadId) { showToast('Please select a customer', 'error'); return; }
    const validItems = lineItems.filter(i => i.product?.trim());
    if (validItems.length === 0) { showToast('Please add at least one product', 'error'); return; }
    const hasPrice = validItems.every(i => (Number(i.unitPrice) || 0) > 0);
    if (!hasPrice) { showToast('All items must have a unit price', 'error'); return; }
    setSaving(true);
    try {
      await purchasesApi.create({
        ...createForm,
        items: validItems,
        receivedDate: createForm.receivedDate || new Date().toISOString().slice(0, 10),
      });
      setShowCreate(false);
      showToast('Purchase order created');
      load();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to create PO', 'error');
    } finally { setSaving(false); }
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditTarget(po);
    setEditForm({
      vendorName: po.vendorName || '',
      vendorEmail: po.vendorEmail || '',
      notes: po.notes || '',
      receivedDate: po.receivedDate ? new Date(po.receivedDate).toISOString().slice(0, 10) : '',
      paymentTerms: po.paymentTerms || '',
    });
    setEditItems(
      po.items && po.items.length > 0
        ? po.items.map(i => ({ ...i }))
        : [{ product: po.product || '', quantity: 1, unitPrice: po.amount, amount: po.amount }]
    );
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const validItems = editItems.filter(i => i.product?.trim());
      await purchasesApi.update(editTarget._id, {
        ...editForm,
        items: validItems.length > 0 ? validItems : undefined,
      });
      setEditTarget(null);
      showToast('Updated successfully');
      if (selected?._id === editTarget._id) await refreshSelected(editTarget._id);
      else load();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to update', 'error');
    } finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await purchasesApi.delete(deleteTarget._id);
      setOrders(p => p.filter(o => o._id !== deleteTarget._id));
      setTotal(p => p - 1);
      setDeleteTarget(null);
      if (selected?._id === deleteTarget._id) setSelected(null);
    } catch (err: any) { showToast(err?.response?.data?.message || 'Failed to delete', 'error'); }
    finally { setDeleting(false); }
  };

  // ── Step Action handlers ──────────────────────────────────────────────────
  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!step2Target || !step2Form.arkEmail.trim()) { showToast('ARK email required', 'error'); return; }
    await act(
      () => purchasesApi.step2ForwardToArk(step2Target._id, step2Form.arkEmail, step2Form.arkName || undefined, step2File || undefined, undefined, step2Form.docName || undefined),
      'PO forwarded to ARK',
      () => { setStep2Target(null); setStep2File(null); setStep2Form({ arkEmail: '', arkName: '', docName: '' }); }
    );
  };

  const handleStep3 = async () => {
    if (!step3Target) return;
    const names = step3DocNames.split(',').map(s => s.trim()).filter(Boolean);
    await act(
      () => purchasesApi.step3PriceClearance(step3Target._id, step3Files.length ? step3Files : undefined, names.length ? names : undefined),
      'Price clearance marked',
      () => { setStep3Target(null); setStep3Files([]); setStep3DocNames(''); }
    );
  };

  const handleStep4 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!step4Target || !step4Email.trim()) { showToast('Customer email required', 'error'); return; }
    await act(
      () => purchasesApi.step4SendDocsToCustomer(step4Target._id, step4Email, step4Files.length ? step4Files : undefined),
      'Documents sent to customer',
      () => { setStep4Target(null); setStep4Files([]); setStep4Email(''); }
    );
  };

  const handleStep5 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!step5Target || !step5Form.arkEmail.trim()) { showToast('ARK email required', 'error'); return; }
    await act(
      () => purchasesApi.step5InvoiceToArk(step5Target._id, step5Form.arkEmail, step5File || undefined, step5Form.docName || undefined),
      'Invoice sent to ARK',
      () => { setStep5Target(null); setStep5File(null); setStep5Form({ arkEmail: '', docName: '' }); }
    );
  };

  const handleStep6 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!step6Target || !step6Email.trim()) { showToast('ARK email required', 'error'); return; }
    await act(
      () => purchasesApi.step6SendDocsToArk(step6Target._id, step6Email, step6Files.length ? step6Files : undefined),
      'Documents sent to ARK',
      () => { setStep6Target(null); setStep6Files([]); setStep6Email(''); }
    );
  };

  const handleStep7 = async () => {
    if (!step7Target) return;
    await act(
      () => purchasesApi.step7LicenseReceived(step7Target._id),
      'License generation mail marked as received',
      () => setStep7Target(null)
    );
  };

  const handleStep8 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!step8Target || !step8Form.customerEmail.trim()) { showToast('Customer email required', 'error'); return; }
    if (!step8Form.amount || Number(step8Form.amount) <= 0) { showToast('Invoice amount required', 'error'); return; }
    await act(
      () => purchasesApi.step8FinalInvoice(
        step8Target._id,
        step8Form.customerEmail,
        Number(step8Form.amount),
        step8Form.convertToAccount,
        step8Form.accountName || undefined,
        step8File || undefined,
      ),
      step8Form.convertToAccount ? 'Final invoice sent & customer converted to account!' : 'Final invoice sent to customer',
      () => { setStep8Target(null); setStep8File(null); setStep8Form({ customerEmail: '', amount: '', convertToAccount: false, accountName: '' }); }
    );
  };

  // ── Step action button (on list row) ─────────────────────────────────────
  function StepActionButton({ po }: { po: PurchaseOrder }) {
    const step = po.currentStep || 1;
    const completed = po.workflowStatus === 'Completed';
    if (completed || !canEdit) return null;

    switch (step) {
      case 1: return (
        <button onClick={e => { e.stopPropagation(); setStep2Target(po); setStep2Form({ arkEmail: po.vendorEmail || '', arkName: po.vendorName || '', docName: '' }); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
          <Send size={11} />Forward to ARK
        </button>
      );
      case 2: return (
        <button onClick={e => { e.stopPropagation(); setStep2Target(po); setStep2Form({ arkEmail: po.vendorEmail || '', arkName: po.vendorName || '', docName: '' }); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
          <Send size={11} />Forward to ARK
        </button>
      );
      case 3: return (
        <button onClick={e => { e.stopPropagation(); setStep3Target(po); setStep3Files([]); setStep3DocNames(''); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
          <Mail size={11} />Mark Clearance
        </button>
      );
      case 4: return (
        <button onClick={e => { e.stopPropagation(); setStep4Target(po); setStep4Email((po.leadId as Lead)?.email || ''); setStep4Files([]); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
          <FileText size={11} />Send Docs
        </button>
      );
      case 5: return (
        <button onClick={e => { e.stopPropagation(); setStep5Target(po); setStep5Form({ arkEmail: po.vendorEmail || '', docName: '' }); setStep5File(null); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
          <Receipt size={11} />Invoice to ARK
        </button>
      );
      case 6: return (
        <button onClick={e => { e.stopPropagation(); setStep6Target(po); setStep6Email(po.vendorEmail || ''); setStep6Files([]); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
          <Upload size={11} />Docs to ARK
        </button>
      );
      case 7: return (
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); setStep7Target(po); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
            <Key size={11} />Mark License
          </button>
          {(po.step7LicenseMailReceived && !po.converted && !po.step8FinalInvoiceSent) && (
            <button onClick={e => { e.stopPropagation(); accountsApi.convert({ leadId: typeof po.leadId === 'string' ? po.leadId : (po.leadId as Lead)._id, accountName: (po.leadId as Lead)?.companyName || '' }).then(() => { showToast('Converted to account'); load(); }).catch(() => showToast('Failed', 'error')); }} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
              <Building2 size={11} />Convert to Account
            </button>
          )}
        </div>
      );
      case 8: return po.step8FinalInvoiceSent ? (
        <span className="badge bg-emerald-100 text-emerald-700 text-xs px-2 py-1 whitespace-nowrap">✓ Completed</span>
      ) : (
        <button onClick={e => { e.stopPropagation(); setStep8Target(po); setStep8Form({ customerEmail: (po.leadId as Lead)?.email || '', amount: String(po.amount), convertToAccount: false, accountName: (po.leadId as Lead)?.companyName || '' }); setStep8File(null); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
          <Receipt size={11} />Final Invoice
        </button>
      );
      default: return null;
    }
  }

  // ── Step detail panel inside modal ────────────────────────────────────────
  function StepDetail({ po }: { po: PurchaseOrder }) {
    const step = po.currentStep || 1;
    const completed = po.workflowStatus === 'Completed';

    function StepRow({ num, label, done, active, extra }: { num: number; label: string; done: boolean; active: boolean; extra?: React.ReactNode }) {
      const open = expandedStep === num;
      return (
        <div>
          <button
            onClick={() => setExpandedStep(prev => prev === num ? null : num)}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left',
              done ? 'bg-emerald-50 border-emerald-200' :
              active ? 'bg-violet-50 border-violet-200' :
              'bg-white border-gray-200 hover:border-gray-300'
            )}
          >
            <div className="flex items-center gap-3">
              <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                done ? 'bg-emerald-500 text-white' : active ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-500'
              )}>
                {done ? '✓' : num}
              </span>
              <span className="font-medium text-sm text-gray-800">{label}</span>
              {done && <span className="badge bg-emerald-100 text-emerald-700 text-xs">Done</span>}
              {active && !done && <span className="badge bg-violet-100 text-violet-700 text-xs">Active</span>}
            </div>
            {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
          </button>
          {open && extra && (
            <div className="mt-1 ml-2 p-4 bg-white border border-gray-100 rounded-xl space-y-2">
              {extra}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <StepRow num={1} label="PO Added" done={step > 1 || completed} active={step === 1}
          extra={
            <div className="text-sm space-y-1">
              <p className="text-gray-500 text-xs">PO received and added to the system.</p>
              {po.items && po.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Product</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500">Qty</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500">Unit Price</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {po.items.map((it, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">{it.product}</td>
                          <td className="px-3 py-2 text-right">{it.quantity}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(it.unitPrice)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-violet-50 border-t border-violet-200">
                      <tr><td colSpan={3} className="px-3 py-2 font-semibold text-violet-700 text-xs">Total</td><td className="px-3 py-2 text-right font-bold text-violet-700">{formatCurrency(po.amount)}</td></tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p><strong>Product:</strong> {po.product || '—'} · <strong>Amount:</strong> {formatCurrency(po.amount)}</p>
              )}
              {canEdit && step === 1 && (
                <button onClick={() => { setExpandedStep(null); setStep2Target(po); setStep2Form({ arkEmail: po.vendorEmail || '', arkName: po.vendorName || '', docName: '' }); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 w-fit">
                  <Send size={11} />Forward to ARK
                </button>
              )}
            </div>
          }
        />

        <StepRow num={2} label="Forward PO to ARK" done={po.step2ForwardedToArk || step > 2 || completed} active={step === 2}
          extra={
            <div className="text-sm space-y-2">
              {po.step2ForwardedToArk ? (
                <>
                  <p className="text-emerald-600 text-xs flex items-center gap-1"><CheckCircle size={12} /> Forwarded on {formatDate(po.step2ForwardedAt!)}</p>
                  {po.step2PoDocName && <p className="text-xs text-gray-500">Document: {po.step2PoDocName}</p>}
                  <p className="text-xs text-gray-500">Sent to: {po.vendorEmail}</p>
                  {canEdit && (
                    <button onClick={() => { setExpandedStep(null); setStep2Target(po); setStep2Form({ arkEmail: po.vendorEmail || '', arkName: po.vendorName || '', docName: '' }); setStep2File(null); }} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium w-fit">
                      <RefreshCw size={11} />Resend
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500">Upload PO document and send to ARK (OEM) for price clearance.</p>
                  {canEdit && step <= 2 && (
                    <button onClick={() => { setExpandedStep(null); setStep2Target(po); setStep2Form({ arkEmail: po.vendorEmail || '', arkName: po.vendorName || '', docName: '' }); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 w-fit">
                      <Send size={11} />Forward to ARK
                    </button>
                  )}
                </>
              )}
            </div>
          }
        />

        <StepRow num={3} label="ARK Response — Price Clearance" done={po.step3PriceClearanceReceived || step > 3 || completed} active={step === 3}
          extra={
            <div className="text-sm space-y-2">
              {po.step3PriceClearanceReceived ? (
                <>
                  <p className="text-emerald-600 text-xs flex items-center gap-1"><CheckCircle size={12} /> Price clearance received on {formatDate(po.step3ReceivedAt!)}</p>
                  {po.step3DocNames && po.step3DocNames.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {po.step3DocNames.map(d => <span key={d} className="badge bg-blue-50 text-blue-700 text-xs">{d}</span>)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500">Upload received ARK documents and mark price clearance as received.</p>
                  {canEdit && step === 3 && (
                    <button onClick={() => { setExpandedStep(null); setStep3Target(po); setStep3Files([]); setStep3DocNames(''); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 w-fit">
                      <Mail size={11} />Mark Price Clearance
                    </button>
                  )}
                </>
              )}
            </div>
          }
        />

        <StepRow num={4} label="Send Documents to Customer" done={po.step4DocsSentToCustomer || step > 4 || completed} active={step === 4}
          extra={
            <div className="text-sm space-y-2">
              {po.step4DocsSentToCustomer ? (
                <>
                  <p className="text-emerald-600 text-xs flex items-center gap-1"><CheckCircle size={12} /> Documents sent on {formatDate(po.step4SentAt!)}</p>
                  {canEdit && (
                    <button onClick={() => { setExpandedStep(null); setStep4Target(po); setStep4Email((po.leadId as Lead)?.email || ''); setStep4Files([]); }} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium w-fit">
                      <RefreshCw size={11} />Resend
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500">Upload and forward all received ARK documents to the customer.</p>
                  {canEdit && step === 4 && (
                    <button onClick={() => { setExpandedStep(null); setStep4Target(po); setStep4Email((po.leadId as Lead)?.email || ''); setStep4Files([]); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 w-fit">
                      <FileText size={11} />Send Docs to Customer
                    </button>
                  )}
                </>
              )}
            </div>
          }
        />

        <StepRow num={5} label="Invoice to ARK" done={po.step5InvoiceToArk || step > 5 || completed} active={step === 5}
          extra={
            <div className="text-sm space-y-2">
              {po.step5InvoiceToArk ? (
                <>
                  <p className="text-emerald-600 text-xs flex items-center gap-1"><CheckCircle size={12} /> Invoice sent on {formatDate(po.step5InvoiceSentAt!)}</p>
                  {po.step5InvoiceDocName && <p className="text-xs text-gray-500">Invoice doc: {po.step5InvoiceDocName}</p>}
                  {canEdit && (
                    <button onClick={() => { setExpandedStep(null); setStep5Target(po); setStep5Form({ arkEmail: po.vendorEmail || '', docName: '' }); setStep5File(null); }} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium w-fit">
                      <RefreshCw size={11} />Resend
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500">Upload invoice and send to ARK (OEM).</p>
                  {canEdit && step === 5 && (
                    <button onClick={() => { setExpandedStep(null); setStep5Target(po); setStep5Form({ arkEmail: po.vendorEmail || '', docName: '' }); setStep5File(null); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 w-fit">
                      <Receipt size={11} />Send Invoice to ARK
                    </button>
                  )}
                </>
              )}
            </div>
          }
        />

        <StepRow num={6} label="Send Documents to ARK" done={po.step6DocsSentToArk || step > 6 || completed} active={step === 6}
          extra={
            <div className="text-sm space-y-2">
              {po.step6DocsSentToArk ? (
                <>
                  <p className="text-emerald-600 text-xs flex items-center gap-1"><CheckCircle size={12} /> Customer docs sent to ARK on {formatDate(po.step6SentAt!)}</p>
                  {canEdit && (
                    <button onClick={() => { setExpandedStep(null); setStep6Target(po); setStep6Email(po.vendorEmail || ''); setStep6Files([]); }} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium w-fit">
                      <RefreshCw size={11} />Resend
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500">Upload and send completed customer documents to ARK.</p>
                  {canEdit && step === 6 && (
                    <button onClick={() => { setExpandedStep(null); setStep6Target(po); setStep6Email(po.vendorEmail || ''); setStep6Files([]); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 w-fit">
                      <Upload size={11} />Send Docs to ARK
                    </button>
                  )}
                </>
              )}
            </div>
          }
        />

        <StepRow num={7} label="License Generation" done={po.step7LicenseMailReceived || step > 7 || completed} active={step === 7}
          extra={
            <div className="text-sm space-y-2">
              {po.step7LicenseMailReceived ? (
                <p className="text-emerald-600 text-xs flex items-center gap-1"><CheckCircle size={12} /> License mail received on {formatDate(po.step7LicenseMailReceivedAt!)}</p>
              ) : (
                <>
                  <p className="text-xs text-gray-500">Manually mark when the license generation mail is received from ARK.</p>
                  {canEdit && step === 7 && (
                    <button onClick={() => { setExpandedStep(null); setStep7Target(po); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 w-fit">
                      <Key size={11} />Mark License Mail Received
                    </button>
                  )}
                </>
              )}
            </div>
          }
        />

        <StepRow num={8} label="Final Invoice" done={po.step8FinalInvoiceSent || completed} active={step === 8 && !po.step8FinalInvoiceSent}
          extra={
            <div className="text-sm space-y-2">
              {po.step8FinalInvoiceSent ? (
                <>
                  <p className="text-emerald-600 text-xs flex items-center gap-1"><CheckCircle size={12} /> Final invoice sent on {formatDate(po.step8FinalInvoiceSentAt!)}</p>
                  {po.step8FinalInvoiceNumber && <p className="text-xs text-gray-500">Invoice#: {po.step8FinalInvoiceNumber} · Amount: {formatCurrency(po.step8FinalInvoiceAmount || po.amount)}</p>}
                  {canEdit && (
                    <button onClick={() => { setExpandedStep(null); setStep8Target(po); setStep8Form({ customerEmail: (po.leadId as Lead)?.email || '', amount: String(po.step8FinalInvoiceAmount || po.amount), convertToAccount: false, accountName: (po.leadId as Lead)?.companyName || '' }); setStep8File(null); }} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium w-fit">
                      <RefreshCw size={11} />Resend
                    </button>
                  )}
                  {!po.converted && canEdit && (
                    <button
                      onClick={() => accountsApi.convert({ leadId: typeof po.leadId === 'string' ? po.leadId : (po.leadId as Lead)._id, accountName: (po.leadId as Lead)?.companyName || '' })
                        .then(() => { showToast('Converted to account'); refreshSelected(po._id); })
                        .catch(() => showToast('Failed', 'error'))
                      }
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 w-fit"
                    >
                      <Building2 size={11} />Convert to Account
                    </button>
                  )}
                  {po.converted && <span className="badge bg-emerald-100 text-emerald-700 text-xs">✓ Customer Converted to Account</span>}
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500">Generate and send final invoice to customer. Optionally convert customer to Account.</p>
                  {canEdit && step === 8 && (
                    <button onClick={() => { setExpandedStep(null); setStep8Target(po); setStep8Form({ customerEmail: (po.leadId as Lead)?.email || '', amount: String(po.amount), convertToAccount: false, accountName: (po.leadId as Lead)?.companyName || '' }); setStep8File(null); }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 w-fit">
                      <Receipt size={11} />Generate Final Invoice
                    </button>
                  )}
                </>
              )}
            </div>
          }
        />
      </div>
    );
  }

  // ─── Tab counts ─────────────────────────────────────────────────────────────
  const tabCount = (s: number) => orders.filter(o => (o.currentStep || 1) === s).length;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total · 8-step workflow</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={16} />Add PO
          </button>
        )}
      </div>

      {/* Step filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab('all')}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all',
            activeTab === 'all' ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700'
          )}
        >
          All <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-bold', activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>{orders.length}</span>
        </button>
        {STEPS.map((s, i) => {
          const active = activeTab === s.num;
          const cnt = tabCount(s.num);
          return (
            <div key={s.num} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-gray-300 text-sm">›</span>}
              <button
                onClick={() => setActiveTab(s.num)}
                className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all',
                  active ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700'
                )}
              >
                <span className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold',
                  active ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'
                )}>{s.num}</span>
                {s.short}
                {cnt > 0 && <span className={cn('text-[10px] px-1 py-0.5 rounded-full font-bold', active ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700')}>{cnt}</span>}
              </button>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-xs">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search PO, customer, product…" className="input-field pl-9" />
      </div>

      {/* Table */}
      <div className="glass-card !p-0 overflow-hidden hidden md:block">
        {loading ? <LoadingSpinner className="h-48" /> : (() => {
          const visible = activeTab === 'all' ? orders : orders.filter(o => (o.currentStep || 1) === activeTab);
          if (visible.length === 0) return (
            <div className="text-center text-gray-400 py-16">
              {activeTab === 'all' ? 'No purchase orders yet. Click "Add PO" to get started.' : `No POs at step ${activeTab}`}
            </div>
          );
          return (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['PO Number', 'Customer', 'Products', 'ARK / OEM', 'Amount', 'Received', 'Step', 'Action', ''].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map(po => {
                    const step = po.currentStep || 1;
                    const completed = po.workflowStatus === 'Completed';
                    return (
                      <tr key={po._id} className="hover:bg-violet-50/20 transition-colors cursor-pointer" onClick={() => { setSelected(po); setExpandedStep(step); }}>
                        <td className="table-cell font-mono font-medium text-violet-700">{po.poNumber}</td>
                        <td className="table-cell">
                          <p className="font-medium text-gray-800">{(po.leadId as Lead)?.companyName || '—'}</p>
                          {(po.leadId as Lead)?.contactPersonName && <p className="text-xs text-gray-400">{(po.leadId as Lead).contactPersonName}</p>}
                        </td>
                        <td className="table-cell max-w-[160px]"><ProductsList po={po} /></td>
                        <td className="table-cell text-sm">
                          {po.vendorName
                            ? <><p className="text-gray-700">{po.vendorName}</p>{po.vendorEmail && <p className="text-xs text-gray-400 truncate max-w-[120px]">{po.vendorEmail}</p>}</>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="table-cell font-semibold text-green-700">{formatCurrency(po.amount)}</td>
                        <td className="table-cell text-gray-400 text-xs">{formatDate(po.receivedDate)}</td>
                        <td className="table-cell">
                          <div className="space-y-1">
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', completed ? 'bg-emerald-100 text-emerald-700' : STEP_COLORS[step])}>
                              {completed ? '✓ Complete' : `Step ${step}`}
                            </span>
                            <div><MiniStepper step={step} completed={completed} /></div>
                          </div>
                        </td>
                        <td className="table-cell" onClick={e => e.stopPropagation()}>
                          <StepActionButton po={po} />
                        </td>
                        <td className="table-cell" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
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

      {/* Mobile Card View */}
      {loading ? (
        <LoadingSpinner className="h-48 md:hidden" />
      ) : (() => {
        const visible = activeTab === 'all' ? orders : orders.filter(o => (o.currentStep || 1) === activeTab);
        if (visible.length === 0) return (
          <div className="md:hidden text-center text-gray-400 py-16 glass-card">
            {activeTab === 'all' ? 'No purchase orders yet.' : `No POs at step ${activeTab}`}
          </div>
        );
        return (
          <div className="md:hidden space-y-3">
            {visible.map(po => {
              const step = po.currentStep || 1;
              const completed = po.workflowStatus === 'Completed';
              return (
                <div key={po._id} className="glass-card !p-4 space-y-3" onClick={() => { setSelected(po); setExpandedStep(step); }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono font-semibold text-violet-700 text-sm">{po.poNumber}</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{(po.leadId as Lead)?.companyName || '—'}</p>
                    </div>
                    <span className={cn('badge text-xs', completed ? 'bg-emerald-100 text-emerald-700' : STEP_COLORS[step])}>
                      {completed ? '✓ Complete' : `Step ${step}`}
                    </span>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <ProductsList po={po} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-gray-400">Amount:</span> <span className="font-semibold text-green-700">{formatCurrency(po.amount)}</span></div>
                    {po.vendorName && <div><span className="text-gray-400">ARK:</span> <span className="text-gray-600 truncate">{po.vendorName}</span></div>}
                    <div><span className="text-gray-400">Received:</span> <span className="text-gray-600">{formatDate(po.receivedDate)}</span></div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                    <StepActionButton po={po} />
                    <div className="flex items-center gap-1 ml-auto">
                      {canEdit && <button title="Edit" onClick={() => openEdit(po)} className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100"><Edit size={13} /></button>}
                      {canEdit && <button title="Delete" onClick={() => setDeleteTarget(po)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={13} /></button>}
                    </div>
                  </div>
                </div>
              );
            })}
            {total > 15 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 15)}</p>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
                  <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── Detail Modal ──────────────────────────────────────────────────────── */}
      {selected && (
        <Modal
          title={
            <div className="flex items-center gap-3">
              <Package size={18} className="text-violet-600" />
              <span>{(selected.leadId as Lead)?.companyName} — {selected.poNumber}</span>
              <span className={cn('badge text-xs', selected.workflowStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}>
                {selected.workflowStatus}
              </span>
            </div>
          }
          onClose={() => setSelected(null)}
        >
          <div className="space-y-4">
            {/* Info strip */}
            <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-xl text-sm">
              <div><span className="text-gray-500 text-xs">PO Number</span><p className="font-medium">{selected.poNumber}</p></div>
              <div><span className="text-gray-500 text-xs">Customer</span><p className="font-medium">{(selected.leadId as Lead)?.companyName || '—'}</p></div>
              <div><span className="text-gray-500 text-xs">ARK / OEM</span><p className="font-medium">{selected.vendorName || '—'}</p></div>
              <div><span className="text-gray-500 text-xs">Total Amount</span><p className="font-medium text-green-700">{formatCurrency(selected.amount)}</p></div>
              <div><span className="text-gray-500 text-xs">Step</span><p className="font-medium">{selected.currentStep || 1} / 8</p></div>
              {selected.paymentTerms && <div><span className="text-gray-500 text-xs">Payment Terms</span><p className="font-medium">{selected.paymentTerms}</p></div>}
            </div>
            {/* Progress bar */}
            <div className="overflow-x-auto pb-1">
              <StepProgressBar step={selected.currentStep || 1} completed={selected.workflowStatus === 'Completed'} />
            </div>
            {/* Step accordion */}
            <StepDetail po={selected} />
          </div>
        </Modal>
      )}

      {/* ─── Create PO Modal ───────────────────────────────────────────────────── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Purchase Order" size="lg">
        <form onSubmit={handleCreate} className="space-y-5">
          {/* Customer */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Customer</p>
            <div>
              <label className="label">Customer *</label>
              <select required className="input-field" value={createForm.leadId} onChange={e => setCreateForm(f => ({ ...f, leadId: e.target.value }))}>
                <option value="">Select customer</option>
                {leads.map(l => <option key={l._id} value={l._id}>{l.companyName}</option>)}
              </select>
            </div>
          </div>
          {/* ARK / OEM */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">ARK / OEM</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">ARK / OEM Name</label><input className="input-field" value={createForm.vendorName} onChange={e => setCreateForm(f => ({ ...f, vendorName: e.target.value }))} /></div>
              <div>
                <label className="label">ARK / OEM Email</label>
                <ContactEmailPicker placeholder="ark@example.com" value={createForm.vendorEmail} onChange={val => setCreateForm(f => ({ ...f, vendorEmail: val }))} defaultContactType="ARK" />
              </div>
            </div>
          </div>
          {/* Line Items */}
          <div>
            <label className="label mb-2">Products / Services *</label>
            <LineItemsTable items={lineItems} onChange={setLineItems} />
          </div>
          {/* Misc */}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Received Date *</label><input required type="date" className="input-field" value={createForm.receivedDate} onChange={e => setCreateForm(f => ({ ...f, receivedDate: e.target.value }))} /></div>
            <div><label className="label">Payment Terms</label><input className="input-field" placeholder="e.g. Net 30" value={createForm.paymentTerms} onChange={e => setCreateForm(f => ({ ...f, paymentTerms: e.target.value }))} /></div>
          </div>
          <div><label className="label">Notes</label><textarea rows={2} className="input-field" value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Create PO'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Edit PO Modal ─────────────────────────────────────────────────────── */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit PO — ${editTarget?.poNumber}`} size="lg">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase">ARK / OEM</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">ARK / OEM Name</label><input className="input-field" value={editForm.vendorName} onChange={e => setEditForm(f => ({ ...f, vendorName: e.target.value }))} /></div>
              <div>
                <label className="label">ARK / OEM Email</label>
                <ContactEmailPicker placeholder="ark@example.com" value={editForm.vendorEmail} onChange={val => setEditForm(f => ({ ...f, vendorEmail: val }))} defaultContactType="ARK" />
              </div>
            </div>
          </div>
          <div>
            <label className="label mb-2">Products / Services</label>
            <LineItemsTable items={editItems} onChange={setEditItems} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Received Date</label><input type="date" className="input-field" value={editForm.receivedDate} onChange={e => setEditForm(f => ({ ...f, receivedDate: e.target.value }))} /></div>
            <div><label className="label">Payment Terms</label><input className="input-field" value={editForm.paymentTerms} onChange={e => setEditForm(f => ({ ...f, paymentTerms: e.target.value }))} /></div>
          </div>
          <div><label className="label">Notes</label><textarea rows={2} className="input-field" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setEditTarget(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={editSaving} className="btn-primary">{editSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Step 2: Forward PO to ARK ─────────────────────────────────────────── */}
      <Modal isOpen={!!step2Target} onClose={() => { setStep2Target(null); setStep2File(null); }} title={`Step 2 — Forward PO to ARK: ${step2Target?.poNumber}`}>
        <form onSubmit={handleStep2} className="space-y-4">
          <p className="text-xs text-gray-500">Upload the PO document and send to ARK (OEM) for price clearance.</p>
          <div><label className="label">ARK / OEM Email *</label><ContactEmailPicker required autoFocus placeholder="ark@example.com" value={step2Form.arkEmail} onChange={v => setStep2Form(f => ({ ...f, arkEmail: v }))} defaultContactType="ARK" /></div>
          <div><label className="label">ARK / OEM Name</label><input className="input-field" value={step2Form.arkName} onChange={e => setStep2Form(f => ({ ...f, arkName: e.target.value }))} /></div>
          <div>
            <label className="label">Attach PO Document</label>
            <input type="file" className="input-field py-2 text-sm" onChange={e => { const f = e.target.files?.[0]; setStep2File(f || null); if (f) setStep2Form(p => ({ ...p, docName: f.name })); }} />
            {step2File && <p className="text-xs text-violet-600 mt-1">{step2File.name}</p>}
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setStep2Target(null); setStep2File(null); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex items-center gap-2">
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              {busy ? 'Sending…' : 'Forward to ARK'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Step 3: ARK Response — Mark Price Clearance ───────────────────────── */}
      <Modal isOpen={!!step3Target} onClose={() => { setStep3Target(null); setStep3Files([]); }} title={`Step 3 — ARK Response: ${step3Target?.poNumber}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Upload received ARK documents and mark price clearance as received.</p>
          <div>
            <label className="label">Upload ARK Documents (optional)</label>
            <input type="file" multiple className="input-field py-2 text-sm" onChange={e => setStep3Files(Array.from(e.target.files || []))} />
            {step3Files.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {step3Files.map(f => <span key={f.name} className="badge bg-blue-50 text-blue-700 text-xs">{f.name}</span>)}
              </div>
            )}
          </div>
          <div>
            <label className="label">Document Names (comma separated, optional)</label>
            <input className="input-field text-sm" placeholder="price_clearance.pdf, quotation.pdf" value={step3DocNames} onChange={e => setStep3DocNames(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setStep3Target(null); setStep3Files([]); setStep3DocNames(''); }} className="btn-secondary">Cancel</button>
            <button disabled={busy} onClick={handleStep3} className="btn-primary flex items-center gap-2">
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {busy ? 'Saving…' : 'Mark Price Clearance Received'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Step 4: Send Docs to Customer ─────────────────────────────────────── */}
      <Modal isOpen={!!step4Target} onClose={() => { setStep4Target(null); setStep4Files([]); }} title={`Step 4 — Send Docs to Customer: ${step4Target?.poNumber}`}>
        <form onSubmit={handleStep4} className="space-y-4">
          <p className="text-xs text-gray-500">Upload and forward all received ARK documents to the customer.</p>
          <div><label className="label">Customer Email *</label><ContactEmailPicker required autoFocus placeholder="customer@example.com" value={step4Email} onChange={setStep4Email} defaultContactType="CUSTOMER" /></div>
          <div>
            <label className="label">Attach Documents (optional)</label>
            <input type="file" multiple className="input-field py-2 text-sm" onChange={e => setStep4Files(Array.from(e.target.files || []))} />
            {step4Files.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {step4Files.map(f => <span key={f.name} className="badge bg-blue-50 text-blue-700 text-xs">{f.name}</span>)}
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setStep4Target(null); setStep4Files([]); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex items-center gap-2">
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              {busy ? 'Sending…' : 'Send to Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Step 5: Invoice to ARK ─────────────────────────────────────────────── */}
      <Modal isOpen={!!step5Target} onClose={() => { setStep5Target(null); setStep5File(null); }} title={`Step 5 — Invoice to ARK: ${step5Target?.poNumber}`}>
        <form onSubmit={handleStep5} className="space-y-4">
          <p className="text-xs text-gray-500">Upload the invoice document and send to ARK (OEM).</p>
          <div><label className="label">ARK / OEM Email *</label><ContactEmailPicker required autoFocus placeholder="ark@example.com" value={step5Form.arkEmail} onChange={v => setStep5Form(f => ({ ...f, arkEmail: v }))} defaultContactType="ARK" /></div>
          <div>
            <label className="label">Attach Invoice Document</label>
            <input type="file" className="input-field py-2 text-sm" onChange={e => { const f = e.target.files?.[0]; setStep5File(f || null); if (f) setStep5Form(p => ({ ...p, docName: f.name })); }} />
            {step5File && <p className="text-xs text-violet-600 mt-1">{step5File.name}</p>}
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setStep5Target(null); setStep5File(null); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex items-center gap-2">
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Receipt size={14} />}
              {busy ? 'Sending…' : 'Send Invoice to ARK'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Step 6: Send Docs to ARK ───────────────────────────────────────────── */}
      <Modal isOpen={!!step6Target} onClose={() => { setStep6Target(null); setStep6Files([]); }} title={`Step 6 — Send Docs to ARK: ${step6Target?.poNumber}`}>
        <form onSubmit={handleStep6} className="space-y-4">
          <p className="text-xs text-gray-500">Upload and send completed customer documents back to ARK.</p>
          <div><label className="label">ARK / OEM Email *</label><ContactEmailPicker required autoFocus placeholder="ark@example.com" value={step6Email} onChange={setStep6Email} defaultContactType="ARK" /></div>
          <div>
            <label className="label">Attach Documents (optional)</label>
            <input type="file" multiple className="input-field py-2 text-sm" onChange={e => setStep6Files(Array.from(e.target.files || []))} />
            {step6Files.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {step6Files.map(f => <span key={f.name} className="badge bg-blue-50 text-blue-700 text-xs">{f.name}</span>)}
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setStep6Target(null); setStep6Files([]); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex items-center gap-2">
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              {busy ? 'Sending…' : 'Send Docs to ARK'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Step 7: License Generation ─────────────────────────────────────────── */}
      <Modal isOpen={!!step7Target} onClose={() => setStep7Target(null)} title={`Step 7 — License Generation: ${step7Target?.poNumber}`}>
        <div className="space-y-4">
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-sm space-y-1">
            <p><strong>PO:</strong> {step7Target?.poNumber}</p>
            <p><strong>Customer:</strong> {(step7Target?.leadId as Lead)?.companyName}</p>
          </div>
          <p className="text-sm text-gray-600">Confirm that the license generation mail has been received from ARK. This is a manual update.</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setStep7Target(null)} className="btn-secondary">Cancel</button>
            <button disabled={busy} onClick={handleStep7} className="btn-primary flex items-center gap-2">
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
              {busy ? 'Saving…' : 'Mark License Mail Received'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Step 8: Final Invoice ───────────────────────────────────────────────── */}
      <Modal isOpen={!!step8Target} onClose={() => { setStep8Target(null); setStep8File(null); }} title={`Step 8 — Final Invoice: ${step8Target?.poNumber}`}>
        <form onSubmit={handleStep8} className="space-y-4">
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-sm space-y-1">
            <p><strong>Customer:</strong> {(step8Target?.leadId as Lead)?.companyName}</p>
            <p><strong>PO Amount:</strong> {step8Target ? formatCurrency(step8Target.amount) : '—'}</p>
          </div>
          <div><label className="label">Customer Email *</label><ContactEmailPicker required autoFocus placeholder="customer@example.com" value={step8Form.customerEmail} onChange={v => setStep8Form(f => ({ ...f, customerEmail: v }))} defaultContactType="CUSTOMER" /></div>
          <div><label className="label">Invoice Amount (₹) *</label><input required type="number" step="0.01" className="input-field" value={step8Form.amount} onChange={e => setStep8Form(f => ({ ...f, amount: e.target.value }))} /></div>
          <div>
            <label className="label">Attach Invoice (optional)</label>
            <input type="file" className="input-field py-2 text-sm" onChange={e => setStep8File(e.target.files?.[0] || null)} />
            {step8File && <p className="text-xs text-violet-600 mt-1">{step8File.name}</p>}
          </div>
          <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 transition-colors">
            <input type="checkbox" className="accent-violet-600" checked={step8Form.convertToAccount} onChange={e => setStep8Form(f => ({ ...f, convertToAccount: e.target.checked }))} />
            <div>
              <p className="text-sm font-medium text-gray-800">Convert customer to Account</p>
              <p className="text-xs text-gray-500">Creates a new Account record and marks the lead as Converted</p>
            </div>
          </label>
          {step8Form.convertToAccount && (
            <div><label className="label">Account Name</label><input className="input-field" value={step8Form.accountName} onChange={e => setStep8Form(f => ({ ...f, accountName: e.target.value }))} placeholder="Account name" /></div>
          )}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setStep8Target(null); setStep8File(null); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary flex items-center gap-2">
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Receipt size={14} />}
              {busy ? 'Sending…' : 'Send Final Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Purchase Order"
        message={`Delete PO ${deleteTarget?.poNumber}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
