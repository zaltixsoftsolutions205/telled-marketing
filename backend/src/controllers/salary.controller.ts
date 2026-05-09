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

const getClaimsTotal = async (employeeId: any, start: Date, end: Date): Promise<number> => {
  const agg = await VisitClaim.aggregate([
    { $match: { engineerId: new mongoose.Types.ObjectId(employeeId), status: 'approved', isArchived: false, claimDate: { $gte: start, $lte: end } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  return agg[0]?.total || 0;
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const getSalaries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { organizationId: req.user!.organizationId };
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.month) filter.month = parseInt(req.query.month as string);
    if (req.query.year) filter.year = parseInt(req.query.year as string);
    if (req.user!.role === 'engineer') filter.employeeId = req.user!.id;
    const [salaries, total] = await Promise.all([
      Salary.find(filter).populate('employeeId', 'name email role').sort({ year: -1, month: -1 }).skip(skip).limit(limit),
      Salary.countDocuments(filter),
    ]);
    sendPaginated(res, salaries, total, page, limit);
  } catch { sendError(res, 'Failed', 500); }
};

export const calculateSalary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId, month, year, baseSalary: bodyBaseSalary, incentives = 0, deductions = 0, travelAllowance = 0, notes, recalculate = false } = req.body;
    const employee = await User.findById(employeeId);
    if (!employee) { sendError(res, 'Employee not found', 404); return; }

    // Use baseSalary from request if provided, else fall back to employee profile
    const baseSalary = bodyBaseSalary !== undefined && bodyBaseSalary !== ''
      ? Number(bodyBaseSalary)
      : (employee.baseSalary || 0);

    const [start, end] = [new Date(year, month - 1, 1), new Date(year, month, 0)];
    const visitAgg = await EngineerVisit.aggregate([
      { $match: { engineerId: employee._id, hrStatus: 'Approved', visitDate: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const visitChargesTotal = visitAgg[0]?.total || 0;
    const claimsTotal = await getClaimsTotal(employeeId, start, end);

    // If recalculate=true, update existing record; otherwise create new
    const existing = await Salary.findOne({ employeeId, month, year });
    if (existing && !recalculate) { sendError(res, 'Salary already calculated for this period. Use recalculate to update.', 409); return; }

    let salary: any;
    if (existing && recalculate) {
      existing.baseSalary = baseSalary;
      existing.visitChargesTotal = visitChargesTotal;
      existing.claimsTotal = claimsTotal;
      existing.travelAllowance = Number(travelAllowance);
      existing.incentives = Number(incentives);
      existing.deductions = Number(deductions);
      if (notes !== undefined) existing.notes = notes;
      salary = await existing.save();
    } else {
      salary = await new Salary({ organizationId: req.user!.organizationId, employeeId, month, year, baseSalary, visitChargesTotal, claimsTotal, travelAllowance, incentives, deductions, notes }).save();
    }
    try {
      const pdf = await generatePayslipPDF({ employeeName: employee.name, email: employee.email, role: employee.role, month: MONTHS[month - 1], year, baseSalary, visitChargesTotal, travelAllowance, incentives, deductions, finalSalary: salary.finalSalary });
      await Salary.findByIdAndUpdate(salary._id, { payslipPdf: pdf });
    } catch (_e) {}
    notifyUser(employeeId, {
      title: 'Salary Calculated',
      message: `Your salary for ${MONTHS[month - 1]} ${year} has been calculated — ₹${salary.finalSalary?.toLocaleString() || '0'}`,
      type: 'salary',
      link: '/salary',
    });
    sendSuccess(res, salary, 'Salary calculated', 201);
  } catch { sendError(res, 'Failed to calculate salary', 500); }
};

export const markSalaryPaid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const salary = await Salary.findByIdAndUpdate(req.params.id, { isPaid: true, paidAt: new Date(), paidBy: req.user!.id }, { new: true });
    if (!salary) { sendError(res, 'Salary record not found', 404); return; }
    notifyUser(salary.employeeId.toString(), {
      title: 'Salary Paid',
      message: `Your salary for ${MONTHS[(salary.month as number) - 1]} ${salary.year} of ₹${(salary as any).finalSalary?.toLocaleString() || '0'} has been paid`,
      type: 'salary',
      link: '/salary',
    });
    sendSuccess(res, salary, 'Salary marked as paid');
  } catch { sendError(res, 'Failed', 500); }
};

export const getClaimsPreview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId, month, year } = req.query;
    if (!employeeId || !month || !year) { sendError(res, 'employeeId, month, year required', 400); return; }
    const m = Number(month); const y = Number(year);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const claimsTotal = await getClaimsTotal(employeeId as string, start, end);
    sendSuccess(res, { claimsTotal });
  } catch { sendError(res, 'Failed to fetch claims preview', 500); }
};

export const getVisitChargesPreview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId, month, year } = req.query;
    if (!employeeId || !month || !year) { sendError(res, 'employeeId, month, year required', 400); return; }
    const m = Number(month); const y = Number(year);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const agg = await EngineerVisit.aggregate([
      { $match: { engineerId: new mongoose.Types.ObjectId(employeeId as string), hrStatus: 'Approved', visitDate: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    sendSuccess(res, { visitChargesTotal: agg[0]?.total || 0 });
  } catch { sendError(res, 'Failed to fetch visit charges preview', 500); }
};
