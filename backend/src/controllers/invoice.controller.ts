import { Response } from 'express';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Account from '../models/Account';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, generateInvoiceNumber } from '../utils/helpers';
import { generateInvoicePDF } from '../services/pdf.service';
import { notifyRole, notifyUser } from '../utils/notify';

export const getInvoices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, unknown> = { isArchived: false };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.accountId) filter.accountId = req.query.accountId;
    const [invoices, total] = await Promise.all([
      Invoice.find(filter).populate('accountId', 'companyName contactEmail').populate('createdBy', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(filter),
    ]);
    sendPaginated(res, invoices, total, page, limit);
  } catch { sendError(res, 'Failed to fetch invoices', 500); }
};

export const createInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, taxPercent = 18 } = req.body;
    const taxAmount = (amount * taxPercent) / 100;
    const totalAmount = amount + taxAmount;
    let invoice = await new Invoice({ ...req.body, invoiceNumber: generateInvoiceNumber(), taxAmount, totalAmount, status: 'Sent', createdBy: req.user!.id }).save();
    try {
      const account = await Account.findById(req.body.accountId);
      if (account) {
        const pdf = await generateInvoicePDF({ invoiceNumber: invoice.invoiceNumber, companyName: account.companyName, contactName: account.contactName, amount, taxAmount, totalAmount, dueDate: invoice.dueDate, invoiceDate: invoice.createdAt, notes: req.body.notes, paidAmount: 0 });
        invoice = (await Invoice.findByIdAndUpdate(invoice._id, { pdfUrl: pdf }, { new: true })) ?? invoice;
      }
    } catch (_e) {}
    notifyRole(['admin', 'hr_finance'], {
      title: 'New Invoice Created',
      message: `Invoice ${invoice.invoiceNumber} for ₹${invoice.totalAmount.toLocaleString()} has been created`,
      type: 'salary',
      link: '/invoices',
    });
    sendSuccess(res, invoice, 'Invoice created', 201);
  } catch { sendError(res, 'Failed to create invoice', 500); }
};

export const recordPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) { sendError(res, 'Invoice not found', 404); return; }
    const { amountPaid, paymentDate, mode, referenceNumber, notes } = req.body;
    const payment = await new Payment({ invoiceId: invoice._id, accountId: invoice.accountId, amountPaid, paymentDate, mode, referenceNumber, notes, recordedBy: req.user!.id }).save();
    invoice.paidAmount += amountPaid;
    invoice.status = invoice.paidAmount >= invoice.totalAmount ? 'Paid' : invoice.paidAmount > 0 ? 'Partially Paid' : invoice.status;
    await invoice.save();
    notifyRole(['admin', 'hr_finance'], {
      title: invoice.status === 'Paid' ? 'Invoice Fully Paid' : 'Partial Payment Received',
      message: `₹${amountPaid.toLocaleString()} received for invoice ${invoice.invoiceNumber} — status: ${invoice.status}`,
      type: 'salary',
      link: '/invoices',
    });
    sendSuccess(res, { invoice, payment }, 'Payment recorded');
  } catch { sendError(res, 'Failed to record payment', 500); }
};

export const getPaymentsByInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payments = await Payment.find({ invoiceId: req.params.id }).populate('recordedBy', 'name').sort({ paymentDate: -1 });
    sendSuccess(res, payments);
  } catch { sendError(res, 'Failed', 500); }
};

export const getInvoiceStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [byStatus, outstanding] = await Promise.all([
      Invoice.aggregate([{ $match: { isArchived: false } }, { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$totalAmount' }, paid: { $sum: '$paidAmount' } } }]),
      Invoice.aggregate([{ $match: { status: { $in: ['Sent', 'Partially Paid', 'Overdue'] }, isArchived: false } }, { $group: { _id: null, total: { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } } } }]),
    ]);
    sendSuccess(res, { byStatus, outstandingAmount: outstanding[0]?.total || 0 });
  } catch { sendError(res, 'Failed to get stats', 500); }
};
