import { useEffect, useState, useCallback } from 'react';
import {
  ClipboardList, Search, Plus, ChevronDown, ChevronUp,
  Mail, FileText, CheckCircle, Clock, AlertCircle, Send,
  Download, Key, Receipt, CreditCard, RefreshCw, X,
  Building2, Package,
} from 'lucide-react';
import { poExecutionApi } from '@/api/poExecution';
import { purchasesApi } from '@/api/purchases';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import Toast from '@/components/common/Toast';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import type { POExecutionWorkflow, PurchaseOrder } from '@/types';
import { cn } from '@/utils/cn';

// ─── Step config ─────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: 'PO Notification',          icon: Mail },
  { num: 2, label: 'Distributor Docs',          icon: FileText },
  { num: 3, label: 'Customer Forms',            icon: Send },
  { num: 4, label: 'Distributor Invoice',       icon: Receipt },
  { num: 5, label: 'Share to Distributor',      icon: RefreshCw },
  { num: 6, label: 'License Generation',        icon: Key },
  { num: 7, label: 'Customer Invoice',          icon: CreditCard },
];

// ─── Badge helpers ────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending:    'bg-amber-100 text-amber-700',
    Sent:       'bg-blue-100 text-blue-700',
    Received:   'bg-emerald-100 text-emerald-700',
    NA:         'bg-gray-100 text-gray-500',
    Completed:  'bg-emerald-100 text-emerald-700',
    Generated:  'bg-violet-100 text-violet-700',
    Delivered:  'bg-emerald-100 text-emerald-700',
    Paid:       'bg-emerald-100 text-emerald-700',
    Unpaid:     'bg-red-100 text-red-600',
    Partial:    'bg-amber-100 text-amber-700',
    Failed:     'bg-red-100 text-red-600',
    'In Progress': 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={cn('badge text-[11px] font-medium', map[status] || 'bg-gray-100 text-gray-600')}>
      {status}
    </span>
  );
}

// ─── Step Progress Bar ────────────────────────────────────────────────────────
function StepProgressBar({ currentStep, overallStatus }: { currentStep: number; overallStatus: string }) {
  return (
    <div className="flex items-center gap-0 w-full">
      {STEPS.map((step, idx) => {
        const done    = currentStep > step.num || overallStatus === 'Completed';
        const active  = currentStep === step.num && overallStatus !== 'Completed';
        const Icon    = step.icon;
        return (
          <div key={step.num} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                done   ? 'bg-emerald-500 border-emerald-500 text-white' :
                active ? 'bg-violet-600 border-violet-600 text-white' :
                         'bg-white border-gray-300 text-gray-400'
              )}>
                {done ? <CheckCircle size={14} /> : <Icon size={13} />}
              </div>
              <span className={cn('text-[9px] mt-1 font-medium text-center leading-tight max-w-[56px]',
                done ? 'text-emerald-600' : active ? 'text-violet-700' : 'text-gray-400'
              )}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mb-4 mx-1', currentStep > step.num || overallStatus === 'Completed' ? 'bg-emerald-400' : 'bg-gray-200')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Doc field row ────────────────────────────────────────────────────────────
function DocRow({
  label, field, data, onUpdate, readOnly,
}: {
  label: string;
  field: string;
  data: { status: string; fileName?: string; url?: string; info?: string };
  onUpdate: (field: string, patch: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(data.info || data.url || data.fileName || '');

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700 w-40 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {editing ? (
          <>
            <input
              className="input-field text-sm flex-1"
              value={val}
              onChange={e => setVal(e.target.value)}
              placeholder="Enter value..."
            />
            <button className="btn-primary text-xs px-3 py-1.5" onClick={() => { onUpdate(field, { status: 'Received', info: val, url: val, fileName: val }); setEditing(false); }}>
              Save
            </button>
            <button className="text-gray-400 hover:text-gray-600" onClick={() => setEditing(false)}><X size={14} /></button>
          </>
        ) : (
          <>
            <span className="text-xs text-gray-500 truncate max-w-[120px]">{data.info || data.url || data.fileName || '—'}</span>
            <StatusPill status={data.status} />
            {!readOnly && data.status !== 'Received' && (
              <div className="flex gap-1">
                <button className="text-xs text-violet-600 hover:underline" onClick={() => setEditing(true)}>Edit</button>
                {data.status !== 'NA' && (
                  <button className="text-xs text-emerald-600 hover:underline ml-1" onClick={() => onUpdate(field, { status: 'Received' })}>Mark Received</button>
                )}
                {field === 'startupForm' && data.status !== 'NA' && (
                  <button className="text-xs text-gray-400 hover:underline ml-1" onClick={() => onUpdate(field, { status: 'NA' })}>N/A</button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function POExecutionPage() {
  const { user } = useAuthStore();
  const canEdit = user?.role === 'admin' || user?.role === 'sales';
  const readOnly = !canEdit;

  const [workflows, setWorkflows]     = useState<POExecutionWorkflow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected]       = useState<POExecutionWorkflow | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(1);
  const [toast, setToast]             = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [busy, setBusy]               = useState(false);

  // Start workflow modal
  const [showStart, setShowStart]     = useState(false);
  const [availablePOs, setAvailablePOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO]   = useState('');
  const [starting, setStarting]       = useState(false);

  // Sub-modals
  const [showDistInvoice, setShowDistInvoice] = useState(false);
  const [distInvoiceForm, setDistInvoiceForm] = useState({ amount: '', paymentTerms: '', customerDetails: '' });

  const [showCustInvoice, setShowCustInvoice] = useState(false);
  const [custInvoiceForm, setCustInvoiceForm] = useState({ amount: '', tdsExemptionAttached: false });

  const [showLicense, setShowLicense] = useState(false);
  const [licenseForm, setLicenseForm] = useState({ licenseKey: '', licenseFile: '' });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await poExecutionApi.getAll({ search, status: filterStatus || undefined });
      setWorkflows((res as any).data || []);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus]);

  useEffect(() => { load(); }, [load]);

  // Reload selected workflow fresh from list
  const refreshSelected = async (id: string) => {
    const fresh = await poExecutionApi.getById(id);
    if (fresh) { setSelected(fresh as POExecutionWorkflow); }
    await load();
  };

  const openStart = async () => {
    const res = await purchasesApi.getAll({ limit: 100 });
    // Only POs that don't have a workflow yet
    const existingPoIds = workflows.map(w => w.poId);
    setAvailablePOs((res.data as PurchaseOrder[]).filter(p => !existingPoIds.includes(p._id)));
    setSelectedPO('');
    setShowStart(true);
  };

  const handleStart = async () => {
    if (!selectedPO) return;
    setStarting(true);
    try {
      const wf = await poExecutionApi.create(selectedPO);
      setShowStart(false);
      await load();
      setSelected(wf as POExecutionWorkflow);
      setExpandedStep(1);
      showToast('PO Execution Workflow started!');
    } catch {
      showToast('Failed to start workflow', 'error');
    } finally {
      setStarting(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      if (selected) await refreshSelected(selected._id);
      showToast(successMsg);
    } catch (e: any) {
      showToast(e?.message || 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  // ─── Step panels ───────────────────────────────────────────────────────────
  function StepPanel({ wf }: { wf: POExecutionWorkflow }) {
    const toggleStep = (n: number) => setExpandedStep(prev => prev === n ? null : n);

    function StepHeader({ num, label, statusNode }: { num: number; label: string; statusNode: React.ReactNode }) {
      const open = expandedStep === num;
      const done = wf.currentStep > num || wf.overallStatus === 'Completed';
      return (
        <button
          onClick={() => toggleStep(num)}
          className={cn(
            'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
            done ? 'bg-emerald-50 border-emerald-200' :
            wf.currentStep === num ? 'bg-violet-50 border-violet-200' :
            'bg-white border-gray-200 hover:border-gray-300'
          )}
        >
          <div className="flex items-center gap-3">
            <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
              done ? 'bg-emerald-500 text-white' :
              wf.currentStep === num ? 'bg-violet-600 text-white' :
              'bg-gray-200 text-gray-500'
            )}>{done ? '✓' : num}</span>
            <span className="font-medium text-sm text-gray-800">{label}</span>
            {statusNode}
          </div>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
      );
    }

    return (
      <div className="space-y-2">

        {/* STEP 1 */}
        <div>
          <StepHeader num={1} label="PO Notification" statusNode={<StatusPill status={wf.step1.status} />} />
          {expandedStep === 1 && (
            <div className="mt-1 ml-2 p-4 bg-white rounded-xl border border-gray-100 space-y-3">
              <p className="text-xs text-gray-500">Notify OEM and Distributor leadership by sending them a copy of the PO.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* OEM */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                  <div>
                    <p className="text-sm font-medium text-gray-700">OEM Notification</p>
                    {wf.step1.oemNotifiedAt && <p className="text-xs text-gray-400">{formatDate(wf.step1.oemNotifiedAt)}</p>}
                  </div>
                  {!readOnly && (
                    <div className="flex flex-col items-end gap-1">
                      {wf.step1.oemNotified && <span className="badge bg-emerald-100 text-emerald-700 text-xs">Sent</span>}
                      <div className="flex gap-1">
                        {wf.step1.oemNotified ? (
                          <button disabled={busy} onClick={() => act(() => poExecutionApi.notifyOEM(wf._id), 'OEM re-notified!')} className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                            <RefreshCw size={11} />Resend
                          </button>
                        ) : (
                          <button disabled={busy} onClick={() => act(() => poExecutionApi.notifyOEM(wf._id), 'OEM notified!')} className="btn-primary text-xs px-3 py-1.5">
                            <Mail size={13} className="inline mr-1" />Send
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {readOnly && wf.step1.oemNotified && <span className="badge bg-emerald-100 text-emerald-700 text-xs">Sent</span>}
                </div>
                {/* Distributor */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Distributor Notification</p>
                    {wf.step1.distributorNotifiedAt && <p className="text-xs text-gray-400">{formatDate(wf.step1.distributorNotifiedAt)}</p>}
                  </div>
                  {!readOnly && (
                    <div className="flex flex-col items-end gap-1">
                      {wf.step1.distributorNotified && <span className="badge bg-emerald-100 text-emerald-700 text-xs">Sent</span>}
                      <div className="flex gap-1">
                        {wf.step1.distributorNotified ? (
                          <button disabled={busy} onClick={() => act(() => poExecutionApi.notifyDistributor(wf._id), 'Distributor re-notified!')} className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                            <RefreshCw size={11} />Resend
                          </button>
                        ) : (
                          <button disabled={busy} onClick={() => act(() => poExecutionApi.notifyDistributor(wf._id), 'Distributor notified!')} className="btn-primary text-xs px-3 py-1.5">
                            <Mail size={13} className="inline mr-1" />Send
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {readOnly && wf.step1.distributorNotified && <span className="badge bg-emerald-100 text-emerald-700 text-xs">Sent</span>}
                </div>
              </div>
              {/* Move to next step */}
              {!readOnly && (wf.step1.oemNotified || wf.step1.distributorNotified) && wf.currentStep === 1 && (
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <span className="text-xs text-gray-400 flex-1">Notifications sent. Move to next step when ready.</span>
                  <button disabled={busy} onClick={() => act(() => poExecutionApi.updateStep(wf._id, 'step1Completed', {}), 'Moved to Step 2!')} className="btn-primary text-xs px-3 py-1.5">
                    Next Step →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* STEP 2 */}
        <div>
          <StepHeader num={2} label="Distributor Documentation" statusNode={null} />
          {expandedStep === 2 && (
            <div className="mt-1 ml-2 p-4 bg-white rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 mb-3">Track documents received from Distributor. Documents can arrive in any order.</p>
              <DocRow label="License Form"          field="licenseForm"        data={wf.step2.licenseForm}        onUpdate={(f, d) => act(() => poExecutionApi.updateDocField(wf._id, f, d), 'Updated!')} readOnly={readOnly} />
              <DocRow label="Startup Form"          field="startupForm"        data={wf.step2.startupForm}        onUpdate={(f, d) => act(() => poExecutionApi.updateDocField(wf._id, f, d), 'Updated!')} readOnly={readOnly} />
              <DocRow label="Machine Details Link"  field="machineDetailsLink" data={wf.step2.machineDetailsLink} onUpdate={(f, d) => act(() => poExecutionApi.updateDocField(wf._id, f, d), 'Updated!')} readOnly={readOnly} />
              <DocRow label="Price Clearance Info"  field="priceClearanceInfo" data={wf.step2.priceClearanceInfo} onUpdate={(f, d) => act(() => poExecutionApi.updateDocField(wf._id, f, d), 'Updated!')} readOnly={readOnly} />
              <DocRow label="Payment Terms"         field="paymentTerms"       data={wf.step2.paymentTerms}       onUpdate={(f, d) => act(() => poExecutionApi.updateDocField(wf._id, f, d), 'Updated!')} readOnly={readOnly} />
            </div>
          )}
        </div>

        {/* STEP 3 */}
        <div>
          <StepHeader num={3} label="Customer Forms" statusNode={<StatusPill status={wf.step3.status} />} />
          {expandedStep === 3 && (
            <div className="mt-1 ml-2 p-4 bg-white rounded-xl border border-gray-100 space-y-3">
              <p className="text-xs text-gray-500">Send License Form, Startup Form, and Machine Details Link to the customer for completion.</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: 'License Form',         sent: wf.step3.licenseFormSent },
                  { label: 'Startup Form',          sent: wf.step3.startupFormSent },
                  { label: 'Machine Details Link',  sent: wf.step3.machineDetailsLinkSent },
                ].map(item => (
                  <div key={item.label} className={cn('p-2 rounded-lg border text-center', item.sent ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200')}>
                    <p className="font-medium text-gray-700">{item.label}</p>
                    <StatusPill status={item.sent ? 'Sent' : 'Pending'} />
                  </div>
                ))}
              </div>
              {wf.step3.sentAt && <p className="text-xs text-gray-400">Sent on {formatDate(wf.step3.sentAt)}</p>}
              {wf.step3.completedAt && <p className="text-xs text-emerald-600">Completed on {formatDate(wf.step3.completedAt)}</p>}
              {!readOnly && (
                <div className="flex gap-2 flex-wrap items-center">
                  {wf.step3.status === 'Pending' && (
                    <button disabled={busy} onClick={() => act(() => poExecutionApi.sendCustomerForms(wf._id), 'Customer forms sent!')} className="btn-primary text-xs px-3 py-1.5">
                      <Send size={13} className="inline mr-1" />Send All Forms to Customer
                    </button>
                  )}
                  {(wf.step3.status === 'Sent' || wf.step3.status === 'Completed') && (
                    <>
                      <button disabled={busy} onClick={() => act(() => poExecutionApi.sendCustomerForms(wf._id), 'Customer forms resent!')} className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                        <RefreshCw size={11} />Resend
                      </button>
                      {wf.step3.status === 'Sent' && (
                        <>
                          <span className="text-gray-300">|</span>
                          <button disabled={busy} onClick={() => act(() => poExecutionApi.markCustomerFormsCompleted(wf._id), 'Customer forms marked completed!')} className="btn-primary text-xs px-3 py-1.5">
                            <CheckCircle size={13} className="inline mr-1" />Mark as Completed
                          </button>
                          <button disabled={busy} onClick={() => { setExpandedStep(4); }} className="text-xs text-gray-500 hover:underline">
                            Skip →
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* STEP 4 */}
        <div>
          <StepHeader num={4} label="Distributor Invoice" statusNode={<StatusPill status={wf.step4.status} />} />
          {expandedStep === 4 && (
            <div className="mt-1 ml-2 p-4 bg-white rounded-xl border border-gray-100 space-y-3">
              <p className="text-xs text-gray-500">Generate invoice for Distributor based on approved pricing and payment terms.</p>
              {wf.step4.invoiceNumber ? (
                <div className="p-3 rounded-lg bg-violet-50 border border-violet-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-violet-800">{wf.step4.invoiceNumber}</span>
                    <StatusPill status={wf.step4.status} />
                  </div>
                  {wf.step4.amount && <p className="text-sm text-gray-700">Amount: <strong>{formatCurrency(wf.step4.amount)}</strong></p>}
                  {wf.step4.paymentTerms && <p className="text-xs text-gray-500">Terms: {wf.step4.paymentTerms}</p>}
                  {wf.step4.generatedAt && <p className="text-xs text-gray-400">Generated: {formatDate(wf.step4.generatedAt)}</p>}
                  {wf.step4.pdfPath && (
                    <button className="flex items-center gap-1 text-xs text-violet-600 hover:underline mt-1">
                      <Download size={12} />Download PDF
                    </button>
                  )}
                </div>
              ) : !readOnly ? (
                <button className="btn-primary text-xs px-3 py-1.5" onClick={() => setShowDistInvoice(true)}>
                  <Receipt size={13} className="inline mr-1" />Generate Distributor Invoice
                </button>
              ) : <p className="text-sm text-gray-400">No invoice generated yet.</p>}
            </div>
          )}
        </div>

        {/* STEP 5 */}
        <div>
          <StepHeader num={5} label="Share Back to Distributor" statusNode={<StatusPill status={wf.step5.status} />} />
          {expandedStep === 5 && (
            <div className="mt-1 ml-2 p-4 bg-white rounded-xl border border-gray-100 space-y-3">
              <p className="text-xs text-gray-500">Send completed customer forms and invoice details back to the Distributor.</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'Customer Forms Shared', done: wf.step5.formsShared },
                  { label: 'Invoice Shared',         done: wf.step5.invoiceShared },
                ].map(item => (
                  <div key={item.label} className={cn('p-2 rounded-lg border text-center', item.done ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200')}>
                    <p className="font-medium text-gray-700">{item.label}</p>
                    <StatusPill status={item.done ? 'Sent' : 'Pending'} />
                  </div>
                ))}
              </div>
              {wf.step5.sharedAt && <p className="text-xs text-gray-400">Shared on {formatDate(wf.step5.sharedAt)}</p>}
              {!readOnly && (
                <div className="flex gap-2 flex-wrap items-center">
                  {wf.step5.status !== 'Sent' ? (
                    <button disabled={busy} onClick={() => act(() => poExecutionApi.shareBackToDistributor(wf._id), 'Shared with Distributor!')} className="btn-primary text-xs px-3 py-1.5">
                      <Send size={13} className="inline mr-1" />Share to Distributor
                    </button>
                  ) : (
                    <>
                      <button disabled={busy} onClick={() => act(() => poExecutionApi.shareBackToDistributor(wf._id), 'Reshared with Distributor!')} className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                        <RefreshCw size={11} />Resend
                      </button>
                      <span className="text-gray-300">|</span>
                      <button disabled={busy} onClick={() => setExpandedStep(6)} className="text-xs text-gray-500 hover:underline">
                        Skip →
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* STEP 6 — License Generation → Convert to Account here */}
        <div>
          <StepHeader num={6} label="License Generation" statusNode={<StatusPill status={wf.step6.licenseStatus} />} />
          {expandedStep === 6 && (
            <div className="mt-1 ml-2 p-4 bg-white rounded-xl border border-gray-100 space-y-3">
              <p className="text-xs text-gray-500">Generate and deliver the license to customer.</p>
              {wf.step6.licenseKey || wf.step6.licenseFile ? (
                <div className="p-3 rounded-lg bg-violet-50 border border-violet-100 space-y-1">
                  {wf.step6.licenseKey && <p className="text-sm font-mono text-gray-800">Key: {wf.step6.licenseKey}</p>}
                  {wf.step6.licenseFile && <p className="text-xs text-gray-500">File: {wf.step6.licenseFile}</p>}
                  {wf.step6.deliveryDate && <p className="text-xs text-emerald-600">Delivered: {formatDate(wf.step6.deliveryDate)}</p>}
                </div>
              ) : null}
              {!readOnly && (
                <div className="flex gap-2 flex-wrap items-center">
                  {wf.step6.licenseStatus === 'Pending' && (
                    <button className="btn-primary text-xs px-3 py-1.5" onClick={() => setShowLicense(true)}>
                      <Key size={13} className="inline mr-1" />Generate License
                    </button>
                  )}
                  {wf.step6.licenseStatus === 'Generated' && (
                    <>
                      <button disabled={busy} onClick={() => act(() => poExecutionApi.updateLicenseStatus(wf._id, { licenseStatus: 'Delivered', deliveryDate: new Date().toISOString() }), 'License delivered!')} className="btn-primary text-xs px-3 py-1.5">
                        <CheckCircle size={13} className="inline mr-1" />Mark as Delivered
                      </button>
                      <button disabled={busy} onClick={() => setExpandedStep(7)} className="text-xs text-gray-500 hover:underline">
                        Skip →
                      </button>
                    </>
                  )}
                  {wf.step6.licenseStatus === 'Delivered' && (
                    <div className="w-full space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge bg-emerald-100 text-emerald-700 text-xs px-3 py-1.5">License Delivered</span>
                        <button disabled={busy} onClick={() => act(() => poExecutionApi.updateLicenseStatus(wf._id, { licenseStatus: 'Delivered', deliveryDate: new Date().toISOString() }), 'License resent!')} className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                          <RefreshCw size={11} />Resend License
                        </button>
                      </div>
                      {/* Convert to Account — triggered here on license delivery */}
                      <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <Building2 size={15} className="text-emerald-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-emerald-800">License received — Convert to Account</p>
                          <p className="text-xs text-emerald-600 mt-0.5">The customer has received their license. Create an account to begin support & billing.</p>
                        </div>
                        <button
                          disabled={busy}
                          onClick={() => act(() => poExecutionApi.updateStep(wf._id, 'convertedToAccount', { convertedToAccount: true }), 'Converted to Account!')}
                          className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap flex-shrink-0"
                        >
                          <Building2 size={12} className="inline mr-1" />Convert to Account
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* STEP 7 */}
        <div>
          <StepHeader num={7} label="Customer Invoice" statusNode={<StatusPill status={wf.step7.status} />} />
          {expandedStep === 7 && (
            <div className="mt-1 ml-2 p-4 bg-white rounded-xl border border-gray-100 space-y-3">
              <p className="text-xs text-gray-500">Generate and send invoice to Customer. Track payment status.</p>
              {wf.step7.invoiceNumber ? (
                <div className="p-3 rounded-lg bg-violet-50 border border-violet-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-violet-800">{wf.step7.invoiceNumber}</span>
                    <StatusPill status={wf.step7.paymentStatus} />
                  </div>
                  {wf.step7.amount && <p className="text-sm text-gray-700">Amount: <strong>{formatCurrency(wf.step7.amount)}</strong></p>}
                  {wf.step7.tdsExemptionAttached && <p className="text-xs text-blue-600">TDS Exemption Letter attached</p>}
                  {wf.step7.sentAt && <p className="text-xs text-gray-400">Sent: {formatDate(wf.step7.sentAt)}</p>}
                </div>
              ) : null}
              {!readOnly && (
                <div className="flex gap-2 flex-wrap items-center">
                  {wf.step7.status === 'Pending' && (
                    <button className="btn-primary text-xs px-3 py-1.5" onClick={() => setShowCustInvoice(true)}>
                      <CreditCard size={13} className="inline mr-1" />Generate Customer Invoice
                    </button>
                  )}
                  {wf.step7.status === 'Generated' && (
                    <>
                      <button disabled={busy} onClick={() => act(() => poExecutionApi.sendCustomerInvoice(wf._id), 'Invoice sent to Customer!')} className="btn-primary text-xs px-3 py-1.5">
                        <Send size={13} className="inline mr-1" />Send Invoice by Email
                      </button>
                      <button disabled={busy} onClick={() => act(() => poExecutionApi.markCustomerPaid(wf._id), 'Payment recorded!')} className="text-xs text-gray-500 hover:underline">
                        Skip →
                      </button>
                    </>
                  )}
                  {wf.step7.status === 'Sent' && wf.step7.paymentStatus !== 'Paid' && (
                    <>
                      <button disabled={busy} onClick={() => act(() => poExecutionApi.sendCustomerInvoice(wf._id), 'Invoice resent!')} className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                        <RefreshCw size={11} />Resend Invoice
                      </button>
                      <span className="text-gray-300">|</span>
                      <button disabled={busy} onClick={() => act(() => poExecutionApi.markCustomerPaid(wf._id), 'Payment recorded! Workflow completed.')} className="btn-primary text-xs px-3 py-1.5">
                        <CheckCircle size={13} className="inline mr-1" />Mark as Paid
                      </button>
                    </>
                  )}
                  {wf.step7.paymentStatus === 'Paid' && (
                    <span className="badge bg-emerald-100 text-emerald-700 text-xs px-3 py-1.5">Payment Received — Workflow Complete</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <ClipboardList size={20} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">PO Execution Tracker</h1>
            <p className="text-xs text-gray-500">Post-PO execution workflow — from notification to customer invoice</p>
          </div>
        </div>
        {canEdit && (
          <button className="btn-primary flex items-center gap-2" onClick={openStart}>
            <Plus size={16} />Start Workflow
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input-field pl-9 text-sm"
            placeholder="Search by company or PO number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field text-sm w-44"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner /></div>
      ) : workflows.length === 0 ? (
        <div className="card text-center py-16">
          <ClipboardList size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No workflows found</p>
          <p className="text-sm text-gray-400 mt-1">Start a workflow by clicking "Start Workflow" above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {workflows.map(wf => (
            <div key={wf._id} className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelected(wf); setExpandedStep(wf.currentStep); }}>
              {/* Card header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <Building2 size={17} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{wf.companyName || '—'}</p>
                    <p className="text-xs text-gray-500">{wf.poNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusPill status={wf.overallStatus} />
                  <span className="text-xs text-gray-400">Step {wf.currentStep}/7</span>
                </div>
              </div>
              {/* Progress bar */}
              <StepProgressBar currentStep={wf.currentStep} overallStatus={wf.overallStatus} />
              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <span className="text-xs text-gray-400">Started {formatDate(wf.createdAt)}</span>
                <button
                  className="text-xs text-violet-600 font-medium hover:underline"
                  onClick={e => { e.stopPropagation(); setSelected(wf); setExpandedStep(wf.currentStep); }}
                >
                  Manage →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Detail Modal ─────────────────────────────────────────────────────── */}
      {selected && (
        <Modal
          title={
            <div className="flex items-center gap-3">
              <Package size={18} className="text-violet-600" />
              <span>{selected.companyName} — PO Execution</span>
              <StatusPill status={selected.overallStatus} />
            </div>
          }
          onClose={() => setSelected(null)}
        >
          <div className="space-y-4">
            {/* Info row */}
            <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-xl text-sm">
              <div><span className="text-gray-500 text-xs">PO Number</span><p className="font-medium">{selected.poNumber}</p></div>
              <div><span className="text-gray-500 text-xs">Company</span><p className="font-medium">{selected.companyName}</p></div>
              <div><span className="text-gray-500 text-xs">Current Step</span><p className="font-medium">{selected.currentStep} / 7</p></div>
              <div><span className="text-gray-500 text-xs">Last Updated</span><p className="font-medium">{formatDate(selected.updatedAt)}</p></div>
            </div>

            {/* Stepper */}
            <div className="overflow-x-auto pb-2">
              <StepProgressBar currentStep={selected.currentStep} overallStatus={selected.overallStatus} />
            </div>

            {/* Step panels */}
            <StepPanel wf={selected} />
          </div>
        </Modal>
      )}

      {/* ─── Start Workflow Modal ─────────────────────────────────────────────── */}
      {showStart && (
        <Modal title="Start PO Execution Workflow" onClose={() => setShowStart(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Select a Purchase Order to begin the execution workflow.</p>
            {availablePOs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Package size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No available POs. All POs already have workflows.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {availablePOs.map(po => (
                  <label key={po._id} className={cn(
                    'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all',
                    selectedPO === po._id ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-gray-300'
                  )}>
                    <div className="flex items-center gap-3">
                      <input type="radio" className="accent-violet-600" name="po" value={po._id} checked={selectedPO === po._id} onChange={() => setSelectedPO(po._id)} />
                      <div>
                        <p className="font-medium text-sm text-gray-800">{po.poNumber}</p>
                        <p className="text-xs text-gray-500">{(po.leadId as any)?.companyName || '—'} · {formatCurrency(po.amount)}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(po.receivedDate)}</span>
                  </label>
                ))}
              </div>
            )}
            {availablePOs.length > 0 && (
              <div className="flex justify-end gap-3 pt-2">
                <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800" onClick={() => setShowStart(false)}>Cancel</button>
                <button disabled={!selectedPO || starting} className="btn-primary" onClick={handleStart}>
                  {starting ? 'Starting...' : 'Start Workflow'}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ─── Distributor Invoice Modal ────────────────────────────────────────── */}
      {showDistInvoice && selected && (
        <Modal title="Generate Distributor Invoice" onClose={() => setShowDistInvoice(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Amount (₹) *</label>
              <input className="input-field" type="number" value={distInvoiceForm.amount} onChange={e => setDistInvoiceForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
              <input className="input-field" value={distInvoiceForm.paymentTerms} onChange={e => setDistInvoiceForm(f => ({ ...f, paymentTerms: e.target.value }))} placeholder="e.g. Net 30 days" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer (End-User) Details</label>
              <textarea className="input-field" rows={2} value={distInvoiceForm.customerDetails} onChange={e => setDistInvoiceForm(f => ({ ...f, customerDetails: e.target.value }))} placeholder="Customer name, address..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="px-4 py-2 text-sm text-gray-600" onClick={() => setShowDistInvoice(false)}>Cancel</button>
              <button
                disabled={!distInvoiceForm.amount || busy}
                className="btn-primary"
                onClick={() => act(
                  () => poExecutionApi.generateDistributorInvoice(selected._id, distInvoiceForm),
                  'Distributor invoice generated!'
                ).then(() => setShowDistInvoice(false))}
              >
                Generate Invoice
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── License Modal ────────────────────────────────────────────────────── */}
      {showLicense && selected && (
        <Modal title="Generate License" onClose={() => setShowLicense(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Key</label>
              <input className="input-field font-mono" value={licenseForm.licenseKey} onChange={e => setLicenseForm(f => ({ ...f, licenseKey: e.target.value }))} placeholder="XXXX-XXXX-XXXX-XXXX" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License File Name</label>
              <input className="input-field" value={licenseForm.licenseFile} onChange={e => setLicenseForm(f => ({ ...f, licenseFile: e.target.value }))} placeholder="license.lic" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="px-4 py-2 text-sm text-gray-600" onClick={() => setShowLicense(false)}>Cancel</button>
              <button
                disabled={(!licenseForm.licenseKey && !licenseForm.licenseFile) || busy}
                className="btn-primary"
                onClick={() => act(
                  () => poExecutionApi.updateLicenseStatus(selected._id, { licenseStatus: 'Generated', ...licenseForm }),
                  'License generated!'
                ).then(() => setShowLicense(false))}
              >
                Save License
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Customer Invoice Modal ───────────────────────────────────────────── */}
      {showCustInvoice && selected && (
        <Modal title="Generate Customer Invoice" onClose={() => setShowCustInvoice(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Amount (₹) *</label>
              <input className="input-field" type="number" value={custInvoiceForm.amount} onChange={e => setCustInvoiceForm(f => ({ ...f, amount: e.target.value as any }))} placeholder="0" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-violet-600" checked={custInvoiceForm.tdsExemptionAttached} onChange={e => setCustInvoiceForm(f => ({ ...f, tdsExemptionAttached: e.target.checked }))} />
              <span className="text-sm text-gray-700">Attach TDS Exemption Letter</span>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button className="px-4 py-2 text-sm text-gray-600" onClick={() => setShowCustInvoice(false)}>Cancel</button>
              <button
                disabled={!custInvoiceForm.amount || busy}
                className="btn-primary"
                onClick={() => act(
                  () => poExecutionApi.generateCustomerInvoice(selected._id, custInvoiceForm),
                  'Customer invoice generated!'
                ).then(() => setShowCustInvoice(false))}
              >
                Generate Invoice
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
