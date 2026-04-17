// backend/src/cron/jobs.ts
import cron from 'node-cron';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import Lead from '../models/Lead';
import Invoice from '../models/Invoice';
import SupportTicket from '../models/SupportTicket';
import EngineerVisit from '../models/EngineerVisit';
import logger from '../utils/logger';
import sendEmail, { sendOEMExpiryReminder, sendInvoiceReminder, sendTicketClosureNotification } from '../services/email.service';
import { OEM_EXPIRY_REMINDER_DAYS, TICKET_AUTO_CLOSE_DAYS, INVOICE_DUE_REMINDER_DAYS } from '../config/constants';
import { syncEmailsForDRF, ImapCredentials } from '../services/emailInbox.service';
import { syncPurchaseOrderEmails } from '../services/emailInboxPurchase.service';
import { syncSupportEmails, patchUnassignedTickets } from '../services/emailInboxSupport.service';

// Add this function before startCronJobs
async function syncPurchaseOrderEmailsJob() {
  try {
    const result = await syncPurchaseOrderEmails();
    if (result.created.length || result.updated.length) {
      logger.info(`PO Email sync: ${result.created.length} created, ${result.updated.length} updated, ${result.skipped.length} skipped, ${result.errors.length} errors`);

      // Log details for monitoring
      if (result.created.length) {
        logger.info(`Created POs: ${result.created.join(', ')}`);
      }
      if (result.updated.length) {
        logger.info(`Updated POs: ${result.updated.join(', ')}`);
      }
      if (result.errors.length) {
        logger.error(`PO sync errors: ${result.errors.join(', ')}`);
      }
    }
  } catch (e) {
    logger.error('PO email sync cron error:', e);
  }
}

async function syncSupportEmailsJob() {
  try {
    const result = await syncSupportEmails();
    if (result.created.length || result.failed.length) {
      logger.info(`Support Email sync: ${result.created.length} tickets created, ${result.failed.length} failed, ${result.errors.length} errors`);
      
      if (result.created.length) {
        logger.info(`Created tickets from emails: ${result.created.join(', ')}`);
      }
      if (result.failed.length) {
        logger.warn(`Failed to process emails: ${result.failed.join(', ')}`);
      }
      if (result.errors.length) {
        logger.error(`Support sync errors: ${result.errors.join(', ')}`);
      }
    }
  } catch (e: any) {
    if (e?.message && (e.message.includes('socket') || e.message.includes('ECONNRESET') || e.message.includes('closed'))) {
      logger.warn('Support IMAP socket closed by server (harmless)');
    } else {
      logger.error('Support email sync cron error:', e);
    }
  }
}

export const startCronJobs = (): void => {
  // Auto-expire OEM approvals — every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await OEMApprovalAttempt.updateMany({ status: 'Pending', expiryDate: { $lt: new Date() } }, { $set: { status: 'Expired' } });
      if (result.modifiedCount > 0) {
        const recent = new Date(Date.now() - 60 * 60 * 1000);
        const expired = await OEMApprovalAttempt.find({ status: 'Expired', updatedAt: { $gte: recent } });
        for (const a of expired) await Lead.findByIdAndUpdate(a.leadId, { stage: 'OEM Rejected' });
        logger.info(`Auto-expired ${result.modifiedCount} OEM attempts`);
      }
    } catch (e) { logger.error('OEM expiry cron:', e); }
  });

  // OEM expiry reminder — daily 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      const deadline = new Date(Date.now() + OEM_EXPIRY_REMINDER_DAYS * 24 * 60 * 60 * 1000);
      const expiring = await OEMApprovalAttempt.find({ status: 'Pending', expiryDate: { $gte: new Date(), $lte: deadline } })
        .populate<{ leadId: { contactEmail: string; companyName: string } }>('leadId', 'contactEmail companyName');
      for (const a of expiring) {
        const lead = a.leadId as unknown as { contactEmail: string; companyName: string };
        if (lead && a.expiryDate) await sendOEMExpiryReminder(lead.contactEmail, lead.companyName, a.expiryDate);
      }
      logger.info(`Sent ${expiring.length} OEM expiry reminders`);
    } catch (e) { logger.error('OEM reminder cron:', e); }
  });

  // Invoice due reminders — daily 10 AM
  cron.schedule('0 10 * * *', async () => {
    try {
      const deadline = new Date(Date.now() + INVOICE_DUE_REMINDER_DAYS * 24 * 60 * 60 * 1000);
      const dueInvoices = await Invoice.find({ status: { $in: ['Sent', 'Partially Paid'] }, dueDate: { $gte: new Date(), $lte: deadline }, isArchived: false })
        .populate<{ accountId: { companyName: string; contactEmail: string } }>('accountId', 'companyName contactEmail');
      for (const inv of dueInvoices) {
        const acc = inv.accountId as unknown as { companyName: string; contactEmail: string };
        if (acc) {
          await sendInvoiceReminder(acc.contactEmail, acc.companyName, inv.invoiceNumber, inv.totalAmount - inv.paidAmount, inv.dueDate);
          await Invoice.findByIdAndUpdate(inv._id, { $inc: { remindersSent: 1 }, lastReminderAt: new Date() });
        }
      }
      logger.info(`Sent ${dueInvoices.length} invoice reminders`);
    } catch (e) { logger.error('Invoice reminder cron:', e); }
  });

  // Mark invoices overdue — daily midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      const r = await Invoice.updateMany({ status: { $in: ['Sent', 'Partially Paid'] }, dueDate: { $lt: new Date() }, isArchived: false }, { $set: { status: 'Overdue' } });
      if (r.modifiedCount > 0) logger.info(`Marked ${r.modifiedCount} invoices overdue`);
    } catch (e) { logger.error('Invoice overdue cron:', e); }
  });

  // Auto-close stale tickets — every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - TICKET_AUTO_CLOSE_DAYS * 24 * 60 * 60 * 1000);
      const stale = await SupportTicket.find({ status: { $in: ['Open', 'In Progress'] }, lastResponseAt: { $lt: cutoff }, isArchived: false })
        .populate<{ accountId: { contactEmail: string } }>('accountId', 'contactEmail');
      for (const t of stale) {
        t.status = 'Closed'; t.closedAt = t.autoClosedAt = new Date();
        await t.save();
        const acc = t.accountId as unknown as { contactEmail: string };
        if (acc?.contactEmail) await sendTicketClosureNotification(acc.contactEmail, t.ticketId, t.subject);
      }
      if (stale.length > 0) logger.info(`Auto-closed ${stale.length} stale tickets`);
    } catch (e) { logger.error('Ticket auto-close cron:', e); }
  });

  // Engineer visit day reminder — daily 8 AM
  cron.schedule('0 8 * * *', async () => {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const visits = await EngineerVisit.find({
        status: 'Scheduled',
        scheduledDate: { $gte: now, $lte: in24h },
        dayReminderSent: false,
      }).populate<{ engineerId: { name: string; email: string } }>('engineerId', 'name email')
        .populate<{ accountId: { companyName: string } }>('accountId', 'companyName');

      for (const visit of visits) {
        const engineer = visit.engineerId as unknown as { name: string; email: string };
        const account = visit.accountId as unknown as { companyName: string };
        if (engineer?.email) {
          const scheduledStr = visit.scheduledDate
            ? visit.scheduledDate.toLocaleString()
            : 'N/A';
          const subject = `Reminder: Visit scheduled tomorrow — ${account?.companyName || 'Account'}`;
          const html = `<p>Hi ${engineer.name},</p>
<p>This is a reminder that you have a <strong>${visit.visitType}</strong> visit scheduled for <strong>${scheduledStr}</strong> at <strong>${account?.companyName || 'your assigned account'}</strong>.</p>
<p>Please make sure you are prepared and on time.</p>
<p>Purpose: ${visit.purpose}</p>`;
          await sendEmail(engineer.email, subject, html);
        }
        await EngineerVisit.findByIdAndUpdate(visit._id, { dayReminderSent: true });
      }
      logger.info(`Sent ${visits.length} engineer visit day reminders`);
    } catch (e) { logger.error('Engineer visit day reminder cron:', e); }
  });

  // Engineer visit 2-hour reminder — every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const visits = await EngineerVisit.find({
        status: 'Scheduled',
        scheduledDate: { $gte: now, $lte: in2h },
        twoHourReminderSent: false,
      }).populate<{ engineerId: { name: string; email: string } }>('engineerId', 'name email')
        .populate<{ accountId: { companyName: string } }>('accountId', 'companyName');

      for (const visit of visits) {
        const engineer = visit.engineerId as unknown as { name: string; email: string };
        const account = visit.accountId as unknown as { companyName: string };
        if (engineer?.email) {
          const scheduledStr = visit.scheduledDate
            ? visit.scheduledDate.toLocaleString()
            : 'N/A';
          const subject = `Reminder: Visit in ~2 hours — ${account?.companyName || 'Account'}`;
          const html = `<p>Hi ${engineer.name},</p>
<p>Your <strong>${visit.visitType}</strong> visit at <strong>${account?.companyName || 'your assigned account'}</strong> is coming up at <strong>${scheduledStr}</strong> (within the next 2 hours).</p>
<p>Please ensure you are on your way and have everything you need.</p>
<p>Purpose: ${visit.purpose}</p>`;
          await sendEmail(engineer.email, subject, html);
        }
        await EngineerVisit.findByIdAndUpdate(visit._id, { twoHourReminderSent: true });
      }
      logger.info(`Sent ${visits.length} engineer visit 2-hour reminders`);
    } catch (e) { logger.error('Engineer visit 2-hour reminder cron:', e); }
  });

  // DRF email inbox sync — every 2 minutes, per-user inbox
  cron.schedule('*/2 * * * *', async () => {
    try {
      const User = (await import('../models/User')).default;
      const { decryptText } = await import('../utils/crypto');
      const users = await User.find({
        isActive: true,
        role: { $in: ['admin', 'sales'] },
        smtpUser: { $exists: true, $ne: '' },
        smtpPass: { $exists: true, $ne: '' },
      }).select('smtpHost smtpUser smtpPass email name');

      if (users.length === 0) {
        // No users with SMTP configured — fall back to system inbox
        const result = await syncEmailsForDRF();
        if (result.approved.length || result.rejected.length) {
          logger.info(`DRF email sync (system): ${result.approved.length} approved, ${result.rejected.length} rejected`);
        }
        return;
      }

      for (const u of users) {
        try {
          const smtpHost = u.smtpHost || 'smtp.hostinger.com';
          const imapHost = smtpHost.includes('office365') || smtpHost.includes('outlook')
            ? 'imap-mail.outlook.com'
            : smtpHost.replace(/^smtp\./, 'imap.');
          const creds: ImapCredentials = {
            host: imapHost,
            port: 993,
            user: u.smtpUser!,
            pass: decryptText(u.smtpPass!),
          };
          const result = await syncEmailsForDRF(creds);
          if (result.approved.length || result.rejected.length) {
            logger.info(`DRF email sync (${u.email}): ${result.approved.length} approved, ${result.rejected.length} rejected`);
          }
        } catch (userErr) {
          logger.error(`DRF email sync failed for ${u.email}:`, userErr);
        }
      }
    } catch (e) { logger.error('DRF email sync cron:', e); }
  });

  // Purchase order email sync — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await syncPurchaseOrderEmailsJob();
  });

  // Support email to ticket sync — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await syncSupportEmailsJob();
  });

  // Also run once on startup
  setTimeout(() => {
    syncPurchaseOrderEmailsJob().catch(e => logger.error('Initial PO sync failed:', e));
  }, 30000); // Run 30 seconds after startup

  setTimeout(() => {
    syncSupportEmailsJob().catch(e => logger.error('Initial support email sync failed:', e));
  }, 60000); // Run 60 seconds after startup

  // Fix unassigned tickets on startup
  setTimeout(() => {
    patchUnassignedTickets().catch(e => logger.error('patchUnassignedTickets failed:', e));
  }, 5000);

  logger.info('All cron jobs started');
};