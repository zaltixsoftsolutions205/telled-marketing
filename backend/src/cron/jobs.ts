// backend/src/cron/jobs.ts
import cron from 'node-cron';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import Lead from '../models/Lead';
import Invoice from '../models/Invoice';
import SupportTicket from '../models/SupportTicket';
import EngineerVisit from '../models/EngineerVisit';
import logger from '../utils/logger';
import sendEmail, { sendOEMExpiryReminder, sendInvoiceReminder, sendTicketClosureNotification, sendOEMExtensionRequest } from '../services/email.service';
import { getUserSmtp } from '../utils/getUserSmtp';
import { OEM_EXPIRY_REMINDER_DAYS, TICKET_AUTO_CLOSE_DAYS, TICKET_RESOLVED_FORCE_CLOSE_DAYS, TICKET_REOPEN_EXPIRE_DAYS, INVOICE_DUE_REMINDER_DAYS } from '../config/constants';
import User from '../models/User';
import { syncEmailsForDRF, syncEmailsForDRFViaGraph, ImapCredentials } from '../services/emailInbox.service';
import { syncPurchaseOrderEmails } from '../services/emailInboxPurchase.service';
import { syncSupportEmails, syncSupportEmailsViaGraph, patchUnassignedTickets } from '../services/emailInboxSupport.service';
import { generateTicketId } from '../utils/helpers';

// Add this function before startCronJobs
async function syncPurchaseOrderEmailsJob() {
  try {
    const User = (await import('../models/User')).default;
    const { decryptText } = await import('../utils/crypto');

    const users = await User.find({
      isActive: true,
      role: { $in: ['admin', 'sales'] },
      smtpUser: { $exists: true, $ne: '' },
      smtpPass: { $exists: true, $ne: '' },
    }).select('_id smtpHost smtpUser smtpPass email');

    if (users.length === 0) {
      logger.info('PO sync skipped — no sales/admin users with SMTP configured');
      return;
    }

    for (const u of users) {
      if (shouldSkipImap(u.email || '')) continue;
      try {
        const smtpHost = u.smtpHost || 'smtp.hostinger.com';
        const imapHost = smtpHost.includes('office365') || smtpHost.includes('outlook')
          ? 'imap-mail.outlook.com'
          : smtpHost.replace(/^smtp\./, 'imap.');
        const creds = { host: imapHost, port: 993, user: u.smtpUser!, pass: decryptText(u.smtpPass!) };
        const result = await syncPurchaseOrderEmails(creds, u._id.toString());
        if (result.created.length || result.updated.length) {
          logger.info(`PO sync (${u.email}): created=${result.created.length} updated=${result.updated.length}`);
        }
      } catch (e: any) {
        if (isImapSocketError(e)) {
          logger.warn(`PO IMAP connection issue for ${u.email}`);
        } else {
          logger.error(`PO sync failed for ${u.email}:`, e);
        }
      }
    }
  } catch (e) {
    logger.error('PO email sync cron error:', e);
  }
}

function isImapSocketError(e: any): boolean {
  const msg = (e?.message || '').toLowerCase();
  return msg.includes('socket') || msg.includes('econnreset') || msg.includes('closed')
    || msg.includes('etimedout') || msg.includes('econnrefused') || msg.includes('imap')
    || msg.includes('greeting') || msg.includes('tls') || msg.includes('connect')
    || msg.includes('command failed') || msg.includes('authentication') || msg.includes('login failed')
    || msg.includes('invalid credentials') || msg.includes('auth');
}

// Providers that use IMAP differently or block automated access
const SKIP_IMAP_DOMAINS = ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'live.in', 'live.co.uk'];

function shouldSkipImap(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return SKIP_IMAP_DOMAINS.includes(domain);
}

async function syncSupportEmailsJob() {
  try {
    const { decryptText } = await import('../utils/crypto');

    // Fetch all active engineers — both IMAP and Microsoft OAuth
    const allEngineers = await User.find({
      isActive: true,
      role: 'engineer',
    }).select('smtpHost smtpUser smtpPass msRefreshToken email').lean();

    let synced = 0;

    for (const u of allEngineers) {
      // Microsoft OAuth engineer — use Graph API
      if ((u as any).msRefreshToken) {
        try {
          const result = await syncSupportEmailsViaGraph((u as any).msRefreshToken, u);
          if (result.created.length || result.failed.length || result.errors.length) {
            logger.info(`Support Graph sync (${u.email}): created=${result.created.length} failed=${result.failed.length} errors=${result.errors.length}`);
          }
          synced++;
        } catch (e: any) {
          logger.error(`Support Graph sync failed for ${u.email}:`, e);
        }
        continue;
      }

      // IMAP engineer — needs smtpUser + smtpPass
      if (!u.smtpUser || !(u as any).smtpPass) continue;
      if (shouldSkipImap(u.email || '')) continue;

      try {
        const smtpHost = u.smtpHost || 'smtp.hostinger.com';
        const imapHost = smtpHost.includes('office365') || smtpHost.includes('outlook')
          ? 'imap-mail.outlook.com'
          : smtpHost.includes('gmail')
          ? 'imap.gmail.com'
          : smtpHost.includes('zoho')
          ? 'imap.zoho.com'
          : smtpHost.replace(/^smtp[.-]/, 'imap.');

        const creds = { host: imapHost, port: 993, user: u.smtpUser!, pass: decryptText((u as any).smtpPass!) };
        const result = await syncSupportEmails(creds);
        if (result.created.length || result.failed.length || result.errors.length) {
          logger.info(`Support sync (${u.email}): created=${result.created.length} failed=${result.failed.length} errors=${result.errors.length}`);
          if (result.created.length) logger.info(`Created tickets: ${result.created.join(', ')}`);
          if (result.errors.length) logger.warn(`Sync errors: ${result.errors.join(', ')}`);
        }
        synced++;
      } catch (e: any) {
        logger.warn(`Support IMAP sync skipped for ${u.email}: ${e?.message || e}`);
      }
    }

    if (synced === 0) {
      // No engineers with any creds — fall through to env vars
      const result = await syncSupportEmails();
      if (result.created.length || result.errors.length) {
        logger.info(`Support sync (env creds): created=${result.created.length} failed=${result.failed.length} errors=${result.errors.length}`);
      }
    }
  } catch (e: any) {
    if (isImapSocketError(e)) {
      logger.warn('Support IMAP connection issue (harmless)');
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

  // Auto DRF extension email — daily 8 AM
  // Sends extension request to OEM automatically when DRF expires in 2–5 days
  // and extension hasn't been requested yet
  cron.schedule('0 8 * * *', async () => {
    try {
      const now = new Date();
      const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

      const expiring = await OEMApprovalAttempt.find({
        status: { $in: ['Pending', 'Approved'] },
        expiryDate: { $gte: in2Days, $lte: in5Days },
        extensionRequested: { $ne: true },
      }).populate('leadId').populate('createdBy', 'name email _id');

      let sent = 0;
      for (const attempt of expiring) {
        const lead = attempt.leadId as any;
        const creator = attempt.createdBy as any;
        const oemTo = lead?.oemEmail || lead?.email;
        if (!oemTo || !attempt.expiryDate) continue;

        const d = new Date(attempt.sentDate);
        const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const drfNumber = `DRF-${dateStr}-${String(attempt.attemptNumber).padStart(3, '0')}`;
        const daysLeft = Math.ceil((attempt.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const expiry = attempt.expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

        // Use the sales owner's SMTP if configured, else fall back to system SMTP
        const senderSmtp = creator?._id ? await getUserSmtp(creator._id.toString()) : undefined;

        const autoMessage =
          `We are writing to request an extension for the DRF approval for ${lead.companyName}.\n\n` +
          `The current DRF (${drfNumber}) is expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} on ${expiry}. ` +
          `We are actively progressing with the customer and kindly request an extension of the validity period.\n\n` +
          `Please reply with the new valid-until date at your earliest convenience.`;

        try {
          await sendOEMExtensionRequest(oemTo, {
            drfNumber,
            companyName: lead.companyName,
            oemName: lead.oemName || '',
            expiryDate: attempt.expiryDate.toISOString(),
            salesName: creator?.name || 'ZIEOS Sales',
            salesEmail: creator?.email || '',
            customMessage: autoMessage,
            customSubject: `[Auto] DRF Extension Request — ${drfNumber} — ${lead.companyName} (expires in ${daysLeft}d)`,
          }, senderSmtp);

          // Mark as requested so it doesn't send again
          attempt.extensionRequested = true;
          attempt.extensionRequestedAt = new Date();
          await attempt.save();
          sent++;
          logger.info(`Auto-extension email sent for ${drfNumber} (expires in ${daysLeft}d)`);
        } catch (mailErr: any) {
          logger.error(`Auto-extension email failed for ${drfNumber}:`, mailErr?.message);
        }
      }
      if (sent > 0) logger.info(`Auto-sent ${sent} DRF extension emails`);
    } catch (e) { logger.error('DRF auto-extension cron:', e); }
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
        $or: [
          { smtpUser: { $exists: true, $ne: '' }, smtpPass: { $exists: true, $ne: '' } },
          { msRefreshToken: { $exists: true, $ne: '' } },
        ],
      }).select('smtpHost smtpUser smtpPass email name msRefreshToken');

      if (users.length === 0) {
        // No users with email configured — fall back to system inbox
        const result = await syncEmailsForDRF();
        if (result.approved.length || result.rejected.length) {
          logger.info(`DRF email sync (system): ${result.approved.length} approved, ${result.rejected.length} rejected`);
        }
        return;
      }

      for (const u of users) {
        // Derive IMAP host from SMTP host
        const smtpHost = u.smtpHost || '';
        let imapHost = '';

        if (smtpHost.includes('gmail')) {
          imapHost = 'imap.gmail.com';
        } else if (smtpHost.includes('office365') || smtpHost.includes('outlook')) {
          imapHost = 'outlook.office365.com';
        } else if (smtpHost.includes('zoho')) {
          imapHost = 'imap.zoho.com';
        } else if (smtpHost.includes('hostinger')) {
          imapHost = 'imap.hostinger.com';
        } else if (smtpHost) {
          imapHost = smtpHost.replace(/^smtp[.-]/, 'imap.');
        }

        // Personal Outlook with OAuth — use Graph API to read inbox instead of IMAP
        if ((u as any).msRefreshToken) {
          try {
            const result = await syncEmailsForDRFViaGraph((u as any).msRefreshToken, u.email || '');
            if (result.approved.length || result.rejected.length) {
              logger.info(`DRF Graph sync (${u.email}): ${result.approved.length} approved, ${result.rejected.length} rejected`);
            }
          } catch (graphErr: any) {
            const msg = graphErr?.response?.data?.error?.message || graphErr?.response?.data || graphErr?.message || String(graphErr);
            logger.warn(`DRF Graph sync failed for ${u.email}: ${JSON.stringify(msg)}`);
          }
          continue;
        }

        // Skip if no IMAP host could be derived or no credentials
        if (!imapHost || !u.smtpUser || !u.smtpPass) {
          continue;
        }

        // Skip providers that block IMAP (Tuta, ProtonMail without Bridge)
        if (shouldSkipImap(u.email || '')) {
          continue;
        }

        try {
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
        } catch (userErr: any) {
          if (isImapSocketError(userErr)) {
            logger.warn(`DRF IMAP connection issue for ${u.email} (server may have closed idle connection)`);
          } else {
            logger.error(`DRF email sync failed for ${u.email}:`, userErr);
          }
        }
      }
    } catch (e) { logger.error('DRF email sync cron:', e); }
  });

  // Purchase order email sync — DISABLED
  // cron.schedule('*/5 * * * *', async () => {
  //   await syncPurchaseOrderEmailsJob();
  // });

  // Support email to ticket sync — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await syncSupportEmailsJob();
  });

  // Force-close Resolved tickets with no customer feedback after 3 days — every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - TICKET_RESOLVED_FORCE_CLOSE_DAYS * 24 * 60 * 60 * 1000);
      const stale = await SupportTicket.find({ status: 'Resolved', resolvedAt: { $lt: cutoff }, isArchived: false })
        .populate<{ accountId: { contactEmail: string; companyName: string } }>('accountId', 'contactEmail companyName');
      for (const t of stale) {
        t.status = 'Closed';
        t.closedAt = t.autoClosedAt = new Date();
        t.internalNotes.push({ note: 'Auto-closed: no customer feedback received within 3 days of resolution.', addedBy: t.createdBy, addedAt: new Date() });
        await t.save();
        const acc = t.accountId as unknown as { contactEmail: string };
        if (acc?.contactEmail) await sendTicketClosureNotification(acc.contactEmail, t.ticketId, t.subject).catch(() => {});
      }
      if (stale.length > 0) logger.info(`Force-closed ${stale.length} resolved tickets (no feedback)`);
    } catch (e) { logger.error('Resolved force-close cron:', e); }
  });

  // Auto-spawn new ticket for Reopened tickets older than 3 days — every 2 hours
  cron.schedule('30 */2 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - TICKET_REOPEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000);
      const expired = await SupportTicket.find({ status: 'Reopened', reopenedAt: { $lt: cutoff }, isArchived: false })
        .populate<{ accountId: { _id: any; contactEmail: string; companyName: string } }>('accountId', 'contactEmail companyName _id')
        .populate<{ assignedEngineer: { _id: any } }>('assignedEngineer', '_id');
      for (const t of expired) {
        // Close original
        t.status = 'Closed';
        t.closedAt = t.autoClosedAt = new Date();
        t.internalNotes.push({ note: 'Auto-closed: reopen window (3 days) expired. New ticket created.', addedBy: t.createdBy, addedAt: new Date() });
        await t.save();

        // Spawn new ticket
        const acc = t.accountId as unknown as { _id: any; contactEmail: string; companyName: string };
        const eng = t.assignedEngineer as unknown as { _id: any } | null;
        if (acc?._id) {
          const fallbackEngineer = eng?._id || (await User.findOne({ role: 'engineer', isActive: true }).select('_id').lean())?._id;
          await new SupportTicket({
            accountId: acc._id,
            ticketId: generateTicketId(),
            subject: `[Follow-up] ${t.subject}`,
            description: `This ticket was automatically created as a follow-up to ticket ${t.ticketId} which was reopened but not resolved within 3 days.\n\nOriginal description:\n${t.description}`,
            priority: t.priority,
            status: 'Open',
            assignedEngineer: fallbackEngineer,
            createdBy: t.createdBy,
            parentTicketId: t._id,
            internalNotes: [{ note: `Auto-spawned from ticket ${t.ticketId} after reopen window expired.`, addedBy: t.createdBy, addedAt: new Date() }],
            lastResponseAt: new Date(),
          }).save();
          logger.info(`Auto-spawned new ticket from ${t.ticketId}`);
        }
        if (acc?.contactEmail) await sendTicketClosureNotification(acc.contactEmail, t.ticketId, t.subject).catch(() => {});
      }
      if (expired.length > 0) logger.info(`Processed ${expired.length} expired-reopen tickets`);
    } catch (e) { logger.error('Reopen-expire cron:', e); }
  });

  // PO sync on startup — DISABLED
  // setTimeout(() => {
  //   syncPurchaseOrderEmailsJob().catch(e => logger.error('Initial PO sync failed:', e));
  // }, 30000);

  setTimeout(() => {
    syncSupportEmailsJob().catch(e => logger.error('Initial support email sync failed:', e));
  }, 60000); // Run 60 seconds after startup

  // Fix unassigned tickets on startup
  setTimeout(() => {
    patchUnassignedTickets().catch(e => logger.error('patchUnassignedTickets failed:', e));
  }, 5000);

  logger.info('All cron jobs started');
};