// import { useEffect, useState, useCallback } from 'react';
// import { Plus, DollarSign, FileDown, RefreshCw } from 'lucide-react';
// import ExcelImportButton from '@/components/common/ExcelImportButton';
// import jsPDF from 'jspdf';
// import html2canvas from 'html2canvas';
// import { salariesApi } from '@/api/salaries';
// import { usersApi } from '@/api/users';
// import { useAuthStore } from '@/store/authStore';
// import { useLogoStore } from '@/store/logoStore';
// import { resolveLogoUrl } from '@/api/settings';
// import StatusBadge from '@/components/common/StatusBadge';
// import LoadingSpinner from '@/components/common/LoadingSpinner';
// import Modal from '@/components/common/Modal';
// import ConfirmDialog from '@/components/common/ConfirmDialog';
// import { formatCurrency } from '@/utils/formatters';
// import type { Salary, User } from '@/types';

// const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// export default function SalaryPage() {
//   const user = useAuthStore((s) => s.user);
//   const isHR = user?.role === 'admin' || user?.role === 'hr';
//   const { logoUrl, companyName } = useLogoStore();
//   const resolvedLogo = resolveLogoUrl(logoUrl);

//   const [salaries, setSalaries] = useState<Salary[]>([]);
//   const [total, setTotal] = useState(0);
//   const [page, setPage] = useState(1);
//   const [loading, setLoading] = useState(true);
//   const [showCalc, setShowCalc] = useState(false);
//   const [engineers, setEngineers] = useState<User[]>([]);

//   // Filters
//   const now = new Date();
//   const [filterMonth, setFilterMonth] = useState(0);
//   const [filterYear, setFilterYear] = useState(now.getFullYear());
//   const [filterEmployee, setFilterEmployee] = useState('');

//   const [form, setForm] = useState({
//     employeeId: '', month: now.getMonth() + 1, year: now.getFullYear(),
//     baseSalary: '', incentives: '', deductions: '', travelAllowance: '',
//   });
//   const [claimsTotal, setClaimsTotal] = useState<number | null>(null);
//   const [claimsFetching, setClaimsFetching] = useState(false);
//   const [visitChargesPreview, setVisitChargesPreview] = useState<number | null>(null);
//   const [saving, setSaving] = useState(false);
//   const [payTarget, setPayTarget] = useState<Salary | null>(null);
//   const [isRecalculating, setIsRecalculating] = useState(false);

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const params: Record<string, unknown> = { page, limit: 15 };
//       if (filterMonth) params.month = filterMonth;
//       if (filterYear) params.year = filterYear;
//       if (filterEmployee) params.employeeId = filterEmployee;
//       const res = await salariesApi.getAll(params);
//       setSalaries(res.data || []);
//       setTotal(res.pagination?.total ?? 0);
//     } catch (err) { console.error('SalaryPage load:', err); setSalaries([]); setTotal(0); } finally { setLoading(false); }
//   }, [page, filterMonth, filterYear, filterEmployee]);

//   useEffect(() => { load(); }, [load]);

//   const openCalc = async () => {
//     try {
//       const res = await usersApi.getAll({ limit: 200, isActive: true });
//       setEngineers((res.data || []).filter((u: User) => u.role !== 'admin'));
//     } catch (err) { console.error('openCalc:', err); }
//     setForm({ employeeId: '', month: now.getMonth() + 1, year: now.getFullYear(), baseSalary: '', incentives: '', deductions: '', travelAllowance: '' });
//     setClaimsTotal(null);
//     setIsRecalculating(false);
//     setShowCalc(true);
//   };

//   const openRecalc = async (sal: Salary) => {
//     try {
//       const res = await usersApi.getAll({ limit: 200, isActive: true });
//       setEngineers((res.data || []).filter((u: User) => u.role !== 'admin'));
//     } catch { }
//     const emp = sal.employeeId as User;
//     setForm({
//       employeeId: emp._id,
//       month: sal.month,
//       year: sal.year,
//       baseSalary: String(sal.baseSalary || ''),
//       incentives: String(sal.incentives || ''),
//       deductions: String(sal.deductions || ''),
//       travelAllowance: String(sal.travelAllowance || ''),
//     });
//     setClaimsTotal(null);
//     setIsRecalculating(true);
//     setShowCalc(true);
//   };

//   // Auto-fill base salary from selected employee profile
//   useEffect(() => {
//     if (!form.employeeId || !showCalc) return;
//     const emp = engineers.find(e => e._id === form.employeeId);
//     if (emp && emp.baseSalary) {
//       setForm(f => ({ ...f, baseSalary: String(emp.baseSalary) }));
//     }
//   }, [form.employeeId, showCalc, engineers]);

//   // Auto-fetch approved claims + visit charges when employee + month + year are set
//   useEffect(() => {
//     if (!form.employeeId || !showCalc) { setClaimsTotal(null); setVisitChargesPreview(null); return; }
//     setClaimsFetching(true);
//     Promise.all([
//       salariesApi.getClaimsPreview(form.employeeId, Number(form.month), Number(form.year)),
//       salariesApi.getVisitChargesPreview?.(form.employeeId, Number(form.month), Number(form.year)).catch(() => 0),
//     ])
//       .then(([claims, visits]) => { setClaimsTotal(claims); setVisitChargesPreview(visits ?? 0); })
//       .catch(() => { setClaimsTotal(0); setVisitChargesPreview(0); })
//       .finally(() => setClaimsFetching(false));
//   }, [form.employeeId, form.month, form.year, showCalc]);

//   // Load all employees for filter
//   useEffect(() => {
//     if (isHR) {
//       usersApi.getAll({ limit: 200 }).then(r => setEngineers((r.data || []).filter((u: User) => u.role !== 'admin'))).catch(() => {});
//     }
//   }, [isHR]);

//   const handleCalculate = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setSaving(true);
//     try {
//       await salariesApi.calculate({
//         employeeId: form.employeeId,
//         month: Number(form.month),
//         year: Number(form.year),
//         baseSalary: Number(form.baseSalary) || 0,
//         incentives: Number(form.incentives) || 0,
//         deductions: Number(form.deductions) || 0,
//         travelAllowance: Number(form.travelAllowance) || 0,
//         recalculate: isRecalculating,
//       });
//       setShowCalc(false);
//       load();
//     } catch (err: any) {
//       alert(err?.response?.data?.message || 'Failed to calculate salary');
//     } finally { setSaving(false); }
//   };

//   const handleMarkPaid = async () => {
//     if (!payTarget) return;
//     await salariesApi.markPaid(payTarget._id);
//     setSalaries(prev => prev.map(s => s._id === payTarget._id ? { ...s, status: 'Paid' as const } : s));
//     setPayTarget(null);
//   };

//   const generatePayslip = async (sal: Salary) => {
//     const emp = sal.employeeId as User;
//     const monthName = MONTHS[sal.month - 1];
//     const B = '#000';
//     const H = '#f0f0f0';
//     const BRAND = '#4f46e5';
//     const td = (style = '') => `border:1px solid ${B};padding:6px 10px;${style}`;
//     const th = (style = '') => `border:1px solid ${B};padding:6px 10px;background:${H};font-weight:bold;${style}`;

//     const earnings = [
//       { label: 'Basic Salary',      amount: sal.baseSalary },
//       { label: 'Visit Charges',     amount: sal.visitChargesTotal },
//       { label: 'Travel Allowance',  amount: sal.travelAllowance || 0 },
//       { label: 'Incentives',        amount: sal.incentives },
//     ];
//     const totalEarnings = earnings.reduce((s, e) => s + e.amount, 0);
//     const totalDeductions = sal.deductions;

//     const container = document.createElement('div');
//     container.style.cssText = 'position:absolute;left:-9999px;top:0;width:720px;background:#fff;font-family:Arial,sans-serif;font-size:11px;padding:24px;box-sizing:border-box;';
//     document.body.appendChild(container);
//     container.innerHTML = `
//       <style>*{box-sizing:border-box;margin:0;padding:0;}table{width:100%;border-collapse:collapse;}td,th{font-family:Arial,sans-serif;font-size:11px;vertical-align:middle;}</style>
//       <div style="border:1.5px solid ${B};">

//         <!-- Header -->
//         <table style="border-bottom:1.5px solid ${B};">
//           <tr>
//             <td style="padding:14px 18px;width:50%;vertical-align:middle;">
//               <img src="${resolvedLogo}" style="height:46px;object-fit:contain;" />
//             </td>
//             <td style="padding:14px 18px;width:50%;text-align:right;vertical-align:middle;">
//               <div style="font-size:18px;font-weight:900;letter-spacing:2px;color:${BRAND};">PAYSLIP</div>
//               <div style="font-size:11px;color:#555;margin-top:3px;">${monthName} ${sal.year}</div>
//             </td>
//           </tr>
//         </table>

//         <!-- Employee Details -->
//         <table style="border-bottom:1px solid ${B};">
//           <tr>
//             <td style="${th('width:25%;')}">Employee Name</td>
//             <td style="${td('width:25%;')}">${emp?.name || '—'}</td>
//             <td style="${th('width:20%;')}">Pay Period</td>
//             <td style="${td()}">${monthName} ${sal.year}</td>
//           </tr>
//           <tr>
//             <td style="${th()}">Designation</td>
//             <td style="${td()}">${emp?.role?.replace('_', ' ') || '—'}</td>
//             <td style="${th()}">Department</td>
//             <td style="${td()}">${emp?.department || '—'}</td>
//           </tr>
//           <tr>
//             <td style="${th()}">Employee ID</td>
//             <td style="${td()}">${String(emp?._id || '').slice(-8).toUpperCase()}</td>
//             <td style="${th()}">Payment Status</td>
//             <td style="${td()}">
//               <span style="background:${sal.status === 'Paid' ? '#dcfce7' : '#fef9c3'};color:${sal.status === 'Paid' ? '#166534' : '#92400e'};padding:2px 10px;border-radius:3px;font-weight:bold;">
//                 ${sal.status}
//               </span>
//             </td>
//           </tr>
//         </table>

//         <!-- Earnings & Deductions -->
//         <table style="border-bottom:1px solid ${B};">
//           <tr>
//             <th style="${th('width:35%;text-align:left;background:${BRAND};color:#fff;')}">Earnings</th>
//             <th style="${th('width:15%;text-align:right;background:${BRAND};color:#fff;')}">Amount (₹)</th>
//             <th style="${th('width:35%;text-align:left;background:${BRAND};color:#fff;')}">Deductions</th>
//             <th style="${th('width:15%;text-align:right;background:${BRAND};color:#fff;')}">Amount (₹)</th>
//           </tr>
//           ${earnings.map((e, i) => `
//           <tr>
//             <td style="${td()}">${e.label}</td>
//             <td style="${td('text-align:right;')}">${formatCurrency(e.amount)}</td>
//             ${i === 0 ? `<td style="${td()}">Deductions</td><td style="${td('text-align:right;color:#dc2626;')}">${formatCurrency(sal.deductions)}</td>` : `<td style="${td()}"></td><td style="${td()}"></td>`}
//           </tr>`).join('')}
//           <tr style="background:${H};">
//             <td style="${td('font-weight:bold;')}">Total Earnings</td>
//             <td style="${td('text-align:right;font-weight:bold;')}">${formatCurrency(totalEarnings)}</td>
//             <td style="${td('font-weight:bold;')}">Total Deductions</td>
//             <td style="${td('text-align:right;font-weight:bold;color:#dc2626;')}">${formatCurrency(totalDeductions)}</td>
//           </tr>
//         </table>

//         <!-- Net Pay -->
//         <table style="border-bottom:1px solid ${B};">
//           <tr style="background:${BRAND};">
//             <td style="padding:10px 18px;color:#fff;font-size:13px;font-weight:bold;width:70%;">
//               Net Pay — ${monthName} ${sal.year}
//             </td>
//             <td style="padding:10px 18px;color:#fff;font-size:15px;font-weight:900;text-align:right;">
//               ${formatCurrency(sal.finalSalary)}
//             </td>
//           </tr>
//         </table>

//         ${sal.notes ? `
//         <!-- Notes -->
//         <table style="border-bottom:1px solid ${B};">
//           <tr>
//             <td style="${th('width:15%;')}">Notes</td>
//             <td style="${td()}">${sal.notes}</td>
//           </tr>
//         </table>` : ''}

//         <!-- Footer -->
//         <table>
//           <tr>
//             <td style="padding:12px 18px;width:50%;vertical-align:bottom;">
//               <div style="margin-top:36px;border-top:1px solid #999;padding-top:4px;font-size:10px;color:#555;text-align:center;">Employee Signature</div>
//             </td>
//             <td style="padding:12px 18px;width:50%;vertical-align:bottom;text-align:center;">
//               <div style="margin-top:36px;border-top:1px solid #999;padding-top:4px;font-size:10px;color:#555;text-align:center;">Authorised Signatory</div>
//             </td>
//           </tr>
//           <tr>
//             <td colspan="2" style="padding:6px 18px;text-align:center;border-top:1px solid #eee;">
//               <span style="font-size:9px;color:#999;">This is a computer generated payslip. Generated on ${new Date().toLocaleDateString('en-IN')}.</span>
//             </td>
//           </tr>
//         </table>

//       </div>
//     `;
//     try {
//       const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, backgroundColor: '#fff' });
//       const imgData = canvas.toDataURL('image/png');
//       const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
//       const pw = pdf.internal.pageSize.getWidth();
//       const ph = pdf.internal.pageSize.getHeight();
//       const ih = (canvas.height * pw) / canvas.width;
//       let left = ih; let pos = 0;
//       pdf.addImage(imgData, 'PNG', 0, pos, pw, ih);
//       left -= ph;
//       while (left > 0) { pos -= ph; pdf.addPage(); pdf.addImage(imgData, 'PNG', 0, pos, pw, ih); left -= ph; }
//       pdf.save(`Payslip_${emp?.name?.replace(/\s+/g, '_')}_${monthName}_${sal.year}.pdf`);
//     } finally {
//       document.body.removeChild(container);
//     }
//   };

//   return (
//     <div className="space-y-6 animate-fade-in">
//       <div className="flex flex-wrap items-center justify-between gap-3">
//         <div>
//           <h1 className="page-header">Salary Management</h1>
//           <p className="text-sm text-gray-500 mt-0.5">{total} records</p>
//         </div>
//         <div className="flex items-center gap-2 flex-wrap">
//           {isHR && (
//             <ExcelImportButton
//               entityName="Salaries"
//               columnHint="employeeEmail or employeeName, month (1-12), year (YYYY), baseSalary, incentives, deductions"
//               onImport={async (rows) => {
//                 let imported = 0;
//                 const usersRes = await (await import('@/api/users')).usersApi.getAll({ limit: 500 });
//                 const userList: { _id: string; name: string; email: string }[] = usersRes.data || [];
//                 for (const row of rows) {
//                   const emailKey = row.employeeEmail || row.email || row.Email || '';
//                   const nameKey  = (row.employeeName || row.name || '').toLowerCase();
//                   const emp = userList.find(u => u.email === emailKey || u.name.toLowerCase().includes(nameKey));
//                   if (!emp) continue;
//                   const month = parseInt(row.month || '1');
//                   const year  = parseInt(row.year  || String(new Date().getFullYear()));
//                   if (!month || !year) continue;
//                   try {
//                     await salariesApi.calculate({ employeeId: emp._id, month, year, baseSalary: parseFloat(row.baseSalary || '0') || 0, incentives: parseFloat(row.incentives || '0') || 0, deductions: parseFloat(row.deductions || '0') || 0 });
//                     imported++;
//                   } catch { /* skip */ }
//                 }
//                 load();
//                 return { imported };
//               }}
//             />
//           )}
//           {isHR && (
//             <button onClick={openCalc} className="btn-primary flex items-center gap-2"><Plus size={16} /> Calculate Salary</button>
//           )}
//         </div>
//       </div>

//       {/* Filters */}
//       <div className="flex flex-wrap gap-3">
//         <select
//           value={filterMonth}
//           onChange={(e) => { setFilterMonth(Number(e.target.value)); setPage(1); }}
//           className="input-field w-auto"
//         >
//           <option value={0}>All Months</option>
//           {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
//         </select>
//         <input
//           type="number"
//           value={filterYear}
//           onChange={(e) => { setFilterYear(Number(e.target.value)); setPage(1); }}
//           className="input-field w-28"
//           min={2020}
//           max={2099}
//           placeholder="Year"
//         />
//         {isHR && (
//           <select
//             value={filterEmployee}
//             onChange={(e) => { setFilterEmployee(e.target.value); setPage(1); }}
//             className="input-field w-auto"
//           >
//             <option value="">All Employees</option>
//             {engineers.map(e => <option key={e._id} value={e._id}>{e.name} ({e.role})</option>)}
//           </select>
//         )}
//       </div>

//       <div className="glass-card !p-0 overflow-hidden hidden md:block">
//         {loading ? <LoadingSpinner className="h-48" /> : salaries.length === 0 ? (
//           <div className="text-center text-gray-400 py-16">No salary records found</div>
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full">
//               <thead className="bg-gray-50 border-b border-gray-100">
//                 <tr>
//                   <th className="table-header">Employee</th>
//                   <th className="table-header">Month / Year</th>
//                   <th className="table-header">Base Salary</th>
//                   <th className="table-header">Visit Charges</th>
//                   <th className="table-header">Claims</th>
//                   <th className="table-header">Travel Allow.</th>
//                   <th className="table-header">Incentives</th>
//                   <th className="table-header">Deductions</th>
//                   <th className="table-header">Final Salary</th>
//                   <th className="table-header">Status</th>
//                   <th className="table-header">Action</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-gray-50">
//                 {salaries.map((sal) => (
//                   <tr key={sal._id} className="hover:bg-violet-50/20 transition-colors">
//                     <td className="table-cell font-medium">{(sal.employeeId as User)?.name}</td>
//                     <td className="table-cell text-gray-500">{MONTHS[sal.month - 1]} {sal.year}</td>
//                     <td className="table-cell">{formatCurrency(sal.baseSalary)}</td>
//                     <td className="table-cell text-blue-600">{formatCurrency(sal.visitChargesTotal)}</td>
//                     <td className="table-cell text-amber-600">{formatCurrency((sal as any).claimsTotal || 0)}</td>
//                     <td className="table-cell text-blue-500">{formatCurrency(sal.travelAllowance || 0)}</td>
//                     <td className="table-cell text-green-600">{formatCurrency(sal.incentives)}</td>
//                     <td className="table-cell text-red-600">-{formatCurrency(sal.deductions)}</td>
//                     <td className="table-cell font-bold text-violet-700 text-base">{formatCurrency(sal.finalSalary)}</td>
//                     <td className="table-cell"><StatusBadge status={sal.status} /></td>
//                     <td className="table-cell">
//                       <div className="flex items-center gap-1.5 flex-wrap">
//                         {isHR && (
//                           <button onClick={() => openRecalc(sal)} className="flex items-center gap-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2.5 py-1 rounded-lg font-medium" title="Edit & Recalculate">
//                             <RefreshCw size={11} /> Recalc
//                           </button>
//                         )}
//                         {sal.status === 'Calculated' && isHR && (
//                           <button onClick={() => setPayTarget(sal)} className="flex items-center gap-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2.5 py-1 rounded-lg font-medium">
//                             <DollarSign size={12} /> Mark Paid
//                           </button>
//                         )}
//                         <button
//                           onClick={() => generatePayslip(sal)}
//                           className="flex items-center gap-1 text-xs bg-violet-100 hover:bg-violet-200 text-violet-800 px-2.5 py-1 rounded-lg font-medium"
//                           title="Download Payslip PDF"
//                         >
//                           <FileDown size={12} /> Payslip
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

//       {/* Mobile Card View */}
//       {loading ? (
//         <LoadingSpinner className="h-48 md:hidden" />
//       ) : salaries.length === 0 ? (
//         <div className="md:hidden text-center text-gray-400 py-16 glass-card">No salary records found</div>
//       ) : (
//         <div className="md:hidden space-y-3">
//           {salaries.map((sal) => (
//             <div key={sal._id} className="glass-card !p-4 space-y-3">
//               <div className="flex items-start justify-between gap-2">
//                 <div className="min-w-0 flex-1">
//                   <p className="font-semibold text-gray-900 text-sm">{(sal.employeeId as User)?.name}</p>
//                   <p className="text-xs text-gray-500 mt-0.5">{MONTHS[sal.month - 1]} {sal.year}</p>
//                 </div>
//                 <StatusBadge status={sal.status} />
//               </div>
//               <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
//                 <div><span className="text-gray-400">Base:</span> <span className="text-gray-700">{formatCurrency(sal.baseSalary)}</span></div>
//                 <div><span className="text-gray-400">Visits:</span> <span className="text-blue-600">{formatCurrency(sal.visitChargesTotal)}</span></div>
//                 <div><span className="text-gray-400">Claims:</span> <span className="text-amber-600">{formatCurrency((sal as any).claimsTotal || 0)}</span></div>
//                 <div><span className="text-gray-400">Travel:</span> <span className="text-blue-500">{formatCurrency(sal.travelAllowance || 0)}</span></div>
//                 <div><span className="text-gray-400">Incentives:</span> <span className="text-green-600">{formatCurrency(sal.incentives)}</span></div>
//                 <div><span className="text-gray-400">Deductions:</span> <span className="text-red-600">-{formatCurrency(sal.deductions)}</span></div>
//               </div>
//               <div className="flex items-center justify-between pt-1 border-t border-gray-100">
//                 <div>
//                   <span className="text-xs text-gray-400">Final Salary</span>
//                   <p className="font-bold text-violet-700 text-base">{formatCurrency(sal.finalSalary)}</p>
//                 </div>
//                 <div className="flex items-center gap-1.5 flex-wrap">
//                   {isHR && (
//                     <button onClick={() => openRecalc(sal)} className="flex items-center gap-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2.5 py-1 rounded-lg font-medium">
//                       <RefreshCw size={11} /> Recalc
//                     </button>
//                   )}
//                   {sal.status === 'Calculated' && isHR && (
//                     <button onClick={() => setPayTarget(sal)} className="flex items-center gap-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2.5 py-1 rounded-lg font-medium">
//                       <DollarSign size={12} /> Mark Paid
//                     </button>
//                   )}
//                   <button
//                     onClick={() => generatePayslip(sal)}
//                     className="flex items-center gap-1 text-xs bg-violet-100 hover:bg-violet-200 text-violet-800 px-2.5 py-1 rounded-lg font-medium"
//                   >
//                     <FileDown size={12} /> Payslip
//                   </button>
//                 </div>
//               </div>
//             </div>
//           ))}
//           {total > 15 && (
//             <div className="flex items-center justify-between pt-2">
//               <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 15)}</p>
//               <div className="flex gap-2">
//                 <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
//                 <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
//               </div>
//             </div>
//           )}
//         </div>
//       )}

//       <Modal isOpen={showCalc} onClose={() => setShowCalc(false)} title={isRecalculating ? 'Recalculate Salary' : 'Calculate Salary'}>
//         <form onSubmit={handleCalculate} className="space-y-4">
//           <div>
//             <label className="label">Employee *</label>
//             <select required className="input-field" value={form.employeeId}
//               disabled={isRecalculating}
//               onChange={(e) => setForm(f => ({...f, employeeId: e.target.value}))}>
//               <option value="">Select employee</option>
//               {engineers.map(e => <option key={e._id} value={e._id}>{e.name} ({e.role})</option>)}
//             </select>
//           </div>
//           <div className="grid grid-cols-2 gap-4">
//             <div>
//               <label className="label">Month *</label>
//               <select required className="input-field" value={form.month}
//                 disabled={isRecalculating}
//                 onChange={(e) => setForm(f => ({...f, month: Number(e.target.value)}))}>
//                 {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
//               </select>
//             </div>
//             <div>
//               <label className="label">Year *</label>
//               <input required type="number" className="input-field" value={form.year}
//                 disabled={isRecalculating}
//                 onChange={(e) => setForm(f => ({...f, year: Number(e.target.value)}))} />
//             </div>
//             <div>
//               <label className="label">Base Salary (₹) *</label>
//               <input required type="number" className="input-field" value={form.baseSalary} onChange={(e) => setForm(f => ({...f, baseSalary: e.target.value}))} />
//             </div>
//             <div>
//               <label className="label">Travel Allowance (₹)</label>
//               <input type="number" className="input-field" value={form.travelAllowance} onChange={(e) => setForm(f => ({...f, travelAllowance: e.target.value}))} placeholder="0" />
//             </div>
//             <div>
//               <label className="label">Incentives (₹)</label>
//               <input type="number" className="input-field" value={form.incentives} onChange={(e) => setForm(f => ({...f, incentives: e.target.value}))} />
//             </div>
//             <div>
//               <label className="label">Deductions (₹)</label>
//               <input type="number" className="input-field" value={form.deductions} onChange={(e) => setForm(f => ({...f, deductions: e.target.value}))} />
//             </div>
//           </div>

//           {/* Auto-fetched: Visit Charges + Claims */}
//           {form.employeeId && (
//             <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
//               <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Auto-calculated for this period</p>
//               {claimsFetching ? (
//                 <p className="text-sm text-blue-600 animate-pulse">Fetching records…</p>
//               ) : (
//                 <div className="grid grid-cols-2 gap-3">
//                   <div>
//                     <p className="text-xs text-blue-500 mb-0.5">Visit Charges (Approved)</p>
//                     <p className="text-base font-bold text-blue-700">{formatCurrency(visitChargesPreview ?? 0)}</p>
//                     {visitChargesPreview === 0 && <p className="text-xs text-blue-400">No approved visits</p>}
//                   </div>
//                   <div>
//                     <p className="text-xs text-amber-500 mb-0.5">Claims (Approved)</p>
//                     <p className="text-base font-bold text-amber-700">{formatCurrency(claimsTotal ?? 0)}</p>
//                     {claimsTotal === 0 && <p className="text-xs text-amber-400">No approved claims</p>}
//                   </div>
//                 </div>
//               )}
//             </div>
//           )}

//           <p className="text-xs text-gray-400">Visit charges and claims will be auto-aggregated from approved engineer records.</p>
//           <div className="flex gap-3 justify-end">
//             <button type="button" onClick={() => setShowCalc(false)} className="btn-secondary">Cancel</button>
//             <button type="submit" disabled={saving} className="btn-primary">
//               {saving ? 'Saving…' : isRecalculating ? 'Recalculate & Update' : 'Calculate'}
//             </button>
//           </div>
//         </form>
//       </Modal>

//       <ConfirmDialog
//         isOpen={!!payTarget}
//         onClose={() => setPayTarget(null)}
//         onConfirm={handleMarkPaid}
//         title="Mark Salary as Paid"
//         message={`Mark salary of ${payTarget ? formatCurrency(payTarget.finalSalary) : ''} as paid?`}
//         confirmLabel="Mark Paid"
//       />
//     </div>
//   );
// }
import { useEffect, useState, useCallback } from 'react';
import { Plus, DollarSign, FileDown, RefreshCw, Banknote, FileText, Calculator, Users, TrendingUp } from 'lucide-react';
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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// NEW: Salary component breakdown for better display
const SALARY_COMPONENTS = {
  BASIC_PERCENTAGE: 50,
  HRA_PERCENTAGE: 40,
  LTA_PERCENTAGE: 10,
};

export default function SalaryPage() {
  const user = useAuthStore((s) => s.user);
  const isHR = user?.role === 'admin' || user?.role === 'hr';
  const isFinance = user?.role === 'finance';
  const { logoUrl, companyName } = useLogoStore();
  const resolvedLogo = resolveLogoUrl(logoUrl);

  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [engineers, setEngineers] = useState<User[]>([]);
  
  // NEW: Dashboard stats for payroll overview
  const [stats, setStats] = useState({
    totalPayroll: 0,
    pendingPayments: 0,
    paidThisMonth: 0,
    totalEmployees: 0,
  });

  // Filters
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // NEW: Enhanced form with all payroll components
  const [form, setForm] = useState({
    employeeId: '',
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    // Core components
    basicSalary: '',
    hra: '',
    lta: '',
    specialAllowance: '',
    // Variable components
    incentives: '',
    overtimePay: '',
    bonuses: '',
    // Reimbursements
    travelAllowance: '',
    medicalReimbursement: '',
    conveyance: '',
    // Deductions
    pfDeduction: '',
    professionalTax: '',
    tds: '',
    esiDeduction: '',
    otherDeductions: '',
    // Loan/Advance
    loanRepayment: '',
    advanceDeduction: '',
    // Perquisites
    perquisites: '',
  });
  
  const [claimsTotal, setClaimsTotal] = useState<number | null>(null);
  const [claimsFetching, setClaimsFetching] = useState(false);
  const [visitChargesPreview, setVisitChargesPreview] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [payTarget, setPayTarget] = useState<Salary | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  // NEW: Bulk payroll processing
  const [showBulkPayroll, setShowBulkPayroll] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  
  // NEW: Tax declaration modal
  const [showTaxDecl, setShowTaxDecl] = useState(false);
  const [taxDeclarations, setTaxDeclarations] = useState({
    investments80C: 0,
    medicalInsurance: 0,
    hraRentPaid: 0,
    homeLoanInterest: 0,
    npsContribution: 0,
  });

  // Load payroll stats
  const loadStats = useCallback(async () => {
    try {
      const res = await salariesApi.getStats({ month: filterMonth, year: filterYear });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [filterMonth, filterYear]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (filterMonth) params.month = filterMonth;
      if (filterYear) params.year = filterYear;
      if (filterEmployee) params.employeeId = filterEmployee;
      if (filterStatus) params.status = filterStatus;
      const res = await salariesApi.getAll(params);
      setSalaries(res.data || []);
      setTotal(res.pagination?.total ?? 0);
      await loadStats();
    } catch (err) { console.error('SalaryPage load:', err); setSalaries([]); setTotal(0); } 
    finally { setLoading(false); }
  }, [page, filterMonth, filterYear, filterEmployee, filterStatus, loadStats]);

  useEffect(() => { load(); }, [load]);

  // NEW: Auto-calculate deductions based on salary
  const calculateStatutoryDeductions = useCallback((basicSalary: number) => {
    // PF: 12% of basic (employee contribution)
    const pfDeduction = basicSalary * 0.12;
    // ESI: 0.75% if salary <= 21000
    const esiDeduction = basicSalary <= 21000 ? basicSalary * 0.0075 : 0;
    // Professional Tax: Slab based
    let professionalTax = 0;
    if (basicSalary <= 3000) professionalTax = 0;
    else if (basicSalary <= 6000) professionalTax = 80;
    else if (basicSalary <= 9000) professionalTax = 150;
    else if (basicSalary <= 12000) professionalTax = 200;
    else professionalTax = 300;
    
    return { pfDeduction, esiDeduction, professionalTax };
  }, []);

  // NEW: Calculate complete salary breakup
  const calculateSalaryBreakup = useCallback((basic: number, incentives: number, travel: number, reimbursements: number) => {
    const hra = basic * 0.4;  // HRA: 40% of basic
    const lta = basic * 0.1;   // LTA: 10% of basic
    const specialAllowance = basic * 0.2; // Special allowance
    
    const { pfDeduction, esiDeduction, professionalTax } = calculateStatutoryDeductions(basic);
    
    const totalEarnings = basic + hra + lta + specialAllowance + incentives + travel + reimbursements;
    const totalDeductions = pfDeduction + esiDeduction + professionalTax;
    
    return {
      hra,
      lta,
      specialAllowance,
      pfDeduction,
      esiDeduction,
      professionalTax,
      totalEarnings,
      totalDeductions,
      netPayable: totalEarnings - totalDeductions,
    };
  }, [calculateStatutoryDeductions]);

  // Auto-fetch claims and visits when employee + month + year are set
  useEffect(() => {
    if (!form.employeeId || !showCalc) { setClaimsTotal(null); setVisitChargesPreview(null); return; }
    setClaimsFetching(true);
    Promise.all([
      salariesApi.getClaimsPreview(form.employeeId, Number(form.month), Number(form.year)),
      salariesApi.getVisitChargesPreview?.(form.employeeId, Number(form.month), Number(form.year)).catch(() => 0),
    ])
      .then(([claims, visits]) => { setClaimsTotal(claims); setVisitChargesPreview(visits ?? 0); })
      .catch(() => { setClaimsTotal(0); setVisitChargesPreview(0); })
      .finally(() => setClaimsFetching(false));
  }, [form.employeeId, form.month, form.year, showCalc]);

  // Load all employees for filter
  useEffect(() => {
    if (isHR) {
      usersApi.getAll({ limit: 200 }).then(r => setEngineers((r.data || []).filter((u: User) => u.role !== 'admin'))).catch(() => {});
    }
  }, [isHR]);

  const openCalc = async () => {
    try {
      const res = await usersApi.getAll({ limit: 200, isActive: true });
      setEngineers((res.data || []).filter((u: User) => u.role !== 'admin'));
    } catch (err) { console.error('openCalc:', err); }
    setForm({ 
      employeeId: '', month: now.getMonth() + 1, year: now.getFullYear(),
      basicSalary: '', hra: '', lta: '', specialAllowance: '',
      incentives: '', overtimePay: '', bonuses: '',
      travelAllowance: '', medicalReimbursement: '', conveyance: '',
      pfDeduction: '', professionalTax: '', tds: '', esiDeduction: '', otherDeductions: '',
      loanRepayment: '', advanceDeduction: '', perquisites: '',
    });
    setClaimsTotal(null);
    setIsRecalculating(false);
    setShowCalc(true);
  };

  const openRecalc = async (sal: Salary) => {
    try {
      const res = await usersApi.getAll({ limit: 200, isActive: true });
      setEngineers((res.data || []).filter((u: User) => u.role !== 'admin'));
    } catch { }
    const emp = sal.employeeId as User;
    setForm({
      employeeId: emp._id,
      month: sal.month,
      year: sal.year,
      basicSalary: String(sal.baseSalary || ''),
      hra: String((sal as any).hra || ''),
      lta: String((sal as any).lta || ''),
      specialAllowance: String((sal as any).specialAllowance || ''),
      incentives: String(sal.incentives || ''),
      overtimePay: String((sal as any).overtimePay || ''),
      bonuses: String((sal as any).bonuses || ''),
      travelAllowance: String(sal.travelAllowance || ''),
      medicalReimbursement: String((sal as any).medicalReimbursement || ''),
      conveyance: String((sal as any).conveyance || ''),
      pfDeduction: String((sal as any).pfDeduction || ''),
      professionalTax: String((sal as any).professionalTax || ''),
      tds: String((sal as any).tds || ''),
      esiDeduction: String((sal as any).esiDeduction || ''),
      otherDeductions: String((sal as any).otherDeductions || ''),
      loanRepayment: String((sal as any).loanRepayment || ''),
      advanceDeduction: String((sal as any).advanceDeduction || ''),
      perquisites: String((sal as any).perquisites || ''),
    });
    setClaimsTotal(null);
    setIsRecalculating(true);
    setShowCalc(true);
  };

  // NEW: Bulk payroll processing - generate salaries for all active employees
  const handleBulkPayroll = async () => {
    setBulkProcessing(true);
    try {
      await salariesApi.bulkCalculate({
        month: filterMonth,
        year: filterYear,
      });
      await load();
      alert('Bulk payroll processing completed successfully!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to process bulk payroll');
    } finally {
      setBulkProcessing(false);
      setShowBulkPayroll(false);
    }
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Calculate statutory deductions if not manually entered
      const basic = Number(form.basicSalary) || 0;
      const { pfDeduction, professionalTax, esiDeduction } = calculateStatutoryDeductions(basic);
      
      const totalDeductions = 
        (form.pfDeduction ? Number(form.pfDeduction) : pfDeduction) +
        (form.professionalTax ? Number(form.professionalTax) : professionalTax) +
        (form.tds ? Number(form.tds) : 0) +
        (form.esiDeduction ? Number(form.esiDeduction) : esiDeduction) +
        (form.otherDeductions ? Number(form.otherDeductions) : 0) +
        (form.loanRepayment ? Number(form.loanRepayment) : 0) +
        (form.advanceDeduction ? Number(form.advanceDeduction) : 0);

      const totalAllowances = 
        (form.hra ? Number(form.hra) : basic * 0.4) +
        (form.lta ? Number(form.lta) : basic * 0.1) +
        (form.specialAllowance ? Number(form.specialAllowance) : 0);

      await salariesApi.calculate({
        employeeId: form.employeeId,
        month: Number(form.month),
        year: Number(form.year),
        baseSalary: basic,
        hra: totalAllowances,
        incentives: Number(form.incentives) || 0,
        bonuses: Number(form.bonuses) || 0,
        overtimePay: Number(form.overtimePay) || 0,
        travelAllowance: Number(form.travelAllowance) || 0,
        medicalReimbursement: Number(form.medicalReimbursement) || 0,
        conveyance: Number(form.conveyance) || 0,
        deductions: totalDeductions,
        perquisites: Number(form.perquisites) || 0,
        recalculate: isRecalculating,
      });
      setShowCalc(false);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to calculate salary');
    } finally { setSaving(false); }
  };

  // FIXED: Add the missing handleMarkPaid function
  const handleMarkPaid = async () => {
    if (!payTarget) return;
    try {
      await salariesApi.markPaid(payTarget._id);
      // Update local state
      setSalaries(prev => prev.map(s => 
        s._id === payTarget._id ? { ...s, status: 'Paid' as const, isPaid: true } : s
      ));
      // Refresh stats
      await loadStats();
      setPayTarget(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to mark salary as paid');
    }
  };

  // FIXED: Add generatePayslip function
  const generatePayslip = async (sal: Salary) => {
    const emp = sal.employeeId as User;
    const monthName = MONTHS[sal.month - 1];
    const B = '#000';
    const H = '#f0f0f0';
    const BRAND = '#4f46e5';
    const td = (style = '') => `border:1px solid ${B};padding:6px 10px;${style}`;
    const th = (style = '') => `border:1px solid ${B};padding:6px 10px;background:${H};font-weight:bold;${style}`;

    const earnings = [
      { label: 'Basic Salary', amount: sal.baseSalary },
      { label: 'HRA', amount: (sal as any).hra || 0 },
      { label: 'LTA', amount: (sal as any).lta || 0 },
      { label: 'Special Allowance', amount: (sal as any).specialAllowance || 0 },
      { label: 'Visit Charges', amount: (sal as any).visitChargesTotal || 0 },
      { label: 'Travel Allowance', amount: sal.travelAllowance || 0 },
      { label: 'Incentives', amount: sal.incentives },
      { label: 'Bonuses', amount: (sal as any).bonuses || 0 },
    ];
    
    const deductions = [
      { label: 'PF Deduction', amount: (sal as any).pfDeduction || 0 },
      { label: 'ESI Deduction', amount: (sal as any).esiDeduction || 0 },
      { label: 'Professional Tax', amount: (sal as any).professionalTax || 0 },
      { label: 'TDS', amount: (sal as any).tds || 0 },
      { label: 'Other Deductions', amount: (sal as any).otherDeductions || 0 },
    ];
    
    const totalEarnings = earnings.reduce((s, e) => s + e.amount, 0);
    const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

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
            ${i < deductions.length ? `<td style="${td()}">${deductions[i].label}</td><td style="${td('text-align:right;color:#dc2626;')}">${formatCurrency(deductions[i].amount)}</td>` : `<td style="${td()}"></td><td style="${td()}"></td>`}
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
      let pos = 0;
      pdf.addImage(imgData, 'PNG', 0, pos, pw, ih);
      let left = ih;
      while (left > ph) { 
        pos -= ph; 
        pdf.addPage(); 
        pdf.addImage(imgData, 'PNG', 0, pos, pw, ih); 
        left -= ph; 
      }
      pdf.save(`Payslip_${emp?.name?.replace(/\s+/g, '_')}_${monthName}_${sal.year}.pdf`);
    } finally {
      document.body.removeChild(container);
    }
  };

  // NEW: Generate salary register report
  const generateSalaryRegister = async () => {
    try {
      const response = await salariesApi.exportSalaryRegister({
        month: filterMonth,
        year: filterYear,
        format: 'excel',
      });
      // Handle download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Salary_Register_${MONTHS[filterMonth - 1]}_${filterYear}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to generate salary register');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Salary & Payroll Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} records for {MONTHS[filterMonth - 1]} {filterYear}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(isHR || isFinance) && (
            <>
              <ExcelImportButton
                entityName="Salaries"
                columnHint="employeeEmail, month, year, basicSalary, incentives, deductions"
                onImport={async (rows) => {
                  let imported = 0;
                  const usersRes = await (await import('@/api/users')).usersApi.getAll({ limit: 500 });
                  const userList: { _id: string; name: string; email: string }[] = usersRes.data || [];
                  for (const row of rows) {
                    const emp = userList.find(u => u.email === row.employeeEmail);
                    if (!emp) continue;
                    try {
                      await salariesApi.calculate({ 
                        employeeId: emp._id, 
                        month: parseInt(row.month), 
                        year: parseInt(row.year), 
                        baseSalary: parseFloat(row.basicSalary) || 0,
                        incentives: parseFloat(row.incentives) || 0,
                        deductions: parseFloat(row.deductions) || 0,
                      });
                      imported++;
                    } catch { /* skip */ }
                  }
                  load();
                  return { imported };
                }}
              />
              <button onClick={openCalc} className="btn-primary flex items-center gap-2">
                <Plus size={16} /> Calculate Salary
              </button>
              <button onClick={() => setShowBulkPayroll(true)} className="btn-secondary flex items-center gap-2">
                <Users size={16} /> Bulk Payroll
              </button>
              <button onClick={generateSalaryRegister} className="btn-secondary flex items-center gap-2">
                <FileText size={16} /> Export Register
              </button>
            </>
          )}
        </div>
      </div>

      {/* NEW: Payroll Dashboard Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Payroll</p>
              <p className="text-2xl font-bold text-violet-700">{formatCurrency(stats.totalPayroll)}</p>
            </div>
            <Banknote className="text-violet-400" size={32} />
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Payments</p>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.pendingPayments)}</p>
            </div>
            <Calculator className="text-amber-400" size={32} />
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Paid This Month</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.paidThisMonth)}</p>
            </div>
            <DollarSign className="text-green-400" size={32} />
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Employees</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalEmployees}</p>
            </div>
            <Users className="text-blue-400" size={32} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterMonth}
          onChange={(e) => { setFilterMonth(Number(e.target.value)); setPage(1); }}
          className="input-field w-auto"
        >
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input
          type="number"
          value={filterYear}
          onChange={(e) => { setFilterYear(Number(e.target.value)); setPage(1); }}
          className="input-field w-28"
          min={2020}
          max={2099}
        />
        {isHR && (
          <>
            <select
              value={filterEmployee}
              onChange={(e) => { setFilterEmployee(e.target.value); setPage(1); }}
              className="input-field w-auto"
            >
              <option value="">All Employees</option>
              {engineers.map(e => <option key={e._id} value={e._id}>{e.name} ({e.role})</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="input-field w-auto"
            >
              <option value="">All Status</option>
              <option value="Calculated">Calculated</option>
              <option value="Paid">Paid</option>
            </select>
          </>
        )}
      </div>

      {/* Salary Table */}
      <div className="glass-card !p-0 overflow-hidden hidden md:block">
        {loading ? <LoadingSpinner className="h-48" /> : salaries.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No salary records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Employee</th>
                  <th className="table-header">Period</th>
                  <th className="table-header">Basic</th>
                  <th className="table-header">Allowances</th>
                  <th className="table-header">Deductions</th>
                  <th className="table-header">PF/ESI</th>
                  <th className="table-header">Net Payable</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {salaries.map((sal) => (
                  <tr key={sal._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-medium">{(sal.employeeId as User)?.name}</td>
                    <td className="table-cell text-gray-500">{MONTHS[sal.month - 1]} {sal.year}</td>
                    <td className="table-cell">{formatCurrency(sal.baseSalary)}</td>
                    <td className="table-cell text-green-600">{formatCurrency((sal as any).totalAllowances || 0)}</td>
                    <td className="table-cell text-red-600">-{formatCurrency((sal as any).totalDeductions || 0)}</td>
                    <td className="table-cell text-blue-600">{formatCurrency(((sal as any).pfDeduction || 0) + ((sal as any).esiDeduction || 0))}</td>
                    <td className="table-cell font-bold text-violet-700 text-base">{formatCurrency(sal.finalSalary)}</td>
                    <td className="table-cell"><StatusBadge status={sal.status} /></td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5">
                        {(isHR || isFinance) && (
                          <button onClick={() => openRecalc(sal)} className="text-blue-600 hover:text-blue-800" title="Recalculate">
                            <RefreshCw size={14} />
                          </button>
                        )}
                        <button onClick={() => generatePayslip(sal)} className="text-violet-600 hover:text-violet-800" title="Download Payslip">
                          <FileDown size={14} />
                        </button>
                        {sal.status === 'Calculated' && (isHR || isFinance) && (
                          <button onClick={() => setPayTarget(sal)} className="text-green-600 hover:text-green-800" title="Mark Paid">
                            <DollarSign size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <LoadingSpinner className="h-48" />
        ) : salaries.length === 0 ? (
          <div className="text-center text-gray-400 py-16 glass-card">No salary records found</div>
        ) : (
          salaries.map((sal) => (
            <div key={sal._id} className="glass-card !p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{(sal.employeeId as User)?.name}</p>
                  <p className="text-xs text-gray-500">{MONTHS[sal.month - 1]} {sal.year}</p>
                </div>
                <StatusBadge status={sal.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Basic:</span> {formatCurrency(sal.baseSalary)}</div>
                <div><span className="text-gray-500">Net:</span> <span className="font-bold text-violet-700">{formatCurrency(sal.finalSalary)}</span></div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                {(isHR || isFinance) && (
                  <button onClick={() => openRecalc(sal)} className="btn-secondary py-1 px-3 text-xs">Recalc</button>
                )}
                <button onClick={() => generatePayslip(sal)} className="btn-secondary py-1 px-3 text-xs">Payslip</button>
                {sal.status === 'Calculated' && (isHR || isFinance) && (
                  <button onClick={() => setPayTarget(sal)} className="btn-primary py-1 px-3 text-xs">Mark Paid</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Enhanced Salary Calculation Modal */}
      <Modal isOpen={showCalc} onClose={() => setShowCalc(false)} title={isRecalculating ? 'Recalculate Salary' : 'Calculate Salary'} size="lg">
        <form onSubmit={handleCalculate} className="space-y-4 max-h-[70vh] overflow-y-auto px-2">
          {/* Employee and Period Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Employee *</label>
              <select required className="input-field" value={form.employeeId}
                disabled={isRecalculating}
                onChange={(e) => setForm(f => ({...f, employeeId: e.target.value}))}>
                <option value="">Select employee</option>
                {engineers.map(e => <option key={e._id} value={e._id}>{e.name} ({e.role})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Month *</label>
              <select required className="input-field" value={form.month}
                disabled={isRecalculating}
                onChange={(e) => setForm(f => ({...f, month: Number(e.target.value)}))}>
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Salary Components Section */}
          <div className="border-t pt-3">
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><DollarSign size={16} /> Salary Components</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label text-xs">Basic Salary *</label><input required type="number" className="input-field" value={form.basicSalary} onChange={(e) => setForm(f => ({...f, basicSalary: e.target.value}))} /></div>
              <div><label className="label text-xs">HRA</label><input type="number" className="input-field" value={form.hra} onChange={(e) => setForm(f => ({...f, hra: e.target.value}))} placeholder="Auto: 40% of basic" /></div>
              <div><label className="label text-xs">LTA</label><input type="number" className="input-field" value={form.lta} onChange={(e) => setForm(f => ({...f, lta: e.target.value}))} placeholder="Auto: 10% of basic" /></div>
            </div>
          </div>

          {/* Auto-fetched: Visit Charges + Claims */}
          {form.employeeId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-700 uppercase">Auto-calculated for this period</p>
              {claimsFetching ? (
                <p className="text-sm text-blue-600 animate-pulse">Fetching records…</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-blue-500">Visit Charges</p><p className="text-base font-bold text-blue-700">{formatCurrency(visitChargesPreview ?? 0)}</p></div>
                  <div><p className="text-xs text-amber-500">Claims</p><p className="text-base font-bold text-amber-700">{formatCurrency(claimsTotal ?? 0)}</p></div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowCalc(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : isRecalculating ? 'Recalculate' : 'Calculate'}</button>
          </div>
        </form>
      </Modal>

      {/* Bulk Payroll Modal */}
      <Modal isOpen={showBulkPayroll} onClose={() => setShowBulkPayroll(false)} title="Bulk Payroll Processing">
        <div className="space-y-4">
          <p className="text-gray-600">This will generate salaries for all active employees for {MONTHS[filterMonth - 1]} {filterYear}.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">⚠️ This will calculate salaries based on:</p>
            <ul className="text-xs text-amber-700 mt-1 list-disc list-inside">
              <li>Employee base salary from profile</li>
              <li>Approved visit charges for the period</li>
              <li>Approved claims for the period</li>
              <li>Standard statutory deductions (PF, ESI, PT)</li>
            </ul>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowBulkPayroll(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleBulkPayroll} disabled={bulkProcessing} className="btn-primary">
              {bulkProcessing ? 'Processing...' : 'Process Bulk Payroll'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Dialog for Mark Paid */}
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