import { Response } from 'express';
import Leave from '../models/Leave';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';

export const getLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, any> = {};

    if (req.user!.role === 'engineer') {
      filter.employeeId = req.user!.id;
    } else if (req.query.employeeId) {
      filter.employeeId = req.query.employeeId;
    }

    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;

    const [leaves, total] = await Promise.all([
      Leave.find(filter)
        .populate('employeeId', 'name email')
        .populate('approvedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Leave.countDocuments(filter),
    ]);

    sendPaginated(res, leaves, total, page, limit);
  } catch (e) {
    sendError(res, 'Failed to fetch leaves', 500);
  }
};

export const applyLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, startDate, endDate, days, reason } = req.body;
    if (!type || !startDate || !endDate || !days || !reason) {
      sendError(res, 'All fields are required', 400); return;
    }
    const leave = await new Leave({
      employeeId: req.user!.id,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      days: Number(days),
      reason,
      status: 'Pending',
    }).save();
    await leave.populate('employeeId', 'name email');
    sendSuccess(res, leave, 'Leave application submitted', 201);
  } catch (e) {
    sendError(res, 'Failed to apply for leave', 500);
  }
};

export const approveLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.user!.role;
    if (role !== 'admin' && role !== 'hr_finance') {
      sendError(res, 'Not authorized', 403); return;
    }
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { status: 'Approved', approvedBy: req.user!.id, approvedAt: new Date() },
      { new: true }
    ).populate('employeeId', 'name email').populate('approvedBy', 'name');
    if (!leave) { sendError(res, 'Leave not found', 404); return; }
    sendSuccess(res, leave, 'Leave approved');
  } catch (e) {
    sendError(res, 'Failed to approve leave', 500);
  }
};

export const rejectLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.user!.role;
    if (role !== 'admin' && role !== 'hr_finance') {
      sendError(res, 'Not authorized', 403); return;
    }
    const { rejectionReason } = req.body;
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { status: 'Rejected', rejectionReason: rejectionReason || '' },
      { new: true }
    ).populate('employeeId', 'name email').populate('approvedBy', 'name');
    if (!leave) { sendError(res, 'Leave not found', 404); return; }
    sendSuccess(res, leave, 'Leave rejected');
  } catch (e) {
    sendError(res, 'Failed to reject leave', 500);
  }
};
