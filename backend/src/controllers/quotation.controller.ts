// src/controllers/quotation.controller.ts
import { Response } from 'express';
import Quotation from '../models/Quotation';
import Lead from '../models/Lead';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';
import sendEmail from '../services/email.service';
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
    const quotation = await Quotation.findById(req.params.id)
      .populate('leadId', 'companyName contactName email contactPersonName')
      .populate('createdBy', 'name email');
    
    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    const lead = quotation.leadId as any;
    if (!lead?.email) {
      sendError(res, 'Lead email not found', 400);
      return;
    }
    
    // Generate HTML email content
    const itemsHtml = quotation.items.map(item => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.description}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">₹${item.unitPrice.toLocaleString()}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">₹${item.total.toLocaleString()}</td>
       </tr>
    `).join('');
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Quotation ${quotation.quotationNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f9fafb;">
        <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #6d28d9, #4c1d95); padding: 30px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px;">Telled CRM</h1>
            <p style="margin: 8px 0 0; color: #c4b5fd;">Official Quotation</p>
          </div>
          
          <div style="padding: 30px;">
            <div style="margin-bottom: 20px;">
              <h2 style="margin: 0 0 8px; color: #1f2937;">Quotation ${quotation.quotationNumber}</h2>
              <p style="margin: 0; color: #6b7280;">Version ${quotation.version} | ${new Date().toLocaleDateString('en-IN')}</p>
            </div>
            
            <div style="margin-bottom: 30px;">
              <p style="margin: 0 0 4px;"><strong>To:</strong> ${lead.contactName || lead.contactPersonName || lead.companyName}</p>
              <p style="margin: 0;"><strong>Company:</strong> ${lead.companyName}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Description</th>
                  <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">Quantity</th>
                  <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">Unit Price</th>
                  <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            
            <div style="text-align: right; margin-bottom: 20px;">
              <p style="margin: 4px 0;"><strong>Subtotal:</strong> ₹${quotation.subtotal.toLocaleString()}</p>
              ${quotation.gstApplicable ? `<p style="margin: 4px 0;"><strong>GST (${quotation.taxRate}%):</strong> ₹${quotation.taxAmount.toLocaleString()}</p>` : ''}
              <p style="margin: 8px 0 0; font-size: 18px; font-weight: bold; color: #6d28d9;"><strong>Total:</strong> ₹${quotation.total.toLocaleString()}</p>
            </div>
            
            ${quotation.terms ? `
            <div style="margin: 20px 0; padding: 12px; background-color: #fef3c7; border-radius: 8px;">
              <strong style="color: #b45309;">Terms & Conditions:</strong>
              <p style="margin: 4px 0 0; color: #78350f;">${quotation.terms}</p>
            </div>
            ` : ''}
            
            ${quotation.notes ? `
            <div style="margin: 20px 0; padding: 12px; background-color: #f3f4f6; border-radius: 8px;">
              <strong>Notes:</strong>
              <p style="margin: 4px 0 0; color: #4b5563;">${quotation.notes}</p>
            </div>
            ` : ''}
            
            ${quotation.validUntil ? `
            <div style="margin: 20px 0; padding: 12px; background-color: #dbeafe; border-radius: 8px;">
              <strong style="color: #1e40af;">Valid Until:</strong>
              <p style="margin: 4px 0 0; color: #1e3a8a;">${new Date(quotation.validUntil).toLocaleDateString('en-IN')}</p>
            </div>
            ` : ''}
            
            <hr style="margin: 30px 0 20px; border: none; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
              This is a system-generated quotation. For any queries, please contact your sales representative.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(
      lead.email,
      `Quotation ${quotation.quotationNumber} from Telled CRM`,
      emailHtml
    );
    
    await Quotation.findByIdAndUpdate(req.params.id, {
      emailSent: true,
      emailSentAt: new Date(),
      status: 'Sent'
    });
    
    sendSuccess(res, null, 'Quotation email sent successfully');
  } catch (error) {
    logger.error('sendQuotationEmail error:', error);
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
      .populate('leadId', 'companyName oemName oemEmail')
      .populate('createdBy', 'name email');
    
    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    const lead = quotation.leadId as any;
    
    // Update final amount if provided
    if (finalAmount) {
      quotation.finalAmount = finalAmount;
      await quotation.save();
    }
    
    // Generate vendor email content
    const vendorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Quotation Request - ${quotation.quotationNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f9fafb;">
        <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #6d28d9, #4c1d95); padding: 30px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px;">Request for Quotation</h1>
            <p style="margin: 8px 0 0; color: #c4b5fd;">Telled CRM - Vendor Inquiry</p>
          </div>
          
          <div style="padding: 30px;">
            <h2 style="margin: 0 0 16px; color: #1f2937;">Quotation Request Details</h2>
            
            <div style="margin-bottom: 20px;">
              <p><strong>Customer:</strong> ${lead.companyName}</p>
              <p><strong>OEM Product:</strong> ${lead.oemName || 'N/A'}</p>
              <p><strong>Quotation Number:</strong> ${quotation.quotationNumber}</p>
              <p><strong>Request Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Description</th>
                  <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">Quantity</th>
                  <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">Unit Price</th>
                  <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${quotation.items.map(item => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.description}</td>
                    <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
                    <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">₹${item.unitPrice.toLocaleString()}</td>
                    <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">₹${item.total.toLocaleString()}</td>
                   </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div style="margin-bottom: 20px;">
              ${quotation.finalAmount ? `
              <p style="font-size: 18px; font-weight: bold; color: #6d28d9;">
                Expected Final Amount: ₹${quotation.finalAmount.toLocaleString()}
              </p>
              ` : ''}
            </div>
            
            ${quotation.notes ? `
            <div style="margin: 20px 0; padding: 12px; background-color: #f3f4f6; border-radius: 8px;">
              <strong>Notes:</strong>
              <p style="margin: 4px 0 0; color: #4b5563;">${quotation.notes}</p>
            </div>
            ` : ''}
            
            <hr style="margin: 30px 0 20px;">
            <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
              Please provide your best quote at your earliest convenience.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail(
      vendorEmail,
      `Quotation Request - ${quotation.quotationNumber} for ${lead.companyName}`,
      vendorHtml
    );
    
    await Quotation.findByIdAndUpdate(req.params.id, {
      vendorSent: true,
      vendorSentAt: new Date(),
      vendorEmail: vendorEmail
    });
    
    sendSuccess(res, null, 'Quotation sent to vendor successfully');
  } catch (error) {
    logger.error('sendToVendor error:', error);
    sendError(res, 'Failed to send to vendor', 500);
  }
};

export const generateQuotationPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    
    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }
    
    const pdfPath = `quotation-${quotation.quotationNumber}-${Date.now()}.pdf`;
    
    await Quotation.findByIdAndUpdate(req.params.id, { pdfPath });
    
    sendSuccess(res, { pdfPath, downloadUrl: `/uploads/${pdfPath}` }, 'PDF generation initiated');
  } catch (error) {
    logger.error('generateQuotationPDF error:', error);
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