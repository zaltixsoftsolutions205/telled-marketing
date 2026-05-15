// import { Response } from 'express';
// import Account from '../models/Account';
// import Lead from '../models/Lead';
// import User from '../models/User';
// import Organization from '../models/Organization';
// import { AuthRequest } from '../middleware/auth.middleware';
// import { sendSuccess, sendError, sendPaginated } from '../utils/response';
// import { getPaginationParams, sanitizeQuery } from '../utils/helpers';
// import { notifyUser, notifyRole } from '../utils/notify';
// import { sendAccountWelcomeEmail, UserSmtpConfig } from '../services/email.service';
// import logger from '../utils/logger';
// import { getUserSmtp, getUserSmtpWithFallback } from '../utils/getUserSmtp';

// export const getAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { page, limit, skip } = getPaginationParams(req);
//     const { status, search, assignedEngineer } = req.query;
//     const filter: Record<string, unknown> = { isArchived: false, organizationId: req.user!.organizationId };
//     if (status) filter.status = status;
//     if (assignedEngineer) filter.assignedEngineer = assignedEngineer;
//     // engineers see all accounts (they get assigned later)
//     if (search) filter.$or = [
//       { companyName: { $regex: sanitizeQuery(search as string), $options: 'i' } },
//       { contactName: { $regex: sanitizeQuery(search as string), $options: 'i' } },
//     ];
//     const [accounts, total] = await Promise.all([
//       Account.find(filter).populate('leadId', 'companyName').populate('assignedEngineer', 'name email').populate('assignedSales', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit),
//       Account.countDocuments(filter),
//     ]);
//     sendPaginated(res, accounts, total, page, limit);
//   } catch { sendError(res, 'Failed to fetch accounts', 500); }
// };

// export const getAccountById = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const account = await Account.findOne({ _id: req.params.id, organizationId: req.user!.organizationId }).populate('assignedEngineer', 'name email').populate('assignedSales', 'name email').populate('leadId');
//     if (!account || account.isArchived) { sendError(res, 'Account not found', 404); return; }
//     sendSuccess(res, account);
//   } catch { sendError(res, 'Failed', 500); }
// };

// export const convertLeadToAccount = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { leadId } = req.body;
//     const lead = await Lead.findById(leadId);
//     if (!lead) { sendError(res, 'Lead not found', 404); return; }
//     const existing = await Account.findOne({ leadId });
//     if (existing) { sendSuccess(res, existing, 'Account already exists for this lead'); return; }
//     const account = await new Account({
//       organizationId: req.user!.organizationId,
//       leadId,
//       companyName: req.body.accountName || lead.companyName,
//       contactName: lead.contactName || lead.contactPersonName || lead.companyName,
//       contactEmail: lead.email || '',
//       phone: String(lead.phone || ''),
//       assignedSales: lead.assignedTo || req.user!.id,
//       notes: req.body.notes,
//       status: 'Active',
//       salesStatus: 'Closed, and now a Customer',
//     }).save();
//     await Lead.findByIdAndUpdate(leadId, { stage: 'Converted', salesStatus: 'Closed, and now a Customer' });
//     notifyRole(['admin', 'hr'], {
//       title: 'New Account Created',
//       message: `"${account.companyName}" has been converted from a lead to an active account`,
//       type: 'general',
//       link: '/accounts',
//     });
//     sendSuccess(res, account, 'Lead converted to account', 201);
//   } catch (err: any) { sendError(res, err?.message || 'Failed to convert lead', 500); }
// };

// export const updateAccount = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const account = await Account.findOneAndUpdate({ _id: req.params.id, organizationId: req.user!.organizationId }, req.body, { new: true, runValidators: true }).populate('assignedEngineer', 'name email').populate('assignedSales', 'name email');
//     if (!account) { sendError(res, 'Account not found', 404); return; }
//     sendSuccess(res, account, 'Account updated');
//   } catch { sendError(res, 'Failed to update account', 500); }
// };

// export const assignEngineer = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const account = await Account.findByIdAndUpdate(req.params.id, { assignedEngineer: req.body.engineerId }, { new: true })
//       .populate('assignedEngineer', 'name email phone');
//     if (!account) { sendError(res, 'Account not found', 404); return; }

//     if (req.body.engineerId) {
//       notifyUser(req.body.engineerId, {
//         title: 'Account Assigned',
//         message: `You have been assigned to account "${account.companyName}"`,
//         type: 'general',
//         link: '/accounts',
//       });
//     }

//     sendSuccess(res, account, 'Engineer assigned');
//   } catch { sendError(res, 'Failed', 500); }
// };

// export const sendWelcomeMail = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const account = await Account.findOne({ _id: req.params.id, organizationId: req.user!.organizationId })
//       .populate('assignedEngineer', 'name email phone');
//     if (!account) { sendError(res, 'Account not found', 404); return; }

//     const engineer = account.assignedEngineer as any;
//     const role = req.user!.role;
//     const isAssignedEngineer = engineer && String(engineer._id) === String(req.user!.id);
//     const isAdminOrManager = role === 'admin' || role === 'manager';
//     if (!isAssignedEngineer && !isAdminOrManager) {
//       sendError(res, 'Only the assigned engineer, admin or manager can send the welcome mail', 403); return;
//     }
//     if (!account.contactEmail) { sendError(res, 'Account has no customer email', 400); return; }

//     const engineerSmtp = await getUserSmtpWithFallback(req.user!.id);
//     const org = account.organizationId
//       ? await Organization.findById(account.organizationId).select('name').lean()
//       : null;
//     const orgName = (org as any)?.name || 'Our Company';

//     await sendAccountWelcomeEmail({
//       to: account.contactEmail,
//       customerName: account.contactName || account.companyName,
//       orgName,
//       engineerName: engineer.name,
//       engineerPhone: engineer.phone,
//       engineerEmail: engineer.email,
//       supportEmail: engineer.email,
//     }, engineerSmtp);

//     sendSuccess(res, null, 'Welcome email sent');
//   } catch (e) {
//     logger.error('sendWelcomeMail error:', e);
//     sendError(res, 'Failed to send welcome email', 500);
//   }
// };

// export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const account = await Account.findOneAndDelete({ _id: req.params.id, organizationId: req.user!.organizationId });
//     if (!account) { sendError(res, 'Account not found', 404); return; }
//     sendSuccess(res, null, 'Account deleted');
//   } catch { sendError(res, 'Failed to delete account', 500); }
// };
import { Response } from 'express';
import Account from '../models/Account';
import Lead from '../models/Lead';
import User from '../models/User';
import Organization from '../models/Organization';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';
import { notifyUser, notifyRole } from '../utils/notify';
import { sendEmailWithUserSmtp, UserSmtpConfig, textToHtmlEmail } from '../services/email.service';
import logger from '../utils/logger';
import { getUserSmtp, getUserSmtpWithFallback } from '../utils/getUserSmtp';

export const getAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, search, assignedEngineer, accountNumber } = req.query;
    const filter: Record<string, unknown> = { isArchived: false, organizationId: req.user!.organizationId };
    
    if (status) filter.status = status;
    if (assignedEngineer) filter.assignedEngineer = assignedEngineer;
    if (accountNumber) filter.accountNumber = { $regex: sanitizeQuery(accountNumber as string), $options: 'i' };
    
    // engineers see all accounts (they get assigned later)
    if (search) filter.$or = [
      { accountNumber: { $regex: sanitizeQuery(search as string), $options: 'i' } },
      { companyName: { $regex: sanitizeQuery(search as string), $options: 'i' } },
      { contactName: { $regex: sanitizeQuery(search as string), $options: 'i' } },
    ];
    
    const [accounts, total] = await Promise.all([
      Account.find(filter)
        .populate('leadId', 'companyName contactPersonName email')
        .populate('assignedEngineer', 'name email')
        .populate('assignedSales', 'name email')
        .sort({ accountNumber: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Account.countDocuments(filter),
    ]);
    
    sendPaginated(res, accounts, total, page, limit);
  } catch (error) {
    logger.error('getAccounts error:', error);
    sendError(res, 'Failed to fetch accounts', 500);
  }
};

export const getAccountById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = await Account.findOne({ 
      _id: req.params.id, 
      organizationId: req.user!.organizationId 
    })
    .populate('assignedEngineer', 'name email phone')
    .populate('assignedSales', 'name email')
    .populate('leadId');
    
    if (!account || account.isArchived) { 
      sendError(res, 'Account not found', 404); 
      return; 
    }
    
    sendSuccess(res, account);
  } catch (error) {
    logger.error('getAccountById error:', error);
    sendError(res, 'Failed to fetch account', 500);
  }
};

export const convertLeadToAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leadId, accountNumber } = req.body;
    
    // Validate lead exists
    const lead = await Lead.findById(leadId);
    if (!lead) { 
      sendError(res, 'Lead not found', 404); 
      return; 
    }
    
    // Check if account already exists for this lead
    const existing = await Account.findOne({ leadId });
    if (existing) { 
      sendSuccess(res, existing, 'Account already exists for this lead'); 
      return; 
    }
    
    // If accountNumber is provided, check for uniqueness
    if (accountNumber) {
      const accountNumberExists = await Account.findOne({ accountNumber });
      if (accountNumberExists) {
        sendError(res, 'Account number already exists. Please use a unique number.', 400);
        return;
      }
    }
    
    // Create new account
    const account = await new Account({
      organizationId: req.user!.organizationId,
      leadId,
      accountNumber: accountNumber || null,
      companyName: req.body.accountName || lead.companyName,
      contactName: lead.contactName || lead.contactPersonName || lead.companyName,
      contactEmail: lead.email || '',
      phone: String(lead.phone || ''),
      assignedSales: lead.assignedTo || req.user!.id,
      notes: req.body.notes,
      status: 'Active',
      salesStatus: 'Closed, and now a Customer',
    }).save();
    
    // Update lead status
    await Lead.findByIdAndUpdate(leadId, { 
      stage: 'Converted', 
      salesStatus: 'Closed, and now a Customer' 
    });
    
    // Notify roles
    notifyRole(['admin', 'hr'], {
      title: 'New Account Created',
      message: `"${account.companyName}" has been converted from a lead to an active account${account.accountNumber ? ` (Account #: ${account.accountNumber})` : ''}`,
      type: 'general',
      link: '/accounts',
    });
    
    sendSuccess(res, account, 'Lead converted to account', 201);
  } catch (err: any) {
    // Handle duplicate key error for accountNumber
    if (err.code === 11000 && err.keyPattern?.accountNumber) {
      sendError(res, 'Account number already exists. Please use a unique number.', 400);
      return;
    }
    sendError(res, err?.message || 'Failed to convert lead', 500);
  }
};

export const updateAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // If accountNumber is being updated, check for uniqueness
    if (updateData.accountNumber) {
      const existingAccount = await Account.findOne({
        accountNumber: updateData.accountNumber,
        _id: { $ne: id },
        organizationId: req.user!.organizationId
      });
      
      if (existingAccount) {
        sendError(res, 'Account number already exists. Please use a unique number.', 400);
        return;
      }
    }
    
    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.organizationId;
    delete updateData.leadId;
    delete updateData.createdAt;
    
    const account = await Account.findOneAndUpdate(
      { _id: id, organizationId: req.user!.organizationId },
      { $set: updateData },
      { new: true, runValidators: true }
    )
    .populate('assignedEngineer', 'name email phone')
    .populate('assignedSales', 'name email')
    .populate('leadId', 'companyName contactPersonName email');
    
    if (!account) { 
      sendError(res, 'Account not found', 404); 
      return; 
    }
    
    sendSuccess(res, account, 'Account updated successfully');
  } catch (err: any) {
    // Handle duplicate key error for accountNumber
    if (err.code === 11000 && err.keyPattern?.accountNumber) {
      sendError(res, 'Account number already exists. Please use a unique number.', 400);
      return;
    }
    logger.error('updateAccount error:', err);
    sendError(res, err?.message || 'Failed to update account', 500);
  }
};

export const assignEngineer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user!.organizationId },
      { assignedEngineer: req.body.engineerId },
      { new: true }
    )
    .populate('assignedEngineer', 'name email phone')
    .populate('leadId', 'companyName');

    if (!account) { 
      sendError(res, 'Account not found', 404); 
      return; 
    }

    if (req.body.engineerId) {
      notifyUser(req.body.engineerId, {
        title: 'Account Assigned',
        message: `You have been assigned to account "${account.companyName}"${account.accountNumber ? ` (${account.accountNumber})` : ''}`,
        type: 'general',
        link: '/accounts',
      });
    }

    sendSuccess(res, account, 'Engineer assigned successfully');
  } catch (error) {
    logger.error('assignEngineer error:', error);
    sendError(res, 'Failed to assign engineer', 500);
  }
};

export const sendWelcomeMail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { subject, body: customBody } = req.body;
    
    // Validate required fields
    if (!subject || !customBody) {
      sendError(res, 'Subject and email body are required', 400);
      return;
    }
    
    const account = await Account.findOne({ _id: id, organizationId: req.user!.organizationId })
      .populate('assignedEngineer', 'name email phone')
      .populate('leadId');
    
    if (!account) { 
      sendError(res, 'Account not found', 404); 
      return; 
    }

    const engineer = account.assignedEngineer as any;
    const lead = account.leadId as any;
    const role = req.user!.role;
    const isAssignedEngineer = engineer && String(engineer._id) === String(req.user!.id);
    const isAdminOrManager = role === 'admin' || role === 'manager';
    
    if (!isAssignedEngineer && !isAdminOrManager) {
      sendError(res, 'Only the assigned engineer, admin or manager can send the welcome mail', 403); 
      return; 
    }
    
    // Get customer email from account or lead
    const customerEmail = account.contactEmail || lead?.email;
    if (!customerEmail) { 
      sendError(res, 'Account has no customer email', 400); 
      return; 
    }

    // Get sender's SMTP configuration (the engineer or admin sending the email)
    const senderSmtp = await getUserSmtpWithFallback(req.user!.id);
    
    if (!senderSmtp) {
      sendError(res, 'Please configure your email settings before sending welcome emails. Go to Profile > Email Settings to set up your SMTP configuration.', 400);
      return;
    }
    
    // Check if the email body contains HTML tags
    const hasHtmlTags = /<[^>]+>/i.test(customBody);
    
    let htmlBody: string;
    
    if (hasHtmlTags) {
      // Use the custom HTML as is
      htmlBody = customBody;
    } else {
      // Convert plain text to HTML email with proper styling
      const orgName = account.companyName || lead?.companyName || 'Our Company';
      const customerName = account.contactName || lead?.contactPersonName || 'Customer';
      const engineerName = engineer?.name || 'Support Team';
      const engineerEmail = engineer?.email || senderSmtp.fromEmail;
      const engineerPhone = engineer?.phone || '';
      const loginUrl = process.env.FRONTEND_URL || 'https://zaltixsoftsolutions.com/zieos/login';
      
      // Replace placeholders in the custom body
      let processedBody = customBody
        .replace(/{{orgName}}/g, orgName)
        .replace(/{{customerName}}/g, customerName)
        .replace(/{{engineerName}}/g, engineerName)
        .replace(/{{engineerEmail}}/g, engineerEmail)
        .replace(/{{engineerPhone}}/g, engineerPhone)
        .replace(/{{loginUrl}}/g, loginUrl)
        .replace(/{{customerEmail}}/g, customerEmail);
      
      // Convert to HTML email with professional styling
      htmlBody = textToHtmlEmail(processedBody, subject, {
        orgName,
        customerName,
        engineerName,
        engineerEmail,
        engineerPhone,
        loginUrl
      });
    }
    
    // Send email using the sender's configured SMTP
    await sendEmailWithUserSmtp(
      customerEmail,
      subject,
      htmlBody,
      senderSmtp,
      undefined, // attachments
      undefined, // cc
    );
    
    // Log the email sent
    logger.info(`Welcome email sent to ${customerEmail} for account ${account.companyName}${account.accountNumber ? ` (${account.accountNumber})` : ''} by ${req.user!.email}`);
    
    // Optional: Store email history in database (if you have an EmailLog model)
    // await EmailLog.create({
    //   accountId: account._id,
    //   to: customerEmail,
    //   subject,
    //   body: customBody,
    //   sentBy: req.user!.id,
    //   sentAt: new Date()
    // });
    
    sendSuccess(res, { 
      sent: true, 
      to: customerEmail,
      subject: subject
    }, 'Welcome email sent successfully');
    
  } catch (error: any) {
    logger.error('sendWelcomeMail error:', error);
    sendError(res, error.message || 'Failed to send welcome email. Please check your email configuration.', 500);
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = await Account.findOneAndDelete({ 
      _id: req.params.id, 
      organizationId: req.user!.organizationId 
    });
    
    if (!account) { 
      sendError(res, 'Account not found', 404); 
      return; 
    }
    
    sendSuccess(res, null, 'Account deleted');
  } catch (error) {
    logger.error('deleteAccount error:', error);
    sendError(res, 'Failed to delete account', 500);
  }
};

// Optional: Get account by account number
export const getAccountByNumber = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { accountNumber } = req.params;
    
    const account = await Account.findOne({ 
      accountNumber,
      organizationId: req.user!.organizationId,
      isArchived: false
    })
    .populate('assignedEngineer', 'name email phone')
    .populate('assignedSales', 'name email')
    .populate('leadId');
    
    if (!account) {
      sendError(res, 'Account not found', 404);
      return;
    }
    
    sendSuccess(res, account);
  } catch (error) {
    logger.error('getAccountByNumber error:', error);
    sendError(res, 'Failed to fetch account', 500);
  }
};

// Optional: Bulk assign account numbers
export const bulkAssignAccountNumbers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { accounts } = req.body; // Array of { id: string, accountNumber: string }
    
    if (!Array.isArray(accounts) || accounts.length === 0) {
      sendError(res, 'Please provide an array of accounts with account numbers', 400);
      return;
    }
    
    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[]
    };
    
    for (const item of accounts) {
      try {
        // Check if account number is already used
        const existing = await Account.findOne({
          accountNumber: item.accountNumber,
          _id: { $ne: item.id }
        });
        
        if (existing) {
          results.failed.push({ id: item.id, error: 'Account number already exists' });
          continue;
        }
        
        const updated = await Account.findOneAndUpdate(
          { _id: item.id, organizationId: req.user!.organizationId },
          { accountNumber: item.accountNumber },
          { new: true }
        );
        
        if (updated) {
          results.success.push(item.id);
        } else {
          results.failed.push({ id: item.id, error: 'Account not found' });
        }
      } catch (error) {
        results.failed.push({ id: item.id, error: 'Failed to update' });
      }
    }
    
    sendSuccess(res, results, `Updated ${results.success.length} accounts successfully`);
  } catch (error) {
    logger.error('bulkAssignAccountNumbers error:', error);
    sendError(res, 'Failed to bulk assign account numbers', 500);
  }
};