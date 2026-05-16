// import { Response } from 'express';
// import Salary from '../models/Salary';
// import EngineerVisit from '../models/EngineerVisit';
// import VisitClaim from '../models/VisitClaim';
// import User from '../models/User';
// import { AuthRequest } from '../middleware/auth.middleware';
// import { sendSuccess, sendError, sendPaginated } from '../utils/response';
// import { getPaginationParams } from '../utils/helpers';
// import { generatePayslipPDF } from '../services/pdf.service';
// import { notifyUser } from '../utils/notify';
// import mongoose from 'mongoose';

// const getClaimsTotal = async (employeeId: any, start: Date, end: Date): Promise<number> => {
//   const agg = await VisitClaim.aggregate([
//     { $match: { engineerId: new mongoose.Types.ObjectId(employeeId), status: 'approved', isArchived: false, claimDate: { $gte: start, $lte: end } } },
//     { $group: { _id: null, total: { $sum: '$totalAmount' } } },
//   ]);
//   return agg[0]?.total || 0;
// };

// const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// export const getSalaries = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { page, limit, skip } = getPaginationParams(req);
//     const filter: Record<string, unknown> = { organizationId: req.user!.organizationId };
//     if (req.query.employeeId) filter.employeeId = req.query.employeeId;
//     if (req.query.month) filter.month = parseInt(req.query.month as string);
//     if (req.query.year) filter.year = parseInt(req.query.year as string);
//     if (req.user!.role === 'engineer') filter.employeeId = req.user!.id;
//     const [salaries, total] = await Promise.all([
//       Salary.find(filter).populate('employeeId', 'name email role').sort({ year: -1, month: -1 }).skip(skip).limit(limit),
//       Salary.countDocuments(filter),
//     ]);
//     sendPaginated(res, salaries, total, page, limit);
//   } catch { sendError(res, 'Failed', 500); }
// };

// export const calculateSalary = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { employeeId, month, year, baseSalary: bodyBaseSalary, incentives = 0, deductions = 0, travelAllowance = 0, notes, recalculate = false } = req.body;
//     const employee = await User.findById(employeeId);
//     if (!employee) { sendError(res, 'Employee not found', 404); return; }

//     // Use baseSalary from request if provided, else fall back to employee profile
//     const baseSalary = bodyBaseSalary !== undefined && bodyBaseSalary !== ''
//       ? Number(bodyBaseSalary)
//       : (employee.baseSalary || 0);

//     const [start, end] = [new Date(year, month - 1, 1), new Date(year, month, 0)];
//     const visitAgg = await EngineerVisit.aggregate([
//       { $match: { engineerId: employee._id, hrStatus: 'Approved', visitDate: { $gte: start, $lte: end } } },
//       { $group: { _id: null, total: { $sum: '$totalAmount' } } },
//     ]);
//     const visitChargesTotal = visitAgg[0]?.total || 0;
//     const claimsTotal = await getClaimsTotal(employeeId, start, end);

//     // If recalculate=true, update existing record; otherwise create new
//     const existing = await Salary.findOne({ employeeId, month, year });
//     if (existing && !recalculate) { sendError(res, 'Salary already calculated for this period. Use recalculate to update.', 409); return; }

//     let salary: any;
//     if (existing && recalculate) {
//       existing.baseSalary = baseSalary;
//       existing.visitChargesTotal = visitChargesTotal;
//       existing.claimsTotal = claimsTotal;
//       existing.travelAllowance = Number(travelAllowance);
//       existing.incentives = Number(incentives);
//       existing.deductions = Number(deductions);
//       if (notes !== undefined) existing.notes = notes;
//       salary = await existing.save();
//     } else {
//       salary = await new Salary({ organizationId: req.user!.organizationId, employeeId, month, year, baseSalary, visitChargesTotal, claimsTotal, travelAllowance, incentives, deductions, notes }).save();
//     }
//     try {
//       const pdf = await generatePayslipPDF({ employeeName: employee.name, email: employee.email, role: employee.role, month: MONTHS[month - 1], year, baseSalary, visitChargesTotal, travelAllowance, incentives, deductions, finalSalary: salary.finalSalary });
//       await Salary.findByIdAndUpdate(salary._id, { payslipPdf: pdf });
//     } catch (_e) {}
//     notifyUser(employeeId, {
//       title: 'Salary Calculated',
//       message: `Your salary for ${MONTHS[month - 1]} ${year} has been calculated — ₹${salary.finalSalary?.toLocaleString() || '0'}`,
//       type: 'salary',
//       link: '/salary',
//     });
//     sendSuccess(res, salary, 'Salary calculated', 201);
//   } catch { sendError(res, 'Failed to calculate salary', 500); }
// };

// export const markSalaryPaid = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const salary = await Salary.findByIdAndUpdate(req.params.id, { isPaid: true, paidAt: new Date(), paidBy: req.user!.id }, { new: true });
//     if (!salary) { sendError(res, 'Salary record not found', 404); return; }
//     notifyUser(salary.employeeId.toString(), {
//       title: 'Salary Paid',
//       message: `Your salary for ${MONTHS[(salary.month as number) - 1]} ${salary.year} of ₹${(salary as any).finalSalary?.toLocaleString() || '0'} has been paid`,
//       type: 'salary',
//       link: '/salary',
//     });
//     sendSuccess(res, salary, 'Salary marked as paid');
//   } catch { sendError(res, 'Failed', 500); }
// };

// export const getClaimsPreview = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { employeeId, month, year } = req.query;
//     if (!employeeId || !month || !year) { sendError(res, 'employeeId, month, year required', 400); return; }
//     const m = Number(month); const y = Number(year);
//     const start = new Date(y, m - 1, 1);
//     const end = new Date(y, m, 0);
//     const claimsTotal = await getClaimsTotal(employeeId as string, start, end);
//     sendSuccess(res, { claimsTotal });
//   } catch { sendError(res, 'Failed to fetch claims preview', 500); }
// };

// export const getVisitChargesPreview = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { employeeId, month, year } = req.query;
//     if (!employeeId || !month || !year) { sendError(res, 'employeeId, month, year required', 400); return; }
//     const m = Number(month); const y = Number(year);
//     const start = new Date(y, m - 1, 1);
//     const end = new Date(y, m, 0);
//     const agg = await EngineerVisit.aggregate([
//       { $match: { engineerId: new mongoose.Types.ObjectId(employeeId as string), hrStatus: 'Approved', visitDate: { $gte: start, $lte: end } } },
//       { $group: { _id: null, total: { $sum: '$totalAmount' } } },
//     ]);
//     sendSuccess(res, { visitChargesTotal: agg[0]?.total || 0 });
//   } catch { sendError(res, 'Failed to fetch visit charges preview', 500); }
// };
import { Response } from 'express';
import Salary from '../models/Salary';
import EngineerVisit from '../models/EngineerVisit';
import VisitClaim from '../models/VisitClaim';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';
import { generatePayslipPDF } from '../services/pdf.service';
import { notifyUser } from '../utils/notify';
import mongoose from 'mongoose';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Helper: Calculate TDS based on annual income and declarations
const calculateTDS = (monthlySalary: number, taxDeclarations: any, month: number, year: number): number => {
  const annualProjectedSalary = monthlySalary * 12;
  const taxableIncome = annualProjectedSalary - 
    (taxDeclarations?.investments80C || 0) - 
    (taxDeclarations?.medicalInsurance || 0) - 
    (taxDeclarations?.homeLoanInterest || 0) -
    (taxDeclarations?.npsContribution || 0);
  
  // HRA exemption calculation (simplified)
  const hraExemption = Math.min(
    (taxDeclarations?.hraRentPaid || 0) - (monthlySalary * 0.1),
    monthlySalary * 0.4,
    0
  );
  
  const finalTaxable = Math.max(0, taxableIncome - hraExemption);
  
  // New tax regime slabs (FY 2024-25)
  let tax = 0;
  if (finalTaxable <= 300000) tax = 0;
  else if (finalTaxable <= 600000) tax = (finalTaxable - 300000) * 0.05;
  else if (finalTaxable <= 900000) tax = 15000 + (finalTaxable - 600000) * 0.1;
  else if (finalTaxable <= 1200000) tax = 45000 + (finalTaxable - 900000) * 0.15;
  else if (finalTaxable <= 1500000) tax = 90000 + (finalTaxable - 1200000) * 0.2;
  else tax = 150000 + (finalTaxable - 1500000) * 0.3;
  
  // Cess: 4%
  tax = tax * 1.04;
  
  // Monthly TDS
  return Math.ceil(tax / 12);
};

// Helper: Calculate statutory deductions
const calculateStatutoryDeductions = (basicSalary: number) => {
  // PF: 12% of basic (employee contribution)
  const pfDeduction = basicSalary * 0.12;
  
  // ESI: 0.75% if basic <= 21000
  const esiDeduction = basicSalary <= 21000 ? basicSalary * 0.0075 : 0;
  
  // Professional Tax: State-wise slabs (Maharashtra example)
  let professionalTax = 0;
  if (basicSalary <= 3000) professionalTax = 0;
  else if (basicSalary <= 6000) professionalTax = 80;
  else if (basicSalary <= 9000) professionalTax = 150;
  else if (basicSalary <= 12000) professionalTax = 200;
  else professionalTax = 300;
  
  return { pfDeduction, esiDeduction, professionalTax };
};

// Helper: Get claims total
const getClaimsTotal = async (employeeId: any, start: Date, end: Date): Promise<number> => {
  const agg = await VisitClaim.aggregate([
    { 
      $match: { 
        engineerId: new mongoose.Types.ObjectId(employeeId), 
        status: 'approved', 
        isArchived: false, 
        claimDate: { $gte: start, $lte: end } 
      } 
    },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  return agg[0]?.total || 0;
};

// Helper: Get visit charges total
const getVisitChargesTotal = async (employeeId: any, start: Date, end: Date): Promise<number> => {
  const agg = await EngineerVisit.aggregate([
    { 
      $match: { 
        engineerId: new mongoose.Types.ObjectId(employeeId), 
        hrStatus: 'Approved', 
        visitDate: { $gte: start, $lte: end } 
      } 
    },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  return agg[0]?.total || 0;
};

// Helper: Generate salary register PDF (inline function to avoid import error)
const generateSalaryRegisterPDF = async (salaries: any[], monthName: string, year: number): Promise<Buffer> => {
  // Simple PDF generation using html2canvas alternative
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const buffers: Buffer[] = [];
  
  doc.on('data', buffers.push.bind(buffers));
  
  // Header
  doc.fontSize(18).text(`Salary Register - ${monthName} ${year}`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
  doc.moveDown(2);
  
  // Table headers
  const headers = ['Employee', 'Department', 'Basic', 'HRA', 'Incentives', 'PF', 'ESI', 'PT', 'TDS', 'Net Salary', 'Status'];
  const colWidths = [80, 60, 60, 50, 60, 50, 45, 40, 50, 70, 60];
  let y = doc.y;
  
  // Draw header row
  let x = 50;
  doc.fontSize(8).font('Helvetica-Bold');
  headers.forEach((header, i) => {
    doc.text(header, x, y, { width: colWidths[i], align: 'left' });
    x += colWidths[i];
  });
  
  doc.moveDown();
  y = doc.y;
  
  // Draw data rows
  doc.font('Helvetica');
  for (const salary of salaries) {
    x = 50;
    const employee = salary.employeeId as any;
    const rowData = [
      employee?.name?.substring(0, 15) || '-',
      employee?.department?.substring(0, 10) || '-',
      salary.basicSalary?.toLocaleString() || '0',
      salary.hra?.toLocaleString() || '0',
      salary.incentives?.toLocaleString() || '0',
      salary.pfDeduction?.toLocaleString() || '0',
      salary.esiDeduction?.toLocaleString() || '0',
      salary.professionalTax?.toLocaleString() || '0',
      salary.tds?.toLocaleString() || '0',
      salary.finalSalary?.toLocaleString() || '0',
      salary.isPaid ? 'Paid' : 'Calculated'
    ];
    
    rowData.forEach((data, i) => {
      doc.text(String(data), x, y, { width: colWidths[i], align: 'left' });
      x += colWidths[i];
    });
    y += 20;
    
    if (y > 750) {
      doc.addPage();
      y = 50;
    }
  }
  
  doc.end();
  
  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });
  });
};

// GET /salaries - List salaries with filters
export const getSalaries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { organizationId: req.user!.organizationId };
    
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.month) filter.month = parseInt(req.query.month as string);
    if (req.query.year) filter.year = parseInt(req.query.year as string);
    if (req.query.status === 'Paid') filter.isPaid = true;
    if (req.query.status === 'Calculated') filter.isPaid = false;
    
    // Engineers can only see their own
    if (req.user!.role === 'engineer') filter.employeeId = req.user!.id;
    
    const [salaries, total] = await Promise.all([
      Salary.find(filter)
        .populate('employeeId', 'name email role department baseSalary')
        .populate('paidBy', 'name')
        .sort({ year: -1, month: -1 })
        .skip(skip)
        .limit(limit),
      Salary.countDocuments(filter),
    ]);
    
    sendPaginated(res, salaries, total, page, limit);
  } catch (error) {
    console.error('getSalaries error:', error);
    sendError(res, 'Failed to fetch salaries', 500);
  }
};

// POST /salaries/calculate - Calculate salary for an employee
export const calculateSalary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      employeeId, month, year,
      basicSalary: bodyBasicSalary,
      hra, lta, specialAllowance,
      incentives = 0, overtimePay = 0, bonuses = 0,
      travelAllowance = 0, medicalReimbursement = 0, conveyance = 0,
      deductions = 0,
      perquisites = 0,
      loanRepayment = 0, advanceDeduction = 0, otherDeductions = 0,
      recalculate = false,
      taxDeclarations,
      notes
    } = req.body;
    
    // Validate employee
    const employee = await User.findById(employeeId);
    if (!employee) {
      sendError(res, 'Employee not found', 404);
      return;
    }
    
    // Get base salary from request or employee profile
    const basicSalary = bodyBasicSalary !== undefined && bodyBasicSalary !== ''
      ? Number(bodyBasicSalary)
      : (employee.baseSalary || 0);
    
    // Set date range for the month
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    
    // Auto-fetch approved visits and claims
    const [visitChargesTotal, claimsTotal] = await Promise.all([
      getVisitChargesTotal(employeeId, start, end),
      getClaimsTotal(employeeId, start, end)
    ]);
    
    // Calculate standard allowances if not provided
    const calculatedHra = hra !== undefined ? Number(hra) : basicSalary * 0.4;
    const calculatedLta = lta !== undefined ? Number(lta) : basicSalary * 0.1;
    const calculatedSpecialAllowance = specialAllowance !== undefined ? Number(specialAllowance) : basicSalary * 0.2;
    
    // Calculate statutory deductions
    let { pfDeduction, esiDeduction, professionalTax } = calculateStatutoryDeductions(basicSalary);
    
    // Allow manual override of deductions
    if (req.body.pfDeduction !== undefined) pfDeduction = Number(req.body.pfDeduction);
    if (req.body.esiDeduction !== undefined) esiDeduction = Number(req.body.esiDeduction);
    if (req.body.professionalTax !== undefined) professionalTax = Number(req.body.professionalTax);
    
    // Calculate TDS based on salary and tax declarations
    const monthlyGross = basicSalary + calculatedHra + calculatedLta + calculatedSpecialAllowance + 
                         Number(incentives) + Number(overtimePay) + Number(bonuses) + 
                         Number(travelAllowance) + Number(medicalReimbursement) + Number(conveyance);
    
    const tds = calculateTDS(monthlyGross, taxDeclarations || employee.taxDeclarations, month, year);
    
    // Total deductions
    const totalDeductions = pfDeduction + esiDeduction + professionalTax + tds + 
                           Number(loanRepayment) + Number(advanceDeduction) + 
                           Number(otherDeductions) + Number(deductions);
    
    // Check if salary already exists
    const existing = await Salary.findOne({ employeeId, month, year });
    if (existing && !recalculate) {
      sendError(res, 'Salary already calculated for this period. Use recalculate to update.', 409);
      return;
    }
    
    // Prepare salary data
    const salaryData = {
      organizationId: req.user!.organizationId,
      employeeId,
      month, year,
      basicSalary,
      hra: calculatedHra,
      lta: calculatedLta,
      specialAllowance: calculatedSpecialAllowance,
      incentives: Number(incentives),
      overtimePay: Number(overtimePay),
      bonuses: Number(bonuses),
      travelAllowance: Number(travelAllowance),
      medicalReimbursement: Number(medicalReimbursement),
      conveyance: Number(conveyance),
      pfDeduction,
      esiDeduction,
      professionalTax,
      tds,
      loanRepayment: Number(loanRepayment),
      advanceDeduction: Number(advanceDeduction),
      otherDeductions: Number(otherDeductions),
      perquisites: Number(perquisites),
      taxDeclarations: taxDeclarations || employee.taxDeclarations || {},
      notes,
    };
    
    let salary: any;
    if (existing && recalculate) {
      Object.assign(existing, salaryData);
      salary = await existing.save();
    } else {
      salary = await new Salary(salaryData).save();
    }
    
    // Store claims and visits totals as virtuals for frontend
    (salary as any)._claimsTotal = claimsTotal;
    (salary as any)._visitChargesTotal = visitChargesTotal;
    
    // Generate payslip PDF (async, don't wait)
    generatePayslipPDF({
      employeeName: employee.name,
      email: employee.email,
      role: employee.role,
      month: MONTHS[month - 1],
      year,
      basicSalary,
      hra: calculatedHra,
      lta: calculatedLta,
      incentives: Number(incentives),
      travelAllowance: Number(travelAllowance),
      deductions: totalDeductions,
      finalSalary: salary.finalSalary,
      pfDeduction,
      esiDeduction,
      professionalTax,
      tds,
    }).then(pdf => {
      Salary.findByIdAndUpdate(salary._id, { payslipPdf: pdf }).catch(console.error);
    }).catch(console.error);
    
    // Notify employee
    await notifyUser(employeeId, {
      title: 'Salary Calculated',
      message: `Your salary for ${MONTHS[month - 1]} ${year} has been calculated — ₹${salary.finalSalary.toLocaleString()}`,
      type: 'salary',
      link: '/salary',
    });
    
    sendSuccess(res, salary, 'Salary calculated successfully', 201);
  } catch (error) {
    console.error('calculateSalary error:', error);
    sendError(res, 'Failed to calculate salary', 500);
  }
};

// POST /salaries/bulk-calculate - Calculate salaries for all active employees
export const bulkCalculateSalaries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year } = req.body;
    
    if (!month || !year) {
      sendError(res, 'Month and year are required', 400);
      return;
    }
    
    // Get all active employees (excluding admin)
    const employees = await User.find({ 
      organizationId: req.user!.organizationId,
      isActive: true,
      role: { $ne: 'admin' }
    });
    
    const results = {
      total: employees.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };
    
    // Calculate salary for each employee
    for (const employee of employees) {
      try {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        
        const [visitChargesTotal, claimsTotal] = await Promise.all([
          getVisitChargesTotal(employee._id, start, end),
          getClaimsTotal(employee._id, start, end)
        ]);
        
        const basicSalary = employee.baseSalary || 0;
        const { pfDeduction, esiDeduction, professionalTax } = calculateStatutoryDeductions(basicSalary);
        const tds = calculateTDS(basicSalary, employee.taxDeclarations, month, year);
        
        const existing = await Salary.findOne({ employeeId: employee._id, month, year });
        
        const salaryData = {
          organizationId: req.user!.organizationId,
          employeeId: employee._id,
          month, year,
          basicSalary,
          hra: basicSalary * 0.4,
          lta: basicSalary * 0.1,
          specialAllowance: basicSalary * 0.2,
          pfDeduction,
          esiDeduction,
          professionalTax,
          tds,
        };
        
        if (existing) {
          Object.assign(existing, salaryData);
          await existing.save();
        } else {
          await new Salary(salaryData).save();
        }
        
        results.successful++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`${employee.name}: ${err.message || 'Unknown error'}`);
      }
    }
    
    sendSuccess(res, results, `Bulk payroll completed: ${results.successful}/${results.total} successful`);
  } catch (error) {
    console.error('bulkCalculateSalaries error:', error);
    sendError(res, 'Failed to process bulk payroll', 500);
  }
};

// GET /salaries/stats - Get payroll statistics
export const getPayrollStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query;
    const m = month ? parseInt(month as string) : new Date().getMonth() + 1;
    const y = year ? parseInt(year as string) : new Date().getFullYear();
    
    const filter = {
      organizationId: req.user!.organizationId,
      month: m,
      year: y,
    };
    
    const [salaries, totalEmployees] = await Promise.all([
      Salary.find(filter),
      User.countDocuments({ organizationId: req.user!.organizationId, isActive: true, role: { $ne: 'admin' } })
    ]);
    
    const stats = {
      totalPayroll: salaries.reduce((sum, s) => sum + s.finalSalary, 0),
      pendingPayments: salaries.filter(s => !s.isPaid).reduce((sum, s) => sum + s.finalSalary, 0),
      paidThisMonth: salaries.filter(s => s.isPaid).reduce((sum, s) => sum + s.finalSalary, 0),
      totalEmployees,
      calculatedCount: salaries.filter(s => !s.isPaid).length,
      paidCount: salaries.filter(s => s.isPaid).length,
    };
    
    sendSuccess(res, stats);
  } catch (error) {
    console.error('getPayrollStats error:', error);
    sendError(res, 'Failed to fetch payroll stats', 500);
  }
};

// GET /salaries/export - Export salary register
export const exportSalaryRegister = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year, format = 'excel' } = req.query;
    const m = month ? parseInt(month as string) : new Date().getMonth() + 1;
    const y = year ? parseInt(year as string) : new Date().getFullYear();
    
    const salaries = await Salary.find({
      organizationId: req.user!.organizationId,
      month: m,
      year: y,
    }).populate('employeeId', 'name email role department');
    
    if (format === 'excel') {
      try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Salary_Register_${MONTHS[m - 1]}_${y}`);
        
        // Add headers
        worksheet.columns = [
          { header: 'Employee Name', key: 'name', width: 25 },
          { header: 'Department', key: 'department', width: 20 },
          { header: 'Basic Salary', key: 'basic', width: 15 },
          { header: 'HRA', key: 'hra', width: 15 },
          { header: 'Incentives', key: 'incentives', width: 15 },
          { header: 'Travel Allow.', key: 'travel', width: 15 },
          { header: 'PF Deduction', key: 'pf', width: 15 },
          { header: 'ESI', key: 'esi', width: 15 },
          { header: 'Professional Tax', key: 'pt', width: 15 },
          { header: 'TDS', key: 'tds', width: 15 },
          { header: 'Total Earnings', key: 'earnings', width: 15 },
          { header: 'Total Deductions', key: 'deductions', width: 15 },
          { header: 'Net Salary', key: 'net', width: 15 },
          { header: 'Status', key: 'status', width: 12 },
        ];
        
        // Add rows
        for (const salary of salaries) {
          worksheet.addRow({
            name: (salary.employeeId as any)?.name || '-',
            department: (salary.employeeId as any)?.department || '-',
            basic: salary.basicSalary || 0,
            hra: salary.hra || 0,
            incentives: salary.incentives || 0,
            travel: salary.travelAllowance || 0,
            pf: salary.pfDeduction || 0,
            esi: salary.esiDeduction || 0,
            pt: salary.professionalTax || 0,
            tds: salary.tds || 0,
            earnings: salary.totalEarnings || 0,
            deductions: salary.totalDeductions || 0,
            net: salary.finalSalary || 0,
            status: salary.isPaid ? 'Paid' : 'Calculated',
          });
        }
        
        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4F46E5' },
        };
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Salary_Register_${MONTHS[m - 1]}_${y}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
      } catch (excelErr) {
        console.error('Excel generation error:', excelErr);
        sendError(res, 'Failed to generate Excel file', 500);
      }
    } else {
      // Generate PDF
      const pdf = await generateSalaryRegisterPDF(salaries, MONTHS[m - 1], y);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Salary_Register_${MONTHS[m - 1]}_${y}.pdf`);
      res.send(pdf);
    }
  } catch (error) {
    console.error('exportSalaryRegister error:', error);
    sendError(res, 'Failed to export salary register', 500);
  }
};

// PATCH /salaries/:id/mark-paid - Mark salary as paid
export const markSalaryPaid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentMode, bankReference } = req.body;
    
    const salary = await Salary.findByIdAndUpdate(
      req.params.id,
      { 
        isPaid: true, 
        paidAt: new Date(), 
        paidBy: req.user!.id,
        paymentMode,
        bankReference,
      },
      { new: true }
    ).populate('employeeId', 'name email');
    
    if (!salary) {
      sendError(res, 'Salary record not found', 404);
      return;
    }
    
    // Notify employee
    await notifyUser(salary.employeeId.toString(), {
      title: 'Salary Paid',
      message: `Your salary for ${MONTHS[salary.month - 1]} ${salary.year} of ₹${salary.finalSalary.toLocaleString()} has been credited`,
      type: 'salary',
      link: '/salary',
    });
    
    sendSuccess(res, salary, 'Salary marked as paid');
  } catch (error) {
    console.error('markSalaryPaid error:', error);
    sendError(res, 'Failed to mark salary as paid', 500);
  }
};

// GET /salaries/claims-preview - Preview claims for a period
export const getClaimsPreview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId, month, year } = req.query;
    if (!employeeId || !month || !year) {
      sendError(res, 'employeeId, month, year required', 400);
      return;
    }
    
    const m = Number(month);
    const y = Number(year);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const claimsTotal = await getClaimsTotal(employeeId as string, start, end);
    
    sendSuccess(res, { claimsTotal });
  } catch (error) {
    console.error('getClaimsPreview error:', error);
    sendError(res, 'Failed to fetch claims preview', 500);
  }
};

// GET /salaries/visits-preview - Preview visit charges for a period
export const getVisitChargesPreview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId, month, year } = req.query;
    if (!employeeId || !month || !year) {
      sendError(res, 'employeeId, month, year required', 400);
      return;
    }
    
    const m = Number(month);
    const y = Number(year);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const visitChargesTotal = await getVisitChargesTotal(employeeId as string, start, end);
    
    sendSuccess(res, { visitChargesTotal });
  } catch (error) {
    console.error('getVisitChargesPreview error:', error);
    sendError(res, 'Failed to fetch visit charges preview', 500);
  }
};