// backend/src/controllers/quotation.controller.ts
import { Response } from 'express';
import Quotation from '../models/Quotation';
import Lead from '../models/Lead';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';
import sendEmail from '../services/email.service';
import { generateQuotationPDF as generateQuotationPDFService } from '../services/pdf.service';
import logger from '../utils/logger';
import path from 'path';

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
        .populate('leadId', 'companyName contactName email contactPersonName oemName oemEmail')
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
    
    const lead = await Lead.findById(leadId);
    if (!lead || lead.isArchived) {
      sendError(res, 'Lead not found', 404);
      return;
    }
    
    const subtotal = items.reduce((s: number, i: any) => 
      s + (Number(i.quantity) * Number(i.unitPrice)), 0);
    const taxAmount = gstApplicable ? (subtotal * taxRate) / 100 : 0;
    const total = subtotal + taxAmount;
    
    const existingCount = await Quotation.countDocuments({ leadId, isArchived: false });
    
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
    const { items, taxRate, gstApplicable, validUntil, terms, notes, finalAmount } = req.body;
    
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation || quotation.isArchived) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    // Allow updates for Draft and Sent quotations
    if (quotation.status !== 'Draft' && quotation.status !== 'Sent') {
      sendError(res, 'Cannot modify quotation after it has been accepted or rejected', 400);
      return;
    }
    
    const updateData: any = {};
    
    if (items && items.length > 0) {
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
    
    if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : undefined;
    if (terms !== undefined) updateData.terms = terms;
    if (notes !== undefined) updateData.notes = notes;
    if (finalAmount !== undefined) updateData.finalAmount = finalAmount;
    
    const updated = await Quotation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    const populated = await Quotation.findById(updated?._id)
      .populate('leadId', 'companyName contactName email oemName oemEmail')
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
    ).populate('leadId', 'companyName');
    
    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    await Lead.findByIdAndUpdate(quotation.leadId, { stage: 'Quotation Accepted' });
    
    sendSuccess(res, quotation, 'Quotation accepted');
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
        rejectionReason: rejectionReason || 'No reason provided'
      },
      { new: true }
    );
    
    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    sendSuccess(res, quotation, 'Quotation rejected');
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
    if (finalAmount) updateData.finalAmount = Number(finalAmount);
    
    const updated = await Quotation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('leadId', 'companyName contactName email');
    
    sendSuccess(res, updated, 'Quotation finalized and ready to send to customer');
  } catch (error) {
    logger.error('finalizeQuotation error:', error);
    sendError(res, 'Failed to finalize quotation', 500);
  }
};

export const sendQuotationEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('leadId', 'companyName email contactPersonName phone city state address');
    
    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    const lead = quotation.leadId as any;
    if (!lead?.email) {
      sendError(res, 'Lead email not found', 400);
      return;
    }

    // Generate PDF
    const pdfFile = await generateQuotationPDFService({
      quotationNumber: quotation.quotationNumber,
      contactName: lead.contactPersonName || lead.companyName,
      contactEmail: lead.email,
      contactPhone: lead.phone,
      contactAddress: [lead.address, lead.city, lead.state].filter(Boolean).join(', '),
      items: quotation.items.map(i => ({ 
        description: i.description, 
        quantity: i.quantity, 
        unitPrice: i.unitPrice, 
        total: i.total 
      })),
      subtotal: quotation.subtotal,
      taxRate: quotation.taxRate,
      taxAmount: quotation.taxAmount,
      total: quotation.total,
      validUntil: quotation.validUntil,
      notes: quotation.notes,
      terms: quotation.terms,
    });

    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    const pdfPath = path.join(process.cwd(), uploadDir, pdfFile);

    // Build email HTML
    const html = `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0}
      .c{max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)}
      .h{background:linear-gradient(135deg,#6d28d9,#4c1d95);padding:28px;text-align:center}
      .b{padding:28px;color:#333;line-height:1.6}
      .f{background:#f8f8f8;padding:16px;text-align:center;font-size:12px;color:#888}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      td{padding:9px 12px;border:1px solid #eee}
      .lbl{background:#f3e8ff;font-weight:bold;width:40%}
    </style></head><body><div class="c">
    <div class="h">
      <h1 style="color:#fff;margin:0;font-size:22px">QUOTATION</h1>
      <p style="color:#fff;margin:6px 0 0;opacity:.9;font-size:13px">${quotation.quotationNumber}</p>
    </div>
    <div class="b">
      <p>Dear <b>${lead.contactPersonName || lead.companyName}</b>,</p>
      <p>Please find the quotation from <b>Telled CRM</b>. Details are summarised below:</p>
      <table>
        <tr><td class="lbl">Quotation #</td><td>${quotation.quotationNumber}</td></tr>
        <tr><td class="lbl">Date</td><td>${new Date().toLocaleDateString('en-IN')}</td></tr>
        <tr><td class="lbl">Sub Total</td><td>₹ ${quotation.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
        ${quotation.gstApplicable ? `<tr><td class="lbl">GST (${quotation.taxRate}%)</td><td>₹ ${quotation.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>` : ''}
        <tr><td class="lbl" style="background:#6d28d9;color:#fff">Total Amount</td><td style="font-weight:bold;font-size:15px">₹ ${quotation.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
        ${quotation.validUntil ? `<tr><td class="lbl">Valid Until</td><td>${new Date(quotation.validUntil).toLocaleDateString('en-IN')}</td></tr>` : ''}
        ${quotation.notes ? `<tr><td class="lbl">Notes</td><td>${quotation.notes}</td></tr>` : ''}
      </table>
      <p style="margin-top:16px;color:#666;font-size:13px">The detailed quotation PDF is attached to this email. Please review and revert at your earliest convenience.</p>
      <p style="color:#666;font-size:13px">For any queries, feel free to reach us at <b>${process.env.EMAIL_FROM}</b>.</p>
    </div>
    <div class="f">© ${new Date().getFullYear()} Telled CRM &nbsp;|&nbsp; Thanks for your business!</div>
    </div></body></html>`;

    await sendEmail(
      lead.email,
      `Quotation ${quotation.quotationNumber} from Telled CRM`,
      html,
      [{ filename: `Quotation-${quotation.quotationNumber}.pdf`, path: pdfPath }]
    );
    
    await Quotation.findByIdAndUpdate(req.params.id, { 
      emailSent: true, 
      emailSentAt: new Date(), 
      pdfPath: pdfFile 
    });
    
    sendSuccess(res, { pdfPath: pdfFile }, 'Email sent with PDF attachment');
  } catch (err) {
    logger.error('sendQuotationEmail failed:', err);
    sendError(res, 'Failed to send email', 500);
  }
};

export const sendToVendor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vendorEmail, finalAmount } = req.body;
    
    if (!vendorEmail) {
      sendError(res, 'Vendor email is required', 400);
      return;
    }

    const quotation = await Quotation.findById(req.params.id)
      .populate('leadId', 'companyName oemName oemEmail contactName')
      .populate('createdBy', 'name email');
    
    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }

    const lead = quotation.leadId as any;
    
    // Update final amount if provided
    if (finalAmount && finalAmount > 0) {
      quotation.finalAmount = Number(finalAmount);
      await quotation.save();
    }

    // Generate items HTML
    const itemsHtml = quotation.items.map(item => `
      <tr>
        <td style="padding:8px;border:1px solid #eee">${item.description}</td>
        <td style="padding:8px;border:1px solid #eee;text-align:center">${item.quantity}</td>
        <td style="padding:8px;border:1px solid #eee;text-align:right">₹${item.unitPrice.toLocaleString()}</td>
        <td style="padding:8px;border:1px solid #eee;text-align:right">₹${item.total.toLocaleString()}</td>
      </tr>
    `).join('');

    const vendorHtml = `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;margin:0;padding:20px;background:#f9fafb}
      .c{max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}
      .h{background:linear-gradient(135deg,#6d28d9,#4c1d95);padding:24px;text-align:center}
      .h h2{color:#fff;margin:0}
      .b{padding:24px}
      .total{background:#f3e8ff;padding:12px;border-radius:8px;margin:16px 0}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th,td{padding:10px;border:1px solid #e5e7eb;text-align:left}
      th{background:#f9fafb}
    </style></head><body>
    <div class="c">
      <div class="h"><h2>Request for Quotation</h2><p style="color:#c4b5fd;margin:8px 0 0">${quotation.quotationNumber}</p></div>
      <div class="b">
        <p><strong>Dear Vendor,</strong></p>
        <p>Please provide your best quotation for the following items required by our customer:</p>
        
        <div style="background:#f3f4f6;padding:12px;border-radius:8px;margin:16px 0">
          <p><strong>Customer:</strong> ${lead.companyName}</p>
          <p><strong>Contact Person:</strong> ${lead.contactName || 'N/A'}</p>
          <p><strong>OEM Product:</strong> ${lead.oemName || 'N/A'}</p>
          <p><strong>Request Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
        </div>
        
        <table>
          <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        
        <div class="total">
          <p style="margin:4px 0"><strong>Subtotal:</strong> ₹${quotation.subtotal.toLocaleString()}</p>
          ${quotation.gstApplicable ? `<p style="margin:4px 0"><strong>GST (${quotation.taxRate}%):</strong> ₹${quotation.taxAmount.toLocaleString()}</p>` : ''}
          <p style="margin:8px 0 0;font-size:18px;font-weight:bold;color:#6d28d9"><strong>Total Amount:</strong> ₹${quotation.total.toLocaleString()}</p>
          ${quotation.finalAmount ? `<p style="margin:8px 0 0;color:#f59e0b"><strong>Expected Final Amount:</strong> ₹${quotation.finalAmount.toLocaleString()}</p>` : ''}
        </div>
        
        ${quotation.terms ? `<div style="margin:16px 0;padding:12px;background:#fef3c7;border-radius:8px"><strong>Terms:</strong><br>${quotation.terms}</div>` : ''}
        ${quotation.notes ? `<div style="margin:16px 0;padding:12px;background:#f3f4f6;border-radius:8px"><strong>Notes:</strong><br>${quotation.notes}</div>` : ''}
        
        <hr style="margin:24px 0 16px">
        <p style="color:#6b7280;font-size:12px;text-align:center">
          Please provide your best quote at your earliest convenience.<br>
          For any clarifications, contact ${quotation.createdBy?.name || 'Telled Sales'} at ${quotation.createdBy?.email || 'sales@telled.com'}
        </p>
      </div>
    </div>
    </body></html>`;

    await sendEmail(
      vendorEmail,
      `Quotation Request - ${quotation.quotationNumber} for ${lead.companyName}`,
      vendorHtml
    );
    
    await Quotation.findByIdAndUpdate(req.params.id, { 
      vendorSent: true, 
      vendorSentAt: new Date(), 
      vendorEmail,
      status: 'Final'
    });
    
    sendSuccess(res, { 
      quotationNumber: quotation.quotationNumber,
      vendorEmail,
      sentAt: new Date()
    }, 'Quotation sent to vendor successfully');
  } catch (error) {
    logger.error('sendToVendor error:', error);
    sendError(res, 'Failed to send to vendor', 500);
  }
};

export const generateQuotationPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('leadId', 'companyName email contactPersonName phone city state address');
    
    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    const lead = quotation.leadId as any;
    
    const pdfFile = await generateQuotationPDFService({
      quotationNumber: quotation.quotationNumber,
      contactName: lead.contactPersonName || lead.companyName,
      contactEmail: lead.email,
      contactPhone: lead.phone,
      contactAddress: [lead.address, lead.city, lead.state].filter(Boolean).join(', '),
      items: quotation.items.map(i => ({ 
        description: i.description, 
        quantity: i.quantity, 
        unitPrice: i.unitPrice, 
        total: i.total 
      })),
      subtotal: quotation.subtotal,
      taxRate: quotation.taxRate,
      taxAmount: quotation.taxAmount,
      total: quotation.total,
      validUntil: quotation.validUntil,
      notes: quotation.notes,
      terms: quotation.terms,
    });
    
    await Quotation.findByIdAndUpdate(req.params.id, { pdfPath: pdfFile });
    
    sendSuccess(res, { pdfPath: pdfFile, downloadUrl: `/uploads/${pdfFile}` }, 'PDF generated');
  } catch (err) {
    logger.error('generateQuotationPDF failed:', err);
    sendError(res, 'Failed to generate PDF', 500);
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
        { $group: { _id: null, total: { $sum: { $ifNull: ['$finalAmount', '$total'] } } } }
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