import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Send, Building2, Pencil, CheckCircle, RefreshCw, Receipt, CreditCard, Edit, Mail, Trash2 } from 'lucide-react';
import { purchasesApi } from '@/api/purchases';
import { leadsApi } from '@/api/leads';
import { accountsApi } from '@/api/accounts';
import { invoicesApi } from '@/api/invoices';
import api from '@/api/axios';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Toast from '@/components/common/Toast';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import type { PurchaseOrder, Lead, Account } from '@/types';

export default function PurchasesPage() {
  const { user } = useAuthStore();
  const canRecordPayment = user?.role === 'admin' || user?.role === 'hr_finance' || user?.role === 'sales';
  const [activeTab, setActiveTab] = useState<'customer' | 'vendor'>('customer');

  // Customer POs
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    leadId: '', amount: '', product: '', vendorName: '', vendorEmail: '', receivedDate: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<PurchaseOrder | null>(null);
  const [editForm, setEditForm] = useState({
    amount: '', product: '', vendorName: '', vendorEmail: '', notes: '', receivedDate: ''
  });
  const [editSaving, setEditSaving] = useState(false);

  // Send to vendor modal
  const [sendTarget, setSendTarget] = useState<PurchaseOrder | null>(null);
  const [sendVendorEmail, setSendVendorEmail] = useState('');
  const [sending, setSending] = useState(false);

  // Convert modal
  const [convertTarget, setConvertTarget] = useState<PurchaseOrder | null>(null);
  const [convertForm, setConvertForm] = useState({ accountName: '', notes: '' });
  const [converting, setConverting] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Mark Vendor Paid modal
  const [payTarget, setPayTarget] = useState<PurchaseOrder | null>(null);
  const [payForm, setPayForm] = useState({ paidAmount: '', paidDate: new Date().toISOString().slice(0, 10), paymentMode: 'Bank Transfer', paymentReference: '', paymentNotes: '' });
  const [paying, setPaying] = useState(false);

  // Generate Invoice modal
  const [invoiceTarget, setInvoiceTarget] = useState<PurchaseOrder | null>(null);
  const [invoiceAccounts, setInvoiceAccounts] = useState<Account[]>([]);
  const [invoiceForm, setInvoiceForm] = useState({
    accountId: '', amount: '', taxPercent: '18',
    dueDate: '', description: '', notes: '',
  });
  const [invoiceGenerating, setInvoiceGenerating] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await purchasesApi.delete(deleteTarget._id);
      setOrders(prev => prev.filter(o => o._id !== deleteTarget._id));
      setTotal(prev => prev - 1);
      setDeleteTarget(null);
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to delete purchase order', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleSyncEmails = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/purchase-orders/sync-emails');
      setToast({ 
        message: `Sync completed: ${data.data.created.length} created, ${data.data.updated.length} updated, ${data.data.skipped.length} skipped`, 
        type: 'success' 
      });
      await load();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to sync emails', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      const res = await purchasesApi.getAll(params);
      setOrders(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) {
      console.error('PurchasesPage load:', err);
      setOrders([]);
      setTotal(0);
      setToast({ message: 'Failed to load purchase orders', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    try {
      const res = await leadsApi.getAll({ limit: 200 });
      setLeads(res.data || []);
    } catch (err) {
      console.error('openCreate:', err);
      setLeads([]);
    }
    setCreateForm({ leadId: '', amount: '', product: '', vendorName: '', vendorEmail: '', receivedDate: new Date().toISOString().slice(0, 10), notes: '' });
    setShowCreate(true);
  };

  const selectedLead = leads.find(l => l._id === createForm.leadId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.leadId) {
      setToast({ message: 'Please select a customer', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      await purchasesApi.create({ 
        ...createForm, 
        amount: Number(createForm.amount),
        receivedDate: createForm.receivedDate || new Date().toISOString().slice(0, 10)
      });
      setShowCreate(false);
      setToast({ message: 'Purchase order created successfully', type: 'success' });
      load();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to create PO', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditTarget(po);
    setEditForm({
      amount: String(po.amount),
      product: po.product || '',
      vendorName: po.vendorName || '',
      vendorEmail: po.vendorEmail || '',
      notes: po.notes || '',
      receivedDate: po.receivedDate ? new Date(po.receivedDate).toISOString().slice(0, 10) : '',
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await purchasesApi.update(editTarget._id, { 
        ...editForm, 
        amount: Number(editForm.amount),
        receivedDate: editForm.receivedDate || editTarget.receivedDate
      });
      setEditTarget(null);
      setToast({ message: 'Purchase order updated successfully', type: 'success' });
      load();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to update PO', type: 'error' });
    } finally {
      setEditSaving(false);
    }
  };

  const openSendModal = (po: PurchaseOrder) => {
    setSendTarget(po);
    setSendVendorEmail(po.vendorEmail || '');
  };

  const handleSendToVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendTarget) return;
    if (!sendVendorEmail.trim()) {
      setToast({ message: 'Please enter vendor email', type: 'error' });
      return;
    }
    setSending(true);
    try {
      await purchasesApi.sendToVendor(sendTarget._id, sendVendorEmail.trim());
      setSendTarget(null);
      setSendVendorEmail('');
      setToast({ message: `PO ${sendTarget.poNumber} sent to vendor successfully`, type: 'success' });
      load();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to send to vendor', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const openConvert = (po: PurchaseOrder) => {
    setConvertTarget(po);
    setConvertForm({ accountName: (po.leadId as Lead)?.companyName || '', notes: '' });
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertTarget) return;
    setConverting(true);
    try {
      await purchasesApi.convertToAccount(convertTarget._id, convertForm);
      setConvertTarget(null);
      setToast({ message: 'Converted to account successfully', type: 'success' });
      load();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to convert to account', type: 'error' });
    } finally {
      setConverting(false);
    }
  };

  const openGenerateInvoice = async (po: PurchaseOrder) => {
    setInvoiceTarget(po);
    const due = new Date();
    due.setDate(due.getDate() + 30);
    const dueDate = due.toISOString().slice(0, 10);

    try {
      const res = await accountsApi.getAll({ limit: 200 });
      const accs: Account[] = res.data || [];
      setInvoiceAccounts(accs);
      const lead = po.leadId as Lead;
      const matched = accs.find((a: any) => a.leadId === lead?._id || a.leadId?._id === lead?._id || a.companyName === lead?.companyName);
      setInvoiceForm({
        accountId: matched?._id || '',
        amount: String(po.amount),
        taxPercent: '18',
        dueDate,
        description: po.product || '',
        notes: `Generated from PO ${po.poNumber}`,
      });
    } catch {
      setInvoiceAccounts([]);
      setInvoiceForm({ accountId: '', amount: String(po.amount), taxPercent: '18', dueDate, description: po.product || '', notes: `Generated from PO ${po.poNumber}` });
    }
  };

  const openMarkPaid = (po: PurchaseOrder) => {
    setPayTarget(po);
    setPayForm({ paidAmount: String(po.amount), paidDate: new Date().toISOString().slice(0, 10), paymentMode: 'Bank Transfer', paymentReference: '', paymentNotes: '' });
  };

  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    setPaying(true);
    try {
      await purchasesApi.recordPayment(payTarget._id, {
        paidAmount: Number(payForm.paidAmount),
        paidDate: payForm.paidDate,
        paymentMode: payForm.paymentMode,
        paymentReference: payForm.paymentReference,
        paymentNotes: payForm.paymentNotes,
      });
      setPayTarget(null);
      setToast({ message: 'Vendor payment recorded successfully', type: 'success' });
      load();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to record payment', type: 'error' });
    } finally {
      setPaying(false);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceTarget || !invoiceForm.accountId) {
      setToast({ message: 'Please select an account', type: 'error' });
      return;
    }
    setInvoiceGenerating(true);
    try {
      const invoice = await invoicesApi.create({
        accountId: invoiceForm.accountId,
        amount: Number(invoiceForm.amount),
        taxPercent: Number(invoiceForm.taxPercent),
        dueDate: invoiceForm.dueDate,
        description: invoiceForm.description,
        notes: invoiceForm.notes,
        poReference: invoiceTarget.poNumber,
      });
      const pdfUrl = invoice?.pdfUrl || invoice?.pdfPath;
      if (pdfUrl) {
        const a = document.createElement('a');
        a.href = `/uploads/${pdfUrl}`;
        a.download = pdfUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setInvoiceTarget(null);
      setToast({ message: 'Invoice generated successfully', type: 'success' });
      load();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to generate invoice', type: 'error' });
    } finally {
      setInvoiceGenerating(false);
    }
  };

  // Filter orders for vendor tab
  const vendorOrders = orders.filter(o => o.vendorEmailSent);
  const customerOrders = orders.filter(o => !o.vendorEmailSent);

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSyncEmails} 
            disabled={syncing}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Emails'}
          </button>
          {activeTab === 'customer' && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Add PO
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('customer')}
          className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'customer' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Customer POs
          <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{customerOrders.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('vendor')}
          className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'vendor' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Vendor POs
          <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{vendorOrders.length}</span>
        </button>
      </div>

      {activeTab === 'vendor' ? (
        /* Vendor POs Table */
        <div className="glass-card !p-0 overflow-hidden">
          {loading ? (
            <LoadingSpinner className="h-48" />
          ) : vendorOrders.length === 0 ? (
            <div className="text-center text-gray-400 py-16">No vendor POs yet — send a PO to vendor first</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-amber-50 border-b border-amber-100">
                  <tr>
                    <th className="table-header">PO Number</th>
                    <th className="table-header">Customer</th>
                    <th className="table-header">Product</th>
                    <th className="table-header">Vendor</th>
                    <th className="table-header">Amount</th>
                    <th className="table-header">Sent On</th>
                    <th className="table-header">Payment</th>
                    <th className="table-header">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {vendorOrders.map((po) => (
                    <tr key={po._id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="table-cell font-mono font-medium text-amber-700">{po.poNumber}</td>
                      <td className="table-cell font-medium">{(po.leadId as Lead)?.companyName || '—'}</td>
                      <td className="table-cell text-gray-500">{po.product || '—'}</td>
                      <td className="table-cell">
                        <p className="text-sm text-gray-700">{po.vendorName || '—'}</p>
                        {po.vendorEmail && <p className="text-xs text-gray-400">{po.vendorEmail}</p>}
                      </td>
                      <td className="table-cell font-semibold text-amber-700">{formatCurrency(po.amount)}</td>
                      <td className="table-cell text-gray-400">{po.vendorEmailSentAt ? formatDate(po.vendorEmailSentAt) : '—'}</td>
                      <td className="table-cell">
                        {po.paymentStatus === 'Paid' ? (
                          <div>
                            <span className="badge bg-green-100 text-green-700 text-xs">Paid</span>
                            {po.paidDate && <p className="text-xs text-gray-400 mt-0.5">{formatDate(po.paidDate)}</p>}
                          </div>
                        ) : (
                          <span className="badge bg-orange-100 text-orange-700 text-xs">Unpaid</span>
                        )}
                      </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            {canRecordPayment && po.paymentStatus !== 'Paid' && (
                              <button
                                title="Mark Vendor Paid"
                                onClick={() => openMarkPaid(po)}
                                className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                              >
                                <CreditCard size={13} />
                              </button>
                            )}
                            {(user?.role === 'admin' || user?.role === 'sales') && (
                              <button
                                title="Delete PO"
                                onClick={() => setDeleteTarget(po)}
                                className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                              >
                                <Trash2 size={13} />
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
      ) : (
        <>
          <div className="relative max-w-xs">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input 
              value={search} 
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
              placeholder="Search by PO number, vendor, or product..." 
              className="input-field pl-9" 
            />
          </div>

          <div className="glass-card !p-0 overflow-hidden">
            {loading ? (
              <LoadingSpinner className="h-48" />
            ) : customerOrders.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                {search ? 'No matching purchase orders found' : 'No purchase orders found. Click "Sync Emails" to import from email or "Add PO" to create manually.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="table-header">PO Number</th>
                      <th className="table-header">Customer</th>
                      <th className="table-header">Product</th>
                      <th className="table-header">Vendor</th>
                      <th className="table-header">Amount</th>
                      <th className="table-header">Received</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {customerOrders.map((po) => (
                      <tr key={po._id} className="hover:bg-violet-50/20 transition-colors">
                        <td className="table-cell font-mono font-medium text-violet-700">{po.poNumber}</td>
                        <td className="table-cell">
                          <p className="font-medium text-gray-800">{(po.leadId as Lead)?.companyName}</p>
                          {(po.leadId as Lead)?.contactPersonName && <p className="text-xs text-gray-500">{(po.leadId as Lead).contactPersonName}</p>}
                          {(po.leadId as Lead)?.email && <p className="text-xs text-gray-400">{(po.leadId as Lead).email}</p>}
                        </td>
                        <td className="table-cell text-gray-500">{po.product || '—'}</td>
                        <td className="table-cell">
                          {po.vendorName ? (
                            <div>
                              <p className="text-sm text-gray-700">{po.vendorName}</p>
                              {po.vendorEmail && <p className="text-xs text-gray-400">{po.vendorEmail}</p>}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">Not set</span>
                          )}
                        </td>
                        <td className="table-cell font-semibold text-green-700">{formatCurrency(po.amount)}</td>
                        <td className="table-cell text-gray-400">{formatDate(po.receivedDate)}</td>
                        <td className="table-cell">
                          {po.vendorEmailSent ? (
                            <span className="badge text-xs bg-emerald-100 text-emerald-700">Sent to Vendor</span>
                          ) : (
                            <span className="badge text-xs bg-blue-100 text-blue-600">Received</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Edit - always available */}
                            <button
                              title="Edit PO"
                              onClick={() => openEdit(po)}
                              className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
                            >
                              <Edit size={13} />
                            </button>
                            {/* Send to Vendor */}
                            {!po.vendorEmailSent && (
                              <button
                                title="Send to Vendor"
                                onClick={() => openSendModal(po)}
                                className="p-1.5 rounded-lg transition-colors bg-blue-50 text-blue-600 hover:bg-blue-100"
                              >
                                <Send size={13} />
                              </button>
                            )}
                            {/* Convert to Account */}
                            {po.vendorEmailSent && !(po as any).converted && (
                              <button
                                title="Convert to Account"
                                onClick={() => openConvert(po)}
                                className="p-1.5 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
                              >
                                <Building2 size={13} />
                              </button>
                            )}
                            {(po as any).converted && (
                              <span title="Converted to Account">
                                <CheckCircle size={14} className="text-emerald-500" />
                              </span>
                            )}
                            {/* Generate Invoice - only for sent POs */}
                            {po.vendorEmailSent && (
                              <button
                                title="Generate Invoice"
                                onClick={() => openGenerateInvoice(po)}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              >
                                <Receipt size={13} />
                              </button>
                            )}
                            {/* Delete */}
                            {(user?.role === 'admin' || user?.role === 'sales') && (
                              <button
                                title="Delete PO"
                                onClick={() => setDeleteTarget(po)}
                                className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                              >
                                <Trash2 size={13} />
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
        </>
      )}

      {/* Create PO Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Purchase Order" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Customer Section */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Customer</p>
            <div>
              <label className="label">Customer *</label>
              <select required className="input-field" value={createForm.leadId} onChange={(e) => setCreateForm(f => ({...f, leadId: e.target.value}))}>
                <option value="">Select customer</option>
                {leads.map(l => <option key={l._id} value={l._id}>{l.companyName}</option>)}
              </select>
            </div>
            {selectedLead && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Contact Person</label>
                  <input readOnly className="input-field bg-white text-gray-600" value={selectedLead.contactPersonName || '—'} />
                </div>
                <div>
                  <label className="label">Customer Email</label>
                  <input readOnly className="input-field bg-white text-gray-600" value={selectedLead.email || '—'} />
                </div>
              </div>
            )}
          </div>

          {/* Vendor Section */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Vendor</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Vendor Name</label>
                <input className="input-field" placeholder="Vendor company name" value={createForm.vendorName} onChange={(e) => setCreateForm(f => ({...f, vendorName: e.target.value}))} />
              </div>
              <div>
                <label className="label">Vendor Email</label>
                <input type="email" className="input-field" placeholder="vendor@example.com" value={createForm.vendorEmail} onChange={(e) => setCreateForm(f => ({...f, vendorEmail: e.target.value}))} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₹) *</label>
              <input required type="number" step="0.01" className="input-field" value={createForm.amount} onChange={(e) => setCreateForm(f => ({...f, amount: e.target.value}))} />
            </div>
            <div>
              <label className="label">Received Date *</label>
              <input required type="date" className="input-field" value={createForm.receivedDate} onChange={(e) => setCreateForm(f => ({...f, receivedDate: e.target.value}))} />
            </div>
            <div className="col-span-2">
              <label className="label">Product/Service</label>
              <input className="input-field" placeholder="e.g., Siemens PLC S7-1200" value={createForm.product} onChange={(e) => setCreateForm(f => ({...f, product: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={createForm.notes} onChange={(e) => setCreateForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save PO'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit PO Modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit PO — ${editTarget?.poNumber}`} size="lg">
        <form onSubmit={handleEdit} className="space-y-4">
          {/* Customer info (read-only) */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Customer</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Company</label>
                <input readOnly className="input-field bg-white text-gray-600" value={(editTarget?.leadId as Lead)?.companyName || '—'} />
              </div>
              <div>
                <label className="label">Contact Person</label>
                <input readOnly className="input-field bg-white text-gray-600" value={(editTarget?.leadId as Lead)?.contactPersonName || '—'} />
              </div>
              <div className="col-span-2">
                <label className="label">Customer Email</label>
                <input readOnly className="input-field bg-white text-gray-600" value={(editTarget?.leadId as Lead)?.email || '—'} />
              </div>
            </div>
          </div>

          {/* Vendor fields (editable) */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Vendor</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Vendor Name</label>
                <input className="input-field" value={editForm.vendorName} onChange={(e) => setEditForm(f => ({...f, vendorName: e.target.value}))} />
              </div>
              <div>
                <label className="label">Vendor Email</label>
                <input type="email" className="input-field" placeholder="vendor@example.com" value={editForm.vendorEmail} onChange={(e) => setEditForm(f => ({...f, vendorEmail: e.target.value}))} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₹) *</label>
              <input required type="number" step="0.01" className="input-field" value={editForm.amount} onChange={(e) => setEditForm(f => ({...f, amount: e.target.value}))} />
            </div>
            <div>
              <label className="label">Received Date</label>
              <input type="date" className="input-field" value={editForm.receivedDate} onChange={(e) => setEditForm(f => ({...f, receivedDate: e.target.value}))} />
            </div>
            <div className="col-span-2">
              <label className="label">Product/Service</label>
              <input className="input-field" value={editForm.product} onChange={(e) => setEditForm(f => ({...f, product: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={editForm.notes} onChange={(e) => setEditForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setEditTarget(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={editSaving} className="btn-primary">{editSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Convert to Account Modal */}
      <Modal isOpen={!!convertTarget} onClose={() => setConvertTarget(null)} title="Convert to Account">
        <form onSubmit={handleConvert} className="space-y-4">
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-sm text-violet-700">
            This will create a new <strong>Account</strong> from the lead <strong>{(convertTarget?.leadId as Lead)?.companyName}</strong> and mark it as Converted.
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
            <button type="button" onClick={() => setConvertTarget(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={converting} className="btn-primary">{converting ? 'Converting…' : 'Convert to Account'}</button>
          </div>
        </form>
      </Modal>

      {/* Generate Invoice Modal */}
      <Modal isOpen={!!invoiceTarget} onClose={() => setInvoiceTarget(null)} title={`Generate Invoice — ${invoiceTarget?.poNumber}`} size="lg">
        <form onSubmit={handleGenerateInvoice} className="space-y-4">
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Customer</span>
              <span className="font-semibold text-gray-800">{(invoiceTarget?.leadId as Lead)?.companyName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Product</span>
              <span className="font-semibold text-gray-800">{invoiceTarget?.product || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">PO Amount</span>
              <span className="font-bold text-emerald-700">{invoiceTarget ? formatCurrency(invoiceTarget.amount) : '—'}</span>
            </div>
          </div>

          <div>
            <label className="label">Bill To (Account) *</label>
            <select
              required
              className="input-field"
              value={invoiceForm.accountId}
              onChange={(e) => setInvoiceForm(f => ({ ...f, accountId: e.target.value }))}
            >
              <option value="">Select account</option>
              {invoiceAccounts.map(a => (
                <option key={a._id} value={a._id}>{a.accountName || (a as any).companyName}</option>
              ))}
            </select>
            {invoiceAccounts.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No accounts found. Convert PO to account first.</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Amount (₹) *</label>
              <input
                required type="number" className="input-field"
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Tax %</label>
              <input
                type="number" className="input-field" min="0" max="100"
                value={invoiceForm.taxPercent}
                onChange={(e) => setInvoiceForm(f => ({ ...f, taxPercent: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Due Date *</label>
              <input
                required type="date" className="input-field"
                value={invoiceForm.dueDate}
                onChange={(e) => setInvoiceForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>

          {invoiceForm.amount && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-gray-500">Total (with {invoiceForm.taxPercent}% tax)</span>
              <span className="font-bold text-emerald-700 text-base">
                {formatCurrency(Number(invoiceForm.amount) * (1 + Number(invoiceForm.taxPercent) / 100))}
              </span>
            </div>
          )}

          <div>
            <label className="label">Description</label>
            <input
              className="input-field" placeholder="e.g., Supply of Siemens PLC S7-1500"
              value={invoiceForm.description}
              onChange={(e) => setInvoiceForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              rows={2} className="input-field"
              value={invoiceForm.notes}
              onChange={(e) => setInvoiceForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => setInvoiceTarget(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={invoiceGenerating} className="btn-primary flex items-center gap-2">
              <Receipt size={14} /> {invoiceGenerating ? 'Generating…' : 'Generate Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Send to Vendor Modal */}
      <Modal isOpen={!!sendTarget} onClose={() => { setSendTarget(null); setSendVendorEmail(''); }} title={`Send PO to Vendor — ${sendTarget?.poNumber}`}>
        <form onSubmit={handleSendToVendor} className="space-y-4">
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-sm">
            <p><strong>Customer:</strong> {(sendTarget?.leadId as Lead)?.companyName}</p>
            <p className="mt-1"><strong>Product:</strong> {sendTarget?.product || '—'}</p>
            <p className="mt-1"><strong>Amount:</strong> {sendTarget ? formatCurrency(sendTarget.amount) : '—'}</p>
          </div>
          <div>
            <label className="label">Vendor Email *</label>
            <input
              required
              type="email"
              autoFocus
              className="input-field"
              placeholder="Enter vendor email to send PO"
              value={sendVendorEmail}
              onChange={(e) => setSendVendorEmail(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">The PO will be sent to this email address with PDF attachment.</p>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setSendTarget(null); setSendVendorEmail(''); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={sending} className="btn-primary flex items-center gap-2">
              <Mail size={14} />{sending ? 'Sending…' : 'Send to Vendor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Mark Vendor Paid Modal */}
      <Modal isOpen={!!payTarget} onClose={() => setPayTarget(null)} title={`Record Vendor Payment — ${payTarget?.poNumber}`}>
        <form onSubmit={handleMarkPaid} className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Vendor</span>
              <span className="font-semibold">{payTarget?.vendorName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">PO Amount</span>
              <span className="font-bold text-amber-700">{payTarget ? formatCurrency(payTarget.amount) : '—'}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount Paid (₹) *</label>
              <input required type="number" step="0.01" className="input-field" value={payForm.paidAmount} onChange={(e) => setPayForm(f => ({ ...f, paidAmount: e.target.value }))} />
            </div>
            <div>
              <label className="label">Payment Date *</label>
              <input required type="date" className="input-field" value={payForm.paidDate} onChange={(e) => setPayForm(f => ({ ...f, paidDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Payment Mode *</label>
            <select required className="input-field" value={payForm.paymentMode} onChange={(e) => setPayForm(f => ({ ...f, paymentMode: e.target.value }))}>
              {['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'Online'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Reference / Cheque No.</label>
            <input className="input-field" placeholder="Transaction ID, cheque number…" value={payForm.paymentReference} onChange={(e) => setPayForm(f => ({ ...f, paymentReference: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={payForm.paymentNotes} onChange={(e) => setPayForm(f => ({ ...f, paymentNotes: e.target.value }))} />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => setPayTarget(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={paying} className="btn-primary flex items-center gap-2">
              <CreditCard size={14} />{paying ? 'Saving…' : 'Mark as Paid'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Purchase Order"
        message={`Are you sure you want to delete PO ${deleteTarget?.poNumber}? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}