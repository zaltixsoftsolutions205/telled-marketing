import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, FileText, CreditCard, Download, Receipt, TrendingUp, AlertCircle, Building2, Users } from 'lucide-react';
import ExcelImportButton from '@/components/common/ExcelImportButton';
import { invoicesApi } from '@/api/invoices';
import { accountsApi } from '@/api/accounts';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import type { Invoice, Account } from '@/types';

const PAYMENT_MODES = ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'Online'];

type TypeTab = 'all' | 'customer' | 'vendor';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeTab, setTypeTab] = useState<TypeTab>('all');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ accountId: '', amount: '', dueDate: '', notes: '' });
  const [payForm, setPayForm] = useState({ amount: '', paymentDate: new Date().toISOString().slice(0, 10), mode: 'Bank Transfer', reference: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<{ total?: number; totalAmount?: number; collected?: number; outstanding?: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeTab !== 'all') params.invoiceType = typeTab;
      const res = await invoicesApi.getAll(params);
      setInvoices(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) { console.error('InvoicesPage load:', err); setInvoices([]); setTotal(0); } finally { setLoading(false); }
  }, [page, search, statusFilter, typeTab]);

  const loadStats = useCallback(async () => {
    try {
      const s = await invoicesApi.getStats();
      setStats(s);
    } catch (_e) { /* stats optional */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const openCreate = async () => {
    try {
      const res = await accountsApi.getAll({ limit: 100 });
      setAccounts(res.data || []);
    } catch (err) { console.error('openCreate:', err); }
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
      loadStats();
    } finally { setSaving(false); }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await invoicesApi.recordPayment(selected._id, {
        amountPaid: Number(payForm.amount),
        paymentDate: payForm.paymentDate,
        mode: payForm.mode,
        referenceNumber: payForm.reference,
        notes: payForm.notes,
      });
      setShowPayment(false);
      load();
      loadStats();
    } finally { setSaving(false); }
  };

  const totalAmount = stats?.totalAmount ?? invoices.reduce((s, i) => s + i.amount, 0);
  const collected = stats?.collected ?? invoices.reduce((s, i) => s + i.paidAmount, 0);
  const outstanding = stats?.outstanding ?? (totalAmount - collected);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExcelImportButton
            entityName="Invoices"
            columnHint="accountName, amount, dueDate (YYYY-MM-DD), notes"
            onImport={async (rows) => {
              let imported = 0;
              const accs = await accountsApi.getAll({ limit: 500 });
              const accList: { _id: string; accountName: string }[] = accs.data || [];
              for (const row of rows) {
                const amount = parseFloat(row.amount || row.Amount || '0');
                if (!amount) continue;
                const name = (row.accountName || row.account || '').toLowerCase();
                const acc = accList.find(a => a.accountName.toLowerCase().includes(name));
                if (!acc) continue;
                try {
                  await invoicesApi.create({ accountId: acc._id, amount, dueDate: row.dueDate || row['due date'] || '', notes: row.notes || '' });
                  imported++;
                } catch { /* skip */ }
              }
              load();
              return { imported };
            }}
          />
          <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={16} /> New Invoice</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Receipt size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats?.total ?? total}</p>
            <p className="text-xs text-gray-400">Total Invoices</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} className="text-violet-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-gray-400">Total Amount</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <CreditCard size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(collected)}</p>
            <p className="text-xs text-gray-400">Collected</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(outstanding)}</p>
            <p className="text-xs text-gray-400">Outstanding</p>
          </div>
        </div>
      </div>

      {/* Type tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {([
          { key: 'all',      label: 'All Invoices',      icon: FileText },
          { key: 'customer', label: 'Customer Invoices',  icon: Users },
          { key: 'vendor',   label: 'Vendor / ARK Invoices', icon: Building2 },
        ] as { key: TypeTab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setTypeTab(key); setPage(1); }}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
              typeTab === key
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-violet-600'
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" className="input-field pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Statuses</option>
          {['Draft', 'Sent', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Desktop Table */}
      <div className="glass-card !p-0 overflow-hidden hidden md:block">
        {loading ? <LoadingSpinner className="h-48" /> : invoices.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No invoices found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Invoice #</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Party</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Paid</th>
                  <th className="table-header">Due Date</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv) => {
                  const isVendor = inv.invoiceType === 'vendor';
                  const partyName = isVendor
                    ? (inv.vendorName || 'ARK / Vendor')
                    : ((inv.accountId as any)?.accountName || (inv.accountId as any)?.companyName || (inv.leadId as any)?.companyName || '—');
                  return (
                  <tr
                    key={inv._id}
                    className={`hover:bg-violet-50/20 transition-colors ${inv.status === 'Overdue' ? 'bg-red-50/40' : ''}`}
                  >
                    <td className="table-cell font-mono font-medium text-sm">{inv.invoiceNumber}</td>
                    <td className="table-cell">
                      <span className={cn('badge text-xs', isVendor ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700')}>
                        {isVendor ? 'Vendor' : 'Customer'}
                      </span>
                    </td>
                    <td className="table-cell text-gray-700 font-medium text-sm">{partyName}</td>
                    <td className="table-cell font-semibold">{formatCurrency(inv.totalAmount ?? inv.amount)}</td>
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
                        {((inv as any).pdfUrl || inv.pdfPath) && (
                          <a
                            href={`/uploads/${(inv as any).pdfUrl || inv.pdfPath}`}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 hover:text-violet-600 text-gray-400"
                            title="Download Invoice PDF"
                          >
                            <Download size={15} />
                          </a>
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

      {/* Mobile Card View */}
      {loading ? (
        <LoadingSpinner className="h-48 md:hidden" />
      ) : invoices.length === 0 ? (
        <div className="md:hidden text-center text-gray-400 py-16 glass-card">No invoices found</div>
      ) : (
        <div className="md:hidden space-y-3">
          {invoices.map((inv) => {
            const isVendor = inv.invoiceType === 'vendor';
            const partyName = isVendor
              ? (inv.vendorName || 'ARK / Vendor')
              : ((inv.accountId as any)?.accountName || (inv.accountId as any)?.companyName || (inv.leadId as any)?.companyName || '—');
            return (
              <div key={inv._id} className={`glass-card !p-4 space-y-2 ${inv.status === 'Overdue' ? 'border-red-200' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-semibold text-gray-800 text-sm">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{partyName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={inv.status} />
                    <span className={cn('badge text-xs', isVendor ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700')}>
                      {isVendor ? 'Vendor' : 'Customer'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span><span className="text-gray-400">Amount:</span> <span className="font-semibold text-gray-800">{formatCurrency(inv.totalAmount ?? inv.amount)}</span></span>
                  <span><span className="text-gray-400">Paid:</span> <span className="text-green-700 font-medium">{formatCurrency(inv.paidAmount)}</span></span>
                </div>
                <div className="text-xs text-gray-500">
                  <span className="text-gray-400">Due:</span> {formatDate(inv.dueDate)}
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                    <button onClick={() => { setSelected(inv); setPayForm(f => ({...f, amount: String(inv.amount - inv.paidAmount)})); setShowPayment(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium">
                      <CreditCard size={12} /> Record Payment
                    </button>
                  )}
                  {((inv as any).pdfUrl || inv.pdfPath) && (
                    <a href={`/uploads/${(inv as any).pdfUrl || inv.pdfPath}`} download target="_blank" rel="noreferrer"
                      className="p-1.5 rounded-md hover:bg-violet-100 hover:text-violet-600 text-gray-400">
                      <Download size={14} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {total > 15 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 15)}</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
                <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

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
