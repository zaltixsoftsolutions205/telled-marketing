import { Response } from 'express';
import Lead, { STAGE_TO_SALES_STATUS } from '../models/Lead';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';
import { sendDRFEmail, sendDRFExtensionEmail, UserSmtpConfig } from '../services/email.service';
import { getUserSmtp, getUserSmtpWithFallback } from '../utils/getUserSmtp';
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
    const filter: Record<string, unknown> = { organizationId: req.user!.organizationId, isArchived: false };
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
      Lead.find(filter).populate('assignedTo', 'name email').populate('drfSentBy', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Lead.countDocuments(filter),
    ]);
    sendPaginated(res, leads, total, page, limit);
  } catch { sendError(res, 'Failed to fetch leads', 500); }
};

export const getLeadById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, organizationId: req.user!.organizationId }).populate('assignedTo', 'name email');
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
    if (!data.salesStatus) data.salesStatus = 'Uninitiated';
    data.organizationId = req.user!.organizationId;
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
    const old = await Lead.findById(req.params.id).select('status drfEmailSent salesStatus');
    if (!old) { sendError(res, 'Lead not found', 404); return; }

    const updateBody = { ...req.body };
    // Auto-set salesStatus from stage if not manually overridden
    if (updateBody.stage && !updateBody.salesStatus) {
      const auto = STAGE_TO_SALES_STATUS[updateBody.stage as string];
      if (auto) updateBody.salesStatus = auto;
    }

    const lead = await Lead.findByIdAndUpdate(req.params.id, updateBody, { new: true, runValidators: true })
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
      organizationId:    req.user!.organizationId,
      companyName:       r.companyName       || r['Company Name']    || '',
      contactName:       r.contactPersonName || r.contactName        || r['Contact Person'] || r.companyName || r['Company Name'] || '',
      contactPersonName: r.contactPersonName || r['Contact Person']  || '',
      email:             r.email             || r['Email']           || '',
      phone:             r.phone             || r['Phone']           || 'N/A',
      oemName:           r.oemName           || r['OEM Name']        || '',
      source:            r.source            || r['Source']          || 'Import',
      city:              r.city              || r['City']            || undefined,
      state:             r.state             || r['State']           || undefined,
      notes:             r.notes             || r['Notes']           || undefined,
      website:           r.website           || r['Website']         || undefined,
      annualTurnover:    r.annualTurnover    || r['Annual Turnover'] || undefined,
      designation:       r.designation       || r['Designation']     || undefined,
      expectedClosure:   r.expectedClosure   || r['Expected Closure']|| undefined,
      assignedTo:        req.user!.id,
      status:            'New',
      stage:             'New',
    })).filter(d => d.companyName);
    if (!docs.length) { sendError(res, 'No valid rows found. Company Name is required.', 400); return; }
    const result = await Lead.insertMany(docs, { ordered: false });
    sendSuccess(res, { imported: result.length }, `${result.length} leads imported`);
  } catch (e: any) {
    const inserted = e?.result?.nInserted ?? 0;
    if (inserted > 0) { sendSuccess(res, { imported: inserted }, `${inserted} leads imported`); return; }
    logger.error('Import leads error:', e);
    sendError(res, 'Import failed', 500);
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

export const deleteLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) { sendError(res, 'Lead not found', 404); return; }
    sendSuccess(res, null, 'Lead deleted permanently');
  } catch { sendError(res, 'Failed to delete lead', 500); }
};

export const sendDRFExtension = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { drfNumber, companyName, oemName, expiryDate, ownerName } = req.body;
    if (!drfNumber || !companyName) { sendError(res, 'drfNumber and companyName are required', 400); return; }
    const senderSmtp = await getUserSmtpWithFallback(req.user!.id);
    await sendDRFExtensionEmail({ drfNumber, companyName, oemName: oemName || '', expiryDate: expiryDate || '', ownerName: ownerName || '' }, senderSmtp);
    logger.info(`DRF extension email sent for ${drfNumber} (${companyName})`);
    sendSuccess(res, null, 'Extension email sent');
  } catch (err) {
    logger.error('sendDRFExtension failed:', err);
    sendError(res, 'Failed to send extension email', 500);
  }
};

export const sendDRF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const lead = await Lead.findById(req.params.id).populate('assignedTo', 'name email').populate('drfSentBy', 'name');
    if (!lead) { sendError(res, 'Lead not found', 404); return; }
    if (lead.status !== 'Qualified') { sendError(res, 'Lead must be Qualified to send DRF', 400); return; }

    if (lead.drfEmailSent) {
      const sentByName = (lead.drfSentBy as any)?.name || 'another sales person';
      sendError(res, `DRF already sent for this lead by ${sentByName}`, 400);
      return;
    }

    const {
      accountName, address, website, annualTurnover,
      contactPerson, designation, contactNo, email,
      partnerSalesRep, channelPartner, interestedModules,
      expectedClosure, oemEmail: bodyOemEmail,
    } = req.body;

    const assignedUser = lead.assignedTo as any;

    const existingCount = await OEMApprovalAttempt.countDocuments({ leadId: lead._id });
    const attemptNumber = existingCount + 1;
    const { drfNumber } = genDRFNumber();

    const oemEmail = bodyOemEmail || (lead as any).oemEmail || lead.email;
    if (!oemEmail) { sendError(res, 'OEM email is required', 400); return; }

    await new OEMApprovalAttempt({
      organizationId: req.user!.organizationId,
      leadId: lead._id, attemptNumber, status: 'Pending',
      sentDate: new Date(), expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdBy: req.user!.id,
    }).save();

    await Lead.findByIdAndUpdate(lead._id, { drfNumber, drfEmailSent: true, drfEmailSentAt: new Date(), drfSentBy: req.user!.id });

    let senderSmtp;
    try {
      senderSmtp = await getUserSmtp(req.user!.id, true);
    } catch (smtpErr: any) {
      sendError(res, smtpErr.message || 'Your personal email is not configured. Please set up your email in settings before sending a DRF.', 400);
      return;
    }

    try {
      await sendDRFEmail(oemEmail, {
        drfNumber, version: attemptNumber,
        companyName: accountName || lead.companyName,
        contactName: contactPerson || lead.contactPersonName || lead.contactName || '',
        oemName: interestedModules || lead.oemName || '',
        salesName: partnerSalesRep || senderSmtp?.fromName || assignedUser?.name || 'Telled Sales',
        salesEmail: senderSmtp?.fromEmail || assignedUser?.email || '',
        address, website, annualTurnover,
        designation, contactNo: contactNo || lead.phone,
        email: email || lead.email,
        channelPartner, interestedModules: interestedModules || lead.oemName,
        expectedClosure,
      }, senderSmtp);
    } catch (emailErr: any) {
      logger.error('DRF email failed:', emailErr);
      sendError(res, `DRF created but email failed: ${emailErr?.message || 'SMTP error'}`, 500);
      return;
    }

    logger.info(`DRF sent for lead ${lead._id} (${lead.companyName}) → ${oemEmail} — ${drfNumber}`);
    notifyRole(['admin'], {
      title: 'DRF Submitted for OEM Approval',
      message: `DRF ${drfNumber} sent to OEM for "${accountName || lead.companyName}"`,
      type: 'general', link: '/oem',
    });
    sendSuccess(res, { drfNumber, sentTo: oemEmail }, 'DRF sent successfully');
  } catch (err) {
    logger.error('sendDRF failed:', err);
    sendError(res, 'Failed to send DRF', 500);
  }
};
