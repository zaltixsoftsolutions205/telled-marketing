import { useEffect, useState, useCallback } from 'react';
import { Plus, DollarSign, FileDown } from 'lucide-react';
import ExcelImportButton from '@/components/common/ExcelImportButton';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { salariesApi } from '@/api/salaries';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import { useLogoStore } from '@/store/logoStore';
import { resolveLogoUrl } from '@/api/settings';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { formatCurrency } from '@/utils/formatters';
import type { Salary, User } from '@/types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function SalaryPage() {
  const user = useAuthStore((s) => s.user);
  const isHR = user?.role === 'admin' || user?.role === 'hr_finance';
  const { logoUrl, companyName } = useLogoStore();
  const resolvedLogo = resolveLogoUrl(logoUrl);

  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [engineers, setEngineers] = useState<User[]>([]);

  // Filters
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(0);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterEmployee, setFilterEmployee] = useState('');

  const [form, setForm] = useState({
    employeeId: '', month: now.getMonth() + 1, year: now.getFullYear(),
    baseSalary: '', incentives: '', deductions: '', travelAllowance: '',
  });
  const [claimsTotal, setClaimsTotal] = useState<number | null>(null);
  const [claimsFetching, setClaimsFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payTarget, setPayTarget] = useState<Salary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (filterMonth) params.month = filterMonth;
      if (filterYear) params.year = filterYear;
      if (filterEmployee) params.employeeId = filterEmployee;
      const res = await salariesApi.getAll(params);
      setSalaries(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) { console.error('SalaryPage load:', err); setSalaries([]); setTotal(0); } finally { setLoading(false); }
  }, [page, filterMonth, filterYear, filterEmployee]);

  useEffect(() => { load(); }, [load]);

  const openCalc = async () => {
    try {
      const res = await usersApi.getAll({ limit: 200, isActive: true });
      setEngineers((res.data || []).filter((u: User) => u.role !== 'admin'));
    } catch (err) { console.error('openCalc:', err); }
    setForm({ employeeId: '', month: now.getMonth() + 1, year: now.getFullYear(), baseSalary: '', incentives: '', deductions: '', travelAllowance: '' });
    setClaimsTotal(null);
    setShowCalc(true);
  };

  // Auto-fetch approved claims when employee + month + year are set
  useEffect(() => {
    if (!form.employeeId || !showCalc) { setClaimsTotal(null); return; }
    setClaimsFetching(true);
    salariesApi.getClaimsPreview(form.employeeId, Number(form.month), Number(form.year))
      .then(amt => setClaimsTotal(amt))
      .catch(() => setClaimsTotal(0))
      .finally(() => setClaimsFetching(false));
  }, [form.employeeId, form.month, form.year, showCalc]);

  // Load all employees for filter
  useEffect(() => {
    if (isHR) {
      usersApi.getAll({ limit: 200 }).then(r => setEngineers((r.data || []).filter((u: User) => u.role !== 'admin'))).catch(() => {});
    }
  }, [isHR]);

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
        travelAllowance: Number(form.travelAllowance) || 0,
      } as any);
      setShowCalc(false);
      load();
    } finally { setSaving(false); }
  };

  const handleMarkPaid = async () => {
    if (!payTarget) return;
    await salariesApi.markPaid(payTarget._id);
    setSalaries(prev => prev.map(s => s._id === payTarget._id ? { ...s, status: 'Paid' as const } : s));
    setPayTarget(null);
  };

  const generatePayslip = async (sal: Salary) => {
    const emp = sal.employeeId as User;
    const monthName = MONTHS[sal.month - 1];
    const B = '#000';
    const H = '#f0f0f0';
    const BRAND = '#4f46e5';
    const td = (style = '') => `border:1px solid ${B};padding:6px 10px;${style}`;
    const th = (style = '') => `border:1px solid ${B};padding:6px 10px;background:${H};font-weight:bold;${style}`;

    const earnings = [
      { label: 'Basic Salary',      amount: sal.baseSalary },
      { label: 'Visit Charges',     amount: sal.visitChargesTotal },
      { label: 'Travel Allowance',  amount: sal.travelAllowance || 0 },
      { label: 'Incentives',        amount: sal.incentives },
    ];
    const totalEarnings = earnings.reduce((s, e) => s + e.amount, 0);
    const totalDeductions = sal.deductions;

    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:720px;background:#fff;font-family:Arial,sans-serif;font-size:11px;padding:24px;box-sizing:border-box;';
    document.body.appendChild(container);
    container.innerHTML = `
      <style>*{box-sizing:border-box;margin:0;padding:0;}table{width:100%;border-collapse:collapse;}td,th{font-family:Arial,sans-serif;font-size:11px;vertical-align:middle;}</style>
      <div style="border:1.5px solid ${B};">

        <!-- Header -->
        <table style="border-bottom:1.5px solid ${B};">
          <tr>
            <td style="padding:14px 18px;width:50%;vertical-align:middle;">
              <img src="${resolvedLogo}" style="height:46px;object-fit:contain;" />
            </td>
            <td style="padding:14px 18px;width:50%;text-align:right;vertical-align:middle;">
              <div style="font-size:18px;font-weight:900;letter-spacing:2px;color:${BRAND};">PAYSLIP</div>
              <div style="font-size:11px;color:#555;margin-top:3px;">${monthName} ${sal.year}</div>
            </td>
          </tr>
        </table>

        <!-- Employee Details -->
        <table style="border-bottom:1px solid ${B};">
          <tr>
            <td style="${th('width:25%;')}">Employee Name</td>
            <td style="${td('width:25%;')}">${emp?.name || '—'}</td>
            <td style="${th('width:20%;')}">Pay Period</td>
            <td style="${td()}">${monthName} ${sal.year}</td>
          </tr>
          <tr>
            <td style="${th()}">Designation</td>
            <td style="${td()}">${emp?.role?.replace('_', ' ') || '—'}</td>
            <td style="${th()}">Department</td>
            <td style="${td()}">${emp?.department || '—'}</td>
          </tr>
          <tr>
            <td style="${th()}">Employee ID</td>
            <td style="${td()}">${String(emp?._id || '').slice(-8).toUpperCase()}</td>
            <td style="${th()}">Payment Status</td>
            <td style="${td()}">
              <span style="background:${sal.status === 'Paid' ? '#dcfce7' : '#fef9c3'};color:${sal.status === 'Paid' ? '#166534' : '#92400e'};padding:2px 10px;border-radius:3px;font-weight:bold;">
                ${sal.status}
              </span>
            </td>
          </tr>
        </table>

        <!-- Earnings & Deductions -->
        <table style="border-bottom:1px solid ${B};">
          <tr>
            <th style="${th('width:35%;text-align:left;background:${BRAND};color:#fff;')}">Earnings</th>
            <th style="${th('width:15%;text-align:right;background:${BRAND};color:#fff;')}">Amount (₹)</th>
            <th style="${th('width:35%;text-align:left;background:${BRAND};color:#fff;')}">Deductions</th>
            <th style="${th('width:15%;text-align:right;background:${BRAND};color:#fff;')}">Amount (₹)</th>
          </tr>
          ${earnings.map((e, i) => `
          <tr>
            <td style="${td()}">${e.label}</td>
            <td style="${td('text-align:right;')}">${formatCurrency(e.amount)}</td>
            ${i === 0 ? `<td style="${td()}">Deductions</td><td style="${td('text-align:right;color:#dc2626;')}">${formatCurrency(sal.deductions)}</td>` : `<td style="${td()}"></td><td style="${td()}"></td>`}
          </tr>`).join('')}
          <tr style="background:${H};">
            <td style="${td('font-weight:bold;')}">Total Earnings</td>
            <td style="${td('text-align:right;font-weight:bold;')}">${formatCurrency(totalEarnings)}</td>
            <td style="${td('font-weight:bold;')}">Total Deductions</td>
            <td style="${td('text-align:right;font-weight:bold;color:#dc2626;')}">${formatCurrency(totalDeductions)}</td>
          </tr>
        </table>

        <!-- Net Pay -->
        <table style="border-bottom:1px solid ${B};">
          <tr style="background:${BRAND};">
            <td style="padding:10px 18px;color:#fff;font-size:13px;font-weight:bold;width:70%;">
              Net Pay — ${monthName} ${sal.year}
            </td>
            <td style="padding:10px 18px;color:#fff;font-size:15px;font-weight:900;text-align:right;">
              ${formatCurrency(sal.finalSalary)}
            </td>
          </tr>
        </table>

        ${sal.notes ? `
        <!-- Notes -->
        <table style="border-bottom:1px solid ${B};">
          <tr>
            <td style="${th('width:15%;')}">Notes</td>
            <td style="${td()}">${sal.notes}</td>
          </tr>
        </table>` : ''}

        <!-- Footer -->
        <table>
          <tr>
            <td style="padding:12px 18px;width:50%;vertical-align:bottom;">
              <div style="margin-top:36px;border-top:1px solid #999;padding-top:4px;font-size:10px;color:#555;text-align:center;">Employee Signature</div>
            </td>
            <td style="padding:12px 18px;width:50%;vertical-align:bottom;text-align:center;">
              <div style="margin-top:36px;border-top:1px solid #999;padding-top:4px;font-size:10px;color:#555;text-align:center;">Authorised Signatory</div>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:6px 18px;text-align:center;border-top:1px solid #eee;">
              <span style="font-size:9px;color:#999;">This is a computer generated payslip. Generated on ${new Date().toLocaleDateString('en-IN')}.</span>
            </td>
          </tr>
        </table>

      </div>
    `;
    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, backgroundColor: '#fff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const ih = (canvas.height * pw) / canvas.width;
      let left = ih; let pos = 0;
      pdf.addImage(imgData, 'PNG', 0, pos, pw, ih);
      left -= ph;
      while (left > 0) { pos -= ph; pdf.addPage(); pdf.addImage(imgData, 'PNG', 0, pos, pw, ih); left -= ph; }
      pdf.save(`Payslip_${emp?.name?.replace(/\s+/g, '_')}_${monthName}_${sal.year}.pdf`);
    } finally {
      document.body.removeChild(container);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Salary Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} records</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isHR && (
            <ExcelImportButton
              entityName="Salaries"
              columnHint="employeeEmail or employeeName, month (1-12), year (YYYY), baseSalary, incentives, deductions"
              onImport={async (rows) => {
                let imported = 0;
                const usersRes = await (await import('@/api/users')).usersApi.getAll({ limit: 500 });
                const userList: { _id: string; name: string; email: string }[] = usersRes.data || [];
                for (const row of rows) {
                  const emailKey = row.employeeEmail || row.email || row.Email || '';
                  const nameKey  = (row.employeeName || row.name || '').toLowerCase();
                  const emp = userList.find(u => u.email === emailKey || u.name.toLowerCase().includes(nameKey));
                  if (!emp) continue;
                  const month = parseInt(row.month || '1');
                  const year  = parseInt(row.year  || String(new Date().getFullYear()));
                  if (!month || !year) continue;
                  try {
                    await salariesApi.calculate({ employeeId: emp._id, month, year, baseSalary: parseFloat(row.baseSalary || '0') || 0, incentives: parseFloat(row.incentives || '0') || 0, deductions: parseFloat(row.deductions || '0') || 0 });
                    imported++;
                  } catch { /* skip */ }
                }
                load();
                return { imported };
              }}
            />
          )}
          {isHR && (
            <button onClick={openCalc} className="btn-primary flex items-center gap-2"><Plus size={16} /> Calculate Salary</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterMonth}
          onChange={(e) => { setFilterMonth(Number(e.target.value)); setPage(1); }}
          className="input-field w-auto"
        >
          <option value={0}>All Months</option>
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input
          type="number"
          value={filterYear}
          onChange={(e) => { setFilterYear(Number(e.target.value)); setPage(1); }}
          className="input-field w-28"
          min={2020}
          max={2099}
          placeholder="Year"
        />
        {isHR && (
          <select
            value={filterEmployee}
            onChange={(e) => { setFilterEmployee(e.target.value); setPage(1); }}
            className="input-field w-auto"
          >
            <option value="">All Employees</option>
            {engineers.map(e => <option key={e._id} value={e._id}>{e.name} ({e.role})</option>)}
          </select>
        )}
      </div>

      <div className="glass-card !p-0 overflow-hidden hidden md:block">
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
                  <th className="table-header">Claims</th>
                  <th className="table-header">Travel Allow.</th>
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
                    <td className="table-cell text-amber-600">{formatCurrency((sal as any).claimsTotal || 0)}</td>
                    <td className="table-cell text-blue-500">{formatCurrency(sal.travelAllowance || 0)}</td>
                    <td className="table-cell text-green-600">{formatCurrency(sal.incentives)}</td>
                    <td className="table-cell text-red-600">-{formatCurrency(sal.deductions)}</td>
                    <td className="table-cell font-bold text-violet-700 text-base">{formatCurrency(sal.finalSalary)}</td>
                    <td className="table-cell"><StatusBadge status={sal.status} /></td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        {sal.status === 'Calculated' && isHR && (
                          <button onClick={() => setPayTarget(sal)} className="flex items-center gap-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2.5 py-1 rounded-lg font-medium">
                            <DollarSign size={12} /> Mark Paid
                          </button>
                        )}
                        <button
                          onClick={() => generatePayslip(sal)}
                          className="flex items-center gap-1 text-xs bg-violet-100 hover:bg-violet-200 text-violet-800 px-2.5 py-1 rounded-lg font-medium"
                          title="Download Payslip PDF"
                        >
                          <FileDown size={12} /> Payslip
                        </button>
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

      {/* Mobile Card View */}
      {loading ? (
        <LoadingSpinner className="h-48 md:hidden" />
      ) : salaries.length === 0 ? (
        <div className="md:hidden text-center text-gray-400 py-16 glass-card">No salary records found</div>
      ) : (
        <div className="md:hidden space-y-3">
          {salaries.map((sal) => (
            <div key={sal._id} className="glass-card !p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{(sal.employeeId as User)?.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{MONTHS[sal.month - 1]} {sal.year}</p>
                </div>
                <StatusBadge status={sal.status} />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div><span className="text-gray-400">Base:</span> <span className="text-gray-700">{formatCurrency(sal.baseSalary)}</span></div>
                <div><span className="text-gray-400">Visits:</span> <span className="text-blue-600">{formatCurrency(sal.visitChargesTotal)}</span></div>
                <div><span className="text-gray-400">Claims:</span> <span className="text-amber-600">{formatCurrency((sal as any).claimsTotal || 0)}</span></div>
                <div><span className="text-gray-400">Travel:</span> <span className="text-blue-500">{formatCurrency(sal.travelAllowance || 0)}</span></div>
                <div><span className="text-gray-400">Incentives:</span> <span className="text-green-600">{formatCurrency(sal.incentives)}</span></div>
                <div><span className="text-gray-400">Deductions:</span> <span className="text-red-600">-{formatCurrency(sal.deductions)}</span></div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <div>
                  <span className="text-xs text-gray-400">Final Salary</span>
                  <p className="font-bold text-violet-700 text-base">{formatCurrency(sal.finalSalary)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {sal.status === 'Calculated' && isHR && (
                    <button onClick={() => setPayTarget(sal)} className="flex items-center gap-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2.5 py-1 rounded-lg font-medium">
                      <DollarSign size={12} /> Mark Paid
                    </button>
                  )}
                  <button
                    onClick={() => generatePayslip(sal)}
                    className="flex items-center gap-1 text-xs bg-violet-100 hover:bg-violet-200 text-violet-800 px-2.5 py-1 rounded-lg font-medium"
                  >
                    <FileDown size={12} /> Payslip
                  </button>
                </div>
              </div>
            </div>
          ))}
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

      <Modal isOpen={showCalc} onClose={() => setShowCalc(false)} title="Calculate Salary">
        <form onSubmit={handleCalculate} className="space-y-4">
          <div>
            <label className="label">Employee (HR / Sales / Engineer) *</label>
            <select required className="input-field" value={form.employeeId} onChange={(e) => setForm(f => ({...f, employeeId: e.target.value}))}>
              <option value="">Select employee</option>
              {engineers.map(e => <option key={e._id} value={e._id}>{e.name} ({e.role})</option>)}
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
              <label className="label">Travel Allowance (₹)</label>
              <input type="number" className="input-field" value={form.travelAllowance} onChange={(e) => setForm(f => ({...f, travelAllowance: e.target.value}))} placeholder="0" />
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

          {/* Claims — auto-fetched from approved visit claims */}
          {form.employeeId && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <label className="label !mb-1 text-amber-800">Claims (Auto-calculated from approved HR claims)</label>
              {claimsFetching ? (
                <p className="text-sm text-amber-600 animate-pulse">Fetching approved claims…</p>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold text-amber-700">{formatCurrency(claimsTotal ?? 0)}</p>
                  {claimsTotal === 0 && <p className="text-xs text-amber-500">No approved claims for this period</p>}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400">Visit charges and claims will be auto-aggregated from approved engineer records.</p>
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
