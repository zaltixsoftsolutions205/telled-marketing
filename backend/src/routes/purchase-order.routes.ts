import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import PurchaseOrder from '../models/PurchaseOrder';
import Lead from '../models/Lead';
import Account from '../models/Account';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, generatePONumber } from '../utils/helpers';
import sendEmail from '../services/email.service';
import { syncPurchaseOrderEmails } from '../services/emailInboxPurchase.service';
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
      PurchaseOrder.find(filter).populate('leadId', 'companyName email contactPersonName').populate('uploadedBy', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
      PurchaseOrder.countDocuments(filter),
    ]);
    sendPaginated(res, pos, total, page, limit);
  } catch { sendError(res, 'Failed to fetch purchase orders', 500); }
});

// Create
router.post('/', authorize('admin', 'sales', 'engineer', 'hr_finance'), async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, amount, product, vendorName, vendorEmail, receivedDate, notes } = req.body;
    if (!leadId || !amount || !receivedDate) { sendError(res, 'leadId, amount and receivedDate are required', 400); return; }
    const po = await new PurchaseOrder({
      leadId, amount, product, vendorName, vendorEmail, receivedDate, notes,
      poNumber: generatePONumber(),
      uploadedBy: req.user!.id,
    }).save();
    // Update lead stage to PO Received
    await Lead.findByIdAndUpdate(leadId, { stage: 'PO Received' });
    sendSuccess(res, po, 'Purchase order created', 201);
  } catch { sendError(res, 'Failed to create purchase order', 500); }
});

// Update
router.put('/:id', authorize('admin', 'sales', 'engineer', 'hr_finance'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
    sendSuccess(res, po, 'Updated');
  } catch { sendError(res, 'Failed to update', 500); }
});

// Send to vendor
router.post('/:id/send-to-vendor', authorize('admin', 'sales', 'engineer', 'hr_finance'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('leadId', 'companyName contactPersonName email');
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
    const vendorEmailToUse: string = req.body.vendorEmail || po.vendorEmail || '';
    if (!vendorEmailToUse) { sendError(res, 'Vendor email not set', 400); return; }
    if (req.body.vendorEmail) { po.vendorEmail = req.body.vendorEmail; await po.save(); }

    const lead = po.leadId as any;

    // Generate PDF
    const pdfFileName = await generatePurchaseOrderPDF({
      poNumber:        po.poNumber,
      poDate:          new Date(po.receivedDate).toLocaleDateString('en-IN'),
      vendorName:      po.vendorName || vendorEmailToUse,
      vendorEmail:     vendorEmailToUse,
      product:         po.product,
      amount:          po.amount,
      customerCompany: lead?.companyName || '—',
      customerContact: lead?.contactPersonName || '',
      customerEmail:   lead?.email || '',
    });

    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    const pdfPath = path.join(uploadDir, pdfFileName);

    const html = `<div style="font-family:Arial,sans-serif;padding:20px;max-width:600px">
      <h2 style="color:#1a56a0">Purchase Order — ${po.poNumber}</h2>
      <p>Dear ${po.vendorName || 'Supplier'},</p>
      <p>Please find attached our Purchase Order <strong>${po.poNumber}</strong> for your reference.</p>
      <p>Kindly confirm receipt and expected delivery date.</p>
      <br/>
      <p style="margin:0;color:#666">Regards,</p>
      <p style="margin:4px 0"><strong>Telled Marketing</strong></p>
      <p style="margin:2px 0;font-size:13px;color:#666">GST: 36AAKFT2721M1ZV</p>
    </div>`;

    await sendEmail(vendorEmailToUse, `Purchase Order ${po.poNumber} — Telled Marketing`, html, [
      { filename: `PO-${po.poNumber}.pdf`, path: pdfPath },
    ]);

    await PurchaseOrder.findByIdAndUpdate(req.params.id, { vendorEmailSent: true, vendorEmailSentAt: new Date() });
    sendSuccess(res, {}, 'Email with PO PDF sent to vendor');
  } catch (err) {
    logger.error('Send to vendor error:', err);
    sendError(res, 'Failed to send email', 500);
  }
});

// Convert to account
router.post('/:id/convert', authorize('admin', 'sales', 'engineer', 'hr_finance'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('leadId');
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
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
      notes,
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
    if (!paidAmount || !paidDate || !paymentMode) { sendError(res, 'paidAmount, paidDate and paymentMode are required', 400); return; }
    const po = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { paymentStatus: 'Paid', paidAmount, paidDate, paymentMode, paymentReference, paymentNotes, paidBy: req.user!.id },
      { new: true }
    ).populate('leadId', 'companyName').populate('paidBy', 'name');
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
    sendSuccess(res, po, 'Vendor payment recorded');
  } catch { sendError(res, 'Failed to record payment', 500); }
});

// Get all vendor payments (POs that are Paid) — for HR/Finance
router.get('/vendor-payments', authorize('admin', 'hr_finance'), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false, paymentStatus: 'Paid' };
    const [pos, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate('leadId', 'companyName')
        .populate('paidBy', 'name')
        .populate('uploadedBy', 'name')
        .sort({ paidDate: -1 })
        .skip(skip).limit(limit),
      PurchaseOrder.countDocuments(filter),
    ]);
    sendPaginated(res, pos, total, page, limit);
  } catch { sendError(res, 'Failed to fetch vendor payments', 500); }
});

// Update this route to allow admin and sales
router.post('/sync-emails', authorize('admin', 'sales', 'engineer', 'hr_finance'), async (req: AuthRequest, res: Response) => {
  try {
    logger.info('Manual PO email sync triggered by user:', req.user?.email);
    const result = await syncPurchaseOrderEmails();

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
