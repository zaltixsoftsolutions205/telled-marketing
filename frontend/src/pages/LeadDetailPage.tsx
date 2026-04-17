import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Check, X, Plus, FileText, ShoppingCart, Building2, Mail, Download, CheckCircle2, XCircle } from 'lucide-react';
import { leadsApi } from '@/api/leads';
import { drfApi } from '@/api/drf';
import { quotationsApi } from '@/api/quotations';
import { purchasesApi } from '@/api/purchases';
import { useAuthStore } from '@/store/authStore';
import { usePageTitleStore } from '@/store/pageTitleStore';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate, formatDateTime, formatCurrency } from '@/utils/formatters';
import type { Lead, DRF, User, Quotation, PurchaseOrder, LeadStatus, QuotationStatus } from '@/types';

const LEAD_STAGES = ['New','OEM Submitted','OEM Approved','OEM Rejected','OEM Expired','Technical Done','Quotation Sent','Negotiation','PO Received','Converted','Lost'];
const LEAD_STATUSES: LeadStatus[] = ['New','Contacted','Qualified','Not Qualified'];

const STATUS_COLORS: Record<LeadStatus, string> = {
  'New':           'bg-gray-100 text-gray-600 border-gray-200',
  'Contacted':     'bg-blue-50 text-blue-700 border-blue-200',
  'Qualified':     'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Not Qualified': 'bg-red-50 text-red-600 border-red-200',
};

const Q_STATUS_STYLE: Record<QuotationStatus, string> = {
  Draft:    'bg-gray-100 text-gray-600',
  Sent:     'bg-amber-100 text-amber-700',
  Accepted: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-600',
  Final:    'bg-purple-100 text-purple-700',
};

const DRF_STATUS_STYLE: Record<string, string> = {
  Pending:  'bg-amber-100 text-amber-700 border border-amber-200',
  Approved: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  Rejected: 'bg-red-100 text-red-700 border border-red-200',
  Expired:  'bg-gray-100 text-gray-600 border border-gray-200',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setSubtitle = usePageTitleStore((s) => s.setSubtitle);
  const [lead, setLead] = useState<Lead | null>(null);
  const [drfs, setDRFs] = useState<DRF[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Partial<Lead>>({});
  const [saving, setSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [autoDRFNotice, setAutoDRFNotice] = useState(false);

  // DRF modals
  const [showDRFModal, setShowDRFModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedDRF, setSelectedDRF] = useState<DRF | null>(null);
  const [drfForm, setDRFForm] = useState({
    accountName: '', address: '', website: '', annualTurnover: '',
    contactPerson: '', designation: '', contactNo: '', email: '',
    partnerSalesRep: '', channelPartner: 'Telled Marketing',
    interestedModules: '', expectedClosure: '', oemEmail: '', notes: '',
  });
  const [approveForm, setApproveForm] = useState({ expiryDate: '', notes: '' });
  const [rejectForm, setRejectForm] = useState({ rejectionReason: '' });
  const [extendForm, setExtendForm] = useState({ newExpiry: '', reason: '' });
  const [drfSaving, setDRFSaving] = useState(false);
  const [drfError, setDRFError] = useState('');

  // Convert to account modal
  const [showConvert, setShowConvert] = useState(false);
  const [convertForm, setConvertForm] = useState({ accountName: '', notes: '' });
  const [converting, setConverting] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [leadRaw, drfData, quoteData, poData] = await Promise.all([
        leadsApi.getById(id),
        drfApi.getByLead(id).catch(() => []),
        quotationsApi.getByLead(id).catch(() => []),
        purchasesApi.getByLead(id).catch(() => []),
      ]);
      // Backend returns { lead, oemAttempts } — extract the lead object
      const leadData = ((leadRaw as any)?.lead ?? leadRaw) as Lead;
      setLead(leadData);
      setSubtitle(leadData.companyName || null);
      setForm(leadData);
      setDRFs((drfData || []) as DRF[]);
      setQuotations((quoteData || []) as Quotation[]);
      setPOs((poData || []) as PurchaseOrder[]);
    } catch (err) { console.error('LeadDetailPage load:', err); } finally { setLoading(false); }
  };

  useEffect(() => { load(); return () => setSubtitle(null); }, [id]);

  if (loading) return <LoadingSpinner className="h-64" />;
  if (!lead) return <div className="text-center text-gray-500 mt-20">Lead not found</div>;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await leadsApi.update(id!, form);
      setLead(updated as Lead);
      setSubtitle((updated as Lead).companyName || null);
      setEditMode(false);
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (newStatus === lead.status || statusUpdating) return;
    setStatusUpdating(true);
    try {
      const prevStatus = lead.status;
      const updated = await leadsApi.update(id!, { status: newStatus });
      setLead(updated as Lead);
      // Show notice if auto-DRF was created
      if (newStatus === 'Qualified' && prevStatus !== 'Qualified') {
        await load(); // reload to get new DRF
        setAutoDRFNotice(true);
        setTimeout(() => setAutoDRFNotice(false), 5000);
      }
    } finally { setStatusUpdating(false); }
  };

  const handleSubmitDRF = async (e: React.FormEvent) => {
    e.preventDefault();
    setDRFSaving(true);
    setDRFError('');
    try {
      await leadsApi.sendDrf(id!, drfForm);
      await drfApi.sendFromLead(lead as any, drfForm, user);
      setShowDRFModal(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setDRFError(msg || 'Failed to send DRF email');
    } finally { setDRFSaving(false); }
  };

  const handleApproveDRF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDRF) return;
    setDRFSaving(true);
    try {
      await drfApi.approve(selectedDRF._id, approveForm);
      setShowApproveModal(false);
      setApproveForm({ expiryDate: '', notes: '' });
      load();
    } finally { setDRFSaving(false); }
  };

  const handleRejectDRF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDRF) return;
    setDRFSaving(true);
    try {
      await drfApi.reject(selectedDRF._id, rejectForm);
      setShowRejectModal(false);
      setRejectForm({ rejectionReason: '' });
      load();
    } finally { setDRFSaving(false); }
  };

  const handleExtendDRF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDRF) return;
    setDRFSaving(true);
    try {
      await drfApi.extend(selectedDRF._id, extendForm);
      setShowExtendModal(false);
      setExtendForm({ newExpiry: '', reason: '' });
      load();
    } finally { setDRFSaving(false); }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pos[0]) return;
    setConverting(true);
    try {
      await purchasesApi.convertToAccount(pos[0]._id, convertForm);
      setShowConvert(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Conversion failed');
    } finally { setConverting(false); }
  };

  const pendingDRFs = drfs.filter(d => d.status === 'Pending');
  const canCreateDRF = !['Converted','Lost'].includes(lead.stage);
  const hasApprovedDRF = drfs.some(d => d.status === 'Approved');
  const canConvert = lead.stage === 'PO Received' && pos.length > 0;
  const isConverted = lead.stage === 'Converted';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/leads')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="page-header">{lead.companyName}</h1>
          <p className="text-sm text-gray-500">
            {[lead.contactPersonName || lead.contactName, lead.email].filter(Boolean).join(' • ')}
          </p>
        </div>
        <StatusBadge status={lead.stage} />
        {!editMode && (
          <button onClick={() => setEditMode(true)} className="btn-secondary flex items-center gap-2">
            <Edit2 size={15} /> Edit
          </button>
        )}
        {editMode && (
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5">
              <Check size={15} />{saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setEditMode(false); setForm(lead); }} className="btn-secondary flex items-center gap-1.5">
              <X size={15} />Cancel
            </button>
          </div>
        )}
      </div>

      {/* Auto-DRF notice */}
      {autoDRFNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-800">Lead marked as Qualified — a DRF has been automatically created and submitted for review.</p>
          <button onClick={() => setAutoDRFNotice(false)} className="ml-auto text-emerald-500"><X size={15} /></button>
        </div>
      )}

      {/* Status Quick-Change */}
      <div className="glass-card !py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Lead Status:</span>
          {LEAD_STATUSES.map(s => (
            <button key={s} onClick={() => handleStatusChange(s)} disabled={statusUpdating}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${lead.status === s ? STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-violet-400' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {s}
            </button>
          ))}
          {lead.status === 'Qualified' && !hasApprovedDRF && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">DRF auto-submitted — awaiting approval</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Info */}
        <div className="lg:col-span-2 glass-card">
          <h2 className="section-title">Lead Information</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Account Name & Group Name', key: 'companyName' },
              { label: 'Contact Person', key: 'contactPersonName' },
              { label: 'Address & Location', key: 'address' },
              { label: 'Web Site', key: 'website' },
              { label: 'Annual Turnover', key: 'annualTurnover' },
              { label: 'Designation', key: 'designation' },
              { label: 'Contact No.', key: 'phone' },
              { label: 'E-mail', key: 'email' },
              { label: 'Channel Partner', key: 'channelPartner' },
              { label: 'Potential / Interested Modules', key: 'oemName' },
              { label: 'OEM Email', key: 'oemEmail' },
              { label: 'Expected Closure', key: 'expectedClosure' },
              { label: 'City', key: 'city' },
              { label: 'State', key: 'state' },
              { label: 'Source', key: 'source' },
            ].map(({ label, key }) => (
              <div key={label}>
                <label className="label">{label}</label>
                {editMode ? (
                  <input className="input-field" value={(form as Record<string, string>)[key] || ''} onChange={(e) => setForm(f => ({...f, [key]: e.target.value}))} />
                ) : (
                  <p className="text-sm text-gray-800">{(lead as unknown as Record<string, string>)[key] || <span className="text-gray-300">—</span>}</p>
                )}
              </div>
            ))}
            {/* Partner Sales Rep — read-only from assigned user */}
            <div>
              <label className="label">Partner Sales Rep</label>
              <p className="text-sm text-gray-800">{(lead.assignedTo as User)?.name || <span className="text-gray-300">—</span>}</p>
            </div>
            <div>
              <label className="label">Stage</label>
              {editMode ? (
                <select className="input-field" value={form.stage || lead.stage} onChange={(e) => setForm(f => ({...f, stage: e.target.value as Lead['stage']}))}>
                  {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : <StatusBadge status={lead.stage} />}
            </div>
          </div>
          {(editMode || lead.notes) && (
            <div className="mt-4">
              <label className="label">Notes</label>
              {editMode ? (
                <textarea rows={3} className="input-field" value={form.notes || ''} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} />
              ) : <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{lead.notes}</p>}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="glass-card">
            <h2 className="section-title">Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Assigned To</span>
                <span className="font-medium">{(lead.assignedTo as User)?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">DRFs</span>
                <span className="font-medium">{drfs.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Quotations</span>
                <span className="font-medium">{quotations.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">POs</span>
                <span className="font-medium">{pos.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>{formatDate(lead.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Updated</span>
                <span>{formatDate(lead.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* DRF Status */}
          {pendingDRFs.length > 0 && (
            <div className="glass-card">
              <h2 className="section-title !mb-3">DRF Status</h2>
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                {pendingDRFs.length} DRF{pendingDRFs.length > 1 ? 's' : ''} pending review
              </p>
              {pendingDRFs.map(drf => user?.role === 'admin' && (
                <div key={drf._id} className="border border-amber-200 rounded-lg p-3 space-y-2 mt-2">
                  <p className="text-xs font-semibold text-gray-700">{drf.drfNumber} v{drf.version}</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedDRF(drf); setShowApproveModal(true); }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-1.5 rounded-lg">Approve</button>
                    <button onClick={() => { setSelectedDRF(drf); setShowRejectModal(true); }}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium py-1.5 rounded-lg">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Convert to Account */}
          {canConvert && !isConverted && (
            <div className="glass-card border-2 border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={16} className="text-emerald-600" />
                <h2 className="section-title !mb-0 text-emerald-700">Convert to Account</h2>
              </div>
              <p className="text-xs text-gray-500 mb-3">PO received — ready to create an account.</p>
              <button onClick={() => { setConvertForm({ accountName: lead.companyName, notes: '' }); setShowConvert(true); }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                Convert → Account
              </button>
            </div>
          )}
          {isConverted && (
            <div className="glass-card border border-emerald-200 bg-emerald-50/40">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={16} />
                <span className="text-sm font-semibold">Converted to Account</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DRF History */}
      {drfs.length > 0 && (
        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-violet-600" />
            <h2 className="section-title !mb-0">DRF History ({drfs.length})</h2>
          </div>
          <div className="space-y-3">
            {[...drfs].reverse().map((drf) => (
              <div key={drf._id} className="flex items-start justify-between p-4 bg-gray-50 rounded-xl gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <span className="text-sm font-bold text-gray-800">{drf.drfNumber}</span>
                    <span className="text-xs text-gray-500">v{drf.version}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DRF_STATUS_STYLE[drf.status] ?? ''}`}>{drf.status}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{drf.title}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>Sent: {formatDateTime(drf.sentDate)}</span>
                    {drf.approvedDate && <span>Approved: {formatDate(drf.approvedDate)}</span>}
                    {drf.expiryDate && <span>Expires: {formatDate(drf.expiryDate)}</span>}
                    {drf.rejectedDate && <span>Rejected: {formatDate(drf.rejectedDate)}</span>}
                  </div>
                  {drf.rejectionReason && <p className="text-xs text-red-600 mt-1.5 bg-red-50 rounded px-2 py-1">Rejection: {drf.rejectionReason}</p>}
                  {drf.notes && <p className="text-xs text-gray-500 mt-1">{drf.notes}</p>}
                  {drf.extensionCount > 0 && <p className="text-xs text-blue-600 mt-1">Extended {drf.extensionCount}×</p>}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {drf.approvedBy && <p className="text-xs text-gray-400">by {(drf.approvedBy as User)?.name}</p>}
                  {user?.role === 'admin' && drf.status === 'Approved' && drf.expiryDate && (
                    <button onClick={() => { setSelectedDRF(drf); setExtendForm({ newExpiry: '', reason: '' }); setShowExtendModal(true); }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium underline">Extend</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quotations */}
      {quotations.length > 0 && (
        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-blue-600" />
            <h2 className="section-title !mb-0">Quotations ({quotations.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Quotation #</th>
                  <th className="table-header">Ver</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Valid Until</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quotations.map((q) => (
                  <tr key={q._id} className="hover:bg-blue-50/20">
                    <td className="table-cell font-mono text-xs font-semibold text-violet-700">{q.quotationNumber}</td>
                    <td className="table-cell text-center"><span className="badge bg-gray-100 text-gray-600">v{q.version}</span></td>
                    <td className="table-cell font-semibold">{formatCurrency(q.total)}</td>
                    <td className="table-cell text-gray-400">{q.validUntil ? formatDate(q.validUntil) : '—'}</td>
                    <td className="table-cell">
                      <span className={`badge text-xs ${Q_STATUS_STYLE[q.status as QuotationStatus] || 'bg-gray-100 text-gray-600'}`}>{q.status}</span>
                    </td>
                    <td className="table-cell text-xs">{q.emailSent ? <span className="text-emerald-600 font-medium">Sent</span> : <span className="text-gray-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Purchase Orders */}
      {pos.length > 0 && (
        <div className="glass-card">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart size={16} className="text-emerald-600" />
            <h2 className="section-title !mb-0">Purchase Orders ({pos.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">PO Number</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Product</th>
                  <th className="table-header">Vendor</th>
                  <th className="table-header">Received</th>
                  <th className="table-header">Vendor Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pos.map((po) => (
                  <tr key={po._id} className="hover:bg-emerald-50/20">
                    <td className="table-cell font-mono text-xs font-semibold">{po.poNumber}</td>
                    <td className="table-cell font-semibold text-emerald-700">{formatCurrency(po.amount)}</td>
                    <td className="table-cell text-gray-500">{po.product || '—'}</td>
                    <td className="table-cell text-gray-500">{po.vendorName || '—'}</td>
                    <td className="table-cell text-gray-400">{formatDate(po.receivedDate)}</td>
                    <td className="table-cell text-xs">{po.vendorEmailSent ? <span className="text-emerald-600 font-medium">Sent</span> : <span className="text-gray-400">Not sent</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve DRF Modal */}
      <Modal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)} title={`Approve DRF — ${selectedDRF?.drfNumber}`}>
        <form onSubmit={handleApproveDRF} className="space-y-4">
          <div>
            <label className="label">Expiry Date *</label>
            <input required type="date" className="input-field" value={approveForm.expiryDate} onChange={(e) => setApproveForm(f => ({...f, expiryDate: e.target.value}))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={approveForm.notes} onChange={(e) => setApproveForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowApproveModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={drfSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg">
              {drfSaving ? 'Approving…' : 'Approve DRF'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject DRF Modal */}
      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title={`Reject DRF — ${selectedDRF?.drfNumber}`}>
        <form onSubmit={handleRejectDRF} className="space-y-4">
          <div>
            <label className="label">Rejection Reason *</label>
            <textarea required rows={3} className="input-field" value={rejectForm.rejectionReason} onChange={(e) => setRejectForm(f => ({...f, rejectionReason: e.target.value}))} placeholder="Provide a reason…" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowRejectModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={drfSaving} className="bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg">
              {drfSaving ? 'Rejecting…' : 'Reject DRF'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Extend DRF Modal */}
      <Modal isOpen={showExtendModal} onClose={() => setShowExtendModal(false)} title={`Extend DRF — ${selectedDRF?.drfNumber}`}>
        <form onSubmit={handleExtendDRF} className="space-y-4">
          <div>
            <label className="label">New Expiry Date *</label>
            <input required type="date" className="input-field" value={extendForm.newExpiry} onChange={(e) => setExtendForm(f => ({...f, newExpiry: e.target.value}))} />
          </div>
          <div>
            <label className="label">Reason *</label>
            <textarea required rows={2} className="input-field" value={extendForm.reason} onChange={(e) => setExtendForm(f => ({...f, reason: e.target.value}))} placeholder="Reason for extension…" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowExtendModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={drfSaving} className="btn-primary">{drfSaving ? 'Extending…' : 'Extend DRF'}</button>
          </div>
        </form>
      </Modal>

      {/* Convert to Account Modal */}
      <Modal isOpen={showConvert} onClose={() => setShowConvert(false)} title="Convert Lead to Account">
        <form onSubmit={handleConvert} className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-700">
            <p className="font-medium">PO received from {lead.companyName}</p>
            <p className="text-xs mt-0.5">This will create an Account and mark the lead as Converted.</p>
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
            <button type="submit" disabled={converting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg">
              {converting ? 'Converting…' : 'Convert to Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
