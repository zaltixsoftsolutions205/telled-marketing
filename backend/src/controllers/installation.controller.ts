import { Response } from 'express';
import Installation from '../models/Installation';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';
import { notifyUser, notifyRole } from '../utils/notify';

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
    const data = { ...req.body };
    // Normalize: frontend sends "engineer", backend uses "engineerId"
    if (data.engineer && !data.engineerId) { data.engineerId = data.engineer; delete data.engineer; }
    data.assignedBy = req.user!.id;
    const inst = await new Installation(data).save();
    if (data.engineerId) {
      notifyUser(data.engineerId, {
        title: 'Installation Scheduled',
        message: `A new installation has been scheduled for you on ${data.scheduledDate ? new Date(data.scheduledDate).toLocaleDateString('en-IN') : 'a scheduled date'}`,
        type: 'general',
        link: '/installations',
      });
    }
    sendSuccess(res, inst, 'Installation scheduled', 201);
  } catch { sendError(res, 'Failed', 500); }
};

export const updateInstallation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const update = { ...req.body, ...(req.body.status === 'Completed' && { completedDate: new Date() }) };
    const inst = await Installation.findByIdAndUpdate(req.params.id, update, { new: true }).populate('accountId', 'companyName').populate('engineerId', 'name');
    if (!inst) { sendError(res, 'Installation not found', 404); return; }
    if (req.body.status === 'Completed') {
      notifyRole(['admin', 'hr_finance'], {
        title: 'Installation Completed',
        message: `Installation for "${(inst.accountId as any)?.companyName || 'an account'}" has been marked as completed`,
        type: 'general',
        link: '/installations',
      });
    }
    sendSuccess(res, inst, 'Installation updated');
  } catch { sendError(res, 'Failed', 500); }
};
