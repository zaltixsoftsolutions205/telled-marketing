import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Check, X, Plus, FileText } from 'lucide-react';
import { leadsApi } from '@/api/leads';
import { drfApi } from '@/api/drf';
import { useAuthStore } from '@/store/authStore';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate, formatDateTime } from '@/utils/formatters';
import type { Lead, DRF, User } from '@/types';

const LEAD_STAGES = ['New','DRF Submitted','DRF Approved','DRF Rejected','DRF Expired','Technical Done','Quotation Sent','Negotiation','PO Received','Converted','Lost'];

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
  const [lead, setLead] = useState<Lead | null>(null);
  const [drfs, setDRFs] = useState<DRF[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Partial<Lead>>({});
  const [saving, setSaving] = useState(false);

  // DRF modals
  const [showDRFModal, setShowDRFModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedDRF, setSelectedDRF] = useState<DRF | null>(null);
  const [drfForm, setDRFForm] = useState({ notes: '' });
  const [approveForm, setApproveForm] = useState({ expiryDate: '', notes: '' });
  const [rejectForm, setRejectForm] = useState({ rejectionReason: '' });
  const [extendForm, setExtendForm] = useState({ newExpiry: '', reason: '' });
  const [drfSaving, setDRFSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [leadData, drfData] = await Promise.all([leadsApi.getById(id), drfApi.getByLead(id)]);
      setLead(leadData);
      setForm(leadData);
      setDRFs(drfData as DRF[]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <LoadingSpinner className="h-64" />;
  if (!lead) return <div className="text-center text-gray-500 mt-20">Lead not found</div>;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await leadsApi.update(id!, form);
      setLead(updated as Lead);
      setEditMode(false);
    } finally { setSaving(false); }
  };

  const handleSubmitDRF = async (e: React.FormEvent) => {
    e.preventDefault();
    setDRFSaving(true);
    try {
      await drfApi.create({ leadId: id, notes: drfForm.notes, createdBy: user?._id });
      setShowDRFModal(false);
      setDRFForm({ notes: '' });
      load();
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

  const pendingDRFs = drfs.filter(d => d.status === 'Pending');
  const canCreateDRF = lead.stage !== 'Converted' && lead.stage !== 'Lost';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/leads')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="page-header">{lead.companyName}</h1>
          <p className="text-sm text-gray-500">{lead.contactPersonName || lead.contactName} • {lead.email}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Info */}
        <div className="lg:col-span-2 glass-card">
          <h2 className="section-title">Lead Information</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Company Name', key: 'companyName' },
              { label: 'Contact Person Name', key: 'contactPersonName' },
              { label: 'Email', key: 'email' },
              { label: 'Phone', key: 'phone' },
              { label: 'OEM Name', key: 'oemName' },
              { label: 'City', key: 'city' },
              { label: 'State', key: 'state' },
              { label: 'Source', key: 'source' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="label">{label}</label>
                {editMode ? (
                  <input className="input-field" value={(form as Record<string, string>)[key] || ''} onChange={(e) => setForm(f => ({...f, [key]: e.target.value}))} />
                ) : (
                  <p className="text-sm text-gray-800">{(lead as unknown as Record<string, string>)[key] || <span className="text-gray-300">—</span>}</p>
                )}
              </div>
            ))}
            <div>
              <label className="label">Stage</label>
              {editMode ? (
                <select className="input-field" value={form.stage || lead.stage} onChange={(e) => setForm(f => ({...f, stage: e.target.value as Lead['stage']}))}>
                  {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : <StatusBadge status={lead.stage} />}
            </div>
          </div>
          {editMode && (
            <div className="mt-4">
              <label className="label">Notes</label>
              <textarea rows={3} className="input-field" value={form.notes || ''} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} />
            </div>
          )}
          {!editMode && lead.notes && (
            <div className="mt-4">
              <label className="label">Notes</label>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Meta + DRF Actions */}
        <div className="space-y-4">
          <div className="glass-card">
            <h2 className="section-title">Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Assigned To</span>
                <span className="font-medium">{(lead.assignedTo as User)?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">DRFs Submitted</span>
                <span className="font-medium">{drfs.length}</span>
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

          {/* DRF Actions */}
          <div className="glass-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title !mb-0">DRF Actions</h2>
            </div>
            <div className="space-y-2">
              {canCreateDRF && (
                <button onClick={() => setShowDRFModal(true)} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
                  <Plus size={15} /> Submit New DRF
                </button>
              )}
              {pendingDRFs.length > 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  {pendingDRFs.length} DRF{pendingDRFs.length > 1 ? 's' : ''} pending review
                </p>
              )}
              {pendingDRFs.map(drf => user?.role === 'admin' && (
                <div key={drf._id} className="border border-amber-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-700">{drf.drfNumber} v{drf.version}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelectedDRF(drf); setShowApproveModal(true); }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { setSelectedDRF(drf); setShowRejectModal(true); }}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DRF_STATUS_STYLE[drf.status] ?? ''}`}>
                      {drf.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{drf.title}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>Sent: {formatDateTime(drf.sentDate)}</span>
                    {drf.approvedDate && <span>Approved: {formatDate(drf.approvedDate)}</span>}
                    {drf.expiryDate && <span>Expires: {formatDate(drf.expiryDate)}</span>}
                    {drf.rejectedDate && <span>Rejected: {formatDate(drf.rejectedDate)}</span>}
                  </div>
                  {drf.rejectionReason && (
                    <p className="text-xs text-red-600 mt-1.5 bg-red-50 rounded px-2 py-1">Rejection: {drf.rejectionReason}</p>
                  )}
                  {drf.notes && <p className="text-xs text-gray-500 mt-1">{drf.notes}</p>}
                  {drf.extensionCount > 0 && (
                    <p className="text-xs text-blue-600 mt-1">Extended {drf.extensionCount} time{drf.extensionCount > 1 ? 's' : ''}</p>
                  )}
                </div>
                <div className="text-right flex flex-col items-end gap-2 flex-shrink-0">
                  {drf.approvedBy && (
                    <p className="text-xs text-gray-400">by {(drf.approvedBy as User)?.name}</p>
                  )}
                  {user?.role === 'admin' && drf.status === 'Approved' && drf.expiryDate && (
                    <button
                      onClick={() => { setSelectedDRF(drf); setExtendForm({ newExpiry: '', reason: '' }); setShowExtendModal(true); }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      Extend
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit DRF Modal */}
      <Modal isOpen={showDRFModal} onClose={() => setShowDRFModal(false)} title="Submit Document Request Form (DRF)">
        <form onSubmit={handleSubmitDRF} className="space-y-4">
          <div className="bg-violet-50 rounded-lg p-3 text-sm text-violet-700">
            <p className="font-medium">{lead.companyName} — {lead.oemName}</p>
            <p className="text-xs text-violet-500 mt-0.5">Contact: {lead.contactPersonName || lead.contactName}</p>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea rows={3} className="input-field" value={drfForm.notes} onChange={(e) => setDRFForm(f => ({...f, notes: e.target.value}))} placeholder="Any additional notes for the DRF…" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowDRFModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={drfSaving} className="btn-primary">{drfSaving ? 'Submitting…' : 'Submit DRF'}</button>
          </div>
        </form>
      </Modal>

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
            <textarea required rows={3} className="input-field" value={rejectForm.rejectionReason} onChange={(e) => setRejectForm(f => ({...f, rejectionReason: e.target.value}))} placeholder="Provide a reason for rejection…" />
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
    </div>
  );
}
