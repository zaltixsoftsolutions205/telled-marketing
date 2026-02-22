import { useEffect, useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { invoicesApi } from '@/api/invoices';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { formatDate, formatCurrency, formatDateTime } from '@/utils/formatters';
import type { Payment, Invoice, User } from '@/types';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // We'll fetch all invoices and aggregate their payments
    // (Backend should expose /api/payments endpoint; for now use invoice payments aggregated)
    try {
      // Fetch invoices and get payments from all
      const res = await invoicesApi.getAll({ page, limit: 15, search });
      // Gather payments from these invoices
      const paymentLists = await Promise.all(
        res.data.map((inv: Invoice) => invoicesApi.getPayments(inv._id).catch(() => []))
      );
      const allPayments: Payment[] = paymentLists.flat();
      setPayments(allPayments);
      setTotal(res.pagination?.total ?? 0);
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Payments</h1>
        <p className="text-sm text-gray-500 mt-0.5">Payment records</p>
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search invoices…" className="input-field pl-9" />
      </div>

      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : payments.length === 0 ? (
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
                {payments.map((pmt) => (
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
