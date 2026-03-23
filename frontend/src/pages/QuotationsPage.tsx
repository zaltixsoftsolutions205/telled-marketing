// import { useEffect, useState, useCallback } from 'react';
// import { Plus, Search, FileText, Mail, Check, X, Download } from 'lucide-react';
// import { quotationsApi } from '@/api/quotations';
// import { leadsApi } from '@/api/leads';
// import { drfApi } from '@/api/drf';
// import LoadingSpinner from '@/components/common/LoadingSpinner';
// import Modal from '@/components/common/Modal';
// import { formatDate, formatCurrency } from '@/utils/formatters';
// import type { Quotation, Lead, QuotationItem, QuotationStatus } from '@/types';

// const emptyItem: QuotationItem = { description: '', quantity: 1, unitPrice: 0, total: 0 };

// const STATUS_COLORS: Record<QuotationStatus, string> = {
//   'Sent':     'bg-blue-100 text-blue-700',
//   'Accepted': 'bg-emerald-100 text-emerald-700',
//   'Rejected': 'bg-red-100 text-red-600',
// };

// export default function QuotationsPage() {
//   const [quotations, setQuotations] = useState<Quotation[]>([]);
//   const [total, setTotal] = useState(0);
//   const [page, setPage] = useState(1);
//   const [search, setSearch] = useState('');
//   const [loading, setLoading] = useState(true);
//   const [showModal, setShowModal] = useState(false);
//   const [leads, setLeads] = useState<Lead[]>([]);
//   const [items, setItems] = useState<QuotationItem[]>([{ ...emptyItem }]);
//   const [form, setForm] = useState({ leadId: '', taxRate: 18, validUntil: '', terms: '', notes: '' });
//   const [saving, setSaving] = useState(false);
//   const [createError, setCreateError] = useState('');
//   const [actionLoading, setActionLoading] = useState<string | null>(null);

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const params: Record<string, unknown> = { page, limit: 15 };
//       if (search) params.search = search;
//       const res = await quotationsApi.getAll(params);
//       setQuotations(res.data || []);
//       setTotal(res.pagination?.total ?? 0);
//     } catch (err) { console.error('QuotationsPage load:', err); setQuotations([]); setTotal(0); } finally { setLoading(false); }
//   }, [page, search]);

//   useEffect(() => { load(); }, [load]);

//   const openModal = async () => {
//     setCreateError('');
//     setItems([{ ...emptyItem }]);
//     setForm({ leadId: '', taxRate: 18, validUntil: '', terms: '', notes: '' });

//     // Load leads that have an approved DRF
//     try {
//       const [leadsRes, drfRes] = await Promise.all([
//         leadsApi.getAll({ limit: 200 }),
//         drfApi.getAll({ status: 'Approved', limit: 200 }),
//       ]);
//       const approvedLeadIds = new Set((drfRes.data || []).map((d: any) => d.leadId?._id));
//       setLeads((leadsRes.data || []).filter((l: Lead) => approvedLeadIds.has(l._id)));
//     } catch (err) { console.error('openModal:', err); setLeads([]); }
//     setShowModal(true);
//   };

//   const updateItem = (index: number, field: keyof QuotationItem, value: string | number) => {
//     setItems(prev => {
//       const next = [...prev];
//       next[index] = { ...next[index], [field]: value };
//       if (field === 'quantity' || field === 'unitPrice') {
//         next[index].total = Number(next[index].quantity) * Number(next[index].unitPrice);
//       }
//       return next;
//     });
//   };

//   const subtotal = items.reduce((sum, i) => sum + (i.total || 0), 0);
//   const taxAmount = subtotal * (Number(form.taxRate) / 100);
//   const total2 = subtotal + taxAmount;

//   const handleCreate = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setSaving(true);
//     setCreateError('');
//     try {
//       await quotationsApi.create({ ...form, items });
//       setShowModal(false);
//       load();
//     } catch (err: any) {
//       setCreateError(err?.response?.data?.message || 'Failed to create quotation');
//     } finally { setSaving(false); }
//   };

//   const handleAction = async (action: 'accept' | 'reject' | 'sendEmail' | 'generatePDF', id: string) => {
//     setActionLoading(id + action);
//     try {
//       if (action === 'accept') await quotationsApi.accept(id);
//       else if (action === 'reject') await quotationsApi.reject(id);
//       else if (action === 'sendEmail') await quotationsApi.sendEmail(id);
//       else if (action === 'generatePDF') await quotationsApi.generatePDF(id);
//       load();
//     } catch (err: any) {
//       alert(err?.response?.data?.message || 'Action failed');
//     } finally { setActionLoading(null); }
//   };

//   return (
//     <div className="space-y-6 animate-fade-in">
//       <div className="flex items-center justify-between">
//         <div>
//           <h1 className="page-header">Quotations</h1>
//           <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
//         </div>
//         <button onClick={openModal} className="btn-primary flex items-center gap-2">
//           <Plus size={16} /> New Quotation
//         </button>
//       </div>

//       <div className="relative max-w-xs">
//         <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
//         <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" className="input-field pl-9" />
//       </div>

//       <div className="glass-card !p-0 overflow-hidden">
//         {loading ? <LoadingSpinner className="h-48" /> : quotations.length === 0 ? (
//           <div className="text-center text-gray-400 py-16">No quotations found</div>
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full">
//               <thead className="bg-gray-50 border-b border-gray-100">
//                 <tr>
//                   <th className="table-header">Quotation #</th>
//                   <th className="table-header">Lead</th>
//                   <th className="table-header">Ver.</th>
//                   <th className="table-header">Subtotal</th>
//                   <th className="table-header">Total</th>
//                   <th className="table-header">Valid Until</th>
//                   <th className="table-header">Status</th>
//                   <th className="table-header">Actions</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-gray-50">
//                 {quotations.map((q) => (
//                   <tr key={q._id} className="hover:bg-violet-50/20 transition-colors">
//                     <td className="table-cell font-mono font-medium text-violet-700">{q.quotationNumber}</td>
//                     <td className="table-cell font-medium">{(q.leadId as Lead)?.companyName}</td>
//                     <td className="table-cell text-center">
//                       <span className={`badge text-xs ${q.version > 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
//                         v{q.version}
//                       </span>
//                     </td>
//                     <td className="table-cell text-gray-500">{formatCurrency(q.subtotal)}</td>
//                     <td className="table-cell font-semibold text-violet-700">{formatCurrency(q.total)}</td>
//                     <td className="table-cell text-gray-400">{q.validUntil ? formatDate(q.validUntil) : '—'}</td>
//                     <td className="table-cell">
//                       <span className={`badge text-xs ${STATUS_COLORS[q.status as QuotationStatus] || 'bg-gray-100 text-gray-600'}`}>
//                         {q.status}
//                       </span>
//                     </td>
//                     <td className="table-cell">
//                       <div className="flex items-center gap-1.5 flex-wrap">
//                         {/* Accept / Reject — only when Sent */}
//                         {q.status === 'Sent' && (
//                           <>
//                             <button
//                               title="Accept"
//                               disabled={actionLoading === q._id + 'accept'}
//                               onClick={() => handleAction('accept', q._id)}
//                               className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
//                             >
//                               <Check size={13} />
//                             </button>
//                             <button
//                               title="Reject"
//                               disabled={actionLoading === q._id + 'reject'}
//                               onClick={() => handleAction('reject', q._id)}
//                               className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
//                             >
//                               <X size={13} />
//                             </button>
//                           </>
//                         )}
//                         {/* Send Email */}
//                         <button
//                           title={q.emailSent ? `Email sent ${q.emailSentAt ? formatDate(q.emailSentAt) : ''}` : 'Send via Email'}
//                           disabled={!!q.emailSent || actionLoading === q._id + 'sendEmail'}
//                           onClick={() => !q.emailSent && handleAction('sendEmail', q._id)}
//                           className={`p-1.5 rounded-lg transition-colors ${q.emailSent ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
//                         >
//                           <Mail size={13} />
//                         </button>
//                         {/* Generate PDF */}
//                         <button
//                           title={q.pdfPath ? 'PDF ready' : 'Generate PDF'}
//                           disabled={actionLoading === q._id + 'generatePDF'}
//                           onClick={() => handleAction('generatePDF', q._id)}
//                           className={`p-1.5 rounded-lg transition-colors ${q.pdfPath ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
//                         >
//                           {q.pdfPath ? <Download size={13} /> : <FileText size={13} />}
//                         </button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//         {total > 15 && (
//           <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
//             <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 15)}</p>
//             <div className="flex gap-2">
//               <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
//               <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Create Quotation Modal */}
//       <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Quotation" size="xl">
//         <form onSubmit={handleCreate} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
//           {createError && (
//             <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
//               {createError}
//             </div>
//           )}

//           {leads.length === 0 ? (
//             <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
//               <p className="font-semibold mb-1">No eligible leads</p>
//               <p className="text-xs">A quotation can only be created for leads with an <strong>Approved DRF</strong>. Approve a DRF first.</p>
//             </div>
//           ) : (
//             <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs text-violet-700">
//               Only leads with an <strong>Approved DRF</strong> are shown below.
//             </div>
//           )}

//           <div className="grid grid-cols-2 gap-4">
//             <div>
//               <label className="label">Lead *</label>
//               <select required className="input-field" value={form.leadId} onChange={(e) => setForm(f => ({...f, leadId: e.target.value}))}>
//                 <option value="">Select lead</option>
//                 {leads.map(l => <option key={l._id} value={l._id}>{l.companyName}</option>)}
//               </select>
//             </div>
//             <div>
//               <label className="label">Tax Rate (%)</label>
//               <input type="number" className="input-field" value={form.taxRate} onChange={(e) => setForm(f => ({...f, taxRate: Number(e.target.value)}))} />
//             </div>
//             <div>
//               <label className="label">Valid Until</label>
//               <input type="date" className="input-field" value={form.validUntil} onChange={(e) => setForm(f => ({...f, validUntil: e.target.value}))} />
//             </div>
//           </div>

//           {/* Line Items */}
//           <div>
//             <div className="flex items-center justify-between mb-2">
//               <label className="label !mb-0">Line Items</label>
//               <button type="button" onClick={() => setItems(p => [...p, {...emptyItem}])} className="text-xs text-violet-600 hover:text-violet-800 font-medium">+ Add Row</button>
//             </div>
//             <div className="space-y-2">
//               {items.map((item, i) => (
//                 <div key={i} className="grid grid-cols-12 gap-2 items-start">
//                   <div className="col-span-5">
//                     <input className="input-field text-sm" placeholder="Description" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} />
//                   </div>
//                   <div className="col-span-2">
//                     <input type="number" className="input-field text-sm" placeholder="Qty" min={1} value={item.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} />
//                   </div>
//                   <div className="col-span-3">
//                     <input type="number" className="input-field text-sm" placeholder="Unit Price" min={0} value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} />
//                   </div>
//                   <div className="col-span-2 flex items-center gap-1">
//                     <span className="text-sm font-medium text-gray-700 flex-1">{formatCurrency(item.total)}</span>
//                     {items.length > 1 && (
//                       <button type="button" onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
//                     )}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* Totals */}
//           <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
//             <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
//             <div className="flex justify-between"><span className="text-gray-500">Tax ({form.taxRate}%)</span><span>{formatCurrency(taxAmount)}</span></div>
//             <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
//               <span>Total</span><span className="text-violet-700">{formatCurrency(total2)}</span>
//             </div>
//           </div>

//           <div>
//             <label className="label">Terms & Conditions</label>
//             <textarea rows={2} className="input-field" value={form.terms} onChange={(e) => setForm(f => ({...f, terms: e.target.value}))} />
//           </div>

//           <div className="flex gap-3 justify-end sticky bottom-0 bg-white pt-2">
//             <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
//             <button type="submit" disabled={saving || leads.length === 0} className="btn-primary">
//               {saving ? 'Creating…' : 'Create Quotation'}
//             </button>
//           </div>
//         </form>
//       </Modal>
//     </div>
//   );
// }
import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, FileText, Mail, Check, X, Download, Edit, Send, Percent, Building2 } from 'lucide-react';
import { quotationsApi } from '@/api/quotations';
import { leadsApi } from '@/api/leads';
import { drfApi } from '@/api/drf';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate, formatCurrency } from '@/utils/formatters';
import type { Quotation, Lead, QuotationItem, QuotationStatus } from '@/types';

const emptyItem: QuotationItem = { description: '', quantity: 1, unitPrice: 0, total: 0 };

const STATUS_COLORS: Record<QuotationStatus, string> = {
  'Draft':      'bg-gray-100 text-gray-600',
  'Sent':       'bg-blue-100 text-blue-700',
  'Accepted':   'bg-emerald-100 text-emerald-700',
  'Rejected':   'bg-red-100 text-red-600',
  'Final':      'bg-purple-100 text-purple-700',
};

export default function QuotationsPage() {
  const [activeTab, setActiveTab] = useState<'customer' | 'vendor'>('customer');
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [items, setItems] = useState<QuotationItem[]>([{ ...emptyItem }]);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [form, setForm] = useState({
    leadId: '',
    taxRate: 18,
    gstApplicable: true,
    validUntil: '',
    terms: '',
    notes: '',
    finalAmount: 0,
    vendorEmail: '',
  });
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { 
        page, 
        limit: 15,
      };
      if (search) params.search = search;
      const res = await quotationsApi.getAll(params);
      setQuotations(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) { 
      console.error('QuotationsPage load:', err); 
      setQuotations([]); 
      setTotal(0); 
    } finally { 
      setLoading(false); 
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const openModal = async () => {
    setCreateError('');
    setItems([{ ...emptyItem }]);
    setForm({ 
      leadId: '', 
      taxRate: 18, 
      gstApplicable: true,
      validUntil: '', 
      terms: '', 
      notes: '',
      finalAmount: 0,
    });

    try {
      // Load leads that have an approved DRF for customer quotations
      const [leadsRes, drfRes] = await Promise.all([
        leadsApi.getAll({ limit: 200 }),
        drfApi.getAll({ status: 'Approved', limit: 200 }),
      ]);
      const approvedLeadIds = new Set((drfRes.data || []).map((d: any) => d.leadId?._id));
      setLeads((leadsRes.data || []).filter((l: Lead) => approvedLeadIds.has(l._id)));
    } catch (err) { 
      console.error('openModal:', err); 
      setLeads([]); 
    }
    setShowModal(true);
  };

  const openEditModal = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setItems(quotation.items || [{ ...emptyItem }]);
    setForm({
      leadId: quotation.leadId?._id || '',
      taxRate: quotation.taxRate || 18,
      gstApplicable: quotation.gstApplicable ?? true,
      validUntil: quotation.validUntil ? new Date(quotation.validUntil).toISOString().split('T')[0] : '',
      terms: quotation.terms || '',
      notes: quotation.notes || '',
      finalAmount: quotation.finalAmount || quotation.total || 0,
      vendorEmail: (quotation as any).vendorEmail || '',
    });
    setShowEditModal(true);
  };

  const openVendorModal = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setForm(prev => ({
      ...prev,
      finalAmount: quotation.finalAmount || quotation.total || 0,
    }));
    setShowVendorModal(true);
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

  const subtotal = items.reduce((sum, i) => sum + (i.total || 0), 0);
  const taxAmount = form.gstApplicable ? subtotal * (Number(form.taxRate) / 100) : 0;
  const total2 = subtotal + taxAmount;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setCreateError('');
    try {
      const payload = {
        ...form,
        items,
        status: 'Draft',
        subtotal,
        taxAmount,
        total: total2,
      };

      await quotationsApi.create(payload);
      setShowModal(false);
      load();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || 'Failed to create quotation');
    } finally { 
      setSaving(false); 
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuotation) return;
    
    setSaving(true);
    setCreateError('');
    try {
      const payload = {
        ...form,
        items,
        subtotal,
        taxAmount: form.gstApplicable ? taxAmount : 0,
        total: form.gstApplicable ? total2 : subtotal,
      };

      await quotationsApi.update(selectedQuotation._id, payload);
      setShowEditModal(false);
      setSelectedQuotation(null);
      load();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || 'Failed to update quotation');
    } finally { 
      setSaving(false); 
    }
  };

  const handleSendToVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuotation) return;
    
    setSaving(true);
    setCreateError('');
    try {
      // Update the quotation with final amount and mark as sent to vendor
      await quotationsApi.update(selectedQuotation._id, {
        finalAmount: form.finalAmount,
        status: 'Final',
        vendorSentAt: new Date().toISOString(),
      });
      
      setShowVendorModal(false);
      setSelectedQuotation(null);
      load();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || 'Failed to send to vendor');
    } finally { 
      setSaving(false); 
    }
  };

  const handleAction = async (action: 'accept' | 'reject' | 'sendEmail' | 'generatePDF' | 'finalize', id: string) => {
    setActionLoading(id + action);
    try {
      switch (action) {
        case 'accept':
          await quotationsApi.accept(id);
          break;
        case 'reject':
          await quotationsApi.reject(id);
          break;
        case 'sendEmail':
          await quotationsApi.sendEmail(id);
          break;
        case 'generatePDF':
          await quotationsApi.generatePDF(id);
          break;
        case 'finalize':
          await quotationsApi.finalize(id);
          break;
      }
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Action failed');
    } finally { 
      setActionLoading(null); 
    }
  };

  const getActionButtons = (q: Quotation) => {
    const buttons = [];

    // Edit always available for non-Final quotations
    buttons.push(
      <button
        key="edit"
        title="Edit Quotation"
        onClick={() => openEditModal(q)}
        className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <Edit size={13} />
      </button>
    );

    // Customer quotation actions
    if (q.status === 'Draft') {
      buttons.push(
        <button
          key="send"
          title="Send to Customer"
          disabled={actionLoading === q._id + 'sendEmail'}
          onClick={() => handleAction('sendEmail', q._id)}
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
        >
          <Mail size={13} />
        </button>,
        <button
          key="finalize"
          title="Finalize Quotation"
          onClick={() => handleAction('finalize', q._id)}
          className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
        >
          <Check size={13} />
        </button>
      );
    }

    if (q.status === 'Sent') {
      buttons.push(
        <button
          key="sendEmail"
          title={q.emailSent ? `Resend Email (last sent ${q.emailSentAt ? new Date(q.emailSentAt).toLocaleDateString() : ''})` : 'Send Email to Customer'}
          disabled={actionLoading === q._id + 'sendEmail'}
          onClick={() => handleAction('sendEmail', q._id)}
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
        >
          <Mail size={13} />
        </button>,
        <button
          key="accept"
          title="Accept"
          disabled={actionLoading === q._id + 'accept'}
          onClick={() => handleAction('accept', q._id)}
          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          <Check size={13} />
        </button>,
        <button
          key="reject"
          title="Reject"
          disabled={actionLoading === q._id + 'reject'}
          onClick={() => handleAction('reject', q._id)}
          className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
        >
          <X size={13} />
        </button>,
        <button
          key="vendor"
          title="Send to Vendor"
          onClick={() => openVendorModal(q)}
          className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
        >
          <Building2 size={13} />
        </button>
      );
    }

    if (q.status === 'Final') {
      buttons.push(
        <button
          key="vendor"
          title="Send to Vendor"
          onClick={() => openVendorModal(q)}
          className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
        >
          <Building2 size={13} />
        </button>
      );
    }

    // Common buttons for all quotations
    buttons.push(
      <button
        key="pdf"
        title={q.pdfPath ? 'Download PDF' : 'Generate PDF'}
        disabled={actionLoading === q._id + 'generatePDF'}
        onClick={() => handleAction('generatePDF', q._id)}
        className={`p-1.5 rounded-lg transition-colors ${
          q.pdfPath 
            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
        }`}
      >
        {q.pdfPath ? <Download size={13} /> : <FileText size={13} />}
      </button>
    );

    return buttons;
  };

  const customerQuotations = quotations.filter(q => q.status !== 'Final');
  const vendorQuotations   = quotations.filter(q => q.status === 'Final');
  const displayed = activeTab === 'customer' ? customerQuotations : vendorQuotations;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Quotations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        {activeTab === 'customer' && (
          <button onClick={openModal} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Quotation
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => { setActiveTab('customer'); setPage(1); }}
          className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'customer' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Customer Quotations
          <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{customerQuotations.length}</span>
        </button>
        <button
          onClick={() => { setActiveTab('vendor'); setPage(1); }}
          className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'vendor' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Vendor Quotations
          <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{vendorQuotations.length}</span>
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search quotations..."
          className="input-field pl-9"
        />
      </div>

      <div className="glass-card !p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="h-48" />
        ) : displayed.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            {activeTab === 'customer' ? 'No customer quotations found' : 'No vendor quotations yet — send a customer quotation to vendor first'}
          </div>
        ) : activeTab === 'customer' ? (
          /* ── CUSTOMER QUOTATIONS TABLE ── */
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
                      {q.gstApplicable ? (
                        <div className="flex items-center gap-1"><Percent size={12} />{q.taxRate}%</div>
                      ) : <span className="text-gray-400">N/A</span>}
                    </td>
                    <td className="table-cell font-semibold text-violet-700">{formatCurrency(q.total)}</td>
                    <td className="table-cell text-gray-400">{q.validUntil ? formatDate(q.validUntil) : '—'}</td>
                    <td className="table-cell">
                      <span className={`badge text-xs ${STATUS_COLORS[q.status as QuotationStatus] || 'bg-gray-100 text-gray-600'}`}>{q.status}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5 flex-wrap">{getActionButtons(q)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── VENDOR QUOTATIONS TABLE ── */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-amber-50 border-b border-amber-100">
                <tr>
                  <th className="table-header">Quotation #</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Ver.</th>
                  <th className="table-header">Original Total</th>
                  <th className="table-header">Final Amount (Vendor)</th>
                  <th className="table-header">Sent to Vendor</th>
                  <th className="table-header">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map((q) => (
                  <tr key={q._id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="table-cell font-mono font-medium text-amber-700">{q.quotationNumber}</td>
                    <td className="table-cell font-medium">{(q.leadId as Lead)?.companyName || '—'}</td>
                    <td className="table-cell text-center">
                      <span className="badge text-xs bg-gray-100 text-gray-500">v{q.version}</span>
                    </td>
                    <td className="table-cell text-gray-500">{formatCurrency(q.total)}</td>
                    <td className="table-cell font-bold text-amber-700 text-base">
                      {q.finalAmount ? formatCurrency(q.finalAmount) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="table-cell text-gray-400">
                      {(q as any).vendorSentAt ? formatDate((q as any).vendorSentAt) : <span className="badge bg-amber-100 text-amber-700">Sent</span>}
                    </td>
                    <td className="table-cell">
                      {q.pdfPath ? (
                        <button
                          title="Download PDF"
                          onClick={() => handleAction('generatePDF', q._id)}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                        >
                          <Download size={13} />
                        </button>
                      ) : (
                        <button
                          title="Generate PDF"
                          onClick={() => handleAction('generatePDF', q._id)}
                          className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          <FileText size={13} />
                        </button>
                      )}
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
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title="Create Quotation" 
        size="xl"
      >
        <form onSubmit={handleCreate} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {createError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {createError}
            </div>
          )}

          {leads.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">No eligible leads</p>
              <p className="text-xs">A quotation can only be created for leads with an <strong>Approved DRF</strong>.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Lead *</label>
              <select 
                required 
                className="input-field" 
                value={form.leadId} 
                onChange={(e) => setForm(f => ({...f, leadId: e.target.value}))}
              >
                <option value="">Select lead</option>
                {leads.map(l => (
                  <option key={l._id} value={l._id}>{l.companyName}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="label">Valid Until</label>
              <input 
                type="date" 
                className="input-field" 
                value={form.validUntil} 
                onChange={(e) => setForm(f => ({...f, validUntil: e.target.value}))} 
              />
            </div>
          </div>

          {/* GST Toggle */}
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.gstApplicable}
                onChange={(e) => setForm(f => ({...f, gstApplicable: e.target.checked}))}
                className="w-4 h-4 accent-violet-600"
              />
              <span className="text-sm font-medium text-gray-700">GST Applicable</span>
            </label>
            {form.gstApplicable && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Tax Rate:</span>
                <input
                  type="number"
                  className="input-field w-20 text-sm"
                  value={form.taxRate}
                  onChange={(e) => setForm(f => ({...f, taxRate: Number(e.target.value)}))}
                  min="0"
                  max="100"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label !mb-0">Line Items</label>
              <button 
                type="button" 
                onClick={() => setItems(p => [...p, {...emptyItem}])} 
                className="text-xs text-violet-600 hover:text-violet-800 font-medium"
              >
                + Add Row
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <input 
                      className="input-field text-sm" 
                      placeholder="Description" 
                      value={item.description} 
                      onChange={(e) => updateItem(i, 'description', e.target.value)} 
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number" 
                      className="input-field text-sm" 
                      placeholder="Qty" 
                      min={1} 
                      value={item.quantity} 
                      onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} 
                      required
                    />
                  </div>
                  <div className="col-span-3">
                    <input 
                      type="number" 
                      className="input-field text-sm" 
                      placeholder="Unit Price" 
                      min={0} 
                      step="0.01"
                      value={item.unitPrice} 
                      onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} 
                      required
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-700 flex-1">
                      {formatCurrency(item.total)}
                    </span>
                    {items.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} 
                        className="text-red-400 hover:text-red-600 text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {form.gstApplicable && (
              <div className="flex justify-between">
                <span className="text-gray-500">GST ({form.taxRate}%)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
              <span>Total</span>
              <span className="text-violet-700">{formatCurrency(total2)}</span>
            </div>
          </div>

          <div>
            <label className="label">Terms & Conditions</label>
            <textarea 
              rows={2} 
              className="input-field" 
              value={form.terms} 
              onChange={(e) => setForm(f => ({...f, terms: e.target.value}))} 
            />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea 
              rows={2} 
              className="input-field" 
              value={form.notes} 
              onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} 
            />
          </div>

          <div className="flex gap-3 justify-end sticky bottom-0 bg-white pt-2">
            <button 
              type="button" 
              onClick={() => setShowModal(false)} 
              className="btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving || leads.length === 0} 
              className="btn-primary"
            >
              {saving ? 'Creating...' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Quotation Modal */}
      <Modal 
        isOpen={showEditModal} 
        onClose={() => {
          setShowEditModal(false);
          setSelectedQuotation(null);
        }} 
        title="Edit Quotation" 
        size="xl"
      >
        <form onSubmit={handleEdit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {createError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {createError}
            </div>
          )}

          {/* GST Toggle */}
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.gstApplicable}
                onChange={(e) => setForm(f => ({...f, gstApplicable: e.target.checked}))}
                className="w-4 h-4 accent-violet-600"
              />
              <span className="text-sm font-medium text-gray-700">GST Applicable</span>
            </label>
            {form.gstApplicable && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Tax Rate:</span>
                <input
                  type="number"
                  className="input-field w-20 text-sm"
                  value={form.taxRate}
                  onChange={(e) => setForm(f => ({...f, taxRate: Number(e.target.value)}))}
                  min="0"
                  max="100"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label !mb-0">Line Items</label>
              <button 
                type="button" 
                onClick={() => setItems(p => [...p, {...emptyItem}])} 
                className="text-xs text-violet-600 hover:text-violet-800 font-medium"
              >
                + Add Row
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <input 
                      className="input-field text-sm" 
                      placeholder="Description" 
                      value={item.description} 
                      onChange={(e) => updateItem(i, 'description', e.target.value)} 
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number" 
                      className="input-field text-sm" 
                      placeholder="Qty" 
                      min={1} 
                      value={item.quantity} 
                      onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} 
                      required
                    />
                  </div>
                  <div className="col-span-3">
                    <input 
                      type="number" 
                      className="input-field text-sm" 
                      placeholder="Unit Price" 
                      min={0} 
                      step="0.01"
                      value={item.unitPrice} 
                      onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} 
                      required
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-700 flex-1">
                      {formatCurrency(item.total)}
                    </span>
                    {items.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} 
                        className="text-red-400 hover:text-red-600 text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {form.gstApplicable && (
              <div className="flex justify-between">
                <span className="text-gray-500">GST ({form.taxRate}%)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
              <span>Total</span>
              <span className="text-violet-700">{formatCurrency(total2)}</span>
            </div>
          </div>

          <div>
            <label className="label">Terms & Conditions</label>
            <textarea 
              rows={2} 
              className="input-field" 
              value={form.terms} 
              onChange={(e) => setForm(f => ({...f, terms: e.target.value}))} 
            />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              rows={2}
              className="input-field"
              value={form.notes}
              onChange={(e) => setForm(f => ({...f, notes: e.target.value}))}
            />
          </div>

          {/* Vendor section */}
          <div className="border border-amber-200 rounded-xl p-4 bg-amber-50 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Send to Vendor</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Vendor Email</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="vendor@company.com"
                  value={form.vendorEmail}
                  onChange={(e) => setForm(f => ({...f, vendorEmail: e.target.value}))}
                />
              </div>
              <div>
                <label className="label">Final Amount (₹)</label>
                <input
                  type="number"
                  className="input-field"
                  min="0"
                  step="0.01"
                  value={form.finalAmount}
                  onChange={(e) => setForm(f => ({...f, finalAmount: Number(e.target.value)}))}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end sticky bottom-0 bg-white pt-2">
            <button
              type="button"
              onClick={() => { setShowEditModal(false); setSelectedQuotation(null); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !form.vendorEmail}
              onClick={async () => {
                if (!selectedQuotation) return;
                setSaving(true);
                try {
                  await quotationsApi.update(selectedQuotation._id, {
                    ...form,
                    items,
                    subtotal,
                    taxAmount: form.gstApplicable ? taxAmount : 0,
                    total: form.gstApplicable ? total2 : subtotal,
                    status: 'Final',
                    vendorSentAt: new Date().toISOString(),
                  });
                  setShowEditModal(false);
                  setSelectedQuotation(null);
                  load();
                } catch { setCreateError('Failed to send to vendor'); }
                finally { setSaving(false); }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <Send size={14} /> Send to Vendor
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Send to Vendor Modal */}
      <Modal 
        isOpen={showVendorModal} 
        onClose={() => {
          setShowVendorModal(false);
          setSelectedQuotation(null);
        }} 
        title="Send to Vendor" 
        size="md"
      >
        <form onSubmit={handleSendToVendor} className="space-y-4">
          {createError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {createError}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
            <p className="text-sm text-amber-800 mb-2">
              You're about to send this quotation to a vendor. Please review and adjust the final amount if needed.
            </p>
            
            <div className="mt-4">
              <label className="label">Final Amount (including all costs)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">₹</span>
                <input
                  type="number"
                  className="input-field pl-8"
                  value={form.finalAmount}
                  onChange={(e) => setForm(f => ({...f, finalAmount: Number(e.target.value)}))}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Original amount: {formatCurrency(selectedQuotation?.total || 0)}
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <Mail size={16} className="text-gray-400" />
              An email will be sent to the vendor with this quotation
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button 
              type="button" 
              onClick={() => {
                setShowVendorModal(false);
                setSelectedQuotation(null);
              }} 
              className="btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving} 
              className="btn-primary flex items-center gap-2"
            >
              <Send size={16} />
              {saving ? 'Sending...' : 'Send to Vendor'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}