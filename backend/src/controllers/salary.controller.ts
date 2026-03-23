import { Response } from 'express';
import Salary from '../models/Salary';
import EngineerVisit from '../models/EngineerVisit';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';
import { generatePayslipPDF } from '../services/pdf.service';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export const getSalaries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false };
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
    const { employeeId, month, year, incentives = 0, deductions = 0, travelAllowance = 0, notes } = req.body;
    if (await Salary.findOne({ employeeId, month, year })) { sendError(res, 'Salary already calculated for this period', 409); return; }
    const employee = await User.findById(employeeId);
    if (!employee) { sendError(res, 'Employee not found', 404); return; }
    const [start, end] = [new Date(year, month - 1, 1), new Date(year, month, 0)];
    const visitAgg = await EngineerVisit.aggregate([
      { $match: { engineerId: employee._id, hrStatus: 'Approved', visitDate: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const visitChargesTotal = visitAgg[0]?.total || 0;
    const salary = await new Salary({ employeeId, month, year, baseSalary: employee.baseSalary, visitChargesTotal, travelAllowance, incentives, deductions, notes }).save();
    try {
      const pdf = await generatePayslipPDF({ employeeName: employee.name, email: employee.email, role: employee.role, month: MONTHS[month - 1], year, baseSalary: employee.baseSalary, visitChargesTotal, travelAllowance, incentives, deductions, finalSalary: salary.finalSalary });
      await Salary.findByIdAndUpdate(salary._id, { payslipPdf: pdf });
    } catch (_e) {}
    sendSuccess(res, salary, 'Salary calculated', 201);
  } catch { sendError(res, 'Failed to calculate salary', 500); }
};

export const markSalaryPaid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const salary = await Salary.findByIdAndUpdate(req.params.id, { isPaid: true, paidAt: new Date(), paidBy: req.user!.id }, { new: true });
    if (!salary) { sendError(res, 'Salary record not found', 404); return; }
    sendSuccess(res, salary, 'Salary marked as paid');
  } catch { sendError(res, 'Failed', 500); }
};
