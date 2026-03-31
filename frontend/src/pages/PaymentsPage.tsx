import { useEffect, useState, useCallback } from 'react';
import { Search, CreditCard, TrendingUp, BarChart2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { invoicesApi } from '@/api/invoices';
import { purchasesApi } from '@/api/purchases';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { formatDate, formatCurrency } from '@/utils/formatters';
import type { Payment, Invoice, User, PurchaseOrder, Lead } from '@/types';

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const canSeeVendor = user?.role === 'admin' || user?.role === 'hr_finance';
  const [tab, setTab] = useState<'incoming' | 'vendor'>('incoming');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [vendorPos, setVendorPos] = useState<PurchaseOrder[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadIncoming = useCallback(async () => {
    try {
      const res = await invoicesApi.getAll({ limit: 200 });
      const allInvoices: Invoice[] = res.data || [];
      const paymentLists = await Promise.all(
        allInvoices.map((inv: Invoice) => invoicesApi.getPayments(inv._id).catch(() => []))
      );
      setPayments(paymentLists.flat());
    } catch (err) {
      console.error('PaymentsPage load:', err);
      setPayments([]);
    }
  }, []);

  const loadVendor = useCallback(async () => {
    if (!canSeeVendor) return;
    try {
      const res = await purchasesApi.getVendorPayments({ limit: 200 });
      setVendorPos(res.data || []);
    } catch {
      setVendorPos([]);
    }
  }, [canSeeVendor]);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadIncoming(), loadVendor()]);
    setLoading(false);
  }, [loadIncoming, loadVendor]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const thisMonthPayments = payments.filter(p => {
    const d = new Date(p.paymentDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalIncoming = payments.reduce((s, p) => s + (p.amountPaid ?? 0), 0);
  const totalVendor = vendorPos.reduce((s, po) => s + (po.paidAmount ?? po.amount), 0);
  const totalThisMonth = thisMonthPayments.reduce((s, p) => s + (p.amountPaid ?? 0), 0);

  const modeCounts: Record<string, number> = {};
  for (const p of payments) { modeCounts[p.mode] = (modeCounts[p.mode] || 0) + 1; }
  const topMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  const filteredIncoming = search
    ? payments.filter(p => {
        const inv = p.invoiceId as Invoice;
        return inv?.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
          p.mode?.toLowerCase().includes(search.toLowerCase()) ||
          p.referenceNumber?.toLowerCase().includes(search.toLowerCase());
      })
    : payments;

  const filteredVendor = search
    ? vendorPos.filter(po =>
        po.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
        po.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
        (po.leadId as Lead)?.companyName?.toLowerCase().includes(search.toLowerCase())
      )
    : vendorPos;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Payments</h1>
        <p className="text-sm text-gray-500 mt-0.5">{payments.length} incoming · {vendorPos.length} vendor paid</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <ArrowDownCircle size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalIncoming)}</p>
            <p className="text-xs text-gray-400">Total Collected</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
            <ArrowUpCircle size={18} className="text-orange-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalVendor)}</p>
            <p className="text-xs text-gray-400">Vendor Payments Out</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} className="text-violet-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalThisMonth)}</p>
            <p className="text-xs text-gray-400">Collected This Month</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <BarChart2 size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{payments.length + vendorPos.length}</p>
            <p className="text-xs text-gray-400">Total Transactions</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('incoming')}
          className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'incoming' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ArrowDownCircle size={14} /> Incoming
          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{payments.length}</span>
        </button>
        {canSeeVendor && (
          <button
            onClick={() => setTab('vendor')}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'vendor' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <ArrowUpCircle size={14} /> Vendor Payments
            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{vendorPos.length}</span>
          </button>
        )}
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === 'incoming' ? 'Search by invoice, mode…' : 'Search by PO, vendor…'} className="input-field pl-9" />
      </div>

      {tab === 'incoming' ? (
        <div className="glass-card !p-0 overflow-hidden">
          {loading ? <LoadingSpinner className="h-48" /> : filteredIncoming.length === 0 ? (
            <div className="text-center text-gray-400 py-16">No payments found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="table-header">Invoice</th>
                    <th className="table-header">Amount</th>
                    <th className="table-header">Mode</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Reference</th>
                    <th className="table-header">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredIncoming.map((pmt) => (
                    <tr key={pmt._id} className="hover:bg-green-50/20 transition-colors">
                      <td className="table-cell font-mono text-sm">{(pmt.invoiceId as Invoice)?.invoiceNumber}</td>
                      <td className="table-cell font-semibold text-green-700">{formatCurrency(pmt.amountPaid)}</td>
                      <td className="table-cell">
                        <span className="badge bg-blue-100 text-blue-800">{pmt.mode}</span>
                      </td>
                      <td className="table-cell text-gray-400">{formatDate(pmt.paymentDate)}</td>
                      <td className="table-cell text-gray-400">{pmt.referenceNumber || '—'}</td>
                      <td className="table-cell">{(pmt.recordedBy as User)?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card !p-0 overflow-hidden">
          {loading ? <LoadingSpinner className="h-48" /> : filteredVendor.length === 0 ? (
            <div className="text-center text-gray-400 py-16">No vendor payments recorded yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-orange-50 border-b border-orange-100">
                  <tr>
                    <th className="table-header">PO Number</th>
                    <th className="table-header">Customer</th>
                    <th className="table-header">Vendor</th>
                    <th className="table-header">Product</th>
                    <th className="table-header">Amount Paid</th>
                    <th className="table-header">Mode</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredVendor.map((po) => (
                    <tr key={po._id} className="hover:bg-orange-50/20 transition-colors">
                      <td className="table-cell font-mono font-medium text-amber-700">{po.poNumber}</td>
                      <td className="table-cell font-medium">{(po.leadId as Lead)?.companyName || '—'}</td>
                      <td className="table-cell text-gray-700">{po.vendorName || '—'}</td>
                      <td className="table-cell text-gray-500">{po.product || '—'}</td>
                      <td className="table-cell font-semibold text-orange-700">{formatCurrency(po.paidAmount ?? po.amount)}</td>
                      <td className="table-cell">
                        <span className="badge bg-amber-100 text-amber-800">{po.paymentMode || '—'}</span>
                      </td>
                      <td className="table-cell text-gray-400">{po.paidDate ? formatDate(po.paidDate) : '—'}</td>
                      <td className="table-cell text-gray-400">{po.paymentReference || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
