import { Response } from 'express';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import Lead from '../models/Lead';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';
import { addDays } from '../utils/helpers';
import { OEM_EXPIRY_DAYS } from '../config/constants';
import { sendOEMApprovalRequest, sendOEMRejectionNotification } from '../services/email.service';

export const getAttemptsByLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attempts = await OEMApprovalAttempt.find({ leadId: req.params.leadId }).populate('createdBy', 'name email').sort({ attemptNumber: 1 });
    sendSuccess(res, attempts);
  } catch { sendError(res, 'Failed to fetch OEM attempts', 500); }
};

export const createAttempt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leadId } = req.params;
    const lead = await Lead.findById(leadId);
    if (!lead || lead.isArchived) { sendError(res, 'Lead not found', 404); return; }
    if (await OEMApprovalAttempt.findOne({ leadId, status: 'Pending' })) { sendError(res, 'A pending OEM attempt already exists', 400); return; }
    if (await OEMApprovalAttempt.findOne({ leadId, status: 'Approved' })) { sendError(res, 'OEM already approved', 400); return; }
    const last = await OEMApprovalAttempt.findOne({ leadId }).sort({ attemptNumber: -1 });
    const attempt = await new OEMApprovalAttempt({
      leadId, attemptNumber: (last?.attemptNumber || 0) + 1, status: 'Pending',
      sentDate: new Date(), expiryDate: addDays(new Date(), OEM_EXPIRY_DAYS),
      createdBy: req.user!.id, notes: req.body.notes,
    }).save();
    await Lead.findByIdAndUpdate(leadId, { stage: 'OEM Pending' });
    await sendOEMApprovalRequest(lead.contactEmail, lead.companyName, lead.oemName, attempt.attemptNumber);
    sendSuccess(res, attempt, 'OEM request submitted', 201);
  } catch { sendError(res, 'Failed to create OEM attempt', 500); }
};

export const approveAttempt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attempt = await OEMApprovalAttempt.findById(req.params.id);
    if (!attempt) { sendError(res, 'Attempt not found', 404); return; }
    if (attempt.status !== 'Pending') { sendError(res, 'Only pending attempts can be approved', 400); return; }
    attempt.status = 'Approved'; attempt.approvedDate = new Date(); attempt.approvedBy = req.body.approvedBy || req.user!.name;
    await attempt.save();
    await Lead.findByIdAndUpdate(attempt.leadId, { stage: 'OEM Approved' });
    sendSuccess(res, attempt, 'OEM approved');
  } catch { sendError(res, 'Failed to approve', 500); }
};

export const rejectAttempt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    if (!reason) { sendError(res, 'Rejection reason required', 400); return; }
    const attempt = await OEMApprovalAttempt.findById(req.params.id);
    if (!attempt) { sendError(res, 'Attempt not found', 404); return; }
    if (attempt.status !== 'Pending') { sendError(res, 'Only pending attempts can be rejected', 400); return; }
    attempt.status = 'Rejected'; attempt.rejectedDate = new Date(); attempt.rejectionReason = reason;
    await attempt.save();
    const lead = await Lead.findByIdAndUpdate(attempt.leadId, { stage: 'OEM Rejected' }, { new: true });
    if (lead) await sendOEMRejectionNotification(lead.contactEmail, lead.companyName, reason, attempt.attemptNumber);
    sendSuccess(res, attempt, 'OEM rejected');
  } catch { sendError(res, 'Failed to reject', 500); }
};

export const extendExpiry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { days = 15, reason } = req.body;
    const attempt = await OEMApprovalAttempt.findById(req.params.id);
    if (!attempt || attempt.status !== 'Pending') { sendError(res, 'Cannot extend non-pending attempt', 400); return; }
    const previousExpiry = attempt.expiryDate || new Date();
    const newExpiry = addDays(previousExpiry, days);
    attempt.extensionHistory.push({ extendedAt: new Date(), previousExpiry, newExpiry, extendedBy: req.user!.name, reason });
    attempt.extensionCount += 1; attempt.expiryDate = newExpiry;
    await attempt.save();
    sendSuccess(res, attempt, 'Expiry extended');
  } catch { sendError(res, 'Failed to extend', 500); }
};
