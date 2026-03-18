import { useEffect, useState, useCallback } from 'react';
import { Plus, DollarSign } from 'lucide-react';
import { salariesApi } from '@/api/salaries';
import { usersApi } from '@/api/users';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { formatCurrency } from '@/utils/formatters';
import type { Salary, User } from '@/types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function SalaryPage() {
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [engineers, setEngineers] = useState<User[]>([]);
  const [form, setForm] = useState({
    employeeId: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    baseSalary: '', incentives: '', deductions: '',
  });
  const [saving, setSaving] = useState(false);
  const [payTarget, setPayTarget] = useState<Salary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salariesApi.getAll({ page, limit: 15 });
      setSalaries(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) { console.error('SalaryPage load:', err); setSalaries([]); setTotal(0); } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const openCalc = async () => {
    try {
      const engs = await usersApi.getEngineers();
      setEngineers(engs || []);
    } catch (err) { console.error('openCalc:', err); }
    setShowCalc(true);
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await salariesApi.calculate({
        employeeId: form.employeeId,
        month: Number(form.month),
        year: Number(form.year),
        baseSalary: Number(form.baseSalary),
        incentives: Number(form.incentives) || 0,
        deductions: Number(form.deductions) || 0,
      });
      setShowCalc(false);
      load();
    } finally { setSaving(false); }
  };

  const handleMarkPaid = async () => {
    if (!payTarget) return;
    await salariesApi.markPaid(payTarget._id);
    setPayTarget(null);
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Salary Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} records</p>
        </div>
        <button onClick={openCalc} className="btn-primary flex items-center gap-2"><Plus size={16} /> Calculate Salary</button>
      </div>

      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : salaries.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No salary records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Employee</th>
                  <th className="table-header">Month / Year</th>
                  <th className="table-header">Base Salary</th>
                  <th className="table-header">Visit Charges</th>
                  <th className="table-header">Incentives</th>
                  <th className="table-header">Deductions</th>
                  <th className="table-header">Final Salary</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {salaries.map((sal) => (
                  <tr key={sal._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-medium">{(sal.employeeId as User)?.name}</td>
                    <td className="table-cell text-gray-500">{MONTHS[sal.month - 1]} {sal.year}</td>
                    <td className="table-cell">{formatCurrency(sal.baseSalary)}</td>
                    <td className="table-cell text-blue-600">{formatCurrency(sal.visitChargesTotal)}</td>
                    <td className="table-cell text-green-600">{formatCurrency(sal.incentives)}</td>
                    <td className="table-cell text-red-600">-{formatCurrency(sal.deductions)}</td>
                    <td className="table-cell font-bold text-violet-700 text-base">{formatCurrency(sal.finalSalary)}</td>
                    <td className="table-cell"><StatusBadge status={sal.status} /></td>
                    <td className="table-cell">
                      {sal.status === 'Calculated' && (
                        <button onClick={() => setPayTarget(sal)} className="flex items-center gap-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2.5 py-1 rounded-lg font-medium">
                          <DollarSign size={12} /> Mark Paid
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

      <Modal isOpen={showCalc} onClose={() => setShowCalc(false)} title="Calculate Salary">
        <form onSubmit={handleCalculate} className="space-y-4">
          <div>
            <label className="label">Employee *</label>
            <select required className="input-field" value={form.employeeId} onChange={(e) => setForm(f => ({...f, employeeId: e.target.value}))}>
              <option value="">Select engineer</option>
              {engineers.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Month *</label>
              <select required className="input-field" value={form.month} onChange={(e) => setForm(f => ({...f, month: Number(e.target.value)}))}>
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Year *</label>
              <input required type="number" className="input-field" value={form.year} onChange={(e) => setForm(f => ({...f, year: Number(e.target.value)}))} />
            </div>
            <div>
              <label className="label">Base Salary (₹) *</label>
              <input required type="number" className="input-field" value={form.baseSalary} onChange={(e) => setForm(f => ({...f, baseSalary: e.target.value}))} />
            </div>
            <div>
              <label className="label">Incentives (₹)</label>
              <input type="number" className="input-field" value={form.incentives} onChange={(e) => setForm(f => ({...f, incentives: e.target.value}))} />
            </div>
            <div>
              <label className="label">Deductions (₹)</label>
              <input type="number" className="input-field" value={form.deductions} onChange={(e) => setForm(f => ({...f, deductions: e.target.value}))} />
            </div>
          </div>
          <p className="text-xs text-gray-400">Visit charges will be auto-aggregated from approved engineer visits.</p>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowCalc(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Calculating…' : 'Calculate'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!payTarget}
        onClose={() => setPayTarget(null)}
        onConfirm={handleMarkPaid}
        title="Mark Salary as Paid"
        message={`Mark salary of ${payTarget ? formatCurrency(payTarget.finalSalary) : ''} as paid?`}
        confirmLabel="Mark Paid"
      />
    </div>
  );
}
