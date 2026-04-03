// src/pages/VisitClaimsPage.tsx
import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Eye, Send, CheckCircle, XCircle, DollarSign,
  Clock, AlertCircle, FileText, Filter, Search,
  Download, Printer, ChevronLeft, ChevronRight,
  Trash2, Edit, MoreVertical, Receipt, MapPin,
  Coffee, Hotel, Package, HelpCircle
} from 'lucide-react';
import { visitClaimsApi, VisitClaim, Expense } from '@/api/visitClaims';
import { engineerVisitsApi } from '@/api/engineerVisits';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate, formatDateTime, formatCurrency } from '@/utils/formatters';
import toast from 'react-hot-toast';

type ClaimStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';

const STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100', icon: FileText },
  submitted: { label: 'Submitted', color: 'text-blue-600', bg: 'bg-blue-100', icon: Clock },
  under_review: { label: 'Under Review', color: 'text-amber-600', bg: 'bg-amber-100', icon: AlertCircle },
  approved: { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
  paid: { label: 'Paid', color: 'text-violet-600', bg: 'bg-violet-100', icon: DollarSign }
};

const EXPENSE_TYPES = [
  { value: 'travel', label: 'Travel', icon: MapPin, color: 'blue' },
  { value: 'food', label: 'Food', icon: Coffee, color: 'orange' },
  { value: 'accommodation', label: 'Accommodation', icon: Hotel, color: 'purple' },
  { value: 'materials', label: 'Materials', icon: Package, color: 'green' },
  { value: 'other', label: 'Other', icon: HelpCircle, color: 'gray' }
];

export default function VisitClaimsPage() {
  const user = useAuthStore((s) => s.user);
  const isHR = user?.role === 'admin' || user?.role === 'hr_finance';
  const isEngineer = user?.role === 'engineer' || user?.role === 'admin';
  
  const [claims, setClaims] = useState<VisitClaim[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  
  const [stats, setStats] = useState<any>(null);
  
  // Create Claim Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availableVisits, setAvailableVisits] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>([
    { type: 'travel', description: '', amount: 0, date: new Date().toISOString().slice(0, 16) }
  ]);
  const [claimNotes, setClaimNotes] = useState('');
  const [creating, setCreating] = useState(false);
  
  // View Claim Modal
  const [selectedClaim, setSelectedClaim] = useState<VisitClaim | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  
  // Review Modal
  const [reviewClaim, setReviewClaim] = useState<VisitClaim | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewing, setReviewing] = useState(false);
  
  // Payment Modal
  const [payClaim, setPayClaim] = useState<VisitClaim | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [paying, setPaying] = useState(false);
  
  const limit = 15;
  
  const loadClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      
      const res = await visitClaimsApi.getAll(params);
      setClaims(res.data || []);
      setTotal(res.pagination?.total ?? 0);
      
      // Load stats for HR
      if (isHR) {
        const statsRes = await visitClaimsApi.getStats();
        setStats(statsRes);
      }
    } catch (err) {
      console.error('loadClaims error:', err);
      toast.error('Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, isHR]);
  
  useEffect(() => { loadClaims(); }, [loadClaims]);
  
  const loadAvailableVisits = async () => {
    try {
      const res = await engineerVisitsApi.getAll({ 
        engineerId: user?._id,
        status: 'Completed',
        limit: 100 
      });
      // Filter visits that don't have a claim yet
      const visitsWithClaims = claims.filter(c => c.visitId).map(c => 
        typeof c.visitId === 'string' ? c.visitId : c.visitId?._id
      );
      const available = (res.data || []).filter((v: any) => 
        !visitsWithClaims.includes(v._id) && v.status === 'Completed'
      );
      setAvailableVisits(available);
    } catch (err) {
      console.error('loadAvailableVisits error:', err);
    }
  };
  
  const openCreateModal = async () => {
    await loadAvailableVisits();
    setSelectedVisit('');
    setExpenses([{ type: 'travel', description: '', amount: 0, date: new Date().toISOString().slice(0, 16) }]);
    setClaimNotes('');
    setShowCreateModal(true);
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
    if (!selectedVisit) {
      toast.error('Please select a visit');
      return;
    }
    if (expenses.some(e => !e.description || e.amount <= 0)) {
      toast.error('Please fill all expense details');
      return;
    }
    
    setCreating(true);
    try {
      await visitClaimsApi.create({
        visitId: selectedVisit,
        expenses: expenses.map(e => ({ ...e, date: new Date(e.date) })),
        notes: claimNotes
      });
      toast.success('Claim created successfully');
      setShowCreateModal(false);
      loadClaims();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create claim');
    } finally {
      setCreating(false);
    }
  };
  
  const handleSubmitClaim = async (claimId: string) => {
    try {
      await visitClaimsApi.submit(claimId);
      toast.success('Claim submitted for approval');
      loadClaims();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit claim');
    }
  };
  
  const handleDeleteClaim = async (claimId: string) => {
    if (!confirm('Are you sure you want to delete this claim?')) return;
    try {
      await visitClaimsApi.delete(claimId);
      toast.success('Claim deleted');
      loadClaims();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete claim');
    }
  };
  
  const handleReview = async () => {
    if (!reviewClaim) return;
    setReviewing(true);
    try {
      if (reviewAction === 'approve') {
        await visitClaimsApi.approve(reviewClaim._id, reviewNotes);
        toast.success('Claim approved');
      } else {
        await visitClaimsApi.reject(reviewClaim._id, reviewNotes);
        toast.success('Claim rejected');
      }
      setShowReviewModal(false);
      setReviewClaim(null);
      setReviewNotes('');
      loadClaims();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to process claim');
    } finally {
      setReviewing(false);
    }
  };
  
  const handleMarkPaid = async () => {
    if (!payClaim) return;
    setPaying(true);
    try {
      await visitClaimsApi.markAsPaid(payClaim._id, paymentRef);
      toast.success('Claim marked as paid');
      setShowPayModal(false);
      setPayClaim(null);
      setPaymentRef('');
      loadClaims();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to mark as paid');
    } finally {
      setPaying(false);
    }
  };
  
  const totalPages = Math.ceil(total / limit);
  
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visit Claims</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isHR ? 'Manage and approve engineer expense claims' : 'Submit and track your expense claims'}
          </p>
        </div>
        {isEngineer && (
          <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Claim
          </button>
        )}
      </div>
      
      {/* Stats Cards (HR only) */}
      {isHR && stats && (
        <div className="grid grid-cols-6 gap-3">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const stat = stats[status] || { count: 0, amount: 0 };
            return (
              <div
                key={status}
                onClick={() => setStatusFilter(status === statusFilter ? '' : status)}
                className={`bg-white rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md ${
                  statusFilter === status ? 'ring-2 ring-violet-500 border-violet-500' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <config.icon size={18} className={config.color} />
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                    {stat.count}
                  </span>
                </div>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(stat.amount)}</p>
                <p className="text-xs text-gray-500">{config.label}</p>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by claim number..."
            className="input-field pl-8 py-2 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input-field py-2 text-sm w-36"
        >
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
            <option key={status} value={status}>{config.label}</option>
          ))}
        </select>
      </div>
      
      {/* Claims Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="h-64" />
        ) : claims.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <Receipt size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No claims found</p>
            {isEngineer && (
              <button onClick={openCreateModal} className="mt-3 text-sm text-violet-600 hover:text-violet-700">
                Create your first claim
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Claim #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {claims.map((claim) => {
                    const statusConfig = STATUS_CONFIG[claim.status];
                    const StatusIcon = statusConfig.icon;
                    const visit = typeof claim.visitId !== 'string' ? claim.visitId : null;
                    const account = typeof claim.accountId !== 'string' ? claim.accountId : null;
                    const engineer = typeof claim.engineerId !== 'string' ? claim.engineerId : null;
                    
                    const canSubmit = claim.status === 'draft' && (isEngineer || user?._id === engineer?._id);
                    const canReview = isHR && (claim.status === 'submitted' || claim.status === 'under_review');
                    const canPay = isHR && claim.status === 'approved';
                    
                    return (
                      <tr key={claim._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-medium text-gray-900">{claim.claimNumber}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {visit ? `${visit.visitType} - ${formatDate(visit.scheduledDate)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {account?.companyName || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {claim.submittedAt ? formatDate(claim.submittedAt) : formatDate(claim.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-900">{formatCurrency(claim.totalAmount)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                            <StatusIcon size={12} />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => { setSelectedClaim(claim); setShowViewModal(true); }}
                              className="p-1.5 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded"
                              title="View"
                            >
                              <Eye size={14} />
                            </button>
                            
                            {canSubmit && (
                              <button
                                onClick={() => handleSubmitClaim(claim._id)}
                                className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Submit"
                              >
                                <Send size={14} />
                              </button>
                            )}
                            
                            {canReview && (
                              <button
                                onClick={() => { setReviewClaim(claim); setShowReviewModal(true); setReviewNotes(''); }}
                                className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded"
                                title="Review"
                              >
                                <Eye size={14} />
                              </button>
                            )}
                            
                            {canPay && (
                              <button
                                onClick={() => { setPayClaim(claim); setShowPayModal(true); setPaymentRef(''); }}
                                className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                                title="Mark as Paid"
                              >
                                <DollarSign size={14} />
                              </button>
                            )}
                            
                            {claim.status === 'draft' && (isEngineer || user?._id === engineer?._id) && (
                              <button
                                onClick={() => handleDeleteClaim(claim._id)}
                                className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <Trash2 size={14} />
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
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-500">
                  Showing {((page-1)*limit)+1}–{Math.min(page*limit, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p-1)}
                    className="px-3 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p+1)}
                    className="px-3 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Create Claim Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Expense Claim" size="lg">
        <form onSubmit={handleCreateClaim} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Select Visit *</label>
            <select
              required
              className="input-field"
              value={selectedVisit}
              onChange={(e) => setSelectedVisit(e.target.value)}
            >
              <option value="">Select a completed visit</option>
              {availableVisits.map((visit) => (
                <option key={visit._id} value={visit._id}>
                  {visit.visitType} - {visit.accountId?.companyName} - {formatDate(visit.scheduledDate)}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Expenses *</label>
              <button type="button" onClick={addExpense} className="text-xs text-violet-600 hover:text-violet-700">
                + Add Expense
              </button>
            </div>
            <div className="space-y-3">
              {expenses.map((expense, idx) => (
                <div key={idx} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                  <select
                    value={expense.type}
                    onChange={(e) => updateExpense(idx, 'type', e.target.value as any)}
                    className="input-field text-sm w-32"
                  >
                    {EXPENSE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Description"
                    value={expense.description}
                    onChange={(e) => updateExpense(idx, 'description', e.target.value)}
                    className="input-field text-sm flex-1"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={expense.amount || ''}
                    onChange={(e) => updateExpense(idx, 'amount', parseFloat(e.target.value) || 0)}
                    className="input-field text-sm w-28"
                    required
                    min="0"
                    step="0.01"
                  />
                  <input
                    type="datetime-local"
                    value={expense.date}
                    onChange={(e) => updateExpense(idx, 'date', e.target.value)}
                    className="input-field text-sm w-40"
                    required
                  />
                  {expenses.length > 1 && (
                    <button type="button" onClick={() => removeExpense(idx)} className="text-red-500 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Notes (Optional)</label>
            <textarea
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              className="input-field resize-none"
              rows={3}
              placeholder="Any additional information about the claim..."
            />
          </div>
          
          <div className="flex gap-3 justify-end pt-3">
            <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={creating} className="btn-primary text-sm">
              {creating ? 'Creating...' : 'Save as Draft'}
            </button>
          </div>
        </form>
      </Modal>
      
      {/* View Claim Modal */}
      <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title={`Claim ${selectedClaim?.claimNumber}`} size="lg">
        {selectedClaim && (
          <div className="space-y-4">
            {/* Claim Header */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(selectedClaim.totalAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Status</p>
                {(() => {
                  const config = STATUS_CONFIG[selectedClaim.status];
                  const Icon = config.icon;
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                      <Icon size={12} /> {config.label}
                    </span>
                  );
                })()}
              </div>
            </div>
            
            {/* Visit Info */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Visit Details</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Type:</span>
                  <span className="ml-2 text-gray-700">{typeof selectedClaim.visitId !== 'string' ? selectedClaim.visitId?.visitType : '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Date:</span>
                  <span className="ml-2 text-gray-700">
                    {typeof selectedClaim.visitId !== 'string' ? formatDate(selectedClaim.visitId?.scheduledDate) : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Account:</span>
                  <span className="ml-2 text-gray-700">{typeof selectedClaim.accountId !== 'string' ? selectedClaim.accountId?.companyName : '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Engineer:</span>
                  <span className="ml-2 text-gray-700">{typeof selectedClaim.engineerId !== 'string' ? selectedClaim.engineerId?.name : '-'}</span>
                </div>
              </div>
            </div>
            
            {/* Expenses */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Expenses</h4>
              <div className="space-y-2">
                {selectedClaim.expenses.map((expense, idx) => {
                  const typeConfig = EXPENSE_TYPES.find(t => t.value === expense.type);
                  const Icon = typeConfig?.icon || HelpCircle;
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className="text-gray-500" />
                        <span className="font-medium text-gray-700">{expense.description}</span>
                        <span className="text-gray-400 text-xs">({typeConfig?.label})</span>
                      </div>
                      <span className="font-semibold text-gray-900">{formatCurrency(expense.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Notes */}
            {selectedClaim.notes && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Notes</h4>
                <p className="text-sm text-gray-600 p-2 bg-gray-50 rounded">{selectedClaim.notes}</p>
              </div>
            )}
            
            {/* Review Info */}
            {selectedClaim.reviewedBy && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">
                  Reviewed by {typeof selectedClaim.reviewedBy !== 'string' ? selectedClaim.reviewedBy?.name : ''} on {formatDateTime(selectedClaim.reviewedAt)}
                </p>
                {selectedClaim.approvalNotes && (
                  <p className="text-sm text-gray-600 mt-1">Notes: {selectedClaim.approvalNotes}</p>
                )}
                {selectedClaim.rejectionReason && (
                  <p className="text-sm text-red-600 mt-1">Rejection: {selectedClaim.rejectionReason}</p>
                )}
              </div>
            )}
            
            {/* Payment Info */}
            {selectedClaim.paidAt && (
              <div className="p-3 bg-emerald-50 rounded-lg">
                <p className="text-sm font-medium text-emerald-700">Paid on {formatDate(selectedClaim.paidAt)}</p>
                {selectedClaim.paymentReference && (
                  <p className="text-xs text-emerald-600 mt-1">Ref: {selectedClaim.paymentReference}</p>
                )}
              </div>
            )}
            
            <div className="flex justify-end">
              <button onClick={() => setShowViewModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Review Modal (HR) */}
      <Modal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} title="Review Claim" size="md">
        {reviewClaim && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Claim #{reviewClaim.claimNumber}</strong> from {typeof reviewClaim.engineerId !== 'string' ? reviewClaim.engineerId?.name : ''}
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(reviewClaim.totalAmount)}</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Expenses:</p>
              {reviewClaim.expenses.map((exp, idx) => (
                <div key={idx} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                  <span>{exp.description}</span>
                  <span className="font-medium">{formatCurrency(exp.amount)}</span>
                </div>
              ))}
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                {reviewAction === 'approve' ? 'Approval Notes (Optional)' : 'Rejection Reason *'}
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="input-field resize-none"
                rows={3}
                placeholder={reviewAction === 'approve' ? 'Add any notes...' : 'Explain why this claim is being rejected...'}
                required={reviewAction === 'reject'}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setReviewAction('approve')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  reviewAction === 'approve'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setReviewAction('reject')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  reviewAction === 'reject'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Reject
              </button>
            </div>
            
            <div className="flex gap-3 justify-end pt-3">
              <button onClick={() => setShowReviewModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleReview} disabled={reviewing} className={`px-4 py-2 text-sm rounded-md text-white ${
                reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}>
                {reviewing ? 'Processing...' : reviewAction === 'approve' ? 'Approve Claim' : 'Reject Claim'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Payment Modal */}
      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title="Mark Claim as Paid" size="sm">
        {payClaim && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-gray-600">Claim #{payClaim.claimNumber}</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(payClaim.totalAmount)}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Payment Reference (Optional)</label>
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="input-field"
                placeholder="Transaction ID, Cheque No, etc."
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowPayModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleMarkPaid} disabled={paying} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700">
                {paying ? 'Processing...' : 'Mark as Paid'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}