// frontend/src/pages/VisitsAndClaimsPage.tsx
import { useState, useEffect } from 'react';
import { CalendarCheck, Receipt, Plus, Eye, CheckCircle, XCircle, Send } from 'lucide-react';
import ExcelImportButton from '@/components/common/ExcelImportButton';
import { engineerVisitsApi } from '@/api/engineerVisits';
import { visitClaimsApi, VisitClaim, Expense } from '@/api/visitClaims';
import { accountsApi } from '@/api/accounts';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate, formatDateTime, formatCurrency } from '@/utils/formatters';

type TabType = 'visits' | 'claims';

export default function VisitsAndClaimsPage() {
  const user = useAuthStore((s) => s.user);
  const isHR = user?.role === 'admin' || user?.role === 'hr_finance';
  const isEngineer = user?.role === 'engineer' || user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<TabType>('visits');
  
  // Visits state
  const [visits, setVisits] = useState<any[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [engineers, setEngineers] = useState<any[]>([]);
  const [scheduleForm, setScheduleForm] = useState({
    visitType: 'Support',
    scheduledDate: '',
    accountId: '',
    engineerId: '',
    notes: ''
  });
  const [completeForm, setCompleteForm] = useState({
    workNotes: '',
    visitCharges: '0',
    travelAllowance: '0',
    additionalExpense: '0'
  });
  
  // Claims state
  const [claims, setClaims] = useState<VisitClaim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimableVisits, setClaimableVisits] = useState<any[]>([]);
  const [selectedVisitForClaim, setSelectedVisitForClaim] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>([
    { type: 'travel', description: '', amount: 0, date: new Date().toISOString().slice(0, 16) }
  ]);
  const [claimNotes, setClaimNotes] = useState('');
  const [creatingClaim, setCreatingClaim] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewClaim, setReviewClaim] = useState<VisitClaim | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewing, setReviewing] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Submit claim modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitClaim, setSubmitClaim] = useState<VisitClaim | null>(null);
  const [submitPaymentMode, setSubmitPaymentMode] = useState('');
  const [submitInvoiceFile, setSubmitInvoiceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load Visits
  const loadVisits = async () => {
    setVisitsLoading(true);
    try {
      const params: any = { limit: 50 };
      if (!isHR && isEngineer) params.engineerId = user?._id;
      const res = await engineerVisitsApi.getAll(params);
      setVisits(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setVisitsLoading(false);
    }
  };

  // Load Claims
  const loadClaims = async () => {
    setClaimsLoading(true);
    try {
      const params: any = { limit: 50 };
      if (!isHR && isEngineer) params.engineerId = user?._id;
      const res = await visitClaimsApi.getAll(params);
      setClaims(res.data || []);
      
      if (isHR) {
        const statsRes = await visitClaimsApi.getStats();
        setStats(statsRes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClaimsLoading(false);
    }
  };

  useEffect(() => {
    loadVisits();
    loadClaims();
  }, []);

  // Schedule Visit
  const openScheduleModal = async () => {
    const [accRes, engRes] = await Promise.all([
      accountsApi.getAll({ limit: 100 }),
      usersApi.getEngineers()
    ]);
    setAccounts(accRes.data || []);
    setEngineers(engRes || []);
    setScheduleForm({
      visitType: 'Support',
      scheduledDate: '',
      accountId: '',
      engineerId: user?._id || '',
      notes: ''
    });
    setShowScheduleModal(true);
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await engineerVisitsApi.schedule(scheduleForm);
      setShowScheduleModal(false);
      loadVisits();
      alert('Visit scheduled successfully');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to schedule');
    }
  };

  // Complete Visit
  const openCompleteModal = (visit: any) => {
    setSelectedVisit(visit);
    setCompleteForm({
      workNotes: '',
      visitCharges: String(visit.visitCharges || 0),
      travelAllowance: String(visit.travelAllowance || 0),
      additionalExpense: String(visit.additionalExpense || 0)
    });
    setShowCompleteModal(true);
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;
    try {
      await engineerVisitsApi.complete(selectedVisit._id, {
        workNotes: completeForm.workNotes,
        visitCharges: Number(completeForm.visitCharges),
        travelAllowance: Number(completeForm.travelAllowance),
        additionalExpense: Number(completeForm.additionalExpense)
      });
      setShowCompleteModal(false);
      loadVisits();
      alert('Visit marked as completed');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to complete');
    }
  };

  // Create Claim
  const openClaimModal = async () => {
    // Get completed visits without claims
    const completedVisits = visits.filter(v => 
      v.status === 'Completed' && 
      !claims.some(c => c.visitId?._id === v._id)
    );
    setClaimableVisits(completedVisits);
    setSelectedVisitForClaim('');
    setExpenses([]); // Start with empty array
    setClaimNotes('');
    setShowClaimModal(true);
  };

  const addExpense = () => {
    setExpenses([...expenses, { type: 'travel', description: '', amount: 0, date: new Date().toISOString().slice(0, 16) }]);
  };

  const removeExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const updateExpense = (index: number, field: keyof Expense, value: any) => {
    const updated = [...expenses];
    updated[index] = { ...updated[index], [field]: value };
    setExpenses(updated);
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisitForClaim) {
      alert('Please select a visit');
      return;
    }
    
    // Validate expenses
    const validExpenses = expenses.filter(exp => 
      exp.description.trim() !== '' && 
      exp.amount > 0 && 
      exp.date
    );
    if (validExpenses.length === 0) {
      alert('Please add at least one valid expense with description, amount > 0, and date');
      return;
    }
    
    setCreatingClaim(true);
    try {
      await visitClaimsApi.create({
        visitId: selectedVisitForClaim,
        expenses: validExpenses.map(e => ({ ...e, date: e.date })), // Keep as string
        notes: claimNotes
      });
      setShowClaimModal(false);
      loadClaims();
      alert('Claim created successfully');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create claim');
    } finally {
      setCreatingClaim(false);
    }
  };

  // Submit Claim — open modal
  const openSubmitModal = (claim: VisitClaim) => {
    setSubmitClaim(claim);
    setSubmitPaymentMode('');
    setSubmitInvoiceFile(null);
    setShowSubmitModal(true);
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitClaim || !submitPaymentMode) return;
    setSubmitting(true);
    try {
      await visitClaimsApi.submit(submitClaim._id, submitPaymentMode, submitInvoiceFile || undefined);
      setShowSubmitModal(false);
      loadClaims();
      alert('Claim submitted for approval');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  // Review Claim (HR)
  const openReviewModal = (claim: VisitClaim) => {
    setReviewClaim(claim);
    setReviewNotes('');
    setReviewAction('approve');
    setShowReviewModal(true);
  };

  const handleReview = async () => {
    if (!reviewClaim) return;
    setReviewing(true);
    try {
      if (reviewAction === 'approve') {
        await visitClaimsApi.approve(reviewClaim._id, reviewNotes);
        alert('Claim approved');
      } else {
        if (!reviewNotes) {
          alert('Please provide a rejection reason');
          setReviewing(false);
          return;
        }
        await visitClaimsApi.reject(reviewClaim._id, reviewNotes);
        alert('Claim rejected');
      }
      setShowReviewModal(false);
      loadClaims();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to process');
    } finally {
      setReviewing(false);
    }
  };

  const updateStatus = async (visitId: string, status: string) => {
    try {
      await engineerVisitsApi.updateStatus(visitId, status);
      loadVisits();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visit Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeTab === 'visits' ? 'Schedule and track engineer visits' : 'Submit and manage expense claims'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'visits' && (
            <ExcelImportButton
              entityName="Visits"
              columnHint="visitDate (YYYY-MM-DD), visitCharges, travelAllowance, additionalExpense, purpose, accountName"
              onImport={async (rows) => {
                let imported = 0;
                const accs = await accountsApi.getAll({ limit: 500 });
                const accList: { _id: string; accountName: string }[] = accs.data || [];
                for (const row of rows) {
                  const date = row.visitDate || row['visit date'] || row.date || '';
                  if (!date) continue;
                  const name = (row.accountName || row.account || '').toLowerCase();
                  const acc = name ? accList.find(a => a.accountName.toLowerCase().includes(name)) : undefined;
                  try {
                    await engineerVisitsApi.create({ visitDate: date, visitCharges: parseFloat(row.visitCharges || '0') || 0, travelAllowance: parseFloat(row.travelAllowance || '0') || 0, additionalExpense: parseFloat(row.additionalExpense || '0') || 0, purpose: row.purpose || '', accountId: acc?._id });
                    imported++;
                  } catch { /* skip */ }
                }
                loadVisits();
                return { imported };
              }}
            />
          )}
          {activeTab === 'visits' && isEngineer && (
            <button onClick={openScheduleModal} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Schedule Visit
            </button>
          )}
          {activeTab === 'claims' && isEngineer && (
            <button onClick={openClaimModal} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> New Claim
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('visits')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'visits'
              ? 'text-violet-600 border-b-2 border-violet-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CalendarCheck size={16} />
          Engineer Visits
          {!visitsLoading && (
            <span className="ml-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">
              {visits.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'claims'
              ? 'text-violet-600 border-b-2 border-violet-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Receipt size={16} />
          Visit Claims
          {!claimsLoading && (
            <span className="ml-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">
              {claims.filter(c => c.status === 'submitted' || c.status === 'under_review').length}
            </span>
          )}
        </button>
      </div>

      {/* Stats for HR on Claims Tab */}
      {activeTab === 'claims' && isHR && stats && (
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(stats).map(([status, data]: [string, any]) => (
            data.count > 0 && (
              <div key={status} className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 capitalize">{status}</p>
                <p className="text-xl font-bold text-gray-900">{data.count}</p>
                <p className="text-xs text-gray-600">{formatCurrency(data.amount)}</p>
              </div>
            )
          ))}
        </div>
      )}

      {/* VISITS TAB */}
      {activeTab === 'visits' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {visitsLoading ? (
            <LoadingSpinner className="h-64" />
          ) : visits.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CalendarCheck size={48} className="mx-auto mb-3 opacity-30" />
              <p>No visits found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engineer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visits.map((visit) => (
                    <tr key={visit._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-700">{visit.visitType}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{visit.engineerId?.name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{visit.accountId?.companyName || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDateTime(visit.scheduledDate || visit.visitDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          visit.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                          visit.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                          visit.status === 'Scheduled' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {visit.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">
                        {visit.totalAmount ? formatCurrency(visit.totalAmount) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {visit.status === 'Scheduled' && isEngineer && (
                            <button
                              onClick={() => updateStatus(visit._id, 'In Progress')}
                              className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded hover:bg-amber-100"
                            >
                              Start
                            </button>
                          )}
                          {(visit.status === 'Scheduled' || visit.status === 'In Progress') && isEngineer && (
                            <button
                              onClick={() => openCompleteModal(visit)}
                              className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-100"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CLAIMS TAB */}
      {activeTab === 'claims' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {claimsLoading ? (
            <LoadingSpinner className="h-64" />
          ) : claims.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Receipt size={48} className="mx-auto mb-3 opacity-30" />
              <p>No claims found</p>
              {isEngineer && (
                <button onClick={openClaimModal} className="mt-3 text-sm text-violet-600 hover:text-violet-700">
                  Create your first claim
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Claim #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {claims.map((claim) => {
                    const visit = claim.visitId;
                    const canSubmit = claim.status === 'draft' && isEngineer;
                    const canReview = isHR && (claim.status === 'submitted' || claim.status === 'under_review');
                    
                    return (
                      <tr key={claim._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-medium text-gray-900">{claim.claimNumber}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {visit ? `${visit.visitType} - ${formatDate(visit.scheduledDate)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {claim.accountId?.companyName || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-900">{formatCurrency(claim.totalAmount)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            claim.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            claim.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                            claim.status === 'under_review' ? 'bg-amber-100 text-amber-700' :
                            claim.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            claim.status === 'paid' ? 'bg-violet-100 text-violet-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {claim.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {canSubmit && (
                              <button
                                onClick={() => openSubmitModal(claim)}
                                className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 flex items-center gap-1"
                              >
                                <Send size={12} /> Submit to HR
                              </button>
                            )}
                            {canReview && (
                              <button
                                onClick={() => openReviewModal(claim)}
                                className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded hover:bg-amber-100 flex items-center gap-1"
                              >
                                <Eye size={12} /> Review
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Schedule Visit Modal */}
      <Modal isOpen={showScheduleModal} onClose={() => setShowScheduleModal(false)} title="Schedule Visit">
        <form onSubmit={handleSchedule} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700">Visit Type *</label>
              <select
                required
                className="input-field mt-1"
                value={scheduleForm.visitType}
                onChange={(e) => setScheduleForm({ ...scheduleForm, visitType: e.target.value })}
              >
                <option value="Installation">Installation</option>
                <option value="Support">Support</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Training">Training</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Date & Time *</label>
              <input
                required
                type="datetime-local"
                className="input-field mt-1"
                value={scheduleForm.scheduledDate}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">Account</label>
            <select
              className="input-field mt-1"
              value={scheduleForm.accountId}
              onChange={(e) => setScheduleForm({ ...scheduleForm, accountId: e.target.value })}
            >
              <option value="">Select account</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.companyName}</option>)}
            </select>
          </div>
          {isHR && (
            <div>
              <label className="text-xs font-medium text-gray-700">Engineer</label>
              <select
                className="input-field mt-1"
                value={scheduleForm.engineerId}
                onChange={(e) => setScheduleForm({ ...scheduleForm, engineerId: e.target.value })}
              >
                {engineers.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-700">Notes</label>
            <textarea
              className="input-field mt-1"
              rows={3}
              value={scheduleForm.notes}
              onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowScheduleModal(false)} className="px-3 py-2 border rounded-md">Cancel</button>
            <button type="submit" className="btn-primary">Schedule</button>
          </div>
        </form>
      </Modal>

      {/* Complete Visit Modal */}
      <Modal isOpen={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="Complete Visit">
        {selectedVisit && (
          <form onSubmit={handleComplete} className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-medium">{selectedVisit.visitType} Visit</p>
              <p className="text-sm text-gray-500">{selectedVisit.accountId?.companyName}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Work Done *</label>
              <textarea
                required
                className="input-field mt-1"
                rows={4}
                value={completeForm.workNotes}
                onChange={(e) => setCompleteForm({ ...completeForm, workNotes: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700">Visit Charges</label>
                <input type="number" className="input-field mt-1" value={completeForm.visitCharges}
                  onChange={(e) => setCompleteForm({ ...completeForm, visitCharges: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Travel Allowance</label>
                <input type="number" className="input-field mt-1" value={completeForm.travelAllowance}
                  onChange={(e) => setCompleteForm({ ...completeForm, travelAllowance: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Additional Expense</label>
                <input type="number" className="input-field mt-1" value={completeForm.additionalExpense}
                  onChange={(e) => setCompleteForm({ ...completeForm, additionalExpense: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowCompleteModal(false)} className="px-3 py-2 border rounded-md">Cancel</button>
              <button type="submit" className="btn-primary">Complete</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Create Claim Modal */}
      <Modal isOpen={showClaimModal} onClose={() => setShowClaimModal(false)} title="Create Expense Claim" size="lg">
        <form onSubmit={handleCreateClaim} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Select Visit *</label>
            <select
              required
              className="input-field mt-1"
              value={selectedVisitForClaim}
              onChange={(e) => setSelectedVisitForClaim(e.target.value)}
            >
              <option value="">Select a completed visit</option>
              {claimableVisits.map(v => (
                <option key={v._id} value={v._id}>
                  {v.visitType} - {v.accountId?.companyName} - {formatDate(v.scheduledDate)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Expenses *</label>
              <button type="button" onClick={addExpense} className="text-xs text-violet-600">+ Add Expense</button>
            </div>
            <div className="space-y-2">
              {expenses.map((exp, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <select value={exp.type} onChange={(e) => updateExpense(idx, 'type', e.target.value)} className="input-field w-28 text-sm">
                    <option value="travel">Travel</option>
                    <option value="food">Food</option>
                    <option value="accommodation">Accommodation</option>
                    <option value="materials">Materials</option>
                    <option value="other">Other</option>
                  </select>
                  <input type="text" placeholder="Description" value={exp.description}
                    onChange={(e) => updateExpense(idx, 'description', e.target.value)} className="input-field flex-1 text-sm" required />
                  <input type="number" placeholder="Amount" value={exp.amount || ''}
                    onChange={(e) => updateExpense(idx, 'amount', parseFloat(e.target.value) || 0)} className="input-field w-24 text-sm" required />
                  <input type="datetime-local" value={exp.date}
                    onChange={(e) => updateExpense(idx, 'date', e.target.value)} className="input-field w-36 text-sm" required />
                  {expenses.length > 1 && (
                    <button type="button" onClick={() => removeExpense(idx)} className="text-red-500">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea className="input-field mt-1" rows={2} value={claimNotes} onChange={(e) => setClaimNotes(e.target.value)} />
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowClaimModal(false)} className="px-3 py-2 border rounded-md">Cancel</button>
            <button type="submit" disabled={creatingClaim} className="btn-primary">
              {creatingClaim ? 'Creating...' : 'Save as Draft'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Submit Claim Modal */}
      <Modal isOpen={showSubmitModal} onClose={() => setShowSubmitModal(false)} title="Submit Claim to HR">
        {submitClaim && (
          <form onSubmit={handleSubmitClaim} className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-medium">Claim #{submitClaim.claimNumber}</p>
              <p className="text-xl font-bold text-violet-700">{formatCurrency(submitClaim.totalAmount)}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Mode of Payment *</label>
              <select
                required
                className="input-field mt-1"
                value={submitPaymentMode}
                onChange={(e) => setSubmitPaymentMode(e.target.value)}
              >
                <option value="">Select payment mode</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Upload Invoice / Receipt (optional)</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="mt-1 block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                onChange={(e) => setSubmitInvoiceFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-gray-400 mt-1">PDF, JPG or PNG, max 10MB</p>
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setShowSubmitModal(false)} className="px-3 py-2 border rounded-md">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Submitting...' : 'Submit to HR'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Review Claim Modal (HR) */}
      <Modal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} title="Review Claim">
        {reviewClaim && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-medium">Claim #{reviewClaim.claimNumber}</p>
              <p className="text-2xl font-bold">{formatCurrency(reviewClaim.totalAmount)}</p>
              <p className="text-sm text-gray-500 mt-1">From: {reviewClaim.engineerId?.name}</p>
              {reviewClaim.paymentMode && (
                <p className="text-sm text-gray-600 mt-1">
                  Payment Mode: <span className="font-medium text-violet-700">{reviewClaim.paymentMode}</span>
                </p>
              )}
              {reviewClaim.invoiceFile && (
                <a
                  href={reviewClaim.invoiceFile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs text-blue-600 hover:underline"
                >
                  View Invoice / Receipt
                </a>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Expenses:</p>
              <div className="space-y-1">
                {reviewClaim.expenses.map((exp, idx) => (
                  <div key={idx} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                    <span>{exp.description} ({exp.type})</span>
                    <span className="font-medium">{formatCurrency(exp.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                {reviewAction === 'approve' ? 'Approval Notes' : 'Rejection Reason *'}
              </label>
              <textarea
                className="input-field mt-1"
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                required={reviewAction === 'reject'}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setReviewAction('approve')}
                className={`flex-1 py-2 rounded-md text-sm font-medium ${
                  reviewAction === 'approve' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setReviewAction('reject')}
                className={`flex-1 py-2 rounded-md text-sm font-medium ${
                  reviewAction === 'reject' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Reject
              </button>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowReviewModal(false)} className="px-3 py-2 border rounded-md">Cancel</button>
              <button onClick={handleReview} disabled={reviewing} className={`px-4 py-2 rounded-md text-white ${
                reviewAction === 'approve' ? 'bg-emerald-600' : 'bg-red-600'
              }`}>
                {reviewing ? 'Processing...' : reviewAction === 'approve' ? 'Approve Claim' : 'Reject Claim'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}