import { useEffect, useState, useCallback } from 'react';
import { Search, CreditCard, TrendingUp, BarChart2, Star } from 'lucide-react';
import { invoicesApi } from '@/api/invoices';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { formatDate, formatCurrency } from '@/utils/formatters';
import type { Payment, Invoice, User } from '@/types';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const thisMonthPayments = payments.filter(p => {
    const d = new Date(p.paymentDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalThisMonth = thisMonthPayments.reduce((s, p) => s + p.amount, 0);
  const totalAllTime = payments.reduce((s, p) => s + p.amount, 0);

  // Most used payment mode
  const modeCounts: Record<string, number> = {};
  for (const p of payments) {
    modeCounts[p.mode] = (modeCounts[p.mode] || 0) + 1;
  }
  const topMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  const filtered = search
    ? payments.filter(p => {
        const inv = p.invoiceId as Invoice;
        return inv?.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
          p.mode?.toLowerCase().includes(search.toLowerCase()) ||
          p.reference?.toLowerCase().includes(search.toLowerCase());
      })
    : payments;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Payments</h1>
        <p className="text-sm text-gray-500 mt-0.5">{payments.length} payment records</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalThisMonth)}</p>
            <p className="text-xs text-gray-400">Collected This Month</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <CreditCard size={18} className="text-violet-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAllTime)}</p>
            <p className="text-xs text-gray-400">Total Collected</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <BarChart2 size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
            <p className="text-xs text-gray-400">Transactions</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Star size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 truncate">{topMode}</p>
            <p className="text-xs text-gray-400">Top Payment Mode</p>
          </div>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by invoice, mode…" className="input-field pl-9" />
      </div>

      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : filtered.length === 0 ? (
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
                {filtered.map((pmt) => (
                  <tr key={pmt._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-mono text-sm">{(pmt.invoiceId as Invoice)?.invoiceNumber}</td>
                    <td className="table-cell font-semibold text-green-700">{formatCurrency(pmt.amount)}</td>
                    <td className="table-cell">
                      <span className="badge bg-blue-100 text-blue-800">{pmt.mode}</span>
                    </td>
                    <td className="table-cell text-gray-400">{formatDate(pmt.paymentDate)}</td>
                    <td className="table-cell text-gray-400">{pmt.reference || '—'}</td>
                    <td className="table-cell">{(pmt.recordedBy as User)?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
