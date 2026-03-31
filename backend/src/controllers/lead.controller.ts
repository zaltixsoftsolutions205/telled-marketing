import { Response } from 'express';
import Lead from '../models/Lead';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';
import { sendDRFEmail } from '../services/email.service';
import logger from '../utils/logger';
import { notifyUser, notifyRole } from '../utils/notify';

// Generate a DRF number: DRF-YYYYMMDD-XXXX
const genDRFNumber = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return { drfNumber: `DRF-${date}-${rand}`, rand, date };
};

export const getLeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { stage, status, search, assignedTo } = req.query;
    const filter: Record<string, unknown> = { isArchived: false };
    if (stage) filter.stage = stage;
    if (status) filter.status = status;
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
    // Normalize field names from frontend
    if (!data.contactName && data.contactPersonName) data.contactName = data.contactPersonName;
    if (!data.assignedTo) data.assignedTo = req.user!.id;
    if (!data.status) data.status = 'New';
    if (!data.stage)  data.stage  = 'New';
    // Strip empty optional enum fields to avoid validation errors
    if (!data.source) delete data.source;
    if (!data.oemName) delete data.oemName;
    const lead = await new Lead(data).save();
    const populated = await lead.populate('assignedTo', 'name email');
    const assignedId = (populated.assignedTo as any)?._id?.toString() || data.assignedTo;
    if (assignedId && assignedId !== req.user!.id) {
      notifyUser(assignedId, {
        title: 'New Lead Assigned',
        message: `Lead "${populated.companyName}" has been assigned to you`,
        type: 'general',
        link: '/leads',
      });
    }
    sendSuccess(res, populated, 'Lead created', 201);
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message || 'Failed to create lead';
    sendError(res, msg, 500);
  }
};

export const updateLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Fetch old status before update
    const old = await Lead.findById(req.params.id).select('status drfEmailSent');
    if (!old) { sendError(res, 'Lead not found', 404); return; }

    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('assignedTo', 'name email');
    if (!lead) { sendError(res, 'Lead not found', 404); return; }

    // DRF is no longer auto-sent on Qualified — use the dedicated sendDRF endpoint

    // Notify assigned sales if stage changed to key milestones
    const assignedId = (lead.assignedTo as any)?._id?.toString() || (lead.assignedTo as any)?.toString();
    if (req.body.stage && assignedId) {
      const stageMessages: Record<string, string> = {
        'OEM Approved':  `OEM approved for lead "${lead.companyName}" — proceed with quotation`,
        'OEM Rejected':  `OEM rejected for lead "${lead.companyName}"`,
        'PO Received':   `PO received for "${lead.companyName}" — ready to convert to account`,
        'Converted':     `Lead "${lead.companyName}" has been converted to an account`,
        'Lost':          `Lead "${lead.companyName}" marked as Lost`,
      };
      const msg = stageMessages[req.body.stage];
      if (msg) notifyUser(assignedId, { title: `Lead Stage: ${req.body.stage}`, message: msg, type: 'general', link: '/leads' });
    }
    sendSuccess(res, lead, 'Lead updated');
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message || 'Failed to update lead';
    sendError(res, msg, 500);
  }
};

export const importLeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows: Array<Record<string, string>> = req.body.rows || [];
    if (!rows.length) { sendError(res, 'No rows provided', 400); return; }
    const docs = rows.map(r => ({
      companyName:       r.companyName       || r['Company Name']    || '',
      contactName:       r.contactPersonName || r.contactName        || r['Contact Person'] || '',
      contactPersonName: r.contactPersonName || r['Contact Person']  || '',
      email:             r.email || r['Email'] || '',
      phone:             r.phone || r['Phone'] || '',
      oemName:           r.oemName || r['OEM Name'] || '',
      source:            r.source || r['Source'] || undefined,
      city:              r.city || r['City'] || undefined,
      state:             r.state || r['State'] || undefined,
      notes:             r.notes || r['Notes'] || undefined,
      assignedTo:        req.user!.id,
      status:            'New',
      stage:             'New',
    })).filter(d => d.companyName && d.email);
    await Lead.insertMany(docs, { ordered: false });
    sendSuccess(res, { imported: docs.length }, `${docs.length} leads imported`);
  } catch { sendError(res, 'Import failed', 500); }
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

export const deleteLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) { sendError(res, 'Lead not found', 404); return; }
    sendSuccess(res, null, 'Lead deleted permanently');
  } catch { sendError(res, 'Failed to delete lead', 500); }
};

export const sendDRF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lead = await Lead.findById(req.params.id).populate('assignedTo', 'name email');
    if (!lead) { sendError(res, 'Lead not found', 404); return; }
    if (lead.status !== 'Qualified') { sendError(res, 'Lead must be Qualified to send DRF', 400); return; }

    // Use form values from request body, fall back to lead fields
    const {
      accountName, address, website, annualTurnover,
      contactPerson, designation, contactNo, email,
      partnerSalesRep, channelPartner, interestedModules,
      expectedClosure, oemEmail: bodyOemEmail, notes,
    } = req.body;

    const assignedUser = lead.assignedTo as any;

    // Sequential attempt number for this lead (v1, v2, v3...)
    const existingCount = await OEMApprovalAttempt.countDocuments({ leadId: lead._id });
    const attemptNumber = existingCount + 1;
    const { drfNumber } = genDRFNumber();

    const oemEmail = bodyOemEmail || (lead as any).oemEmail || lead.email;
    if (!oemEmail) { sendError(res, 'OEM email is required', 400); return; }

    const recipients = [oemEmail];
    if (assignedUser?.email && assignedUser.email !== oemEmail) recipients.push(assignedUser.email);

    await sendDRFEmail(recipients.join(','), {
      drfNumber, version: attemptNumber,
      companyName: accountName || lead.companyName,
      contactName: contactPerson || lead.contactPersonName || lead.contactName || '',
      oemName: interestedModules || lead.oemName || '',
      salesName: partnerSalesRep || assignedUser?.name || 'Telled Sales',
      salesEmail: assignedUser?.email || '',
      address, website, annualTurnover,
      designation, contactNo: contactNo || lead.phone,
      email: email || lead.email,
      channelPartner, interestedModules: interestedModules || lead.oemName,
      expectedClosure,
    });

    await new OEMApprovalAttempt({
      leadId: lead._id, attemptNumber, status: 'Pending',
      sentDate: new Date(), expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdBy: req.user!.id,
    }).save();

    await Lead.findByIdAndUpdate(lead._id, { drfNumber, drfEmailSent: true, drfEmailSentAt: new Date() });
    logger.info(`DRF sent for lead ${lead._id} (${lead.companyName}) → ${oemEmail} — ${drfNumber}`);
    notifyRole(['admin'], {
      title: 'DRF Submitted for OEM Approval',
      message: `DRF ${drfNumber} sent to OEM for "${accountName || lead.companyName}"`,
      type: 'general', link: '/oem',
    });
    sendSuccess(res, { drfNumber }, 'DRF sent successfully');
  } catch (err) {
    logger.error('sendDRF failed:', err);
    sendError(res, 'Failed to send DRF', 500);
  }
};
