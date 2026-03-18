import { Response } from 'express';
import path from 'path';
import Lead from '../models/Lead';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';
import { generateDRFPDF } from '../services/pdf.service';
import { sendDRFEmail } from '../services/email.service';
import logger from '../utils/logger';

const uploadDir = process.env.UPLOAD_PATH || './uploads';

// Generate a DRF number: DRF-YYYYMMDD-XXXX
const genDRFNumber = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DRF-${date}-${rand}`;
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

    // ── Auto DRF email when status transitions to Qualified ──────────────
    if (req.body.status === 'Qualified' && old.status !== 'Qualified' && !old.drfEmailSent) {
      const assignedUser = lead.assignedTo as any;
      const drfNumber = genDRFNumber();
      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

      try {
        const pdfFile = await generateDRFPDF({
          drfNumber,
          version: 1,
          date: today,
          companyName: lead.companyName,
          contactName: lead.contactName || lead.contactPersonName || '',
          email: lead.email,
          phone: lead.phone,
          city: lead.city,
          state: lead.state,
          oemName: lead.oemName,
          source: lead.source,
          salesName: assignedUser?.name || 'Telled Sales',
          salesEmail: assignedUser?.email || process.env.SMTP_USER || '',
          notes: lead.notes,
        });

        const pdfAbsPath = path.join(process.cwd(), uploadDir, pdfFile);

        // Send to the lead's email contact AND the assigned sales user
        const recipients = [lead.email];
        if (assignedUser?.email && assignedUser.email !== lead.email) {
          recipients.push(assignedUser.email);
        }

        await sendDRFEmail(
          recipients.join(','),
          {
            drfNumber,
            version: 1,
            companyName: lead.companyName,
            contactName: lead.contactName || lead.contactPersonName || '',
            oemName: lead.oemName || '',
            salesName: assignedUser?.name || 'Telled Sales',
          },
          pdfAbsPath
        );

        // Mark DRF email as sent so it doesn't re-send on subsequent updates
        await Lead.findByIdAndUpdate(lead._id, { drfEmailSent: true, drfEmailSentAt: new Date() });
        logger.info(`DRF email sent for lead ${lead._id} (${lead.companyName}) — ${drfNumber}`);
      } catch (emailErr) {
        // Don't fail the request if email fails — just log it
        logger.error('DRF email/PDF generation failed:', emailErr);
      }
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
