import { Response } from 'express';
import Lead from '../models/Lead';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';

export const getLeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { stage, search, assignedTo } = req.query;
    const filter: Record<string, unknown> = { isArchived: false };
    if (stage) filter.stage = stage;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (req.user!.role === 'sales') filter.assignedTo = req.user!.id;
    if (search) filter.$or = [
      { companyName:  { $regex: sanitizeQuery(search as string), $options: 'i' } },
      { contactName:  { $regex: sanitizeQuery(search as string), $options: 'i' } },
      { email:        { $regex: sanitizeQuery(search as string), $options: 'i' } },
    ];
    const [leads, total] = await Promise.all([
      Lead.find(filter).populate('assignedTo', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Lead.countDocuments(filter),
    ]);
    sendPaginated(res, leads, total, page, limit);
  } catch { sendError(res, 'Failed to fetch leads', 500); }
};

export const getLeadById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lead = await Lead.findById(req.params.id).populate('assignedTo', 'name email');
    if (!lead || lead.isArchived) { sendError(res, 'Lead not found', 404); return; }
    const oemAttempts = await OEMApprovalAttempt.find({ leadId: lead._id })
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ attemptNumber: 1 });
    sendSuccess(res, { lead, oemAttempts });
  } catch { sendError(res, 'Failed to fetch lead', 500); }
};

export const createLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = { ...req.body };
    if (!data.assignedTo) data.assignedTo = req.user!.id;
    const lead = await new Lead(data).save();
    const populated = await lead.populate('assignedTo', 'name email');
    sendSuccess(res, populated, 'Lead created', 201);
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message || 'Failed to create lead';
    sendError(res, msg, 500);
  }
};

export const updateLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('assignedTo', 'name email');
    if (!lead) { sendError(res, 'Lead not found', 404); return; }
    sendSuccess(res, lead, 'Lead updated');
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message || 'Failed to update lead';
    sendError(res, msg, 500);
  }
};

export const archiveLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { isArchived: true, archivedAt: new Date(), archivedBy: req.user!.id },
      { new: true }
    );
    if (!lead) { sendError(res, 'Lead not found', 404); return; }
    sendSuccess(res, lead, 'Lead archived');
  } catch { sendError(res, 'Failed to archive lead', 500); }
};
