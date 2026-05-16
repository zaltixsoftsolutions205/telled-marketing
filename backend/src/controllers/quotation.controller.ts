// backend/src/controllers/quotation.controller.ts
import { Response } from 'express';
import Quotation from '../models/Quotation';
import Lead from '../models/Lead';
import PurchaseOrder from '../models/PurchaseOrder';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';
import sendEmail, { sendEmailWithUserSmtp, UserSmtpConfig } from '../services/email.service';
import User from '../models/User';
import Organization from '../models/Organization';
import { getUserSmtp, getUserSmtpWithFallback } from '../utils/getUserSmtp';
import { generateQuotationPDF as generateQuotationPDFService } from '../services/pdf.service';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

function extractAmountFromText(text: string): number | null {
  const clean = (s: string) => parseFloat(s.replace(/,/g, ''));

  // Helper: find all matches for a pattern (global), return last capture group 1 value
  const lastMatch = (re: RegExp): number | null => {
    const all = [...text.matchAll(re)];
    if (!all.length) return null;
    const val = clean(all[all.length - 1][1] || '');
    return isNaN(val) || val <= 0 ? null : val;
  };

  const NUM = `([\\d,]+(?:\\.\\d{1,2})?)`;
  const CUR = `(?:Rs\\.?|INR|₹|USD|\\$)?\\s*`;

  // ── Pass 1: label + amount ON SAME LINE ──────────────────────────────────
  const sameLinePatterns: RegExp[] = [
    new RegExp(`(?:grand\\s+total|total\\s+amount|net\\s+total|invoice\\s+total|amount\\s+payable|payable\\s+amount)\\s*[:\\-=]?\\s*${CUR}${NUM}`, 'gi'),
    new RegExp(`final\\s+(?:price|amount|total)\\s*[:\\-=]?\\s*${CUR}${NUM}`, 'gi'),
    new RegExp(`(?:^|\\n)[\\t ]*(?:Total|TOTAL)\\s*[:\\-=]?\\s*${CUR}${NUM}`, 'gim'),
  ];
  for (const re of sameLinePatterns) {
    const v = lastMatch(re);
    if (v !== null) return v;
  }

  // ── Pass 2: label on one line, amount on NEXT line (tabular PDFs) ────────
  const labelThenNewline = [
    /(?:grand\s+total|total\s+amount|net\s+total|invoice\s+total|amount\s+payable|payable\s+amount|final\s+(?:price|amount|total))\s*[:\-=]?\s*\n\s*/gi,
    /(?:^|\n)[\t ]*(?:Total|TOTAL)\s*[:\-=]?\s*\n\s*/gim,
  ];
  for (const labelRe of labelThenNewline) {
    for (const m of text.matchAll(labelRe)) {
      const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 40);
      const nm = after.match(new RegExp(`^${CUR}${NUM}`));
      if (nm?.[1]) {
        const v = clean(nm[1]);
        if (!isNaN(v) && v > 0) return v;
      }
    }
  }

  // ── Pass 3: last currency amount in document (universal fallback) ─────────
  // Most quotation PDFs end with the final total — so the LAST INR/₹ amount wins
  const allCurrencyAmounts = [...text.matchAll(new RegExp(`(?:INR|Rs\\.?|₹)\\s*${NUM}`, 'gi'))];
  if (allCurrencyAmounts.length) {
    const v = clean(allCurrencyAmounts[allCurrencyAmounts.length - 1][1]);
    if (!isNaN(v) && v > 0) return v;
  }

  return null;
}


const SETTINGS_FILE = path.join(process.cwd(), 'uploads', 'settings.json');
function getLogoPath(): string | undefined {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const s = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      if (s.logoUrl) {
        // logoUrl stored as '/uploads/filename.png' — strip leading slash before joining
        const rel = s.logoUrl.replace(/^\/+/, '');
        const fullPath = path.join(process.cwd(), rel);
        if (fs.existsSync(fullPath)) return fullPath;
        logger.warn(`Logo file not found at: ${fullPath}`);
      }
    }
  } catch (e) {
    logger.warn('getLogoPath error:', e);
  }
  return undefined;
}

// Generate quotation number: QT-YYYY-XXXX
const generateQuotationNumber = async (): Promise<string> => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const prefix = `QT${mm}${yyyy}`;
  // Find the highest existing sequence number for this month prefix
  const last = await Quotation.findOne(
    { quotationNumber: { $regex: `^${prefix}` } },
    { quotationNumber: 1 },
    { sort: { quotationNumber: -1 } }
  ).lean();
  let next = 1;
  if (last?.quotationNumber) {
    const existing = parseInt(last.quotationNumber.slice(prefix.length), 10);
    if (!isNaN(existing)) next = existing + 1;
  }
  return `${prefix}${String(next).padStart(3, '0')}`;
};

export const getQuotations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, leadId, search, poFilter } = req.query;

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

    // PO filter: find lead IDs that have at least one PO
    if (poFilter === 'po_received' || poFilter === 'po_not_received') {
      const poLeadIds = await PurchaseOrder.find({ isArchived: { $ne: true } }).distinct('leadId');
      if (poFilter === 'po_received') {
        filter.leadId = { $in: poLeadIds };
      } else {
        filter.leadId = { $nin: poLeadIds };
      }
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

    // Attach poReceived flag to each quotation
    const allPoLeadIds = await PurchaseOrder.find({ isArchived: { $ne: true } }).distinct('leadId');
    const poLeadIdSet = new Set(allPoLeadIds.map((id: unknown) => String(id)));
    const enriched = quotations.map((q) => {
      const obj = q.toObject() as unknown as Record<string, unknown>;
      const qLeadId = (q.leadId as any)?._id ?? q.leadId;
      obj.poReceived = poLeadIdSet.has(String(qLeadId));
      return obj;
    });

    sendPaginated(res, enriched, total, page, limit);
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
      notes,
      // upload-based fields
      uploadedFile,
      uploadedFileName,
      totalAmount,
      // Seller / from-company info
      fromCompany, fromAddress, fromEmail, fromPhone, fromGST,
      toCompany, toContact, toAddress, deliveryWeeks,
      customerId, salesPersonName,
      bankName, bankAccount, bankIFSC, bankBranch,
      templateId, templateColor,
      secondLogoLabel,
      customFields: rawCustomFields,
    } = req.body;

    if (!leadId) { sendError(res, 'leadId is required', 400); return; }

    const lead = await Lead.findById(leadId);
    if (!lead || lead.isArchived) { sendError(res, 'Lead not found', 404); return; }

    // Determine file from multer upload (now using fields) OR passed path
    const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
    const quotationFileUpload = files?.quotationFile?.[0] || (req as any).file;
    const sellerLogoUpload    = files?.sellerLogo?.[0];
    const secondLogoUpload    = files?.secondLogo?.[0];
    const resolvedFile        = quotationFileUpload ? quotationFileUpload.path : (uploadedFile || undefined);
    const resolvedFileName    = quotationFileUpload ? quotationFileUpload.originalname : (uploadedFileName || undefined);
    const resolvedLogoPath    = sellerLogoUpload  ? sellerLogoUpload.path  : undefined;
    const resolvedSecondLogo  = secondLogoUpload  ? secondLogoUpload.path  : undefined;

    let resolvedItems: any[];
    let subtotal: number;
    let taxAmt: number;
    let total: number;

    if (resolvedFile && totalAmount) {
      // Upload-based flow: single synthetic item
      const amt = Number(totalAmount);
      resolvedItems = [{ description: resolvedFileName || 'Uploaded Quotation', quantity: 1, listPrice: amt, unitPrice: amt, discount: 0, total: amt }];
      subtotal = amt;
      taxAmt = 0;
      total = amt;
    } else {
      // Manual flow: require items
      if (!items?.length) { sendError(res, 'Either upload a quotation file or provide items', 400); return; }
      resolvedItems = items.map((item: any) => ({
        description: item.description,
        quantity: Number(item.quantity),
        listPrice: Number(item.listPrice ?? 0),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount ?? 0),
        total: Number(item.total ?? (item.quantity * item.unitPrice)),
      }));
      subtotal = resolvedItems.reduce((s: number, i: any) => s + i.total, 0);
      const discountApplicable = req.body.discountApplicable ?? false;
      const discountType = req.body.discountType ?? 'percent';
      const discountValue = Number(req.body.discountValue ?? 0);
      const discountAmount = discountApplicable ? (discountType === 'percent' ? subtotal * discountValue / 100 : discountValue) : 0;
      const discountedSubtotal = subtotal - discountAmount;
      taxAmt = gstApplicable ? discountedSubtotal * Number(taxRate) / 100 : 0;
      total = discountedSubtotal + taxAmt;
    }

    const existingCount = await Quotation.countDocuments({ leadId, isArchived: false });

    const quotation = new Quotation({
      organizationId: req.user!.organizationId,
      leadId,
      quotationNumber: await generateQuotationNumber(),
      version: existingCount + 1,
      items: resolvedItems,
      subtotal,
      taxRate: Number(taxRate),
      gstApplicable: gstApplicable === 'true' || gstApplicable === true,
      taxAmount: taxAmt,
      discountApplicable: req.body.discountApplicable ?? false,
      discountType: req.body.discountType ?? 'percent',
      discountValue: Number(req.body.discountValue ?? 0),
      discountAmount: Number(req.body.discountAmount ?? 0),
      total,
      finalAmount: total,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      terms,
      notes,
      status: 'Draft',
      uploadedFile: resolvedFile,
      uploadedFileName: resolvedFileName,
      // Seller info from the quotation modal
      sellerCompany:  fromCompany  || undefined,
      sellerAddress:  fromAddress  || undefined,
      sellerEmail:    fromEmail    || undefined,
      sellerPhone:    fromPhone    || undefined,
      sellerGST:      fromGST      || undefined,
      sellerLogoPath: resolvedLogoPath   || undefined,
      secondLogoPath:  resolvedSecondLogo || undefined,
      secondLogoLabel: secondLogoLabel    || undefined,
      customerId:     customerId  || undefined,
      salesPersonName: salesPersonName || undefined,
      toCompany:       toCompany    || undefined,
      toContact:      toContact    || undefined,
      toAddress:      toAddress    || undefined,
      bankName:       bankName     || undefined,
      bankAccount:    bankAccount  || undefined,
      bankIFSC:       bankIFSC     || undefined,
      bankBranch:     bankBranch   || undefined,
      deliveryWeeks:  deliveryWeeks || undefined,
      templateId:     templateId   || undefined,
      templateColor:  templateColor || undefined,
      customFields:   (() => {
        if (!rawCustomFields) return [];
        // Comes as JSON string from FormData or as array from JSON body
        try { return typeof rawCustomFields === 'string' ? JSON.parse(rawCustomFields) : rawCustomFields; } catch { return []; }
      })(),
      createdBy: req.user!.id,
      isArchived: false,
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

// POST /quotations/parse-pdf — upload a PDF and extract amount
export const parsePdfQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = (req as any).file;
    if (!file) { sendError(res, 'No file uploaded', 400); return; }

    let extractedText = '';
    let suggestedAmount: number | null = null;

    if (path.extname(file.originalname).toLowerCase() === '.pdf') {
      const buffer = fs.readFileSync(file.path);
      try {
        const parsed = await pdfParse(buffer);
        extractedText = parsed.text || '';
        suggestedAmount = extractAmountFromText(extractedText);
        logger.info(`[parsePdf] extracted text (first 500): ${extractedText.slice(0, 500)}`);
        logger.info(`[parsePdf] suggestedAmount: ${suggestedAmount}`);
      } catch (e) {
        logger.warn('pdf-parse failed:', e);
      }
    }

    sendSuccess(res, {
      filePath: file.path,
      fileName: file.originalname,
      suggestedAmount,
      extractedText: extractedText.slice(0, 2000),
    });
  } catch (error: any) {
    logger.error('parsePdfQuotation error:', error);
    sendError(res, 'Failed to parse PDF', 500);
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
      .populate('leadId', 'companyName email contactPersonName phone address city state oemName')
      .populate('createdBy', 'name email phone');

    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }

    const lead = quotation.leadId as any;
    // Always use the logged-in user's own email — no fallback to system or other users
    const senderSmtp = await getUserSmtp(req.user!.id, true);
    if (!senderSmtp) {
      sendError(res, 'Your email is not configured. Please log out and log in again to set up your email.', 400);
      return;
    }
    logger.info(`[sendQuotationEmail] Sending from ${senderSmtp.fromEmail} to ${req.body?.toEmail || lead?.email}`);
    const senderContactEmail = senderSmtp.fromEmail;

    // Fetch organization name
    const senderUser = await User.findById(req.user!.id).select('organizationId name').lean();
    const org = senderUser?.organizationId
      ? await Organization.findById(senderUser.organizationId).select('name').lean()
      : null;
    const orgName = (org as any)?.name || 'Our Company';

    // Allow caller to override recipient(s); fall back to lead email
    const toEmail: string = req.body?.toEmail || lead?.email;
    if (!toEmail) {
      sendError(res, 'Recipient email not found. Please provide a toEmail or ensure the lead has an email.', 400);
      return;
    }

    // Optional CC recipients (comma-separated)
    const ccEmail: string | undefined = req.body?.cc || undefined;

    // Use uploaded file if available, else generate PDF
    let attachmentPath: string;
    let attachmentName: string;

    if ((quotation as any).uploadedFile && fs.existsSync((quotation as any).uploadedFile)) {
      attachmentPath = (quotation as any).uploadedFile;
      attachmentName = (quotation as any).uploadedFileName || `Quotation-${quotation.quotationNumber}.pdf`;
    } else {
      const pdfFile = await generateQuotationPDFService({
        quotationNumber: quotation.quotationNumber,
        // Use user-filled customer fields first, fall back to lead data
        companyName:    (quotation as any).toCompany  || lead.companyName,
        companyAddress: (quotation as any).toAddress  || [lead.address, lead.city, lead.state].filter(Boolean).join(', '),
        contactName:    (quotation as any).toContact  || lead.contactPersonName || lead.companyName,
        contactEmail: lead.email,
        contactPhone: lead.phone,
        oemName: lead.oemName,
        salesPersonName: quotation.salesPersonName || (quotation.createdBy as any)?.name,
        salesPersonEmail: (quotation.createdBy as any)?.email,
        salesPersonPhone: (quotation.createdBy as any)?.phone,
        customerId: (quotation as any).customerId || undefined,
        items: quotation.items.map(i => ({
          description: i.description || '',
          quantity: Number(i.quantity) || 1,
          listPrice: Number((i as any).listPrice) || 0,
          unitPrice: Number(i.unitPrice) || 0,
          discount: Number((i as any).discount) || 0,
          total: Number(i.total) || 0,
        })),
        subtotal: Number(quotation.subtotal) || 0,
        taxRate: Number(quotation.taxRate) || 0,
        taxAmount: Number(quotation.taxAmount) || 0,
        total: Number(quotation.total) || 0,
        gstApplicable: quotation.gstApplicable ?? false,
        discountApplicable: quotation.discountApplicable ?? false,
        discountType: quotation.discountType ?? 'percent',
        discountValue: Number(quotation.discountValue) || 0,
        discountAmount: Number(quotation.discountAmount) || 0,
        validUntil: quotation.validUntil,
        notes: quotation.notes,
        terms: quotation.terms,
        // Use seller-uploaded logo first, then org logo, then nothing
        logoPath:       (quotation as any).sellerLogoPath || getLogoPath(),
        secondLogoPath: (quotation as any).secondLogoPath || undefined,
        secondLogoLabel:(quotation as any).secondLogoLabel || 'Channel Partner',
        // Seller info
        sellerCompany: (quotation as any).sellerCompany,
        sellerAddress: (quotation as any).sellerAddress,
        sellerEmail:   (quotation as any).sellerEmail,
        sellerPhone:   (quotation as any).sellerPhone,
        sellerGST:     (quotation as any).sellerGST,
        bankName:      (quotation as any).bankName,
        bankAccount:   (quotation as any).bankAccount,
        bankIFSC:      (quotation as any).bankIFSC,
        bankBranch:    (quotation as any).bankBranch,
        deliveryWeeks: (quotation as any).deliveryWeeks,
        customFields:  (quotation as any).customFields || [],
      });
      const uploadDir = process.env.UPLOAD_PATH || './uploads';
      attachmentPath = path.join(process.cwd(), uploadDir, pdfFile);
      attachmentName = `Quotation-${quotation.quotationNumber}.pdf`;
    }

    const senderName = (quotation.createdBy as any)?.name || senderSmtp?.fromName || orgName;
    const recipientName = lead.contactPersonName || lead.companyName;

    const html = `<p>Dear ${recipientName},</p>

<p>Please find attached the quotation for your requirements.</p>

<p>Kindly review and let us know if you need any clarification.</p>

<p>Regards,<br>${senderName}</p>`;

    await sendEmailWithUserSmtp(
      toEmail,
      `Quotation ${quotation.quotationNumber}`,
      html,
      senderSmtp,
      [{ filename: attachmentName, path: attachmentPath }],
      ccEmail
    );
    
    await Quotation.findByIdAndUpdate(req.params.id, {
      emailSent: true,
      emailSentAt: new Date(),
      status: 'Sent',
    });

    sendSuccess(res, { attachmentName }, 'Email sent with quotation attachment');
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

    const senderName = (quotation.createdBy as any)?.name || 'Sales';

    const vendorHtml = `<p>Dear Vendor,</p>

<p>Please find attached the purchase order for your reference.</p>

<p>Kindly review and let us know if you need any clarification.</p>

<p>Regards,<br>${senderName}</p>`;

    const senderSmtp = await getUserSmtp(req.user!.id);
    await sendEmailWithUserSmtp(
      vendorEmail,
      `Purchase Order - ${quotation.quotationNumber}`,
      vendorHtml,
      senderSmtp,
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
      .populate('leadId', 'companyName email contactPersonName phone address city state oemName')
      .populate('createdBy', 'name email phone');

    if (!quotation) {
      sendError(res, 'Quotation not found', 404);
      return;
    }

    const lead = quotation.leadId as any;

    const pdfFile = await generateQuotationPDFService({
      quotationNumber: quotation.quotationNumber,
      companyName: lead.companyName,
      companyAddress: [lead.address, lead.city, lead.state].filter(Boolean).join(', '),
      contactName: lead.contactPersonName || lead.companyName,
      contactEmail: lead.email,
      contactPhone: lead.phone,
      oemName: lead.oemName,
      salesPersonName: quotation.salesPersonName || (quotation.createdBy as any)?.name,
      salesPersonEmail: (quotation.createdBy as any)?.email,
      salesPersonPhone: (quotation.createdBy as any)?.phone,
      customerId: (quotation as any).customerId || undefined,
      items: quotation.items.map(i => ({
        description: i.description || '',
        quantity: Number(i.quantity) || 1,
        listPrice: Number((i as any).listPrice) || 0,
        unitPrice: Number(i.unitPrice) || 0,
        discount: Number((i as any).discount) || 0,
        total: Number(i.total) || 0,
      })),
      subtotal: Number(quotation.subtotal) || 0,
      taxRate: Number(quotation.taxRate) || 0,
      taxAmount: Number(quotation.taxAmount) || 0,
      total: Number(quotation.total) || 0,
      gstApplicable: quotation.gstApplicable ?? false,
      discountApplicable: quotation.discountApplicable ?? false,
      discountType: quotation.discountType ?? 'percent',
      discountValue: Number(quotation.discountValue) || 0,
      discountAmount: Number(quotation.discountAmount) || 0,
      validUntil: quotation.validUntil,
      notes: quotation.notes,
      terms: quotation.terms,
      logoPath: getLogoPath(),
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

export const deleteQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const quotation = await Quotation.findByIdAndDelete(req.params.id);
    if (!quotation) { sendError(res, 'Quotation not found', 404); return; }
    sendSuccess(res, null, 'Quotation deleted');
  } catch (error) {
    logger.error('deleteQuotation error:', error);
    sendError(res, 'Failed to delete quotation', 500);
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