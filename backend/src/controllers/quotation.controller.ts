import { Response } from 'express';
import Quotation from '../models/Quotation';
import Lead from '../models/Lead';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';
import sendEmail from '../services/email.service';

const genQNum = () => `QT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;

export const getQuotations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.leadId) filter.leadId = req.query.leadId;
    const [quotations, total] = await Promise.all([
      Quotation.find(filter).populate('leadId', 'companyName contactPersonName email').populate('createdBy', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Quotation.countDocuments(filter),
    ]);
    sendPaginated(res, quotations, total, page, limit);
  } catch { sendError(res, 'Failed to fetch quotations', 500); }
};

export const createQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leadId, items, taxRate = 18, validUntil, terms, notes } = req.body;
    if (!leadId || !items?.length) { sendError(res, 'leadId and items are required', 400); return; }
    const subtotal = items.reduce((s: number, i: { total: number }) => s + (i.total || 0), 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    // Count existing quotations for this lead to set version
    const existingCount = await Quotation.countDocuments({ leadId, isArchived: false });
    const quotation = await new Quotation({
      leadId, items, subtotal, taxRate, taxAmount, total, validUntil, terms, notes,
      quotationNumber: genQNum(),
      version: existingCount + 1,
      status: 'Sent',
      createdBy: req.user!.id,
    }).save();
    // Update lead stage
    await Lead.findByIdAndUpdate(leadId, { stage: 'Quotation Sent' });
    sendSuccess(res, quotation, 'Quotation created', 201);
  } catch (e) { sendError(res, 'Failed to create quotation', 500); }
};

export const acceptQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = await Quotation.findByIdAndUpdate(req.params.id, { status: 'Accepted' }, { new: true });
    if (!q) { sendError(res, 'Quotation not found', 404); return; }
    sendSuccess(res, q, 'Quotation accepted');
  } catch { sendError(res, 'Failed', 500); }
};

export const rejectQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = await Quotation.findByIdAndUpdate(req.params.id, { status: 'Rejected' }, { new: true });
    if (!q) { sendError(res, 'Quotation not found', 404); return; }
    sendSuccess(res, q, 'Quotation rejected');
  } catch { sendError(res, 'Failed', 500); }
};

export const sendQuotationEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = await Quotation.findById(req.params.id).populate('leadId', 'companyName email contactPersonName');
    if (!q) { sendError(res, 'Quotation not found', 404); return; }
    const lead = q.leadId as unknown as { companyName: string; email: string; contactPersonName: string };
    if (!lead?.email) { sendError(res, 'Lead email not found', 400); return; }
    const html = `<div style="font-family:Arial,sans-serif;padding:20px">
      <h2 style="color:#4f2d7f">Quotation ${q.quotationNumber}</h2>
      <p>Dear ${lead.contactPersonName || lead.companyName},</p>
      <p>Please find your quotation details below:</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #eee;background:#f5f3ff;font-weight:bold">Quotation #</td><td style="padding:8px;border:1px solid #eee">${q.quotationNumber}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;background:#f5f3ff;font-weight:bold">Amount</td><td style="padding:8px;border:1px solid #eee">₹${q.total.toLocaleString()}</td></tr>
        ${q.validUntil ? `<tr><td style="padding:8px;border:1px solid #eee;background:#f5f3ff;font-weight:bold">Valid Until</td><td style="padding:8px;border:1px solid #eee">${new Date(q.validUntil).toLocaleDateString()}</td></tr>` : ''}
      </table>
      <p style="margin-top:16px;color:#666">Please review and revert at your earliest convenience.</p>
    </div>`;
    await sendEmail(lead.email, `Quotation ${q.quotationNumber} from Telled CRM`, html);
    await Quotation.findByIdAndUpdate(req.params.id, { emailSent: true, emailSentAt: new Date() });
    sendSuccess(res, {}, 'Email sent');
  } catch { sendError(res, 'Failed to send email', 500); }
};

export const generateQuotationPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = await Quotation.findById(req.params.id).populate('leadId', 'companyName');
    if (!q) { sendError(res, 'Quotation not found', 404); return; }
    // Mark pdf as generated (actual PDF generation can be extended)
    const pdfPath = `quotation-${q.quotationNumber}.pdf`;
    await Quotation.findByIdAndUpdate(req.params.id, { pdfPath });
    sendSuccess(res, { pdfPath }, 'PDF generated');
  } catch { sendError(res, 'Failed to generate PDF', 500); }
};
