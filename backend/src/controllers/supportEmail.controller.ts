// backend/src/controllers/supportEmail.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';
import { syncSupportEmails, syncSupportEmailsViaGraph, patchUnassignedTickets, ImapCredentials } from '../services/emailInboxSupport.service';
import User from '../models/User';
import Account from '../models/Account';
import Lead from '../models/Lead';
import { decryptText } from '../utils/crypto';

export const syncSupportEmailsManually = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'engineer') {
      sendError(res, 'Only admin or engineer can trigger email sync', 403);
      return;
    }

    // Use the logged-in user's own credentials — IMAP or Microsoft OAuth
    const user = await User.findById(req.user!.id).select('smtpHost smtpUser smtpPass msRefreshToken email');
    if (!user) { sendError(res, 'User not found', 404); return; }

    let result;

    // Microsoft OAuth path
    if ((user as any).msRefreshToken) {
      console.log(`📧 Syncing Graph inbox for ${user.email}`);
      result = await syncSupportEmailsViaGraph((user as any).msRefreshToken, user);
    } else {
      if (!user.smtpUser || !user.smtpPass) {
        sendError(res, 'Your email is not configured. Please log out and log in again to set up your email.', 400);
        return;
      }
      const smtpHost = user.smtpHost || 'smtp.hostinger.com';
      const imapHost = smtpHost.includes('office365') || smtpHost.includes('outlook')
        ? 'imap-mail.outlook.com'
        : smtpHost.includes('gmail')
        ? 'imap.gmail.com'
        : smtpHost.includes('zoho')
        ? 'imap.zoho.com'
        : smtpHost.replace(/^smtp[.-]/, 'imap.');

      const creds: ImapCredentials = { host: imapHost, port: 993, user: user.smtpUser, pass: decryptText(user.smtpPass) };
      console.log(`📧 Syncing IMAP inbox for ${user.smtpUser}`);
      result = await syncSupportEmails(creds);
    }
    
    sendSuccess(res, {
      summary: {
        scanned: result.scanned,
        processed: result.processed,
        created: result.created.length,
        failed: result.failed.length,
        errors: result.errors.length,
      },
      createdTickets: result.created,
      failedEmails: result.failed,
      errors: result.errors,
    }, 'Email sync completed');
    
  } catch (error) {
    console.error('Manual sync error:', error);
    sendError(res, 'Failed to sync emails: ' + (error as Error).message, 500);
  }
};

export const fixUnassignedTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patched = await patchUnassignedTickets();
    sendSuccess(res, { patched }, `Fixed ${patched} unassigned tickets`);
  } catch (error) {
    sendError(res, 'Failed to fix tickets', 500);
  }
};

export const getEmailSyncStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isConfigured = !!(process.env.SUPPORT_EMAIL_USER && process.env.SUPPORT_EMAIL_PASS);

    sendSuccess(res, {
      configured: isConfigured,
      email: isConfigured ? process.env.SUPPORT_EMAIL_USER : null,
      host: process.env.SUPPORT_EMAIL_HOST,
      port: process.env.SUPPORT_EMAIL_PORT,
      cronEnabled: true,
    });
  } catch (error) {
    sendError(res, 'Failed to get status', 500);
  }
};

// Backfill contactEmail on accounts that have it blank — copies from the linked Lead.email
export const backfillAccountEmails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      sendError(res, 'Admin only', 403);
      return;
    }
    const accounts = await Account.find({
      organizationId: req.user!.organizationId,
      $or: [{ contactEmail: '' }, { contactEmail: { $exists: false } }],
    }).lean() as any[];

    let patched = 0;
    for (const acc of accounts) {
      const lead = await Lead.findById(acc.leadId).select('email').lean() as any;
      if (lead?.email) {
        await Account.updateOne({ _id: acc._id }, { $set: { contactEmail: lead.email.toLowerCase().trim() } });
        patched++;
      }
    }
    sendSuccess(res, { patched }, `Backfilled contactEmail on ${patched} accounts`);
  } catch (error) {
    sendError(res, 'Backfill failed', 500);
  }
};