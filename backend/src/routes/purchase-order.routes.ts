import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import PurchaseOrder from '../models/PurchaseOrder';
import Lead from '../models/Lead';
import Account from '../models/Account';
import Invoice from '../models/Invoice';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, generatePONumber, generateInvoiceNumber } from '../utils/helpers';
import sendEmail, { sendEmailWithUserSmtp, UserSmtpConfig } from '../services/email.service';
import User from '../models/User';
import { decryptText } from '../utils/crypto';
import logger from '../utils/logger';
import multer from 'multer';
import { getUserSmtp } from '../utils/getUserSmtp';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();
router.use(authenticate);

function computeCurrentStep(po: any): number {
  if (po.step8FinalInvoiceSent) return 8;
  if (po.step7LicenseMailReceived) return 8;
  if (po.step6DocsSentToArk) return 7;
  if (po.step5InvoiceToArk) return 6;
  if (po.step4DocsSentToCustomer) return 5;
  if (po.step3PriceClearanceReceived) return 4;
  if (po.step2ForwardedToArk) return 3;
  return 2;
}

// ── List ─────────────────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false };
    if (req.user!.organizationId) filter.organizationId = req.user!.organizationId;
    if (req.user!.role === 'sales') filter.uploadedBy = req.user!.id;
    if (req.query.leadId) filter.leadId = req.query.leadId;
    if (req.query.step) filter.currentStep = Number(req.query.step);
    if (req.query.search) {
      const re = new RegExp(req.query.search as string, 'i');
      filter.$or = [{ vendorName: re }, { product: re }, { poNumber: re }];
    }
    const [pos, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate('leadId', 'companyName email contactPersonName')
        .populate('uploadedBy', 'name')
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

// ── Get single PO ────────────────────────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('leadId', 'companyName email contactPersonName phone address city state')
      .populate('uploadedBy', 'name email')
      .populate('paidBy', 'name email');
    if (!po || po.isArchived) { sendError(res, 'Purchase order not found', 404); return; }
    sendSuccess(res, po);
  } catch (error) {
    logger.error('Get PO error:', error);
    sendError(res, 'Failed to fetch purchase order', 500);
  }
});

// ── Create ───────────────────────────────────────────────────────────────────
router.post('/', authorize('admin', 'manager', 'sales', 'engineer', 'hr', 'finance'), async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, items, amount, product, vendorName, vendorEmail, receivedDate, notes, paymentTerms } = req.body;
    if (!leadId || !receivedDate) { sendError(res, 'leadId and receivedDate are required', 400); return; }

    // Compute total from items if provided, else use amount directly
    let total = Number(amount) || 0;
    let lineItems = items || [];
    if (Array.isArray(items) && items.length > 0) {
      total = items.reduce((s: number, i: any) => s + (Number(i.amount) || Number(i.unitPrice) * Number(i.quantity) || 0), 0);
      lineItems = items.map((i: any) => ({
        product: i.product,
        description: i.description || '',
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        amount: Number(i.amount) || Number(i.unitPrice) * Number(i.quantity) || 0,
      }));
    }
    if (total <= 0) { sendError(res, 'Total amount must be greater than 0', 400); return; }

    const po = await new PurchaseOrder({
      organizationId: req.user!.organizationId,
      leadId,
      amount: total,
      items: lineItems,
      product: product || (lineItems[0]?.product ?? ''),
      vendorName,
      vendorEmail,
      receivedDate,
      notes,
      paymentTerms,
      poNumber: generatePONumber(),
      uploadedBy: req.user!.id,
      currentStep: 1,
      workflowStatus: 'Draft',
    }).save();

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

// ── Update ───────────────────────────────────────────────────────────────────
router.put('/:id', authorize('admin', 'manager', 'sales', 'engineer', 'hr', 'finance'), async (req: AuthRequest, res: Response) => {
  try {
    const { items, amount, product, vendorName, vendorEmail, notes, receivedDate, paymentTerms } = req.body;
    const upd: any = {};
    if (vendorName !== undefined) upd.vendorName = vendorName;
    if (vendorEmail !== undefined) upd.vendorEmail = vendorEmail;
    if (notes !== undefined) upd.notes = notes;
    if (receivedDate !== undefined) upd.receivedDate = receivedDate;
    if (paymentTerms !== undefined) upd.paymentTerms = paymentTerms;
    if (Array.isArray(items) && items.length > 0) {
      upd.items = items.map((i: any) => ({
        product: i.product,
        description: i.description || '',
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        amount: Number(i.amount) || Number(i.unitPrice) * Number(i.quantity) || 0,
      }));
      upd.amount = upd.items.reduce((s: number, i: any) => s + i.amount, 0);
      upd.product = upd.items[0]?.product || product || '';
    } else if (amount !== undefined) {
      upd.amount = Number(amount);
      if (product !== undefined) upd.product = product;
    }
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, upd, { new: true })
      .populate('leadId', 'companyName email contactPersonName')
      .populate('uploadedBy', 'name');
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
    sendSuccess(res, po, 'Purchase order updated');
  } catch (error) {
    logger.error('Update PO error:', error);
    sendError(res, 'Failed to update purchase order', 500);
  }
});

// ── Step 2: Forward PO to ARK (OEM) ─────────────────────────────────────────
router.post('/:id/step2-forward-to-ark', authorize('admin', 'manager', 'sales', 'hr', 'finance'), upload.single('attachment'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('leadId', 'companyName contactPersonName email');
    if (!po) { sendError(res, 'PO not found', 404); return; }

    const arkEmail: string = req.body.arkEmail || po.vendorEmail || '';
    if (!arkEmail) { sendError(res, 'ARK email is required', 400); return; }

    const lead = po.leadId as any;
    const senderSmtp = await getUserSmtp(req.user!.id);
    if (!senderSmtp) { sendError(res, 'Your email is not configured. Please log out and log in again to set up your email.', 400); return; }
    const senderName = senderSmtp?.fromName || '';
    const senderEmail = senderSmtp?.fromEmail || '';
    const docName = (req as any).file?.originalname || req.body.docName || '';

    const html = `<p>Dear Team,</p>

<p>Please find attached the Purchase Order ${po.poNumber} for your reference. Kindly share the price clearance at the earliest.</p>

<p>Kindly review and let us know if you need any clarification.</p>

<p>Regards,<br>${senderName}</p>`;

    const attachments: any[] = [];
    if ((req as any).file) attachments.push({ filename: (req as any).file.originalname, content: (req as any).file.buffer });

    try {
      await sendEmailWithUserSmtp(arkEmail, `PO ${po.poNumber} — Price Clearance Request`, html, senderSmtp, attachments.length ? attachments : undefined, req.body.cc);
    } catch (emailErr: any) {
      logger.warn('Email send failed (step2), continuing:', emailErr);
    }

    await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      step2ForwardedToArk: true,
      step2ForwardedAt: new Date(),
      step2PoDocName: docName,
      currentStep: 3,
      workflowStatus: 'In Progress',
      vendorEmail: arkEmail,
      vendorName: req.body.arkName || po.vendorName || '',
      poForwardedToArk: true,
      poForwardedToArkAt: new Date(),
      vendorEmailSent: true,
    });
    sendSuccess(res, { sentTo: arkEmail }, 'PO forwarded to ARK');
  } catch (err) {
    logger.error('Step2 forward to ARK error:', err);
    sendError(res, 'Failed to forward PO to ARK', 500);
  }
});

// ── Step 3: ARK Response — Mark Price Clearance Received ────────────────────
router.post('/:id/step3-price-clearance', authorize('admin', 'manager', 'sales', 'hr', 'finance'), upload.array('attachments', 10), async (req: AuthRequest, res: Response) => {
  try {
    const docNames: string[] = [];
    if ((req as any).files?.length) {
      ((req as any).files as Express.Multer.File[]).forEach((f: Express.Multer.File) => docNames.push(f.originalname));
    }
    if (req.body.docNames) {
      const extra = Array.isArray(req.body.docNames) ? req.body.docNames : [req.body.docNames];
      docNames.push(...extra);
    }
    await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      step3PriceClearanceReceived: true,
      step3ReceivedAt: new Date(),
      step3DocNames: docNames,
      currentStep: 4,
      priceClearanceReceived: true,
      priceClearanceReceivedAt: new Date(),
    });
    sendSuccess(res, { docNames }, 'Price clearance marked');
  } catch (err) {
    logger.error('Step3 price clearance error:', err);
    sendError(res, 'Failed to mark price clearance', 500);
  }
});

// ── Step 4: Send Documents to Customer ──────────────────────────────────────
router.post('/:id/step4-send-docs-to-customer', authorize('admin', 'manager', 'sales', 'hr', 'finance'), upload.array('attachments', 10), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('leadId', 'companyName contactPersonName email');
    if (!po) { sendError(res, 'PO not found', 404); return; }

    const customerEmail: string = req.body.customerEmail || (po.leadId as any)?.email || '';
    if (!customerEmail) { sendError(res, 'Customer email is required', 400); return; }

    const lead = po.leadId as any;
    const senderSmtp = await getUserSmtp(req.user!.id);
    if (!senderSmtp) { sendError(res, 'Your email is not configured. Please log out and log in again to set up your email.', 400); return; }
    const senderName = senderSmtp?.fromName || '';
    const senderEmail = senderSmtp?.fromEmail || '';

    const html = `<p>Dear ${lead?.contactPersonName || lead?.companyName || 'Customer'},</p>

<p>Please find attached the documents related to your Purchase Order ${po.poNumber}.</p>

<p>Kindly review and let us know if you need any clarification.</p>

<p>Regards,<br>${senderName}</p>`;

    const attachments: any[] = [];
    if ((req as any).files?.length) {
      ((req as any).files as Express.Multer.File[]).forEach((f: Express.Multer.File) =>
        attachments.push({ filename: f.originalname, content: f.buffer })
      );
    }

    try {
      await sendEmailWithUserSmtp(customerEmail, `Documents for PO ${po.poNumber}`, html, senderSmtp, attachments.length ? attachments : undefined);
    } catch (emailErr: any) {
      logger.warn('Email send failed (step4), continuing:', emailErr);
    }

    await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      step4DocsSentToCustomer: true,
      step4SentAt: new Date(),
      currentStep: 5,
      customerInvoiceSent: true,
      customerInvoiceSentAt: new Date(),
    });
    // Auto-advance salesStatus on the associated lead
    if (po.leadId) {
      const leadId = typeof po.leadId === 'object' ? (po.leadId as any)._id : po.leadId;
      await Lead.findByIdAndUpdate(leadId, { salesStatus: 'Under payment follow-up' }).catch(() => {});
    }
    sendSuccess(res, { sentTo: customerEmail }, 'Documents sent to customer');
  } catch (err) {
    logger.error('Step4 send docs to customer error:', err);
    sendError(res, 'Failed to send documents to customer', 500);
  }
});

// ── Step 5: Invoice to ARK ───────────────────────────────────────────────────
router.post('/:id/step5-invoice-to-ark', authorize('admin', 'manager', 'sales', 'hr', 'finance'), upload.single('attachment'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('leadId', 'companyName');
    if (!po) { sendError(res, 'PO not found', 404); return; }

    const arkEmail: string = req.body.arkEmail || po.vendorEmail || '';
    if (!arkEmail) { sendError(res, 'ARK email is required', 400); return; }

    const lead = po.leadId as any;
    const senderSmtp = await getUserSmtp(req.user!.id);
    if (!senderSmtp) { sendError(res, 'Your email is not configured. Please log out and log in again to set up your email.', 400); return; }
    const senderName = senderSmtp?.fromName || '';
    const senderEmail = senderSmtp?.fromEmail || '';
    const docName = (req as any).file?.originalname || req.body.docName || '';

    const html = `<p>Dear Team,</p>

<p>Please find attached the invoice for Purchase Order ${po.poNumber}.</p>

<p>Kindly review and let us know if you need any clarification.</p>

<p>Regards,<br>${senderName}</p>`;

    const attachments: any[] = [];
    if ((req as any).file) attachments.push({ filename: (req as any).file.originalname, content: (req as any).file.buffer });

    try {
      await sendEmailWithUserSmtp(arkEmail, `Invoice for PO ${po.poNumber}`, html, senderSmtp, attachments.length ? attachments : undefined);
    } catch (emailErr: any) {
      logger.warn('Email send failed (step5), continuing:', emailErr);
    }

    await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      step5InvoiceToArk: true,
      step5InvoiceSentAt: new Date(),
      step5InvoiceDocName: docName,
      currentStep: 6,
      poSentToArk: true,
      poSentToArkAt: new Date(),
    });

    // Auto-create vendor invoice in Finance module
    try {
      const leadId = typeof po.leadId === 'object' ? (po.leadId as any)._id : po.leadId;
      const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
      await new Invoice({
        leadId,
        purchaseOrderId: po._id,
        invoiceType: 'vendor',
        vendorName: po.vendorName || req.body.arkName || arkEmail,
        vendorEmail: arkEmail,
        invoiceNumber: generateInvoiceNumber(),
        amount: po.amount,
        taxAmount: 0,
        totalAmount: po.amount,
        paidAmount: 0,
        dueDate,
        status: 'Sent',
        notes: `Auto-created from PO ${po.poNumber} — Invoice sent to ARK`,
        createdBy: req.user!.id,
      }).save();
    } catch (invErr) {
      logger.warn('Failed to auto-create vendor invoice (step5):', invErr);
    }

    sendSuccess(res, { sentTo: arkEmail }, 'Invoice sent to ARK');
  } catch (err) {
    logger.error('Step5 invoice to ARK error:', err);
    sendError(res, 'Failed to send invoice to ARK', 500);
  }
});

// ── Step 6: Send Documents to ARK ───────────────────────────────────────────
router.post('/:id/step6-send-docs-to-ark', authorize('admin', 'manager', 'sales', 'hr', 'finance'), upload.array('attachments', 10), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('leadId', 'companyName');
    if (!po) { sendError(res, 'PO not found', 404); return; }

    const arkEmail: string = req.body.arkEmail || po.vendorEmail || '';
    if (!arkEmail) { sendError(res, 'ARK email is required', 400); return; }

    const lead = po.leadId as any;
    const senderSmtp = await getUserSmtp(req.user!.id);
    if (!senderSmtp) { sendError(res, 'Your email is not configured. Please log out and log in again to set up your email.', 400); return; }
    const senderName = senderSmtp?.fromName || '';
    const senderEmail = senderSmtp?.fromEmail || '';

    const html = `<p>Dear Team,</p>

<p>Please find attached the customer documents for Purchase Order ${po.poNumber}.</p>

<p>Kindly review and let us know if you need any clarification.</p>

<p>Regards,<br>${senderName}</p>`;

    const attachments: any[] = [];
    if ((req as any).files?.length) {
      ((req as any).files as Express.Multer.File[]).forEach((f: Express.Multer.File) =>
        attachments.push({ filename: f.originalname, content: f.buffer })
      );
    }

    try {
      await sendEmailWithUserSmtp(arkEmail, `Customer Documents for PO ${po.poNumber}`, html, senderSmtp, attachments.length ? attachments : undefined);
    } catch (emailErr: any) {
      logger.warn('Email send failed (step6), continuing:', emailErr);
    }

    await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      step6DocsSentToArk: true,
      step6SentAt: new Date(),
      currentStep: 7,
      arkInvoiceReceived: true,
      arkInvoiceReceivedAt: new Date(),
    });
    sendSuccess(res, { sentTo: arkEmail }, 'Documents sent to ARK');
  } catch (err) {
    logger.error('Step6 send docs to ARK error:', err);
    sendError(res, 'Failed to send documents to ARK', 500);
  }
});

// ── Step 7: License Generation — Mark Mail Received ─────────────────────────
router.post('/:id/step7-license-received', authorize('admin', 'manager', 'sales', 'hr', 'finance'), async (req: AuthRequest, res: Response) => {
  try {
    await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      step7LicenseMailReceived: true,
      step7LicenseMailReceivedAt: new Date(),
      currentStep: 8,
    });
    sendSuccess(res, null, 'License generation mail marked as received');
  } catch (err) {
    logger.error('Step7 license received error:', err);
    sendError(res, 'Failed to mark license mail', 500);
  }
});

// ── Step 8: Final Invoice — Generate/Send + Convert to Account ───────────────
router.post('/:id/step8-final-invoice', authorize('admin', 'manager', 'sales', 'hr', 'finance'), upload.single('attachment'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('leadId', 'companyName contactPersonName email phone address city state');
    if (!po) { sendError(res, 'PO not found', 404); return; }

    const customerEmail: string = req.body.customerEmail || (po.leadId as any)?.email || '';
    if (!customerEmail) { sendError(res, 'Customer email is required', 400); return; }

    const lead = po.leadId as any;
    const senderSmtp = await getUserSmtp(req.user!.id);
    if (!senderSmtp) { sendError(res, 'Your email is not configured. Please log out and log in again to set up your email.', 400); return; }
    const senderName = senderSmtp?.fromName || '';
    const senderEmail = senderSmtp?.fromEmail || '';
    const invoiceAmount = req.body.amount ? Number(req.body.amount) : po.amount;
    const invNumber = `INV-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;

    const html = `<p>Dear ${lead?.contactPersonName || lead?.companyName || 'Customer'},</p>

<p>Please find attached the final invoice ${invNumber} for your Purchase Order ${po.poNumber}.</p>

<p>Kindly review and let us know if you need any clarification.</p>

<p>Regards,<br>${senderName}</p>`;

    const attachments: any[] = [];
    if ((req as any).file) attachments.push({ filename: (req as any).file.originalname, content: (req as any).file.buffer });

    try {
      await sendEmailWithUserSmtp(customerEmail, `Final Invoice ${invNumber} — PO ${po.poNumber}`, html, senderSmtp, attachments.length ? attachments : undefined);
    } catch (emailErr: any) {
      logger.warn('Email send failed (step8), continuing:', emailErr);
    }

    await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      step8FinalInvoiceSent: true,
      step8FinalInvoiceSentAt: new Date(),
      step8FinalInvoiceAmount: invoiceAmount,
      step8FinalInvoiceNumber: invNumber,
      currentStep: 8,
      workflowStatus: 'Completed',
    });
    // Advance lead salesStatus to payment follow-up
    if (po.leadId) {
      const leadId = typeof po.leadId === 'object' ? (po.leadId as any)._id : po.leadId;
      await Lead.findByIdAndUpdate(leadId, { salesStatus: 'Under payment follow-up' }).catch(() => {});
    }

    // Auto-convert to account if requested
    let account: any = null;
    if (req.body.convertToAccount === 'true' || req.body.convertToAccount === true) {
      const existing = await Account.findOne({ leadId: lead._id });
      if (!existing) {
        account = await new Account({
          organizationId: req.user!.organizationId,
          leadId: lead._id,
          companyName: req.body.accountName || lead.companyName,
          contactName: lead.contactPersonName || lead.companyName,
          contactEmail: lead.email || '',
          phone: lead.phone || '',
          address: lead.address || '',
          city: lead.city || '',
          state: lead.state || '',
          status: 'Active',
          salesStatus: 'Closed, and now a Customer',
          assignedSales: req.user!.id,
        }).save();
        await Lead.findByIdAndUpdate(lead._id, { stage: 'Converted', salesStatus: 'Closed, and now a Customer' });
      } else {
        account = existing;
      }
      await PurchaseOrder.findByIdAndUpdate(req.params.id, { converted: true });
    }

    // Auto-create customer invoice in Finance module
    try {
      const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
      await new Invoice({
        accountId: account?._id || undefined,
        leadId: lead._id,
        purchaseOrderId: po._id,
        invoiceType: 'customer',
        invoiceNumber: invNumber,
        amount: invoiceAmount,
        taxAmount: 0,
        totalAmount: invoiceAmount,
        paidAmount: 0,
        dueDate,
        status: 'Sent',
        notes: `Auto-created from PO ${po.poNumber} — Final invoice sent to customer`,
        createdBy: req.user!.id,
      }).save();
    } catch (invErr) {
      logger.warn('Failed to auto-create customer invoice (step8):', invErr);
    }

    sendSuccess(res, { invNumber, sentTo: customerEmail, account }, 'Final invoice sent');
  } catch (err) {
    logger.error('Step8 final invoice error:', err);
    sendError(res, 'Failed to send final invoice', 500);
  }
});

// ── Convert to Account (standalone) ─────────────────────────────────────────
router.post('/:id/convert', authorize('admin', 'manager', 'sales', 'engineer', 'hr', 'finance'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('leadId');
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
    const lead = po.leadId as any;
    const existing = await Account.findOne({ leadId: lead._id });
    if (existing) {
      await PurchaseOrder.findByIdAndUpdate(req.params.id, { converted: true });
      sendSuccess(res, existing, 'Account already exists for this lead'); return;
    }
    const account = await new Account({
      organizationId: req.user!.organizationId,
      leadId: lead._id,
      companyName: req.body.accountName || lead.companyName,
      contactName: lead.contactPersonName || lead.contactName || lead.companyName,
      contactEmail: lead.email || '',
      phone: lead.phone || '',
      address: lead.address || '',
      city: lead.city || '',
      state: lead.state || '',
      notes: req.body.notes,
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

// ── Record vendor payment ────────────────────────────────────────────────────
router.post('/:id/payment', authorize('admin', 'manager', 'hr', 'finance', 'sales'), async (req: AuthRequest, res: Response) => {
  try {
    const { paidAmount, paidDate, paymentMode, paymentReference, paymentNotes } = req.body;
    if (!paidAmount || !paidDate || !paymentMode) {
      sendError(res, 'paidAmount, paidDate and paymentMode are required', 400); return;
    }
    const po = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { paymentStatus: 'Paid', paidAmount, paidDate, paymentMode, paymentReference, paymentNotes, paidBy: req.user!.id },
      { new: true }
    ).populate('leadId', 'companyName').populate('paidBy', 'name email');
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
    sendSuccess(res, po, 'Vendor payment recorded');
  } catch (error) {
    logger.error('Record payment error:', error);
    sendError(res, 'Failed to record payment', 500);
  }
});

// ── Get vendor payments ──────────────────────────────────────────────────────
router.get('/vendor-payments', authorize('admin', 'manager', 'hr', 'finance'), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false, paymentStatus: 'Paid' };
    if (req.user!.organizationId) filter.organizationId = req.user!.organizationId;
    const [pos, total] = await Promise.all([
      PurchaseOrder.find(filter).populate('leadId', 'companyName').populate('paidBy', 'name email').populate('uploadedBy', 'name').sort({ paidDate: -1 }).skip(skip).limit(limit),
      PurchaseOrder.countDocuments(filter),
    ]);
    sendPaginated(res, pos, total, page, limit);
  } catch (error) {
    logger.error('Get vendor payments error:', error);
    sendError(res, 'Failed to fetch vendor payments', 500);
  }
});

// ── Delete all (admin) ───────────────────────────────────────────────────────
router.delete('/all', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await PurchaseOrder.deleteMany({});
    sendSuccess(res, { deleted: result.deletedCount }, `Deleted ${result.deletedCount} purchase orders`);
  } catch (error) {
    sendError(res, 'Failed to delete all purchase orders', 500);
  }
});

// ── Delete PO ────────────────────────────────────────────────────────────────
router.delete('/:id', authorize('admin', 'manager', 'sales'), async (req: AuthRequest, res: Response) => {
  try {
    const po = await PurchaseOrder.findByIdAndDelete(req.params.id);
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
    sendSuccess(res, null, 'Purchase order deleted');
  } catch (error) {
    logger.error('Delete PO error:', error);
    sendError(res, 'Failed to delete purchase order', 500);
  }
});

// ── Legacy step endpoints (backward compat) ──────────────────────────────────
router.post('/:id/send-to-vendor', authorize('admin', 'manager', 'sales', 'engineer', 'hr', 'finance'), upload.single('attachment'), async (req: AuthRequest, res: Response) => {
  try {
    await PurchaseOrder.findByIdAndUpdate(req.params.id, { vendorEmailSent: true, vendorEmailSentAt: new Date() });
    sendSuccess(res, null, 'Vendor notified');
  } catch { sendError(res, 'Failed', 500); }
});

router.post('/:id/send-customer-invoice', authorize('admin', 'manager', 'sales', 'hr', 'finance'), upload.single('attachment'), async (req: AuthRequest, res: Response) => {
  try {
    await PurchaseOrder.findByIdAndUpdate(req.params.id, { customerInvoiceSent: true, customerInvoiceSentAt: new Date() });
    sendSuccess(res, null, 'Customer invoice marked sent');
  } catch { sendError(res, 'Failed', 500); }
});

router.post('/:id/forward-to-ark', authorize('admin', 'manager', 'sales', 'hr', 'finance'), upload.single('attachment'), async (req: AuthRequest, res: Response) => {
  try {
    const arkEmail: string = req.body.arkEmail || '';
    await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      poForwardedToArk: true, poForwardedToArkAt: new Date(),
      step2ForwardedToArk: true, step2ForwardedAt: new Date(),
      currentStep: 3, workflowStatus: 'In Progress',
      ...(arkEmail ? { vendorEmail: arkEmail } : {}),
    });
    sendSuccess(res, null, 'PO forwarded to ARK');
  } catch { sendError(res, 'Failed', 500); }
});

router.post('/:id/mark-price-clearance', authorize('admin', 'manager', 'sales', 'hr', 'finance'), async (req: AuthRequest, res: Response) => {
  try {
    await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      priceClearanceReceived: true, priceClearanceReceivedAt: new Date(),
      step3PriceClearanceReceived: true, step3ReceivedAt: new Date(), currentStep: 4,
    });
    sendSuccess(res, null, 'Price clearance marked');
  } catch { sendError(res, 'Failed', 500); }
});

router.post('/:id/send-po-to-ark', authorize('admin', 'manager', 'sales', 'hr', 'finance'), upload.single('attachment'), async (req: AuthRequest, res: Response) => {
  try {
    await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      poSentToArk: true, poSentToArkAt: new Date(),
      step5InvoiceToArk: true, step5InvoiceSentAt: new Date(), currentStep: 6,
    });
    sendSuccess(res, null, 'PO sent to ARK');
  } catch { sendError(res, 'Failed', 500); }
});

router.post('/:id/mark-ark-invoice', authorize('admin', 'manager', 'sales', 'hr', 'finance'), async (req: AuthRequest, res: Response) => {
  try {
    await PurchaseOrder.findByIdAndUpdate(req.params.id, {
      arkInvoiceReceived: true, arkInvoiceReceivedAt: new Date(),
      ...(req.body.amount ? { arkInvoiceAmount: Number(req.body.amount) } : {}),
      step6DocsSentToArk: true, step6SentAt: new Date(), currentStep: 7,
    });
    sendSuccess(res, null, 'ARK invoice marked as received');
  } catch { sendError(res, 'Failed', 500); }
});

export default router;
