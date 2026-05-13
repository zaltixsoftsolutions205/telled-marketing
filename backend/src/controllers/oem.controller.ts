import { Response } from 'express';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import Lead from '../models/Lead';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendPaginated, sendError } from '../utils/response';
import { addDays } from '../utils/helpers';
import { OEM_EXPIRY_DAYS } from '../config/constants';
import { sendOEMApprovalRequest, sendOEMRejectionNotification, sendDRFEmail, sendOEMExtensionRequest } from '../services/email.service';
import { syncEmailsForDRF, ImapCredentials } from '../services/emailInbox.service';
import { UserSmtpConfig } from '../services/email.service';
import { getUserSmtp, getUserSmtpWithFallback } from '../utils/getUserSmtp';
import { decryptText } from '../utils/crypto';

export const getAllDRFs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 20;
    const page  = Number(req.query.page)  || 1;
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.leadId) filter.leadId = req.query.leadId;
    // Prospects page (status=Approved): admin/manager/engineer see all; sales sees own
    // DRF Management page (no status filter): sales/admin see own
    const role = req.user!.role;
    const isProspectsView = req.query.status === 'Approved';
    if (role === 'admin' || role === 'manager' || (isProspectsView && role === 'engineer')) {
      // see all in org — no extra filter
    } else {
      filter.createdBy = req.user!.id;
    }
    const [data, total] = await Promise.all([
      OEMApprovalAttempt.find(filter).populate('leadId', 'companyName oemName contactPersonName contactName email oemEmail').populate('createdBy', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      OEMApprovalAttempt.countDocuments(filter),
    ]);
    sendPaginated(res, data, total, page, limit);
  } catch { sendError(res, 'Failed to fetch DRFs', 500); }
};

export const getDRFAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const base = req.user!.role !== 'admin' ? { createdBy: req.user!.id } : {};
    const [total, pending, approved, rejected] = await Promise.all([
      OEMApprovalAttempt.countDocuments(base),
      OEMApprovalAttempt.countDocuments({ ...base, status: 'Pending' }),
      OEMApprovalAttempt.countDocuments({ ...base, status: 'Approved' }),
      OEMApprovalAttempt.countDocuments({ ...base, status: 'Rejected' }),
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
    const oemTo = lead.oemEmail;
    if (!oemTo) {
      await attempt.deleteOne();
      await Lead.findByIdAndUpdate(leadId, { stage: 'New' });
      sendError(res, 'OEM Email is not set on this lead. Please edit the lead and add the OEM Email before sending a DRF.', 400);
      return;
    }
    const sender = await User.findById(req.user!.id).select('name email smtpHost smtpUser smtpPass');
    let senderSmtp;
    try {
      senderSmtp = await getUserSmtp(req.user!.id, true);
    } catch (smtpErr: any) {
      await attempt.deleteOne();
      await Lead.findByIdAndUpdate(leadId, { stage: 'New' });
      sendError(res, smtpErr.message || 'Your personal email is not configured. Please set up your email in settings before sending a DRF.', 400);
      return;
    }
    await sendDRFEmail(oemTo, {
      drfNumber,
      version:           attempt.attemptNumber,
      companyName:       lead.companyName,
      contactName:       (lead as any).contactPersonName || (lead as any).contactName || '',
      oemName:           lead.oemName || '',
      salesName:         sender?.name || 'ZIEOS Sales',
      salesEmail:        sender?.email || '',
      address:           (lead as any).address || '',
      website:           (lead as any).website || '',
      annualTurnover:    (lead as any).annualTurnover || '',
      designation:       (lead as any).designation || '',
      contactNo:         (lead as any).phone || (lead as any).contactNo || '',
      email:             lead.email || '',
      channelPartner:    (lead as any).channelPartner || 'ZIEOS',
      interestedModules: (lead as any).interestedModules || lead.oemName || '',
      expectedClosure:   (lead as any).expectedClosure || '',
    }, senderSmtp);
    sendSuccess(res, attempt, 'OEM request submitted', 201);
  } catch (e: any) {
    if (!res.headersSent) sendError(res, e?.message || 'Failed to create OEM attempt', 500);
  }
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
    if (lead) {
      const senderSmtp = await getUserSmtpWithFallback(req.user!.id);
      await sendOEMRejectionNotification(lead.email, lead.companyName, reason, attempt.attemptNumber, senderSmtp);
    }
    sendSuccess(res, attempt, 'OEM rejected');
  } catch { sendError(res, 'Failed to reject', 500); }
};

export const resendDRF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attempt = await OEMApprovalAttempt.findById(req.params.id);
    if (!attempt) { sendError(res, 'DRF not found', 404); return; }
    if (!['Rejected', 'Approved'].includes(attempt.status)) {
      sendError(res, 'Only rejected or approved DRFs can be resent', 400); return;
    }

    const lead = await Lead.findById(attempt.leadId);
    if (!lead) { sendError(res, 'Lead not found', 404); return; }

    // Keep original sentDate only for DRF number, then update sentDate to now
    // so the email sync correctly ignores old reply emails (before this resend)
    const d = new Date(attempt.sentDate);
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const drfNumber = `DRF-${dateStr}-${String(attempt.attemptNumber).padStart(3, '0')}`;

    attempt.status = 'Pending';
    attempt.sentDate = new Date(); // updated so sync ignores emails older than this resend
    attempt.rejectedDate = undefined;
    attempt.rejectionReason = undefined;
    attempt.approvedDate = undefined;
    attempt.approvedBy = undefined;
    await attempt.save();
    await Lead.findByIdAndUpdate(attempt.leadId, { stage: 'OEM Submitted' });

    const oemTo = lead.oemEmail;
    if (!oemTo) {
      sendError(res, 'OEM Email is not set on this lead. Please edit the lead and add the OEM Email before resending.', 400);
      return;
    }
    let senderSmtp;
    try {
      senderSmtp = await getUserSmtp(req.user!.id, true);
    } catch (smtpErr: any) {
      sendError(res, smtpErr.message || 'Your personal email is not configured. Please set up your email in settings before sending a DRF.', 400);
      return;
    }
    const sender = await User.findById(req.user!.id).select('name email');
    const b = req.body || {};
    await sendDRFEmail(oemTo, {
      drfNumber,
      version: attempt.attemptNumber,
      companyName:       b.accountName       || lead.companyName,
      contactName:       b.contactPerson      || (lead as any).contactPersonName || (lead as any).contactName || '',
      oemName:           b.interestedModules  || lead.oemName || '',
      salesName:         b.partnerSalesRep    || sender?.name || 'ZIEOS Sales',
      salesEmail:        sender?.email || '',
      address:           b.address            || (lead as any).address || '',
      website:           b.website            || (lead as any).website || '',
      annualTurnover:    b.annualTurnover     || (lead as any).annualTurnover || '',
      designation:       b.designation        || (lead as any).designation || '',
      contactNo:         b.contactNo          || (lead as any).phone || '',
      email:             b.email              || lead.email || '',
      channelPartner:    b.channelPartner     || (lead as any).channelPartner || '',
      interestedModules: b.interestedModules  || lead.oemName || '',
      expectedClosure:   b.expectedClosure    || (lead as any).expectedClosure || '',
      customEmailBody:   b.customEmailBody    || '',
    }, senderSmtp);

    sendSuccess(res, attempt, 'DRF email resent successfully');
  } catch (e: any) {
    if (!res.headersSent) sendError(res, e?.message || 'Failed to resend DRF', 500);
  }
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

// POST /api/oem/sync-emails  — reads logged-in user's inbox and auto-approves/rejects Pending DRFs
export const syncDRFEmails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id)
      .select('smtpHost smtpPort smtpUser smtpPass msRefreshToken email');

    // ── Personal Outlook/Hotmail with OAuth → use Graph delegated sync ──────────
    if ((user as any)?.msRefreshToken) {
      const { syncEmailsForDRFViaGraph } = await import('../services/emailInbox.service');
      const result = await syncEmailsForDRFViaGraph((user as any).msRefreshToken, user!.email);
      sendSuccess(res, result, `Sync complete — ${result.processed} DRFs updated`);
      return;
    }

    // ── SMTP/IMAP user (Gmail, Zoho, Hostinger, GoDaddy, Yahoo, iCloud…) ────────
    if (!user?.smtpUser || !user?.smtpPass) {
      sendError(res, 'Your email is not configured. Please log out and log in again to set up your email.', 400);
      return;
    }

    let imapPass: string;
    try {
      imapPass = decryptText(user.smtpPass);
    } catch {
      sendError(res, 'Could not read your email credentials. Please log out and log in again.', 400);
      return;
    }

    const smtpHost = user.smtpHost || '';
    let imapHost: string;
    if (smtpHost.includes('gmail')) {
      imapHost = 'imap.gmail.com';
    } else if (smtpHost.includes('office365') || smtpHost.includes('outlook')) {
      imapHost = 'imap-mail.outlook.com';
    } else if (smtpHost.includes('yahoo')) {
      imapHost = 'imap.mail.yahoo.com';
    } else if (smtpHost.includes('zoho')) {
      imapHost = 'imap.zoho.com';
    } else if (smtpHost.includes('hostinger')) {
      imapHost = 'imap.hostinger.com';
    } else if (smtpHost.includes('godaddy') || smtpHost.includes('secureserver')) {
      imapHost = 'imap.secureserver.net';
    } else if (smtpHost.includes('titan')) {
      imapHost = 'imap.titan.email';
    } else if (smtpHost.includes('fastmail')) {
      imapHost = 'imap.fastmail.com';
    } else if (smtpHost.includes('icloud') || smtpHost.includes('me.com')) {
      imapHost = 'imap.mail.me.com';
    } else {
      // Generic fallback: swap smtp. prefix for imap.
      imapHost = smtpHost.replace(/^smtp\./, 'imap.');
    }

    const creds: ImapCredentials = {
      host: imapHost,
      port: 993,
      user: user.smtpUser,
      pass: imapPass,
    };

    const result = await syncEmailsForDRF(creds);
    sendSuccess(res, result, `Sync complete — ${result.processed} DRFs updated`);
  } catch (err: any) {
    sendError(res, err?.message || 'Email sync failed', 500);
  }
};

// PATCH /api/oem/:id/request-extension  — mark DRF as extension requested & email OEM
export const requestExtension = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const attempt = await OEMApprovalAttempt.findById(req.params.id).populate('leadId');
    if (!attempt) { sendError(res, 'DRF not found', 404); return; }
    attempt.extensionRequested = true;
    attempt.extensionRequestedAt = new Date();
    await attempt.save();

    const lead = attempt.leadId as any;
    const oemTo = req.body?.toEmail || lead?.oemEmail || lead?.email;

    if (oemTo && attempt.expiryDate) {
      const d = new Date(attempt.sentDate);
      const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      const drfNumber = `DRF-${dateStr}-${String(attempt.attemptNumber).padStart(3, '0')}`;

      // getUserSmtp without required=true so it falls back to system SMTP instead of throwing
      const senderSmtp = await getUserSmtp(req.user!.id);
      const sender = await User.findById(req.user!.id).select('name email');

      await sendOEMExtensionRequest(oemTo, {
        drfNumber,
        companyName: lead.companyName,
        oemName: lead.oemName || '',
        expiryDate: attempt.expiryDate.toISOString(),
        salesName: sender?.name || 'ZIEOS',
        salesEmail: sender?.email || '',
        // Custom fields from composer modal
        customSubject:     req.body?.customSubject,
        customMessage:     req.body?.customMessage,
        toName:            req.body?.toName,
        requestedNewExpiry: req.body?.requestedNewExpiry,
      }, senderSmtp);
    }

    sendSuccess(res, attempt, 'Extension email sent');
  } catch (e: any) {
    sendError(res, e?.message || 'Failed to request extension', 500);
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

export const updateProspectStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { prospectStatus } = req.body;
    if (!prospectStatus) { sendError(res, 'prospectStatus is required', 400); return; }
    const attempt = await OEMApprovalAttempt.findByIdAndUpdate(
      req.params.id,
      { prospectStatus },
      { new: true }
    );
    if (!attempt) { sendError(res, 'DRF not found', 404); return; }
    sendSuccess(res, attempt, 'Prospect status updated');
  } catch { sendError(res, 'Failed to update prospect status', 500); }
};
