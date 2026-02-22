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
    if (req.query.approved !== undefined) filter.approvedByHR = req.query.approved === 'true';
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
    const visit = await new EngineerVisit({ ...req.body, engineerId: req.body.engineerId || req.user!.id }).save();
    sendSuccess(res, visit, 'Visit logged', 201);
  } catch { sendError(res, 'Failed', 500); }
};

export const approveVisit = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const visit = await EngineerVisit.findByIdAndUpdate(req.params.id, { approvedByHR: true, approvedBy: req.user!.id, approvedAt: new Date() }, { new: true });
    if (!visit) { sendError(res, 'Visit not found', 404); return; }
    sendSuccess(res, visit, 'Visit approved');
  } catch { sendError(res, 'Failed', 500); }
};
