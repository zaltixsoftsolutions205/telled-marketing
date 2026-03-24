// src/pages/QuotationsPage.tsx
import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Search, FileText, Mail, Check, X, Download, Send,
  Percent, Building2, RefreshCw, Eye, Edit,
} from 'lucide-react';
import { quotationsApi } from '@/api/quotations';
import { leadsApi } from '@/api/leads';
import { drfApi } from '@/api/drf';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import Toast from '@/components/common/Toast';
import { formatDate, formatCurrency } from '@/utils/formatters';
import type { Quotation, Lead, QuotationItem } from '@/types';

const emptyItem: QuotationItem = { description: '', quantity: 1, unitPrice: 0, total: 0 };

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-700',
  Accepted: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-600',
  Final: 'bg-purple-100 text-purple-700',
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([{ ...emptyItem }]);
  const [form, setForm] = useState({
    leadId: '',
    taxRate: 18,
    gstApplicable: true,
    validUntil: '',
    terms: '',
    notes: '',
  });
  const [vendorForm, setVendorForm] = useState({
    vendorEmail: '',
    finalAmount: 0,
  });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await quotationsApi.getAll(params);
      setQuotations(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) {
      console.error('QuotationsPage load:', err);
      setToast({ message: 'Failed to load quotations', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreateModal = async () => {
    setItems([{ ...emptyItem }]);
    setForm({ leadId: '', taxRate: 18, gstApplicable: true, validUntil: '', terms: '', notes: '' });
    try {
      const leadsRes = await leadsApi.getAll({ limit: 200, stage: 'OEM Approved' });
      const drfRes = await drfApi.getAll({ status: 'Approved', limit: 200 });
      const approvedLeadIds = new Set((drfRes.data || []).map((d: any) => d.leadId?._id));
      setLeads((leadsRes.data || []).filter((l: Lead) => approvedLeadIds.has(l._id)));
    } catch (err) {
      console.error('openCreateModal:', err);
      setLeads([]);
    }
    setShowCreateModal(true);
  };

  const openEditModal = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setItems(quotation.items || [{ ...emptyItem }]);
    setForm({
      leadId: (quotation.leadId as Lead)?._id || '',
      taxRate: quotation.taxRate || 18,
      gstApplicable: quotation.gstApplicable ?? true,
      validUntil: quotation.validUntil ? new Date(quotation.validUntil).toISOString().split('T')[0] : '',
      terms: quotation.terms || '',
      notes: quotation.notes || '',
    });
    setVendorForm({
      vendorEmail: (quotation as any).vendorEmail || (quotation.leadId as any)?.oemEmail || '',
      finalAmount: quotation.finalAmount || quotation.total || 0,
    });
    setShowEditModal(true);
  };

  const openVendorModal = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setVendorForm({
      vendorEmail: (quotation as any).vendorEmail || (quotation.leadId as any)?.oemEmail || '',
      finalAmount: quotation.finalAmount || quotation.total || 0,
    });
    setShowVendorModal(true);
  };

  const openViewModal = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setShowViewModal(true);
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: string | number) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        next[index].total = Number(next[index].quantity) * Number(next[index].unitPrice);
      }
      return next;
    });
  };

  const addItem = () => setItems(prev => [...prev, { ...emptyItem }]);
  const removeItem = (index: number) => {
    if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, i) => sum + (i.total || 0), 0);
  const taxAmount = form.gstApplicable ? subtotal * (Number(form.taxRate) / 100) : 0;
  const totalAmount = subtotal + taxAmount;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leadId) { setToast({ message: 'Please select a lead', type: 'error' }); return; }
    const validItems = items.filter(i => i.description.trim());
    if (!validItems.length) { setToast({ message: 'Add at least one line item', type: 'error' }); return; }
    setSaving(true);
    try {
      await quotationsApi.create({ ...form, items: validItems, subtotal, taxAmount, total: totalAmount, status: 'Draft' });
      setShowCreateModal(false);
      load();
      setToast({ message: 'Quotation created successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to create quotation', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuotation) return;
    const validItems = items.filter(i => i.description.trim());
    if (!validItems.length) { setToast({ message: 'Add at least one line item', type: 'error' }); return; }
    setSaving(true);
    try {
      await quotationsApi.update(selectedQuotation._id, {
        items: validItems,
        taxRate: form.taxRate,
        gstApplicable: form.gstApplicable,
        validUntil: form.validUntil || undefined,
        terms: form.terms,
        notes: form.notes,
      });
      setShowEditModal(false);
      setSelectedQuotation(null);
      load();
      setToast({ message: 'Quotation updated successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to update quotation', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendToVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuotation) return;
    if (!vendorForm.vendorEmail) { setToast({ message: 'Vendor email is required', type: 'error' }); return; }
    setSaving(true);
    try {
      await quotationsApi.sendToVendor(selectedQuotation._id, {
        vendorEmail: vendorForm.vendorEmail,
        finalAmount: vendorForm.finalAmount,
      });
      setShowVendorModal(false);
      setShowEditModal(false);
      setSelectedQuotation(null);
      load();
      setToast({ message: 'Quotation sent to vendor successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to send to vendor', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: string, id: string) => {
    setActionLoading(id + action);
    try {
      switch (action) {
        case 'accept': await quotationsApi.accept(id); setToast({ message: 'Quotation accepted', type: 'success' }); break;
        case 'reject': await quotationsApi.reject(id); setToast({ message: 'Quotation rejected', type: 'success' }); break;
        case 'sendEmail': await quotationsApi.sendEmail(id); setToast({ message: 'Email sent to customer', type: 'success' }); break;
        case 'finalize': await quotationsApi.finalize(id); setToast({ message: 'Quotation finalized', type: 'success' }); break;
        case 'generatePDF': await quotationsApi.generatePDF(id); setToast({ message: 'PDF generation started', type: 'success' }); break;
      }
      load();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || `${action} failed`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const getActionButtons = (q: Quotation) => {
    const buttons = [];

    // View button for all
    buttons.push(
      <button key="view" title="View Details" onClick={() => openViewModal(q)}
        className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
        <Eye size={14} />
      </button>
    );

    // Edit for non-Final quotations
    if (q.status !== 'Final') {
      buttons.push(
        <button key="edit" title="Edit Quotation" onClick={() => openEditModal(q)}
          className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors">
          <Edit size={14} />
        </button>
      );
    }

    // Draft actions
    if (q.status === 'Draft') {
      buttons.push(
        <button key="finalize" title="Finalize & Send to Customer"
          disabled={actionLoading === q._id + 'finalize'}
          onClick={() => handleAction('finalize', q._id)}
          className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50">
          <Check size={14} />
        </button>
      );
    }

    // Sent actions
    if (q.status === 'Sent') {
      buttons.push(
        <button key="sendEmail"
          title={q.emailSent ? `Resend Email` : 'Send Email to Customer'}
          disabled={actionLoading === q._id + 'sendEmail'}
          onClick={() => handleAction('sendEmail', q._id)}
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
          <Mail size={13} />
        </button>,
        <button key="accept" title="Accept Quotation"
          disabled={actionLoading === q._id + 'accept'}
          onClick={() => handleAction('accept', q._id)}
          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50">
          <Check size={14} />
        </button>,
        <button key="reject" title="Reject Quotation"
          disabled={actionLoading === q._id + 'reject'}
          onClick={() => handleAction('reject', q._id)}
          className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
          <X size={14} />
        </button>,
        <button key="vendor" title="Send to Vendor"
          onClick={() => openVendorModal(q)}
          className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors">
          <Building2 size={14} />
        </button>
      );
    }

    // Accepted / Rejected: allow re-sending email
    if (q.status === 'Accepted' || q.status === 'Rejected') {
      buttons.push(
        <button key="email" title="Send Email to Customer"
          disabled={actionLoading === q._id + 'sendEmail' || q.emailSent}
          onClick={() => handleAction('sendEmail', q._id)}
          className={`p-1.5 rounded-lg transition-colors ${q.emailSent ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
          <Mail size={14} />
        </button>
      );
    }

    // PDF button for all
    buttons.push(
      <button key="pdf" title={q.pdfPath ? 'Download PDF' : 'Generate PDF'}
        disabled={actionLoading === q._id + 'generatePDF'}
        onClick={() => handleAction('generatePDF', q._id)}
        className={`p-1.5 rounded-lg transition-colors ${q.pdfPath ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'} disabled:opacity-50`}>
        {q.pdfPath ? <Download size={14} /> : <FileText size={14} />}
      </button>
    );

    return buttons;
  };

  const displayed = quotations;

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Quotations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total quotations</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Quotation
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by company..." className="input-field pl-9" />
        </div>
        <select className="input-field w-40" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Accepted">Accepted</option>
          <option value="Rejected">Rejected</option>
          <option value="Final">Final</option>
        </select>
        <button onClick={load} className="p-2 text-gray-500 hover:text-violet-600 transition-colors"><RefreshCw size={18} /></button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="h-48" />
        ) : displayed.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No quotations found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Quotation #</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Ver.</th>
                  <th className="table-header">Subtotal</th>
                  <th className="table-header">Tax</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Valid Until</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map((q) => (
                  <tr key={q._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-mono font-medium text-violet-700">{q.quotationNumber}</td>
                    <td className="table-cell font-medium">{(q.leadId as Lead)?.companyName || '—'}</td>
                    <td className="table-cell text-center">
                      <span className={`badge text-xs ${q.version > 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>v{q.version}</span>
                    </td>
                    <td className="table-cell text-gray-500">{formatCurrency(q.subtotal)}</td>
                    <td className="table-cell text-gray-500">
                      {q.gstApplicable
                        ? <div className="flex items-center gap-1"><Percent size={12} />{q.taxRate}%</div>
                        : <span className="text-gray-400">N/A</span>}
                    </td>
                    <td className="table-cell font-semibold text-violet-700">{formatCurrency(q.total)}</td>
                    <td className="table-cell text-gray-400">{q.validUntil ? formatDate(q.validUntil) : '—'}</td>
                    <td className="table-cell">
                      <span className={`badge text-xs ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-600'}`}>{q.status}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5 flex-wrap">{getActionButtons(q)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      {/* Create Quotation Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Quotation" size="xl">
        <form onSubmit={handleCreate} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Lead *</label>
              <select required className="input-field" value={form.leadId}
                onChange={(e) => setForm(f => ({ ...f, leadId: e.target.value }))}>
                <option value="">Select lead</option>
                {leads.map(l => (
                  <option key={l._id} value={l._id}>{l.companyName} ({l.oemName || 'No OEM'})</option>
                ))}
              </select>
              {leads.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No leads with approved DRFs available</p>
              )}
            </div>
            <div>
              <label className="label">Valid Until</label>
              <input type="date" className="input-field" value={form.validUntil}
                onChange={(e) => setForm(f => ({ ...f, validUntil: e.target.value }))} />
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.gstApplicable}
                onChange={(e) => setForm(f => ({ ...f, gstApplicable: e.target.checked }))}
                className="w-4 h-4 accent-violet-600" />
              <span className="text-sm font-medium text-gray-700">GST Applicable</span>
            </label>
            {form.gstApplicable && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Tax Rate:</span>
                <input type="number" className="input-field w-20 text-sm" value={form.taxRate}
                  onChange={(e) => setForm(f => ({ ...f, taxRate: Number(e.target.value) }))} min="0" max="100" />
                <span className="text-sm text-gray-500">%</span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label !mb-0">Line Items *</label>
              <button type="button" onClick={addItem} className="text-xs text-violet-600 hover:text-violet-800 font-medium">+ Add Row</button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <input className="input-field text-sm" placeholder="Description" value={item.description}
                      onChange={(e) => updateItem(i, 'description', e.target.value)} required />
                  </div>
                  <div className="col-span-2">
                    <input type="number" className="input-field text-sm" placeholder="Qty" min={1} value={item.quantity}
                      onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} required />
                  </div>
                  <div className="col-span-3">
                    <input type="number" className="input-field text-sm" placeholder="Unit Price" min={0} step="0.01"
                      value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} required />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-700 flex-1">{formatCurrency(item.total)}</span>
                    <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {form.gstApplicable && <div className="flex justify-between"><span className="text-gray-500">GST ({form.taxRate}%)</span><span>{formatCurrency(taxAmount)}</span></div>}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
              <span>Total</span><span className="text-violet-700">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <div>
            <label className="label">Terms & Conditions</label>
            <textarea rows={2} className="input-field" value={form.terms}
              onChange={(e) => setForm(f => ({ ...f, terms: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || leads.length === 0} className="btn-primary">
              {saving ? 'Creating...' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Quotation Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedQuotation(null); }} title="Edit Quotation" size="xl">
        <form onSubmit={handleEdit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.gstApplicable}
                onChange={(e) => setForm(f => ({ ...f, gstApplicable: e.target.checked }))}
                className="w-4 h-4 accent-violet-600" />
              <span className="text-sm font-medium text-gray-700">GST Applicable</span>
            </label>
            {form.gstApplicable && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Tax Rate:</span>
                <input type="number" className="input-field w-20 text-sm" value={form.taxRate}
                  onChange={(e) => setForm(f => ({ ...f, taxRate: Number(e.target.value) }))} min="0" max="100" />
                <span className="text-sm text-gray-500">%</span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label !mb-0">Line Items</label>
              <button type="button" onClick={addItem} className="text-xs text-violet-600 hover:text-violet-800 font-medium">+ Add Row</button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <input className="input-field text-sm" placeholder="Description" value={item.description}
                      onChange={(e) => updateItem(i, 'description', e.target.value)} required />
                  </div>
                  <div className="col-span-2">
                    <input type="number" className="input-field text-sm" placeholder="Qty" min={1} value={item.quantity}
                      onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} required />
                  </div>
                  <div className="col-span-3">
                    <input type="number" className="input-field text-sm" placeholder="Unit Price" min={0} step="0.01"
                      value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} required />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-700 flex-1">{formatCurrency(item.total)}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {form.gstApplicable && <div className="flex justify-between"><span className="text-gray-500">GST ({form.taxRate}%)</span><span>{formatCurrency(taxAmount)}</span></div>}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
              <span>Total</span><span className="text-violet-700">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <div>
            <label className="label">Terms & Conditions</label>
            <textarea rows={2} className="input-field" value={form.terms}
              onChange={(e) => setForm(f => ({ ...f, terms: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex gap-3 justify-end sticky bottom-0 bg-white pt-2">
            <button type="button" onClick={() => { setShowEditModal(false); setSelectedQuotation(null); }} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Send to Vendor Modal */}
      <Modal isOpen={showVendorModal} onClose={() => { setShowVendorModal(false); setSelectedQuotation(null); }} title="Send to Vendor" size="md">
        <form onSubmit={handleSendToVendor} className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-800 mb-3">Send this quotation request to the vendor for pricing.</p>
            <div className="mb-3">
              <label className="label">Vendor Email *</label>
              <input type="email" className="input-field" value={vendorForm.vendorEmail}
                onChange={(e) => setVendorForm(f => ({ ...f, vendorEmail: e.target.value }))}
                required placeholder="vendor@example.com" />
              <p className="text-xs text-gray-500 mt-1">Email where the quotation request will be sent</p>
            </div>
            <div>
              <label className="label">Final Amount (₹)</label>
              <input type="number" className="input-field" value={vendorForm.finalAmount}
                onChange={(e) => setVendorForm(f => ({ ...f, finalAmount: Number(e.target.value) }))}
                min="0" step="0.01" />
              <p className="text-xs text-gray-500 mt-1">Original total: {formatCurrency(selectedQuotation?.total || 0)}</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setShowVendorModal(false); setSelectedQuotation(null); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              <Send size={16} /> {saving ? 'Sending...' : 'Send to Vendor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Quotation Modal */}
      <Modal isOpen={showViewModal} onClose={() => { setShowViewModal(false); setSelectedQuotation(null); }}
        title={`Quotation Details - ${selectedQuotation?.quotationNumber}`} size="lg">
        {selectedQuotation && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">Customer</p>
                <p className="font-semibold text-gray-900">{(selectedQuotation.leadId as Lead)?.companyName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Contact</p>
                <p className="text-gray-700">
                  {(selectedQuotation.leadId as Lead)?.contactName || (selectedQuotation.leadId as Lead)?.contactPersonName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Version</p>
                <p className="text-gray-700">v{selectedQuotation.version}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedQuotation.status]}`}>
                  {selectedQuotation.status}
                </span>
              </div>
              {selectedQuotation.validUntil && (
                <div>
                  <p className="text-xs text-gray-500">Valid Until</p>
                  <p className="text-gray-700">{formatDate(selectedQuotation.validUntil)}</p>
                </div>
              )}
              {selectedQuotation.createdAt && (
                <div>
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="text-gray-700">{formatDate(selectedQuotation.createdAt)}</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Line Items</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedQuotation.items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-center">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right font-medium">Subtotal:</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(selectedQuotation.subtotal)}</td>
                  </tr>
                  {selectedQuotation.gstApplicable && (
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right font-medium">GST ({selectedQuotation.taxRate}%):</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(selectedQuotation.taxAmount)}</td>
                    </tr>
                  )}
                  <tr className="font-bold">
                    <td colSpan={3} className="px-3 py-2 text-right text-violet-700">Total:</td>
                    <td className="px-3 py-2 text-right text-violet-700">{formatCurrency(selectedQuotation.total)}</td>
                  </tr>
                  {selectedQuotation.finalAmount && (
                    <tr className="text-purple-700">
                      <td colSpan={3} className="px-3 py-2 text-right font-medium">Final Amount:</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(selectedQuotation.finalAmount)}</td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            {selectedQuotation.terms && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">Terms & Conditions</h3>
                <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">{selectedQuotation.terms}</p>
              </div>
            )}
            {selectedQuotation.notes && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">Notes</h3>
                <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">{selectedQuotation.notes}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowViewModal(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
