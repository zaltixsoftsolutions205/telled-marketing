import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, FileText, CreditCard } from 'lucide-react';
import { invoicesApi } from '@/api/invoices';
import { accountsApi } from '@/api/accounts';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate, formatCurrency } from '@/utils/formatters';
import type { Invoice, Account } from '@/types';

const PAYMENT_MODES = ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'Online'];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ accountId: '', amount: '', dueDate: '', notes: '' });
  const [payForm, setPayForm] = useState({ amount: '', paymentDate: new Date().toISOString().slice(0, 10), mode: 'Bank Transfer', reference: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await invoicesApi.getAll(params);
      setInvoices(res.data);
      setTotal(res.pagination?.total ?? 0);
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    const res = await accountsApi.getAll({ limit: 100 });
    setAccounts(res.data);
    setShowCreate(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await invoicesApi.create(form);
      setShowCreate(false);
      setForm({ accountId: '', amount: '', dueDate: '', notes: '' });
      load();
    } finally { setSaving(false); }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await invoicesApi.recordPayment(selected._id, payForm);
      setShowPayment(false);
      load();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={16} /> New Invoice</button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" className="input-field pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Statuses</option>
          {['Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : invoices.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No invoices found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Invoice #</th>
                  <th className="table-header">Account</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Paid</th>
                  <th className="table-header">Due Date</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-mono font-medium text-sm">{inv.invoiceNumber}</td>
                    <td className="table-cell">{(inv.accountId as Account)?.accountName}</td>
                    <td className="table-cell font-semibold">{formatCurrency(inv.amount)}</td>
                    <td className="table-cell text-green-700">{formatCurrency(inv.paidAmount)}</td>
                    <td className="table-cell text-gray-400">{formatDate(inv.dueDate)}</td>
                    <td className="table-cell"><StatusBadge status={inv.status} /></td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                          <button onClick={() => { setSelected(inv); setPayForm(f => ({...f, amount: String(inv.amount - inv.paidAmount)})); setShowPayment(true); }} className="p-1 hover:text-green-600 text-gray-400" title="Record Payment">
                            <CreditCard size={15} />
                          </button>
                        )}
                        {inv.pdfPath && (
                          <a href={`/uploads/${inv.pdfPath}`} target="_blank" rel="noreferrer" className="p-1 hover:text-violet-600 text-gray-400">
                            <FileText size={15} />
                          </a>
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

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Invoice">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Account *</label>
            <select required className="input-field" value={form.accountId} onChange={(e) => setForm(f => ({...f, accountId: e.target.value}))}>
              <option value="">Select account</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.accountName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₹) *</label>
              <input required type="number" className="input-field" value={form.amount} onChange={(e) => setForm(f => ({...f, amount: e.target.value}))} />
            </div>
            <div>
              <label className="label">Due Date *</label>
              <input required type="date" className="input-field" value={form.dueDate} onChange={(e) => setForm(f => ({...f, dueDate: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create Invoice'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showPayment} onClose={() => setShowPayment(false)} title={`Record Payment — ${selected?.invoiceNumber}`}>
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₹) *</label>
              <input required type="number" className="input-field" value={payForm.amount} onChange={(e) => setPayForm(f => ({...f, amount: e.target.value}))} />
            </div>
            <div>
              <label className="label">Payment Date *</label>
              <input required type="date" className="input-field" value={payForm.paymentDate} onChange={(e) => setPayForm(f => ({...f, paymentDate: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="label">Payment Mode *</label>
            <select required className="input-field" value={payForm.mode} onChange={(e) => setPayForm(f => ({...f, mode: e.target.value}))}>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Reference</label>
            <input className="input-field" value={payForm.reference} onChange={(e) => setPayForm(f => ({...f, reference: e.target.value}))} placeholder="UTR / Cheque number" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowPayment(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Record Payment'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
