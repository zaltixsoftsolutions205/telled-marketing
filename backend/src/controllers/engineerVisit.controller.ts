import { Response } from 'express';
import EngineerVisit from '../models/EngineerVisit';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';

export const getVisits = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false };
    if (req.query.engineerId) filter.engineerId = req.query.engineerId;
    if (req.query.hrStatus) filter.hrStatus = req.query.hrStatus;
    if (req.user!.role === 'engineer') filter.engineerId = req.user!.id;
    if (req.query.month && req.query.year) {
      const m = parseInt(req.query.month as string), y = parseInt(req.query.year as string);
      filter.visitDate = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0) };
    }
    const [visits, total] = await Promise.all([
      EngineerVisit.find(filter).populate('engineerId', 'name email').populate('accountId', 'companyName').sort({ visitDate: -1 }).skip(skip).limit(limit),
      EngineerVisit.countDocuments(filter),
    ]);
    sendPaginated(res, visits, total, page, limit);
  } catch { sendError(res, 'Failed', 500); }
};

export const createVisit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = { ...req.body };
    if (!data.engineerId) data.engineerId = req.user!.id;
    // Map workDone → purpose for backward compat
    if (data.workDone && !data.purpose) data.purpose = data.workDone;
    const visit = await new EngineerVisit(data).save();
    const populated = await visit.populate([
      { path: 'engineerId', select: 'name email' },
      { path: 'accountId', select: 'companyName' },
    ]);
    sendSuccess(res, populated, 'Visit logged', 201);
  } catch { sendError(res, 'Failed', 500); }
};

export const approveVisit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const visit = await EngineerVisit.findByIdAndUpdate(
      req.params.id,
      { hrStatus: 'Approved', approvedBy: req.user!.id, approvedAt: new Date() },
      { new: true }
    ).populate('engineerId', 'name email').populate('accountId', 'companyName');
    if (!visit) { sendError(res, 'Visit not found', 404); return; }
    sendSuccess(res, visit, 'Visit approved');
  } catch { sendError(res, 'Failed', 500); }
};

export const rejectVisit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const visit = await EngineerVisit.findByIdAndUpdate(
      req.params.id,
      { hrStatus: 'Rejected', rejectionReason: req.body.reason || '', approvedBy: req.user!.id, approvedAt: new Date() },
      { new: true }
    ).populate('engineerId', 'name email').populate('accountId', 'companyName');
    if (!visit) { sendError(res, 'Visit not found', 404); return; }
    sendSuccess(res, visit, 'Visit rejected');
  } catch { sendError(res, 'Failed', 500); }
};

export const scheduleVisit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { visitType, scheduledDate, accountId, notes } = req.body;
    if (!visitType || !scheduledDate || !accountId) {
      sendError(res, 'visitType, scheduledDate, and accountId are required', 400);
      return;
    }
    const data = {
      visitType,
      scheduledDate: new Date(scheduledDate),
      accountId,
      notes,
      engineerId: req.body.engineerId || req.user!.id,
      status: 'Scheduled',
      // visitDate defaults to scheduledDate; will be updated on completion
      visitDate: new Date(scheduledDate),
      purpose: visitType,
    };
    const visit = await new EngineerVisit(data).save();
    const populated = await visit.populate([
      { path: 'engineerId', select: 'name email' },
      { path: 'accountId', select: 'companyName' },
    ]);
    sendSuccess(res, populated, 'Visit scheduled', 201);
  } catch { sendError(res, 'Failed', 500); }
};

export const completeVisit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const visit = await EngineerVisit.findById(req.params.id);
    if (!visit) { sendError(res, 'Visit not found', 404); return; }

    const now = new Date();
    const { workNotes, visitCharges, travelAllowance, additionalExpense } = req.body;

    visit.status = 'Completed';
    visit.completedAt = now;
    visit.visitDate = now;
    if (workNotes !== undefined) visit.workNotes = workNotes;
    if (visitCharges !== undefined) visit.visitCharges = Number(visitCharges);
    if (travelAllowance !== undefined) visit.travelAllowance = Number(travelAllowance);
    if (additionalExpense !== undefined) visit.additionalExpense = Number(additionalExpense);
    // totalAmount is recalculated by pre-save hook
    await visit.save();

    const populated = await visit.populate([
      { path: 'engineerId', select: 'name email' },
      { path: 'accountId', select: 'companyName' },
    ]);
    sendSuccess(res, populated, 'Visit marked as completed');
  } catch { sendError(res, 'Failed', 500); }
};

export const getVisitById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const visit = await EngineerVisit.findById(req.params.id)
      .populate('engineerId', 'name email')
      .populate('accountId', 'companyName')
      .populate('approvedBy', 'name email');
    if (!visit) { sendError(res, 'Visit not found', 404); return; }
    sendSuccess(res, visit);
  } catch { sendError(res, 'Failed', 500); }
};

export const updateVisitStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const allowed: string[] = ['Scheduled', 'In Progress', 'Cancelled'];
    if (!status || !allowed.includes(status)) {
      sendError(res, `status must be one of: ${allowed.join(', ')}`, 400);
      return;
    }
    const visit = await EngineerVisit.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('engineerId', 'name email').populate('accountId', 'companyName');
    if (!visit) { sendError(res, 'Visit not found', 404); return; }
    sendSuccess(res, visit, 'Status updated');
  } catch { sendError(res, 'Failed', 500); }
};
