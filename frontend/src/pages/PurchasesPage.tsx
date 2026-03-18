import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Send, Building2, Pencil, CheckCircle } from 'lucide-react';
import { purchasesApi } from '@/api/purchases';
import { leadsApi } from '@/api/leads';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate, formatCurrency } from '@/utils/formatters';
import type { PurchaseOrder, Lead } from '@/types';

export default function PurchasesPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    leadId: '', amount: '', product: '', vendorName: '', vendorEmail: '', receivedDate: '', notes: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<PurchaseOrder | null>(null);
  const [editForm, setEditForm] = useState({
    amount: '', product: '', vendorName: '', vendorEmail: '', notes: '',
  });
  const [editSaving, setEditSaving] = useState(false);

  // Convert modal
  const [convertTarget, setConvertTarget] = useState<PurchaseOrder | null>(null);
  const [convertForm, setConvertForm] = useState({ accountName: '', notes: '' });
  const [converting, setConverting] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      const res = await purchasesApi.getAll(params);
      setOrders(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) { console.error('PurchasesPage load:', err); setOrders([]); setTotal(0); } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    try { const res = await leadsApi.getAll({ limit: 200 }); setLeads(res.data || []); } catch (err) { console.error('openCreate:', err); setLeads([]); }
    setCreateForm({ leadId: '', amount: '', product: '', vendorName: '', vendorEmail: '', receivedDate: '', notes: '' });
    setFile(null);
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await purchasesApi.create({ ...createForm, amount: Number(createForm.amount) });
      setShowCreate(false);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create PO');
    } finally { setSaving(false); }
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditTarget(po);
    setEditForm({
      amount: String(po.amount),
      product: po.product || '',
      vendorName: po.vendorName || '',
      vendorEmail: po.vendorEmail || '',
      notes: po.notes || '',
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await purchasesApi.update(editTarget._id, { ...editForm, amount: Number(editForm.amount) });
      setEditTarget(null);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update PO');
    } finally { setEditSaving(false); }
  };

  const handleSendToVendor = async (po: PurchaseOrder) => {
    if (!po.vendorEmail) {
      alert('Please add a vendor email before sending. Click the edit button to add one.');
      return;
    }
    setActionLoading(po._id + 'send');
    try {
      await purchasesApi.sendToVendor(po._id);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to send to vendor');
    } finally { setActionLoading(null); }
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
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to convert to account');
    } finally { setConverting(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add PO
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" className="input-field pl-9" />
      </div>

      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : orders.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No purchase orders found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">PO Number</th>
                  <th className="table-header">Lead</th>
                  <th className="table-header">Product</th>
                  <th className="table-header">Vendor</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Received</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((po) => (
                  <tr key={po._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-mono font-medium text-violet-700">{po.poNumber}</td>
                    <td className="table-cell font-medium">{(po.leadId as Lead)?.companyName}</td>
                    <td className="table-cell text-gray-500">{po.product || '—'}</td>
                    <td className="table-cell">
                      {po.vendorName ? (
                        <div>
                          <p className="text-sm text-gray-700">{po.vendorName}</p>
                          {po.vendorEmail && <p className="text-xs text-gray-400">{po.vendorEmail}</p>}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="table-cell font-semibold text-green-700">{formatCurrency(po.amount)}</td>
                    <td className="table-cell text-gray-400">{formatDate(po.receivedDate)}</td>
                    <td className="table-cell">
                      {po.vendorEmailSent ? (
                        <span className="badge text-xs bg-emerald-100 text-emerald-700">Sent to Vendor</span>
                      ) : (
                        <span className="badge text-xs bg-gray-100 text-gray-500">Pending</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Edit — only if not yet sent */}
                        {!po.vendorEmailSent && (
                          <button
                            title="Edit PO"
                            onClick={() => openEdit(po)}
                            className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {/* Send to Vendor */}
                        {!po.vendorEmailSent && (
                          <button
                            title={po.vendorEmail ? 'Send to Vendor' : 'Add vendor email first'}
                            disabled={actionLoading === po._id + 'send'}
                            onClick={() => handleSendToVendor(po)}
                            className={`p-1.5 rounded-lg transition-colors ${po.vendorEmail ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
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

      {/* Create PO Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Purchase Order" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Lead *</label>
            <select required className="input-field" value={createForm.leadId} onChange={(e) => setCreateForm(f => ({...f, leadId: e.target.value}))}>
              <option value="">Select lead</option>
              {leads.map(l => <option key={l._id} value={l._id}>{l.companyName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₹) *</label>
              <input required type="number" className="input-field" value={createForm.amount} onChange={(e) => setCreateForm(f => ({...f, amount: e.target.value}))} />
            </div>
            <div>
              <label className="label">Received Date *</label>
              <input required type="date" className="input-field" value={createForm.receivedDate} onChange={(e) => setCreateForm(f => ({...f, receivedDate: e.target.value}))} />
            </div>
            <div>
              <label className="label">Product</label>
              <input className="input-field" placeholder="e.g. Siemens PLC S7-1200" value={createForm.product} onChange={(e) => setCreateForm(f => ({...f, product: e.target.value}))} />
            </div>
            <div>
              <label className="label">Vendor Name</label>
              <input className="input-field" placeholder="Vendor company name" value={createForm.vendorName} onChange={(e) => setCreateForm(f => ({...f, vendorName: e.target.value}))} />
            </div>
            <div className="col-span-2">
              <label className="label">Vendor Email</label>
              <input type="email" className="input-field" placeholder="vendor@example.com" value={createForm.vendorEmail} onChange={(e) => setCreateForm(f => ({...f, vendorEmail: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="label">Upload Document (optional)</label>
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" className="input-field" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit PO — ${editTarget?.poNumber}`}>
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₹) *</label>
              <input required type="number" className="input-field" value={editForm.amount} onChange={(e) => setEditForm(f => ({...f, amount: e.target.value}))} />
            </div>
            <div>
              <label className="label">Product</label>
              <input className="input-field" value={editForm.product} onChange={(e) => setEditForm(f => ({...f, product: e.target.value}))} />
            </div>
            <div>
              <label className="label">Vendor Name</label>
              <input className="input-field" value={editForm.vendorName} onChange={(e) => setEditForm(f => ({...f, vendorName: e.target.value}))} />
            </div>
            <div>
              <label className="label">Vendor Email</label>
              <input type="email" className="input-field" value={editForm.vendorEmail} onChange={(e) => setEditForm(f => ({...f, vendorEmail: e.target.value}))} />
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
    </div>
  );
}
