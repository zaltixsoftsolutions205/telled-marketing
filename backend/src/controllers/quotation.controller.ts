// src/controllers/quotation.controller.ts
import { Response } from 'express';
import Quotation from '../models/Quotation';
import Lead from '../models/Lead';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';
import sendEmail from '../services/email.service';
import { generateQuotationPDF as generateQuotationPDFService } from '../services/pdf.service';
import logger from '../utils/logger';

// Generate quotation number: QT-YYYY-XXXX
const generateQuotationNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `QT-${year}-${random}`;
};

export const getQuotations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, leadId, search } = req.query;
    
    const filter: Record<string, unknown> = { isArchived: false };
    
    if (status) filter.status = status;
    if (leadId) filter.leadId = leadId;
    
    // Role-based filtering
    if (req.user!.role === 'sales') {
      filter.createdBy = req.user!.id;
    }
    
    if (search) {
      const leadIds = await Lead.find({
        $or: [
          { companyName: { $regex: sanitizeQuery(search as string), $options: 'i' } },
          { contactName: { $regex: sanitizeQuery(search as string), $options: 'i' } }
        ]
      }).distinct('_id');
      filter.leadId = { $in: leadIds };
    }
    
    const [quotations, total] = await Promise.all([
      Quotation.find(filter)
        .populate('leadId', 'companyName contactName email contactPersonName oemName')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Quotation.countDocuments(filter),
    ]);
    
    sendPaginated(res, quotations, total, page, limit);
  } catch (error) {
    logger.error('getQuotations error:', error);
    sendError(res, 'Failed to fetch quotations', 500);
  }
};

export const getQuotationById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('leadId', 'companyName contactName email contactPersonName oemName oemEmail phone address city state pincode')
      .populate('createdBy', 'name email');
    
    if (!quotation || quotation.isArchived) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    sendSuccess(res, quotation);
  } catch (error) {
    logger.error('getQuotationById error:', error);
    sendError(res, 'Failed to fetch quotation', 500);
  }
};

export const createQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { 
      leadId, 
      items, 
      taxRate = 18, 
      gstApplicable = true,
      validUntil, 
      terms, 
      notes
    } = req.body;
    
    if (!leadId || !items?.length) {
      sendError(res, 'leadId and items are required', 400);
      return;
    }
    
    // Verify lead exists
    const lead = await Lead.findById(leadId);
    if (!lead || lead.isArchived) {
      sendError(res, 'Lead not found', 404);
      return;
    }
    
    // Calculate totals
    const subtotal = items.reduce((s: number, i: any) => 
      s + (Number(i.quantity) * Number(i.unitPrice)), 0);
    const taxAmount = gstApplicable ? (subtotal * taxRate) / 100 : 0;
    const total = subtotal + taxAmount;
    
    // Count existing quotations for version
    const existingCount = await Quotation.countDocuments({ leadId, isArchived: false });
    
    // Format items properly
    const formattedItems = items.map((item: any) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.quantity) * Number(item.unitPrice)
    }));
    
    const quotation = new Quotation({
      leadId,
      quotationNumber: generateQuotationNumber(),
      version: existingCount + 1,
      items: formattedItems,
      subtotal,
      taxRate,
      gstApplicable,
      taxAmount,
      total,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      terms,
      notes,
      status: 'Draft',
      createdBy: req.user!.id,
      isArchived: false
    });
    
    await quotation.save();
    
    // Populate after save
    const populatedQuotation = await Quotation.findById(quotation._id)
      .populate('leadId', 'companyName contactName email oemName')
      .populate('createdBy', 'name email');
    
    sendSuccess(res, populatedQuotation, 'Quotation created successfully', 201);
  } catch (error: any) {
    logger.error('createQuotation error:', error);
    sendError(res, error.message || 'Failed to create quotation', 500);
  }
};

export const updateQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { items, taxRate, gstApplicable, validUntil, terms, notes, finalAmount, status } = req.body;
    
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation || quotation.isArchived) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    // Only allow updates for Draft quotations
    if (quotation.status !== 'Draft') {
      sendError(res, 'Cannot modify quotation after it has been sent', 400);
      return;
    }
    
    const updateData: any = {};
    
    if (items) {
      const formattedItems = items.map((item: any) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.quantity) * Number(item.unitPrice)
      }));
      
      const subtotal = formattedItems.reduce((s: number, i: any) => s + i.total, 0);
      const taxAmountVal = gstApplicable ? (subtotal * (taxRate || 18)) / 100 : 0;
      
      updateData.items = formattedItems;
      updateData.subtotal = subtotal;
      updateData.taxRate = taxRate;
      updateData.gstApplicable = gstApplicable;
      updateData.taxAmount = taxAmountVal;
      updateData.total = subtotal + taxAmountVal;
    }
    
    if (validUntil) updateData.validUntil = new Date(validUntil);
    if (terms !== undefined) updateData.terms = terms;
    if (notes !== undefined) updateData.notes = notes;
    if (finalAmount !== undefined) updateData.finalAmount = finalAmount;
    if (status) updateData.status = status;
    
    const updated = await Quotation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    const populated = await Quotation.findById(updated?._id)
      .populate('leadId', 'companyName contactName email oemName')
      .populate('createdBy', 'name email');
    
    sendSuccess(res, populated, 'Quotation updated successfully');
  } catch (error: any) {
    logger.error('updateQuotation error:', error);
    sendError(res, error.message || 'Failed to update quotation', 500);
  }
};

export const acceptQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'Accepted',
        acceptedAt: new Date(),
        acceptedBy: req.user!.id
      },
      { new: true }
    );
    
    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    // Update lead stage
    await Lead.findByIdAndUpdate(quotation.leadId, { stage: 'Quotation Accepted' });
    
    const populated = await Quotation.findById(quotation._id)
      .populate('leadId', 'companyName contactName email')
      .populate('createdBy', 'name email');
    
    sendSuccess(res, populated, 'Quotation accepted');
  } catch (error) {
    logger.error('acceptQuotation error:', error);
    sendError(res, 'Failed to accept quotation', 500);
  }
};

export const rejectQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rejectionReason } = req.body;
    
    const quotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'Rejected',
        rejectedAt: new Date(),
        rejectedBy: req.user!.id,
        rejectionReason
      },
      { new: true }
    );
    
    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    const populated = await Quotation.findById(quotation._id)
      .populate('leadId', 'companyName contactName email')
      .populate('createdBy', 'name email');
    
    sendSuccess(res, populated, 'Quotation rejected');
  } catch (error) {
    logger.error('rejectQuotation error:', error);
    sendError(res, 'Failed to reject quotation', 500);
  }
};

export const finalizeQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { finalAmount } = req.body;
    
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    if (quotation.status !== 'Draft') {
      sendError(res, 'Only draft quotations can be finalized', 400);
      return;
    }
    
    const updateData: any = { status: 'Sent' };
    if (finalAmount) updateData.finalAmount = finalAmount;
    
    const updated = await Quotation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    const populated = await Quotation.findById(updated?._id)
      .populate('leadId', 'companyName contactName email')
      .populate('createdBy', 'name email');
    
    sendSuccess(res, populated, 'Quotation finalized and ready to send');
  } catch (error) {
    logger.error('finalizeQuotation error:', error);
    sendError(res, 'Failed to finalize quotation', 500);
  }
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
    const pdfFile = await generateQuotationPDFService({
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

export const generateQuotationPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = await Quotation.findById(req.params.id)
      .populate('leadId', 'companyName email contactPersonName phone city state address');
    if (!q) { sendError(res, 'Quotation not found', 404); return; }
    const lead = q.leadId as unknown as {
      companyName: string; email: string; contactPersonName: string;
      phone?: string; city?: string; state?: string; address?: string;
    };
    const pdfFile = await generateQuotationPDFService({
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

export const sendToVendor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vendorEmail, finalAmount } = req.body;
    if (!vendorEmail) { sendError(res, 'Vendor email is required', 400); return; }

    const quotation = await Quotation.findById(req.params.id)
      .populate('leadId', 'companyName oemName oemEmail');
    if (!quotation) { sendError(res, 'Quotation not found', 404); return; }

    const lead = quotation.leadId as any;
    if (finalAmount) { quotation.finalAmount = Number(finalAmount); await quotation.save(); }

    const itemsHtml = quotation.items.map(item =>
      `<tr><td style="padding:8px;border:1px solid #eee">${item.description}</td><td style="padding:8px;border:1px solid #eee;text-align:center">${item.quantity}</td><td style="padding:8px;border:1px solid #eee;text-align:right">&#8377;${item.unitPrice.toLocaleString()}</td><td style="padding:8px;border:1px solid #eee;text-align:right">&#8377;${item.total.toLocaleString()}</td></tr>`
    ).join('');

    const vendorHtml = `<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;padding:20px;background:#f9fafb}
    .c{max-width:700px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,.1)}</style></head>
    <body><div class="c">
    <h2 style="color:#6d28d9">Request for Quotation - ${quotation.quotationNumber}</h2>
    <p><strong>Customer:</strong> ${lead.companyName}</p>
    <p><strong>OEM Product:</strong> ${lead.oemName || 'N/A'}</p>
    <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead><tr style="background:#f3f4f6"><th style="padding:8px;border:1px solid #eee;text-align:left">Description</th><th style="padding:8px;border:1px solid #eee">Qty</th><th style="padding:8px;border:1px solid #eee">Unit Price</th><th style="padding:8px;border:1px solid #eee">Total</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    ${quotation.finalAmount ? `<p style="font-size:16px;font-weight:bold;color:#6d28d9">Expected Final Amount: &#8377;${quotation.finalAmount.toLocaleString()}</p>` : ''}
    <p style="color:#888;font-size:12px;margin-top:24px">Please provide your best quote at your earliest convenience.</p>
    </div></body></html>`;

    await sendEmail(vendorEmail, `Quotation Request - ${quotation.quotationNumber} for ${lead.companyName}`, vendorHtml);
    await Quotation.findByIdAndUpdate(req.params.id, { vendorSent: true, vendorSentAt: new Date(), vendorEmail, status: 'Final' });
    sendSuccess(res, null, 'Quotation sent to vendor successfully');
  } catch (error) {
    logger.error('sendToVendor error:', error);
    sendError(res, 'Failed to send to vendor', 500);
  }
};

export const archiveQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      { isArchived: true, archivedAt: new Date(), archivedBy: req.user!.id },
      { new: true }
    );
    
    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    sendSuccess(res, quotation, 'Quotation archived');
  } catch (error) {
    logger.error('archiveQuotation error:', error);
    sendError(res, 'Failed to archive quotation', 500);
  }
};

export const getQuotationStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = { isArchived: false };
    
    if (req.user!.role === 'sales') {
      filter.createdBy = req.user!.id;
    }
    
    const [total, draft, sent, accepted, rejected, totalValue] = await Promise.all([
      Quotation.countDocuments(filter),
      Quotation.countDocuments({ ...filter, status: 'Draft' }),
      Quotation.countDocuments({ ...filter, status: 'Sent' }),
      Quotation.countDocuments({ ...filter, status: 'Accepted' }),
      Quotation.countDocuments({ ...filter, status: 'Rejected' }),
      Quotation.aggregate([
        { $match: { ...filter, status: 'Accepted' } },
        { $group: { _id: null, total: { $sum: '$finalAmount' } } }
      ])
    ]);
    
    sendSuccess(res, {
      total,
      draft,
      sent,
      accepted,
      rejected,
      totalAcceptedValue: totalValue[0]?.total || 0,
      conversionRate: total ? Math.round((accepted / total) * 100) : 0
    });
  } catch (error) {
    logger.error('getQuotationStats error:', error);
    sendError(res, 'Failed to get stats', 500);
  }
};