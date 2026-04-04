import { Response } from 'express';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import Lead from '../models/Lead';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendPaginated, sendError } from '../utils/response';
import { addDays } from '../utils/helpers';
import { OEM_EXPIRY_DAYS } from '../config/constants';
import { sendOEMApprovalRequest, sendOEMRejectionNotification } from '../services/email.service';
import { syncEmailsForDRF } from '../services/emailInbox.service';

export const getAllDRFs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 20;
    const page  = Number(req.query.page)  || 1;
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.leadId) filter.leadId = req.query.leadId;
    const [data, total] = await Promise.all([
      OEMApprovalAttempt.find(filter).populate('leadId', 'companyName oemName contactPersonName contactName email oemEmail').populate('createdBy', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      OEMApprovalAttempt.countDocuments(filter),
    ]);
    sendPaginated(res, data, total, page, limit);
  } catch { sendError(res, 'Failed to fetch DRFs', 500); }
};

export const getDRFAnalytics = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [total, pending, approved, rejected] = await Promise.all([
      OEMApprovalAttempt.countDocuments({}),
      OEMApprovalAttempt.countDocuments({ status: 'Pending' }),
      OEMApprovalAttempt.countDocuments({ status: 'Approved' }),
      OEMApprovalAttempt.countDocuments({ status: 'Rejected' }),
    ]);
    const approvalRate  = total ? Math.round((approved / total) * 100) : 0;
    const rejectionRate = total ? Math.round((rejected / total) * 100) : 0;
    sendSuccess(res, { total, pending, approved, rejected, approvalRate, rejectionRate, expiringSoon: 0 });
  } catch { sendError(res, 'Failed to get analytics', 500); }
};

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
    await Lead.findByIdAndUpdate(leadId, { stage: 'OEM Submitted' });
    const d = attempt.sentDate;
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const drfNumber = `DRF-${dateStr}-${String(attempt.attemptNumber).padStart(3, '0')}`;
    const oemTo = lead.oemEmail || lead.email;
    await sendOEMApprovalRequest(oemTo, lead.companyName, lead.oemName || '', attempt.attemptNumber, drfNumber);
    sendSuccess(res, attempt, 'OEM request submitted', 201);
  } catch { sendError(res, 'Failed to create OEM attempt', 500); }
};

export const approveAttempt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attempt = await OEMApprovalAttempt.findById(req.params.id);
    if (!attempt) { sendError(res, 'Attempt not found', 404); return; }
    attempt.status = 'Approved'; attempt.approvedDate = new Date(); attempt.approvedBy = req.body.approvedBy || req.user!.name;
    attempt.rejectedDate = undefined; attempt.rejectionReason = undefined;
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
    attempt.status = 'Rejected'; attempt.rejectedDate = new Date(); attempt.rejectionReason = reason;
    await attempt.save();
    const lead = await Lead.findByIdAndUpdate(attempt.leadId, { stage: 'OEM Rejected' }, { new: true });
    if (lead) await sendOEMRejectionNotification(lead.email, lead.companyName, reason, attempt.attemptNumber);
    sendSuccess(res, attempt, 'OEM rejected');
  } catch { sendError(res, 'Failed to reject', 500); }
};

export const resendDRF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attempt = await OEMApprovalAttempt.findById(req.params.id);
    if (!attempt) { sendError(res, 'DRF not found', 404); return; }
    if (attempt.status !== 'Rejected') { sendError(res, 'Only rejected DRFs can be resent', 400); return; }

    const daysSinceRejection = attempt.rejectedDate
      ? Math.floor((Date.now() - new Date(attempt.rejectedDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (daysSinceRejection < 30) {
      sendError(res, `Cannot resend yet. ${30 - daysSinceRejection} day(s) remaining before resend is allowed.`, 400);
      return;
    }

    const lead = await Lead.findById(attempt.leadId);
    if (!lead) { sendError(res, 'Lead not found', 404); return; }

    // Reset to Pending and update sentDate
    attempt.status = 'Pending';
    attempt.sentDate = new Date();
    attempt.rejectedDate = undefined;
    attempt.rejectionReason = undefined;
    attempt.approvedDate = undefined;
    attempt.approvedBy = undefined;
    await attempt.save();
    await Lead.findByIdAndUpdate(attempt.leadId, { stage: 'OEM Submitted' });

    const d = attempt.sentDate;
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const drfNumber = `DRF-${dateStr}-${String(attempt.attemptNumber).padStart(3, '0')}`;
    const oemTo = lead.oemEmail || lead.email;
    await sendOEMApprovalRequest(oemTo, lead.companyName, lead.oemName || '', attempt.attemptNumber, drfNumber);

    sendSuccess(res, attempt, 'DRF email resent successfully');
  } catch { sendError(res, 'Failed to resend DRF', 500); }
};

export const resetToPending = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attempt = await OEMApprovalAttempt.findById(req.params.id);
    if (!attempt) { sendError(res, 'Attempt not found', 404); return; }
    attempt.status = 'Pending';
    attempt.rejectedDate = undefined;
    attempt.rejectionReason = undefined;
    attempt.approvedDate = undefined;
    attempt.approvedBy = undefined;
    await attempt.save();
    await Lead.findByIdAndUpdate(attempt.leadId, { stage: 'OEM Submitted' });
    sendSuccess(res, attempt, 'Reset to Pending');
  } catch { sendError(res, 'Failed to reset', 500); }
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

// POST /api/oem/sync-emails  — reads inbox and auto-approves/rejects Pending DRFs
export const syncDRFEmails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await syncEmailsForDRF();
    sendSuccess(res, result, `Sync complete — ${result.processed} DRFs updated`);
  } catch (err) {
    sendError(res, 'Email sync failed', 500);
  }
};

// PATCH /api/oem/:id/reassign  — admin transfers DRF ownership to another sales person
export const reassignDRF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { newOwnerId } = req.body;
    if (!newOwnerId) { sendError(res, 'newOwnerId is required', 400); return; }

    const attempt = await OEMApprovalAttempt.findById(req.params.id).populate('leadId');
    if (!attempt) { sendError(res, 'DRF not found', 404); return; }

    // New owner must be a sales user inside the same org
    const newOwner = await User.findOne({
      _id: newOwnerId,
      role: 'sales',
      isActive: true,
      organizationId: req.user!.organizationId,
    });
    if (!newOwner) { sendError(res, 'Target user not found or is not an active sales member', 400); return; }

    // Reassign the lead to the new sales person
    await Lead.findByIdAndUpdate(attempt.leadId, { assignedTo: newOwner._id });

    sendSuccess(res, { drfId: attempt._id, newOwner: { id: newOwner._id, name: newOwner.name } }, 'DRF ownership reassigned');
  } catch { sendError(res, 'Failed to reassign DRF', 500); }
};

export const deleteDRF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attempt = await OEMApprovalAttempt.findById(req.params.id);
    if (!attempt) { sendError(res, 'DRF not found', 404); return; }
    await attempt.deleteOne();
    sendSuccess(res, null, 'DRF deleted');
  } catch { sendError(res, 'Failed to delete DRF', 500); }
};
