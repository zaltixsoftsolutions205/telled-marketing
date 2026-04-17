import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import PurchaseOrder from '../models/PurchaseOrder';
import Lead from '../models/Lead';
import Account from '../models/Account';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, generatePONumber } from '../utils/helpers';
import sendEmail, { sendEmailWithUserSmtp, UserSmtpConfig } from '../services/email.service';
import { syncPurchaseOrderEmails, ImapCredentials } from '../services/emailInboxPurchase.service';
import User from '../models/User';
import { decryptText } from '../utils/crypto';

async function getUserSmtp(userId: string): Promise<UserSmtpConfig | undefined> {
  try {
    const user = await User.findById(userId).select('name email smtpHost smtpPort smtpUser smtpPass smtpSecure googleRefreshToken');
    if (!user) return undefined;
    if ((user as any).googleRefreshToken) return { smtpHost: '', smtpPort: 0, smtpUser: '', smtpPass: '', fromEmail: user.email, fromName: user.name, googleRefreshToken: (user as any).googleRefreshToken };
    if (!user?.smtpHost || !user?.smtpUser || !user?.smtpPass) return undefined;
    return {
      smtpHost: user.smtpHost,
      smtpPort: user.smtpPort || 465,
      smtpUser: user.smtpUser,
      smtpPass: decryptText(user.smtpPass),
      smtpSecure: user.smtpSecure,
      fromEmail: user.email,
      fromName: user.name,
    };
  } catch { return undefined; }
}
import { generatePurchaseOrderPDF } from '../services/pdf.service';
import path from 'path';
import logger from '../utils/logger';

const router = Router();
router.use(authenticate);

// List
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false };
    if (req.query.leadId) filter.leadId = req.query.leadId;
    if (req.query.search) {
      const re = new RegExp(req.query.search as string, 'i');
      filter.$or = [{ vendorName: re }, { product: re }, { poNumber: re }];
    }
    const [pos, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate('leadId', 'companyName email contactPersonName')
        .populate('uploadedBy', 'name')
        .populate('paidBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PurchaseOrder.countDocuments(filter),
    ]);
    sendPaginated(res, pos, total, page, limit);
  } catch (error) {
    logger.error('Get POs error:', error);
    sendError(res, 'Failed to fetch purchase orders', 500);
  }
});

// Get single PO
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('leadId', 'companyName email contactPersonName phone address city state')
      .populate('uploadedBy', 'name email')
      .populate('paidBy', 'name email');
    
    if (!po || po.isArchived) {
      sendError(res, 'Purchase order not found', 404);
      return;
    }
    sendSuccess(res, po);
  } catch (error) {
    logger.error('Get PO error:', error);
    sendError(res, 'Failed to fetch purchase order', 500);
  }
});

// Create
router.post('/', authorize('admin', 'sales', 'engineer', 'hr_finance'), async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, amount, product, vendorName, vendorEmail, receivedDate, notes } = req.body;
    if (!leadId || !amount || !receivedDate) {
      sendError(res, 'leadId, amount and receivedDate are required', 400);
      return;
    }
    
    const po = await new PurchaseOrder({
      leadId,
      amount,
      product,
      vendorName,
      vendorEmail,
      receivedDate,
      notes,
      poNumber: generatePONumber(),
      uploadedBy: req.user!.id,
    }).save();
    
    // Update lead stage to PO Received
    await Lead.findByIdAndUpdate(leadId, { stage: 'PO Received' });
    
    const populated = await PurchaseOrder.findById(po._id)
      .populate('leadId', 'companyName email contactPersonName')
      .populate('uploadedBy', 'name');
    
    sendSuccess(res, populated, 'Purchase order created', 201);
  } catch (error) {
    logger.error('Create PO error:', error);
    sendError(res, 'Failed to create purchase order', 500);
  }
});

// Update - Enhanced with better validation
router.put('/:id', authorize('admin', 'sales', 'engineer', 'hr_finance'), async (req: AuthRequest, res: Response) => {
  try {
    const { amount, product, vendorName, vendorEmail, notes, receivedDate } = req.body;
    
    const updateData: any = {};
    if (amount !== undefined) updateData.amount = amount;
    if (product !== undefined) updateData.product = product;
    if (vendorName !== undefined) updateData.vendorName = vendorName;
    if (vendorEmail !== undefined) updateData.vendorEmail = vendorEmail;
    if (notes !== undefined) updateData.notes = notes;
    if (receivedDate !== undefined) updateData.receivedDate = receivedDate;
    
    const po = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('leadId', 'companyName email contactPersonName')
      .populate('uploadedBy', 'name');
    
    if (!po) {
      sendError(res, 'Purchase order not found', 404);
      return;
    }
    
    sendSuccess(res, po, 'Purchase order updated');
  } catch (error) {
    logger.error('Update PO error:', error);
    sendError(res, 'Failed to update purchase order', 500);
  }
});

// Send to vendor - Enhanced with better email
router.post('/:id/send-to-vendor', authorize('admin', 'sales', 'engineer', 'hr_finance'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('leadId', 'companyName contactPersonName email phone address city state');
    
    if (!po) {
      sendError(res, 'Purchase order not found', 404);
      return;
    }
    
    const vendorEmailToUse: string = req.body.vendorEmail || po.vendorEmail || '';
    if (!vendorEmailToUse) {
      sendError(res, 'Vendor email not set. Please provide vendor email.', 400);
      return;
    }
    
    // Update vendor email if provided
    if (req.body.vendorEmail && req.body.vendorEmail !== po.vendorEmail) {
      po.vendorEmail = req.body.vendorEmail;
      await po.save();
    }

    const lead = po.leadId as any;
    const senderSmtp = await getUserSmtp(req.user!.id);
    const senderName = senderSmtp?.fromName || 'Telled Marketing';
    const senderEmail = senderSmtp?.fromEmail || process.env.EMAIL_FROM || 'support@telled.com';

    // Generate PDF
    const pdfFileName = await generatePurchaseOrderPDF({
      poNumber: po.poNumber,
      poDate: new Date(po.receivedDate).toLocaleDateString('en-IN'),
      vendorName: po.vendorName || vendorEmailToUse,
      vendorEmail: vendorEmailToUse,
      product: po.product || 'N/A',
      amount: po.amount,
      customerCompany: lead?.companyName || '—',
      customerContact: lead?.contactPersonName || '',
      customerEmail: lead?.email || '',
      customerPhone: lead?.phone || '',
      customerAddress: [lead?.address, lead?.city, lead?.state].filter(Boolean).join(', ') || '',
    });

    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    const pdfPath = path.join(uploadDir, pdfFileName);

    // Enhanced email HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6d28d9, #4c1d95); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e5e7eb; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .detail-label { font-weight: 600; color: #4b5563; }
          .detail-value { color: #111827; }
          .footer { margin-top: 20px; padding-top: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
          .button { display: inline-block; background: #6d28d9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Purchase Order</h2>
            <p style="margin: 5px 0 0; opacity: 0.9;">${po.poNumber}</p>
          </div>
          <div class="content">
            <p>Dear ${po.vendorName || 'Vendor'},</p>
            <p>Please find attached our Purchase Order <strong>${po.poNumber}</strong> for your reference.</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">PO Number:</span>
                <span class="detail-value">${po.poNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">PO Date:</span>
                <span class="detail-value">${new Date(po.receivedDate).toLocaleDateString('en-IN')}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Product/Service:</span>
                <span class="detail-value">${po.product || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Amount:</span>
                <span class="detail-value" style="font-size: 18px; font-weight: bold; color: #6d28d9;">₹ ${po.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Customer:</span>
                <span class="detail-value">${lead?.companyName || 'N/A'}</span>
              </div>
            </div>
            
            <p>Kindly confirm receipt and expected delivery date at your earliest convenience.</p>

            <p style="margin-top: 20px;">For any queries, please contact us at <strong>${senderEmail}</strong></p>

            <p>Regards,<br/>
            <strong>${senderName}</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated notification from Telled Marketing. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Telled Marketing. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const ccEmail: string | undefined = req.body.cc || undefined;
    await sendEmailWithUserSmtp(
      vendorEmailToUse,
      `Purchase Order ${po.poNumber} from ${senderName}`,
      html,
      senderSmtp,
      [{ filename: `PO-${po.poNumber}.pdf`, path: pdfPath }],
      ccEmail,
    );

    await PurchaseOrder.findByIdAndUpdate(req.params.id, { 
      vendorEmailSent: true, 
      vendorEmailSentAt: new Date(),
      vendorEmail: vendorEmailToUse
    });
    
    sendSuccess(res, { 
      poNumber: po.poNumber, 
      vendorEmail: vendorEmailToUse,
      sentAt: new Date()
    }, 'Email with PO PDF sent to vendor');
  } catch (error) {
    logger.error('Send to vendor error:', error);
    sendError(res, 'Failed to send email to vendor', 500);
  }
});

// Convert to account
router.post('/:id/convert', authorize('admin', 'sales', 'engineer', 'hr_finance'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('leadId');
    if (!po) {
      sendError(res, 'Purchase order not found', 404);
      return;
    }
    const lead = po.leadId as any;
    const { accountName, notes } = req.body;

    // Check if account already exists for this lead
    const existing = await Account.findOne({ leadId: lead._id });
    if (existing) {
      await PurchaseOrder.findByIdAndUpdate(req.params.id, { converted: true });
      sendSuccess(res, existing, 'Account already exists for this lead');
      return;
    }

    const account = await new Account({
      leadId: lead._id,
      companyName: accountName || lead.companyName,
      contactName: lead.contactPersonName || lead.contactName || lead.companyName,
      contactEmail: lead.email || '',
      phone: lead.phone || '',
      address: lead.address || '',
      city: lead.city || '',
      state: lead.state || '',
      notes: notes,
      status: 'Active',
      assignedSales: lead.assignedTo || req.user!.id,
    }).save();
    
    await Lead.findByIdAndUpdate(lead._id, { stage: 'Converted' });
    await PurchaseOrder.findByIdAndUpdate(req.params.id, { converted: true });
    
    sendSuccess(res, account, 'Converted to account', 201);
  } catch (err: any) {
    logger.error('Convert to account error:', err);
    sendError(res, err?.message || 'Failed to convert', 500);
  }
});

// Record vendor payment against a PO
router.post('/:id/payment', authorize('admin', 'hr_finance', 'sales'), async (req: AuthRequest, res: Response) => {
  try {
    const { paidAmount, paidDate, paymentMode, paymentReference, paymentNotes } = req.body;
    if (!paidAmount || !paidDate || !paymentMode) {
      sendError(res, 'paidAmount, paidDate and paymentMode are required', 400);
      return;
    }
    
    const po = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { 
        paymentStatus: 'Paid', 
        paidAmount, 
        paidDate, 
        paymentMode, 
        paymentReference, 
        paymentNotes, 
        paidBy: req.user!.id 
      },
      { new: true }
    ).populate('leadId', 'companyName')
      .populate('paidBy', 'name email');
    
    if (!po) {
      sendError(res, 'Purchase order not found', 404);
      return;
    }
    
    sendSuccess(res, po, 'Vendor payment recorded');
  } catch (error) {
    logger.error('Record payment error:', error);
    sendError(res, 'Failed to record payment', 500);
  }
});

// Get all vendor payments (POs that are Paid) — for HR/Finance
router.get('/vendor-payments', authorize('admin', 'hr_finance'), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false, paymentStatus: 'Paid' };
    const [pos, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate('leadId', 'companyName')
        .populate('paidBy', 'name email')
        .populate('uploadedBy', 'name')
        .sort({ paidDate: -1 })
        .skip(skip)
        .limit(limit),
      PurchaseOrder.countDocuments(filter),
    ]);
    sendPaginated(res, pos, total, page, limit);
  } catch (error) {
    logger.error('Get vendor payments error:', error);
    sendError(res, 'Failed to fetch vendor payments', 500);
  }
});

// Delete PO (admin + sales)
router.delete('/:id', authorize('admin', 'sales'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findByIdAndDelete(req.params.id);
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
    sendSuccess(res, null, 'Purchase order deleted');
  } catch (error) {
    logger.error('Delete PO error:', error);
    sendError(res, 'Failed to delete purchase order', 500);
  }
});

// Sync emails — reads logged-in user's inbox for incoming POs
router.post('/sync-emails', authorize('admin', 'sales', 'engineer', 'hr_finance'), async (req: AuthRequest, res: Response) => {
  try {
    logger.info('Manual PO email sync triggered by user:', req.user?.email);
    let creds: ImapCredentials | undefined;
    const user = await User.findById(req.user!.id).select('smtpHost smtpPort smtpUser smtpPass');
    if (user?.smtpUser && user?.smtpPass) {
      try {
        const smtpHost = user.smtpHost || 'smtp.hostinger.com';
        const imapHost = smtpHost.includes('office365') || smtpHost.includes('outlook')
          ? 'imap-mail.outlook.com'
          : smtpHost.replace(/^smtp\./, 'imap.');
        creds = { host: imapHost, port: 993, user: user.smtpUser, pass: decryptText(user.smtpPass) };
      } catch { /* fall back to env vars */ }
    }
    const result = await syncPurchaseOrderEmails(creds);

    // Log detailed results
    logger.info(`PO sync results:`, {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
      scanned: result.scanned,
      processed: result.processed
    });

    sendSuccess(res, {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
      scanned: result.scanned,
      processed: result.processed,
      summary: `${result.created.length} created, ${result.updated.length} updated, ${result.skipped.length} skipped`
    }, 'PO email sync completed');
  } catch (error) {
    logger.error('Manual PO email sync failed:', error);
    sendError(res, 'Failed to sync PO emails', 500);
  }
});

export default router;