import { Response } from 'express';
import Quotation from '../models/Quotation';
import Lead from '../models/Lead';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';
import sendEmail from '../services/email.service';
import { generateQuotationPDF } from '../services/pdf.service';
import logger from '../utils/logger';

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
    const q = await Quotation.findById(req.params.id)
      .populate('leadId', 'companyName email contactPersonName phone city state address');
    if (!q) { sendError(res, 'Quotation not found', 404); return; }
    const lead = q.leadId as unknown as {
      companyName: string; email: string; contactPersonName: string;
      phone?: string; city?: string; state?: string; address?: string;
    };
    if (!lead?.email) { sendError(res, 'Lead email not found', 400); return; }

    // Generate PDF
    const pdfFile = await generateQuotationPDF({
      quotationNumber:  q.quotationNumber,
      contactName:      lead.contactPersonName || lead.companyName,
      contactEmail:     lead.email,
      contactPhone:     lead.phone,
      contactAddress:   [lead.address, lead.city, lead.state].filter(Boolean).join(', '),
      items:            q.items.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
      subtotal:         q.subtotal,
      taxRate:          q.taxRate,
      taxAmount:        q.taxAmount,
      total:            q.total,
      validUntil:       q.validUntil,
      notes:            q.notes,
      terms:            q.terms,
    });

    const pdfPath = require('path').join(process.env.UPLOAD_PATH || './uploads', pdfFile);

    // Build email HTML
    const html = `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0}
      .c{max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)}
      .h{background:#CD6B5A;padding:28px;text-align:center}
      .b{padding:28px;color:#333;line-height:1.6}
      .f{background:#f8f8f8;padding:16px;text-align:center;font-size:12px;color:#888}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      td{padding:9px 12px;border:1px solid #eee}
      .lbl{background:#F5E0DB;font-weight:bold;width:40%}
    </style></head><body><div class="c">
    <div class="h">
      <h1 style="color:#fff;margin:0;font-size:22px">QUOTATION</h1>
      <p style="color:#fff;margin:6px 0 0;opacity:.9;font-size:13px">${q.quotationNumber}</p>
    </div>
    <div class="b">
      <p>Dear <b>${lead.contactPersonName || lead.companyName}</b>,</p>
      <p>Please find attached the quotation from <b>Telled CRM</b>. Details are summarised below:</p>
      <table>
        <tr><td class="lbl">Quotation #</td><td>${q.quotationNumber}</td></tr>
        <tr><td class="lbl">Date</td><td>${new Date().toLocaleDateString('en-IN')}</td></tr>
        <tr><td class="lbl">Sub Total</td><td>&#8377; ${q.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td class="lbl">Tax (${q.taxRate}%)</td><td>&#8377; ${q.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td class="lbl" style="background:#CD6B5A;color:#fff">Total Amount</td><td style="font-weight:bold;font-size:15px">&#8377; ${q.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
        ${q.validUntil ? `<tr><td class="lbl">Valid Until</td><td>${new Date(q.validUntil).toLocaleDateString('en-IN')}</td></tr>` : ''}
        ${q.notes ? `<tr><td class="lbl">Notes</td><td>${q.notes}</td></tr>` : ''}
      </table>
      <p style="margin-top:16px;color:#666;font-size:13px">The detailed quotation PDF is attached to this email. Please review and revert at your earliest convenience.</p>
      <p style="color:#666;font-size:13px">For any queries, feel free to reach us at <b>${process.env.EMAIL_FROM}</b>.</p>
    </div>
    <div class="f">&#169; ${new Date().getFullYear()} Telled CRM &nbsp;|&nbsp; Thanks for your business!</div>
    </div></body></html>`;

    await sendEmail(
      lead.email,
      `Quotation ${q.quotationNumber} from Telled CRM`,
      html,
      [{ filename: `Quotation-${q.quotationNumber}.pdf`, path: pdfPath }]
    );
    await Quotation.findByIdAndUpdate(req.params.id, { emailSent: true, emailSentAt: new Date(), pdfPath: pdfFile });
    sendSuccess(res, {}, 'Email sent with PDF attachment');
  } catch (err) {
    logger.error('sendQuotationEmail failed:', err);
    sendError(res, 'Failed to send email', 500);
  }
};

export const generateQuotationPDFRoute = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = await Quotation.findById(req.params.id)
      .populate('leadId', 'companyName email contactPersonName phone city state address');
    if (!q) { sendError(res, 'Quotation not found', 404); return; }
    const lead = q.leadId as unknown as {
      companyName: string; email: string; contactPersonName: string;
      phone?: string; city?: string; state?: string; address?: string;
    };
    const pdfFile = await generateQuotationPDF({
      quotationNumber: q.quotationNumber,
      contactName:     lead.contactPersonName || lead.companyName,
      contactEmail:    lead.email,
      contactPhone:    lead.phone,
      contactAddress:  [lead.address, lead.city, lead.state].filter(Boolean).join(', '),
      items:           q.items.map(i => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
      subtotal: q.subtotal, taxRate: q.taxRate, taxAmount: q.taxAmount, total: q.total,
      validUntil: q.validUntil, notes: q.notes, terms: q.terms,
    });
    await Quotation.findByIdAndUpdate(req.params.id, { pdfPath: pdfFile });
    sendSuccess(res, { pdfPath: pdfFile }, 'PDF generated');
  } catch (err) {
    logger.error('generateQuotationPDF failed:', err);
    sendError(res, 'Failed to generate PDF', 500);
  }
};
