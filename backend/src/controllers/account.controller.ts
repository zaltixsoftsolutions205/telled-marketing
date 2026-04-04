import { Response } from 'express';
import Account from '../models/Account';
import Lead from '../models/Lead';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';
import { notifyUser, notifyRole } from '../utils/notify';

export const getAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, search, assignedEngineer } = req.query;
    const filter: Record<string, unknown> = { isArchived: false };
    if (status) filter.status = status;
    if (assignedEngineer) filter.assignedEngineer = assignedEngineer;
    // engineers see all accounts (they get assigned later)
    if (search) filter.$or = [
      { companyName: { $regex: sanitizeQuery(search as string), $options: 'i' } },
      { contactName: { $regex: sanitizeQuery(search as string), $options: 'i' } },
    ];
    const [accounts, total] = await Promise.all([
      Account.find(filter).populate('leadId', 'companyName').populate('assignedEngineer', 'name email').populate('assignedSales', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Account.countDocuments(filter),
    ]);
    sendPaginated(res, accounts, total, page, limit);
  } catch { sendError(res, 'Failed to fetch accounts', 500); }
};

export const getAccountById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = await Account.findById(req.params.id).populate('assignedEngineer', 'name email').populate('assignedSales', 'name email').populate('leadId');
    if (!account || account.isArchived) { sendError(res, 'Account not found', 404); return; }
    sendSuccess(res, account);
  } catch { sendError(res, 'Failed', 500); }
};

export const convertLeadToAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leadId } = req.body;
    const lead = await Lead.findById(leadId);
    if (!lead) { sendError(res, 'Lead not found', 404); return; }
    const existing = await Account.findOne({ leadId });
    if (existing) { sendSuccess(res, existing, 'Account already exists for this lead'); return; }
    const account = await new Account({
      leadId,
      companyName: req.body.accountName || lead.companyName,
      contactName: lead.contactName || lead.contactPersonName || lead.companyName,
      contactEmail: lead.email || '',
      phone: String(lead.phone || ''),
      assignedSales: lead.assignedTo || req.user!.id,
      notes: req.body.notes,
      status: 'Active',
    }).save();
    await Lead.findByIdAndUpdate(leadId, { stage: 'Converted' });
    notifyRole(['admin', 'hr_finance'], {
      title: 'New Account Created',
      message: `"${account.companyName}" has been converted from a lead to an active account`,
      type: 'general',
      link: '/accounts',
    });
    sendSuccess(res, account, 'Lead converted to account', 201);
  } catch (err: any) { sendError(res, err?.message || 'Failed to convert lead', 500); }
};

export const updateAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = await Account.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('assignedEngineer', 'name email').populate('assignedSales', 'name email');
    if (!account) { sendError(res, 'Account not found', 404); return; }
    sendSuccess(res, account, 'Account updated');
  } catch { sendError(res, 'Failed to update account', 500); }
};

export const assignEngineer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = await Account.findByIdAndUpdate(req.params.id, { assignedEngineer: req.body.engineerId }, { new: true }).populate('assignedEngineer', 'name email');
    if (!account) { sendError(res, 'Account not found', 404); return; }
    if (req.body.engineerId) {
      notifyUser(req.body.engineerId, {
        title: 'Account Assigned',
        message: `You have been assigned to account "${account.companyName}"`,
        type: 'general',
        link: '/accounts',
      });
    }
    sendSuccess(res, account, 'Engineer assigned');
  } catch { sendError(res, 'Failed', 500); }
};

export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = await Account.findByIdAndDelete(req.params.id);
    if (!account) { sendError(res, 'Account not found', 404); return; }
    sendSuccess(res, null, 'Account deleted');
  } catch { sendError(res, 'Failed to delete account', 500); }
};
