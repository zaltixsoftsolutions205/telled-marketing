import { Response } from 'express';
import mongoose from 'mongoose';
import Leave from '../models/Leave';
import Organization from '../models/Organization';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';
import { notifyRole, notifyUser } from '../utils/notify';

const LEAVE_TYPES = ['Casual', 'Sick', 'Annual', 'Unpaid'] as const;
const DEFAULT_POLICY = { Casual: 12, Sick: 6, Annual: 15, Unpaid: 0 };

export const getLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, any> = {};

    const role = req.user!.role;
    if (role === 'engineer' || role === 'sales') {
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

export const getLeaveBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.user!.role;
    const employeeId = (role === 'engineer' || role === 'sales')
      ? req.user!.id
      : ((req.query.employeeId as string) || req.user!.id);

    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    const org = await Organization.findById(req.user!.organizationId).select('leavePolicy').lean();
    const policy = (org as any)?.leavePolicy || DEFAULT_POLICY;

    const agg = await Leave.aggregate([
      {
        $match: {
          employeeId: new mongoose.Types.ObjectId(employeeId),
          status: 'Approved',
          startDate: { $gte: start, $lte: end },
        },
      },
      { $group: { _id: '$type', used: { $sum: '$days' } } },
    ]);

    const usedMap: Record<string, number> = {};
    for (const a of agg) usedMap[a._id] = a.used;

    const balance: Record<string, { allocated: number; used: number; remaining: number }> = {};
    for (const type of LEAVE_TYPES) {
      const allocated = policy[type] ?? 0;
      const used = usedMap[type] || 0;
      balance[type] = { allocated, used, remaining: Math.max(0, allocated - used) };
    }

    sendSuccess(res, balance, 'Leave balance fetched');
  } catch (e) {
    sendError(res, 'Failed to fetch leave balance', 500);
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
    const emp = leave.employeeId as any;
    notifyRole(['admin', 'hr_finance'], {
      title: 'New Leave Request',
      message: `${emp?.name || 'An employee'} applied for ${type} leave (${days} day${Number(days) > 1 ? 's' : ''})`,
      type: 'leave',
      link: '/leaves',
    });
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
    const empId = (leave.employeeId as any)?._id?.toString() || leave.employeeId.toString();
    notifyUser(empId, {
      title: 'Leave Approved',
      message: `Your ${leave.type} leave request has been approved`,
      type: 'leave',
      link: '/leaves',
    });
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
    const empId2 = (leave.employeeId as any)?._id?.toString() || leave.employeeId.toString();
    notifyUser(empId2, {
      title: 'Leave Rejected',
      message: `Your ${leave.type} leave request was rejected${rejectionReason ? ': ' + rejectionReason : ''}`,
      type: 'leave',
      link: '/leaves',
    });
    sendSuccess(res, leave, 'Leave rejected');
  } catch (e) {
    sendError(res, 'Failed to reject leave', 500);
  }
};
