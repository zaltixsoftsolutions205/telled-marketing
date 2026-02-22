import { Response } from 'express';
import Account from '../models/Account';
import Lead from '../models/Lead';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';

export const getAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, search, assignedEngineer } = req.query;
    const filter: Record<string, unknown> = { isArchived: false };
    if (status) filter.status = status;
    if (assignedEngineer) filter.assignedEngineer = assignedEngineer;
    if (req.user!.role === 'engineer') filter.assignedEngineer = req.user!.id;
    if (search) filter.$or = [
      { companyName: { $regex: sanitizeQuery(search as string), $options: 'i' } },
      { contactName: { $regex: sanitizeQuery(search as string), $options: 'i' } },
    ];
    const [accounts, total] = await Promise.all([
      Account.find(filter).populate('assignedEngineer', 'name email').populate('assignedSales', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit),
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
    if (lead.stage !== 'PO Received') { sendError(res, 'Lead must have PO received before converting', 400); return; }
    if (await Account.findOne({ leadId })) { sendError(res, 'Lead already converted', 409); return; }
    const account = await new Account({ leadId, companyName: lead.companyName, contactName: lead.contactName, contactEmail: lead.contactEmail, phone: lead.phone, assignedSales: lead.assignedSales, ...req.body }).save();
    await Lead.findByIdAndUpdate(leadId, { stage: 'Converted' });
    sendSuccess(res, account, 'Lead converted to account', 201);
  } catch { sendError(res, 'Failed to convert lead', 500); }
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
    sendSuccess(res, account, 'Engineer assigned');
  } catch { sendError(res, 'Failed', 500); }
};
