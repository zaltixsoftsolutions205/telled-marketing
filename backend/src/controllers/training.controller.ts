import { Response } from 'express';
import Training from '../models/Training';
import Account from '../models/Account';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';
import { notifyUser } from '../utils/notify';

export const getTrainings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.mode) filter.mode = req.query.mode;
    if (req.query.accountId) filter.accountId = req.query.accountId;
    if (req.query.engineerId) filter.trainedBy = req.query.engineerId;
    if (req.user!.role === 'engineer') filter.trainedBy = req.user!.id;
    const [trainings, total] = await Promise.all([
      Training.find(filter)
        .populate('accountId', 'companyName')
        .populate('trainedBy', 'name email')
        .sort({ trainingDate: -1 })
        .skip(skip).limit(limit),
      Training.countDocuments(filter),
    ]);
    sendPaginated(res, trainings, total, page, limit);
  } catch { sendError(res, 'Failed to fetch trainings', 500); }
};

export const getTrainingById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const training = await Training.findById(req.params.id)
      .populate('accountId', 'companyName')
      .populate('trainedBy', 'name email');
    if (!training) { sendError(res, 'Training not found', 404); return; }
    sendSuccess(res, training);
  } catch { sendError(res, 'Failed', 500); }
};

export const createTraining = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = { ...req.body };
    if (!data.trainedBy) data.trainedBy = req.user!.id;
    // Get customer name from account if not provided
    if (!data.customerName && data.accountId) {
      const account = await Account.findById(data.accountId);
      if (account) data.customerName = account.companyName;
    }
    const training = await new Training(data).save();
    const populated = await training.populate([
      { path: 'accountId', select: 'companyName' },
      { path: 'trainedBy', select: 'name email' },
    ]);
    const trainerId = (populated.trainedBy as any)?._id?.toString() || data.trainedBy;
    if (trainerId) {
      notifyUser(trainerId, {
        title: 'Training Scheduled',
        message: `A training session has been scheduled for "${(populated.accountId as any)?.companyName || 'a customer'}" on ${data.trainingDate ? new Date(data.trainingDate).toLocaleDateString('en-IN') : 'a scheduled date'}`,
        type: 'general',
        link: '/training',
      });
    }
    sendSuccess(res, populated, 'Training created', 201);
  } catch { sendError(res, 'Failed to create training', 500); }
};

export const updateTraining = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const training = await Training.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('accountId', 'companyName')
      .populate('trainedBy', 'name email');
    if (!training) { sendError(res, 'Training not found', 404); return; }
    sendSuccess(res, training, 'Training updated');
  } catch { sendError(res, 'Failed to update training', 500); }
};
