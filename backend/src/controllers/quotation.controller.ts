import { Response } from 'express';
import Quotation from '../models/Quotation';
import Account from '../models/Account';
import Lead from '../models/Lead';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';
import { generateQuotationPDF } from '../services/pdf.service';

const genQNum = () => `QT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;

export const getQuotations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.accountId) filter.accountId = req.query.accountId;
    const [quotations, total] = await Promise.all([
      Quotation.find(filter).populate('accountId', 'companyName').populate('createdBy', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Quotation.countDocuments(filter),
    ]);
    sendPaginated(res, quotations, total, page, limit);
  } catch { sendError(res, 'Failed to fetch quotations', 500); }
};

export const createQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productList, taxPercent = 18 } = req.body;
    const subtotal = productList.reduce((s: number, i: { total: number }) => s + i.total, 0);
    const taxAmount = (subtotal * taxPercent) / 100;
    const total = subtotal + taxAmount;
    const quotation = await new Quotation({ ...req.body, quotationNumber: genQNum(), subtotal, taxAmount, total, createdBy: req.user!.id }).save();
    const account = await Account.findById(req.body.accountId);
    if (account) {
      try {
        const pdf = await generateQuotationPDF({ quotationNumber: quotation.quotationNumber, companyName: account.companyName, contactName: account.contactName, productList, subtotal, taxPercent, taxAmount, total });
        await Quotation.findByIdAndUpdate(quotation._id, { pdfUrl: pdf });
        await Lead.findByIdAndUpdate(account.leadId, { stage: 'Quotation Sent' });
      } catch (_e) { /* PDF optional */ }
    }
    sendSuccess(res, quotation, 'Quotation created', 201);
  } catch { sendError(res, 'Failed to create quotation', 500); }
};

export const updateQuotationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = await Quotation.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!q) { sendError(res, 'Quotation not found', 404); return; }
    sendSuccess(res, q, 'Status updated');
  } catch { sendError(res, 'Failed', 500); }
};
