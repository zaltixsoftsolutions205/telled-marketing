// backend/src/controllers/supportEmail.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';
import { syncSupportEmails } from '../services/emailInboxSupport.service';

export const syncSupportEmailsManually = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Only admin can trigger manual sync
    if (req.user?.role !== 'admin') {
      sendError(res, 'Only admin can trigger email sync', 403);
      return;
    }
    
    console.log('🔄 Manual support email sync triggered by:', req.user?.email);
    const result = await syncSupportEmails();
    
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
    sendError(res, 'Failed to sync emails: ' + error.message, 500);
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