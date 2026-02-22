import cron from 'node-cron';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import Lead from '../models/Lead';
import Invoice from '../models/Invoice';
import SupportTicket from '../models/SupportTicket';
import logger from '../utils/logger';
import { sendOEMExpiryReminder, sendInvoiceReminder, sendTicketClosureNotification } from '../services/email.service';
import { OEM_EXPIRY_REMINDER_DAYS, TICKET_AUTO_CLOSE_DAYS, INVOICE_DUE_REMINDER_DAYS } from '../config/constants';

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

  logger.info('All cron jobs started');
};
