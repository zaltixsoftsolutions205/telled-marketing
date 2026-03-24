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
router.post('/', authorize('admin', 'sales'), async (req: AuthRequest, res: Response) => {
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
router.put('/:id', authorize('admin', 'sales'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
    sendSuccess(res, po, 'Updated');
  } catch { sendError(res, 'Failed to update', 500); }
});

// Send to vendor
router.post('/:id/send-to-vendor', authorize('admin', 'sales'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('leadId', 'companyName');
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
    if (!po.vendorEmail) { sendError(res, 'Vendor email not set', 400); return; }
    const lead = po.leadId as unknown as { companyName: string };
    const html = `<div style="font-family:Arial,sans-serif;padding:20px">
      <h2 style="color:#4f2d7f">Purchase Order ${po.poNumber}</h2>
      <p>Dear ${po.vendorName || 'Vendor'},</p>
      <p>We are pleased to place the following purchase order:</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #eee;background:#f5f3ff;font-weight:bold">PO Number</td><td style="padding:8px;border:1px solid #eee">${po.poNumber}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;background:#f5f3ff;font-weight:bold">Product</td><td style="padding:8px;border:1px solid #eee">${po.product || '—'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;background:#f5f3ff;font-weight:bold">Amount</td><td style="padding:8px;border:1px solid #eee">₹${po.amount.toLocaleString()}</td></tr>
        <tr><td style="padding:8px;border:1px solid #eee;background:#f5f3ff;font-weight:bold">Customer</td><td style="padding:8px;border:1px solid #eee">${lead?.companyName || '—'}</td></tr>
      </table>
      <p style="margin-top:16px;color:#666">Please confirm receipt of this order.</p>
    </div>`;
    await sendEmail(po.vendorEmail, `Purchase Order ${po.poNumber}`, html);
    await PurchaseOrder.findByIdAndUpdate(req.params.id, { vendorEmailSent: true, vendorEmailSentAt: new Date() });
    sendSuccess(res, {}, 'Email sent to vendor');
  } catch { sendError(res, 'Failed to send email', 500); }
});

// Convert to account
router.post('/:id/convert', authorize('admin', 'sales'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('leadId');
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
    const lead = po.leadId as unknown as { _id: string; companyName: string; assignedTo?: string };
    const { accountName, notes } = req.body;
    const account = await new Account({
      leadId: lead._id,
      accountName: accountName || lead.companyName,
      notes,
      status: 'Active',
      assignedSales: lead.assignedTo,
    }).save();
    await Lead.findByIdAndUpdate(lead._id, { stage: 'Converted' });
    await PurchaseOrder.findByIdAndUpdate(req.params.id, { converted: true });
    sendSuccess(res, account, 'Converted to account', 201);
  } catch { sendError(res, 'Failed to convert', 500); }
});

// Update this route to allow admin and sales
router.post('/sync-emails', authorize('admin', 'sales'), async (req: AuthRequest, res: Response) => {
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
