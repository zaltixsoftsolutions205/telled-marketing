import { Response } from 'express';
import Installation from '../models/Installation';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';

export const getInstallations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.accountId) filter.accountId = req.query.accountId;
    if (req.user!.role === 'engineer') filter.engineerId = req.user!.id;
    const [installations, total] = await Promise.all([
      Installation.find(filter).populate('accountId', 'companyName').populate('engineerId', 'name').populate('assignedBy', 'name').sort({ scheduledDate: 1 }).skip(skip).limit(limit),
      Installation.countDocuments(filter),
    ]);
    sendPaginated(res, installations, total, page, limit);
  } catch { sendError(res, 'Failed', 500); }
};

export const createInstallation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const inst = await new Installation({ ...req.body, assignedBy: req.user!.id }).save();
    sendSuccess(res, inst, 'Installation scheduled', 201);
  } catch { sendError(res, 'Failed', 500); }
};

export const updateInstallation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const update = { ...req.body, ...(req.body.status === 'Completed' && { completedDate: new Date() }) };
    const inst = await Installation.findByIdAndUpdate(req.params.id, update, { new: true }).populate('accountId', 'companyName').populate('engineerId', 'name');
    if (!inst) { sendError(res, 'Installation not found', 404); return; }
    sendSuccess(res, inst, 'Installation updated');
  } catch { sendError(res, 'Failed', 500); }
};
