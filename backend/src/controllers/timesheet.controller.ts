import { Response } from 'express';
import Timesheet from '../models/Timesheet';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';

export const getTimesheets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { month, year, status, userId } = req.query;
    const isManager = req.user!.role === 'admin' || req.user!.role === 'hr';

    const filter: Record<string, unknown> = { organizationId: req.user!.organizationId };
    // Non-managers can only see their own timesheets
    if (!isManager) filter.userId = req.user!.id;
    else if (userId) filter.userId = userId;

    if (month) filter.month = Number(month);
    if (year)  filter.year  = Number(year);
    if (status) filter.status = status;

    const [data, total] = await Promise.all([
      Timesheet.find(filter)
        .populate('userId', 'name email role department')
        .populate('approvedBy', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      Timesheet.countDocuments(filter),
    ]);
    sendPaginated(res, data, total, page, limit);
  } catch { sendError(res, 'Failed to fetch timesheets', 500); }
};

export const createTimesheet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, taskType, description, hoursWorked, project, notes } = req.body;
    if (!date || !taskType || !description || !hoursWorked) {
      sendError(res, 'date, taskType, description, hoursWorked are required', 400); return;
    }
    const d = new Date(date);
    const entry = await new Timesheet({
      userId:         req.user!.id,
      organizationId: req.user!.organizationId,
      date:           d,
      taskType,
      description,
      hoursWorked:    Number(hoursWorked),
      project,
      notes,
      status:         'Draft',
      month:          d.getMonth() + 1,
      year:           d.getFullYear(),
    }).save();
    const populated = await Timesheet.findById(entry._id).populate('userId', 'name email role');
    sendSuccess(res, populated, 'Timesheet entry created', 201);
  } catch { sendError(res, 'Failed to create timesheet entry', 500); }
};

export const updateTimesheet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entry = await Timesheet.findOne({ _id: req.params.id, organizationId: req.user!.organizationId });
    if (!entry) { sendError(res, 'Entry not found', 404); return; }
    // Only owner can edit Draft entries; managers can edit any
    const isOwner  = entry.userId.toString() === req.user!.id;
    const isManager = req.user!.role === 'admin' || req.user!.role === 'hr';
    if (!isOwner && !isManager) { sendError(res, 'Forbidden', 403); return; }
    if (!isManager && entry.status !== 'Draft') { sendError(res, 'Only Draft entries can be edited', 400); return; }

    const { date, taskType, description, hoursWorked, project, notes } = req.body;
    if (date) { const d = new Date(date); entry.date = d; entry.month = d.getMonth() + 1; entry.year = d.getFullYear(); }
    if (taskType)    entry.taskType    = taskType;
    if (description) entry.description = description;
    if (hoursWorked) entry.hoursWorked = Number(hoursWorked);
    if (project !== undefined) entry.project = project;
    if (notes   !== undefined) entry.notes   = notes;
    await entry.save();
    const populated = await Timesheet.findById(entry._id).populate('userId', 'name email role');
    sendSuccess(res, populated, 'Updated');
  } catch { sendError(res, 'Failed to update', 500); }
};

export const deleteTimesheet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entry = await Timesheet.findOne({ _id: req.params.id, organizationId: req.user!.organizationId });
    if (!entry) { sendError(res, 'Entry not found', 404); return; }
    const isOwner   = entry.userId.toString() === req.user!.id;
    const isManager = req.user!.role === 'admin' || req.user!.role === 'hr';
    if (!isOwner && !isManager) { sendError(res, 'Forbidden', 403); return; }
    await entry.deleteOne();
    sendSuccess(res, null, 'Deleted');
  } catch { sendError(res, 'Failed to delete', 500); }
};

export const submitTimesheet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entry = await Timesheet.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!entry) { sendError(res, 'Entry not found', 404); return; }
    if (entry.status !== 'Draft') { sendError(res, 'Only Draft entries can be submitted', 400); return; }
    entry.status = 'Submitted';
    await entry.save();
    sendSuccess(res, entry, 'Submitted for approval');
  } catch { sendError(res, 'Failed', 500); }
};

export const approveTimesheet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entry = await Timesheet.findOne({ _id: req.params.id, organizationId: req.user!.organizationId });
    if (!entry) { sendError(res, 'Entry not found', 404); return; }
    entry.status     = 'Approved';
    entry.approvedBy = req.user!.id as any;
    entry.approvedAt = new Date();
    await entry.save();
    sendSuccess(res, entry, 'Approved');
  } catch { sendError(res, 'Failed', 500); }
};

export const rejectTimesheet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entry = await Timesheet.findOne({ _id: req.params.id, organizationId: req.user!.organizationId });
    if (!entry) { sendError(res, 'Entry not found', 404); return; }
    entry.status          = 'Rejected';
    entry.rejectionReason = req.body.reason || '';
    await entry.save();
    sendSuccess(res, entry, 'Rejected');
  } catch { sendError(res, 'Failed', 500); }
};
