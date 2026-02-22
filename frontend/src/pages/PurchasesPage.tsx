import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Paperclip } from 'lucide-react';
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
  const [showModal, setShowModal] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [form, setForm] = useState({ leadId: '', amount: '', receivedDate: '', notes: '' });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      const res = await purchasesApi.getAll(params);
      setOrders(res.data);
      setTotal(res.pagination?.total ?? 0);
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const openModal = async () => {
    const res = await leadsApi.getAll({ limit: 100 });
    setLeads(res.data);
    setShowModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (file) fd.append('document', file);
      await purchasesApi.create(fd);
      setShowModal(false);
      setForm({ leadId: '', amount: '', receivedDate: '', notes: '' });
      setFile(null);
      load();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add PO</button>
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
                  <th className="table-header">Amount</th>
                  <th className="table-header">Received Date</th>
                  <th className="table-header">Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((po) => (
                  <tr key={po._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-mono font-medium">{po.poNumber}</td>
                    <td className="table-cell">{(po.leadId as Lead)?.companyName}</td>
                    <td className="table-cell font-semibold text-green-700">{formatCurrency(po.amount)}</td>
                    <td className="table-cell text-gray-400">{formatDate(po.receivedDate)}</td>
                    <td className="table-cell">
                      {po.documentPath ? (
                        <a href={`/uploads/${po.documentPath}`} target="_blank" rel="noreferrer" className="text-violet-600 hover:text-violet-800 flex items-center gap-1">
                          <Paperclip size={14} /> View
                        </a>
                      ) : <span className="text-gray-300">—</span>}
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Purchase Order">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Lead *</label>
            <select required className="input-field" value={form.leadId} onChange={(e) => setForm(f => ({...f, leadId: e.target.value}))}>
              <option value="">Select lead</option>
              {leads.map(l => <option key={l._id} value={l._id}>{l.companyName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₹) *</label>
              <input required type="number" className="input-field" value={form.amount} onChange={(e) => setForm(f => ({...f, amount: e.target.value}))} />
            </div>
            <div>
              <label className="label">Received Date *</label>
              <input required type="date" className="input-field" value={form.receivedDate} onChange={(e) => setForm(f => ({...f, receivedDate: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="label">Upload Document (optional)</label>
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" className="input-field" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
