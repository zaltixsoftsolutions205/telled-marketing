// backend/src/services/emailInboxSupport.service.ts
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import SupportTicket from '../models/SupportTicket';
import Account from '../models/Account';
import User from '../models/User';
import logger from '../utils/logger';
import { generateTicketId } from '../utils/helpers';
import { sendTicketAcknowledgement, UserSmtpConfig } from './email.service';
import mongoose from 'mongoose';

export interface ImapCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
}

// Priority detection
const PRIORITY_KEYWORDS = {
  Critical: ['urgent', 'critical', 'emergency', 'down', 'outage', 'immediate', 'asap'],
  High: ['high priority', 'important', 'serious', 'blocking'],
  Medium: ['medium', 'moderate', 'normal'],
  Low: ['low', 'minor', 'small issue'],
};

export interface SupportEmailSyncResult {
  scanned: number;
  processed: number;
  created: string[];
  failed: string[];
  errors: string[];
}

function detectPriority(subject: string, body: string): 'Low' | 'Medium' | 'High' | 'Critical' {
  const combined = (subject + ' ' + body).toLowerCase();
  
  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (combined.includes(keyword.toLowerCase())) {
        return priority as any;
      }
    }
  }
  return 'Medium';
}

async function extractEmailBody(source: Buffer): Promise<string> {
  try {
    const parsed = await simpleParser(source);
    // Prefer plain text — it's always clean
    // Fall back to HTML with tags stripped
    const html = typeof parsed.html === 'string' ? parsed.html : '';
    const text = parsed.text || html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>') || '';
    // Strip quoted reply content ("> lines", "On ... wrote:", "--- Original Message ---")
    const lines = text.split(/\r?\n/);
    const fresh: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('>')) break;
      if (/^On .{5,100} wrote:/i.test(trimmed)) break;
      if (/^-{3,}\s*(Forwarded|Original)/i.test(trimmed)) break;
      fresh.push(line);
    }
    return fresh.join('\n').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

async function findAccountByEmail(email: string): Promise<any | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const safeEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const emailRegex = new RegExp(`^${safeEmail}$`, 'i');
  const Lead = mongoose.model('Lead');

  // 1. Direct account contactEmail match
  const account = await Account.findOne({ contactEmail: emailRegex, isArchived: false });
  if (account) return account;

  // 2. Via Lead.email → Account (lead was converted to account)
  const lead = await Lead.findOne({ email: emailRegex });
  if (lead) {
    const leadAccount = await Account.findOne({ leadId: lead._id, isArchived: false });
    if (leadAccount) return leadAccount;
  }

  // 3. Domain-based fallback — only for company domains, skip common personal providers
  const domain = normalizedEmail.split('@')[1];
  const COMMON_DOMAINS = [
    'gmail.com','yahoo.com','yahoo.in','yahoo.co.in','outlook.com','hotmail.com',
    'live.com','live.in','icloud.com','me.com','rediffmail.com','protonmail.com','proton.me',
  ];
  if (domain && !COMMON_DOMAINS.includes(domain)) {
    const safeDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 3a. Account.contactEmail domain match
    const domainAccount = await Account.findOne({
      contactEmail: { $regex: `@${safeDomain}$`, $options: 'i' },
      isArchived: false,
    });
    if (domainAccount) return domainAccount;

    // 3b. Lead.email domain match → find converted account
    const domainLead = await Lead.findOne({
      email: { $regex: `@${safeDomain}$`, $options: 'i' },
    });
    if (domainLead) {
      const domainLeadAccount = await Account.findOne({ leadId: domainLead._id, isArchived: false });
      if (domainLeadAccount) return domainLeadAccount;
    }

    // 3c. Account.phone or additional contacts if stored in companyName/notes domain
    // Final check: any lead with this domain that has a converted account
    const allDomainLeads = await Lead.find({
      email: { $regex: `@${safeDomain}$`, $options: 'i' },
    }).select('_id').lean();
    if (allDomainLeads.length > 0) {
      const leadIds = allDomainLeads.map((l: any) => l._id);
      const anyAccount = await Account.findOne({ leadId: { $in: leadIds }, isArchived: false });
      if (anyAccount) return anyAccount;
    }
  }

  return null;
}

export async function patchUnassignedTickets(): Promise<number> {
  let patched = 0;
  try {
    // Get all active accounts that have an assignedEngineer
    const accounts = await Account.find({ assignedEngineer: { $exists: true, $ne: null }, isArchived: false }).lean() as any[];
    for (const account of accounts) {
      // Force-update ALL tickets for this account to use account's assignedEngineer
      const result = await SupportTicket.updateMany(
        { accountId: account._id, isArchived: false },
        { $set: { assignedEngineer: account.assignedEngineer } }
      );
      patched += result.modifiedCount;
      if (result.modifiedCount > 0) {
        console.log(`🔧 Updated ${result.modifiedCount} tickets for account ${account.companyName}`);
      }
    }
    console.log(`✅ Patched ${patched} tickets total`);
  } catch (err) {
    console.error('⚠️ patchUnassignedTickets error:', err);
  }
  return patched;
}

async function getFirstEngineer(): Promise<any | null> {
  const engineer = await User.findOne({ role: 'engineer', isActive: true });
  if (!engineer) {
    // Fallback to admin
    return await User.findOne({ role: 'admin', isActive: true });
  }
  return engineer;
}

const _syncInProgress = new Map<string, number>();

export async function syncSupportEmails(creds?: ImapCredentials): Promise<SupportEmailSyncResult> {
  const lockKey = creds?.user || 'env';
  const startedAt = _syncInProgress.get(lockKey) || 0;

  // Auto-reset stuck flag if sync has been "in progress" for more than 3 minutes
  if (startedAt && Date.now() - startedAt > 3 * 60 * 1000) {
    logger.warn(`Support email sync flag was stuck for ${lockKey} — resetting`);
    _syncInProgress.delete(lockKey);
  }
  if (_syncInProgress.has(lockKey)) {
    logger.info(`Support email sync already in progress for ${lockKey} — skipping`);
    return { scanned: 0, processed: 0, created: [], failed: [], errors: [] };
  }
  _syncInProgress.set(lockKey, Date.now());

  const result: SupportEmailSyncResult = {
    scanned: 0,
    processed: 0,
    created: [],
    failed: [],
    errors: [],
  };

  const imapUser = creds?.user || process.env.SUPPORT_EMAIL_USER || process.env.SMTP_USER || '';
  const imapPass = creds?.pass || process.env.SUPPORT_EMAIL_PASS || process.env.SMTP_PASS || '';
  const imapHost = creds?.host || process.env.SUPPORT_EMAIL_HOST || 'imap.hostinger.com';
  const imapPort = creds?.port || parseInt(process.env.SUPPORT_EMAIL_PORT || '993');

  if (!imapUser || !imapPass) {
    result.errors.push('IMAP credentials not configured. Please set up your email in Email Configuration.');
    return result;
  }

  // Build SMTP config from the same credentials so all outgoing emails (acknowledgements, updates)
  // are sent from the engineer's own email — not the system SMTP
  const smtpHost = imapHost.replace(/^imap[.-]/, 'smtp.');
  const senderSmtp: UserSmtpConfig = {
    smtpHost,
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: imapUser,
    smtpPass: imapPass,
    fromEmail: imapUser,
    fromName: 'Support Team',
  };

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: imapPort === 993,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 30000,
    socketTimeout: 60000,
    greetingTimeout: 15000,
  });

  client.on('error', (err: Error) => {
    const msg = err.message?.toLowerCase() || '';
    if (msg.includes('socket') || msg.includes('econnreset') || msg.includes('closed') || msg.includes('epipe') || msg.includes('timeout') || msg.includes('etimedout')) {
      // Harmless — IMAP server closes idle connections between sync intervals
    } else {
      logger.warn('ImapFlow support sync error:', err.message);
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to IMAP server');

    const lock = await client.getMailboxLock('INBOX');
    try {
      // Search all emails from last 7 days — read OR unread
      // We track processed emails by Message-ID so we never duplicate tickets
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const uidsResult = await client.search({ since }, { uid: true });
      const uids: number[] = Array.isArray(uidsResult) ? uidsResult : [];
      console.log(`📧 Found ${uids.length} emails in last 7 days (read + unread)`);

      for (const uid of uids) {
        result.scanned++;
        
        try {
          const msg = await client.fetchOne(uid, { envelope: true, source: true }, { uid: true });
          if (!msg) continue;

          const subject = msg.envelope?.subject || '';
          const fromEmail = msg.envelope?.from?.[0]?.address || '';
          const fromName = msg.envelope?.from?.[0]?.name || '';
          const messageId = msg.envelope?.messageId || '';

          console.log(`\n📨 Processing: ${subject} (from: ${fromEmail})`);

          // Find account first — if it's a known customer, accept all their emails as support requests
          const account = await findAccountByEmail(fromEmail);

          if (!account) {
            console.log(`⚠️ No account matched for sender: ${fromEmail} — skipping (not a known customer)`);
            result.failed.push(`${fromEmail}: No matching account found`);
            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
            continue;
          }

          console.log(`✅ Found account: ${account.accountName}`);

          // Get engineer — prefer account's assignedEngineer, fallback to first engineer
          let engineer = null;
          if (account.assignedEngineer) {
            engineer = await User.findById(account.assignedEngineer).lean();
          }
          if (!engineer) {
            engineer = await getFirstEngineer();
          }
          if (!engineer) {
            console.log('❌ No engineer found');
            result.failed.push('No engineer available');
            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
            continue;
          }

          // Extract clean body text using mailparser — handles all MIME, encoding, HTML
          const description = (await extractEmailBody(msg.source || Buffer.alloc(0))).slice(0, 2000);
          
          // Detect priority
          const priority = detectPriority(subject, description);
          
          // Dedup by Message-ID — never create two tickets for the same email
          if (messageId) {
            const duplicate = await SupportTicket.findOne({ sourceMessageId: messageId }).lean();
            if (duplicate) {
              console.log(`⚠️ Already processed message-id ${messageId} — skipping`);
              continue;
            }
          }

          // Create ticket
          const ticket = await new SupportTicket({
            organizationId: account.organizationId,
            accountId: account._id,
            ticketId: generateTicketId(),
            sourceMessageId: messageId || undefined,
            subject: subject.slice(0, 200),
            description: description || 'No description provided',
            priority,
            status: 'Open',
            assignedEngineer: engineer._id,
            createdBy: engineer._id,
            internalNotes: [{
              note: `Auto-created from email sent by ${fromName} <${fromEmail}>`,
              addedBy: engineer._id,
              addedAt: new Date()
            }],
            lastResponseAt: new Date(),
          }).save();

          console.log(`✅ Created ticket: ${ticket.ticketId} (Priority: ${priority})`);
          result.created.push(ticket.ticketId);
          result.processed++;

          // Send acknowledgement from the engineer's own email
          await sendTicketAcknowledgement(
            fromEmail,
            fromName || account.companyName || 'Customer',
            ticket.ticketId,
            subject.slice(0, 200),
            senderSmtp,
          ).catch(e => logger.error('Failed to send acknowledgement email:', e));

          // Mark as read
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });

        } catch (err) {
          console.error(`❌ Error processing email ${uid}:`, err);
          result.errors.push(`UID ${uid}: ${(err as any)?.message || String(err)}`);
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        }
      }

    } finally {
      lock.release();
    }

    await client.logout();
    console.log('\n📊 Sync Summary:');
    console.log(`   Scanned: ${result.scanned}`);
    console.log(`   Created: ${result.created.length}`);
    console.log(`   Failed: ${result.failed.length}`);
    console.log(`   Errors: ${result.errors.length}`);

  } catch (err: any) {
    // Suppress noisy socket errors from Hostinger IMAP dropping idle connections
    if (err?.message && (err.message.includes('socket') || err.message.includes('ECONNRESET') || err.message.includes('closed'))) {
      console.warn('⚠️ IMAP socket closed (harmless, connection dropped by server)');
    } else {
      console.error('❌ IMAP connection error:', err?.message || err);
      result.errors.push(`Connection error: ${err?.message}`);
    }
    try { client.close(); } catch (_) {}
  } finally {
    _syncInProgress.delete(lockKey);
  }

  // Patch ALL tickets that have no engineer — assign from account's assignedEngineer
  await patchUnassignedTickets();

  return result;
}

/**
 * Sync support emails for a Microsoft OAuth engineer via Graph API.
 * Called from cron when engineer has msRefreshToken instead of IMAP creds.
 */
export async function syncSupportEmailsViaGraph(
  encryptedRefreshToken: string,
  engineerUser: any,
): Promise<SupportEmailSyncResult> {
  const result: SupportEmailSyncResult = {
    scanned: 0, processed: 0, created: [], failed: [], errors: [],
  };

  try {
    const { decryptText, encryptText } = await import('../utils/crypto');
    const axios = (await import('axios')).default;

    const refreshToken = decryptText(encryptedRefreshToken);
    const tokenRes = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     process.env.GRAPH_CLIENT_ID     || '',
        client_secret: process.env.GRAPH_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        scope:         'offline_access Mail.Read Mail.ReadWrite',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenRes.data.access_token;

    // Rotate refresh token if Microsoft issued a new one
    if (tokenRes.data.refresh_token && tokenRes.data.refresh_token !== refreshToken) {
      const UserModel = (await import('../models/User')).default;
      await UserModel.updateOne(
        { _id: engineerUser._id },
        { msRefreshToken: encryptText(tokenRes.data.refresh_token) }
      );
    }

    // Fetch last 7 days of inbox
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let url = `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$filter=receivedDateTime ge ${since}&$select=id,subject,bodyPreview,body,receivedDateTime,from&$top=50&$orderby=receivedDateTime desc`;

    const allMessages: any[] = [];
    while (url) {
      const res2 = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      allMessages.push(...(res2.data.value || []));
      url = res2.data['@odata.nextLink'] || '';
    }
    result.scanned = allMessages.length;

    for (const msg of allMessages) {
      const fromEmail = msg.from?.emailAddress?.address?.toLowerCase() || '';
      const fromName  = msg.from?.emailAddress?.name || '';
      const subject   = msg.subject || '';
      const messageId = msg.id; // Graph message ID used as dedup key

      if (!fromEmail) continue;

      // Dedup
      const duplicate = await SupportTicket.findOne({ sourceMessageId: messageId }).lean();
      if (duplicate) continue;

      const account = await findAccountByEmail(fromEmail);
      if (!account) {
        result.failed.push(`${fromEmail}: No matching account found`);
        continue;
      }

      let engineer = null;
      if (account.assignedEngineer) engineer = await User.findById(account.assignedEngineer).lean();
      if (!engineer) engineer = engineerUser;
      if (!engineer) { result.failed.push('No engineer available'); continue; }

      const bodyHtml = msg.body?.content || msg.bodyPreview || '';
      const bodyText = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
      const description = bodyText || 'No description provided';
      const priority = detectPriority(subject, description);

      const ticket = await new SupportTicket({
        organizationId: account.organizationId,
        accountId:      account._id,
        ticketId:       generateTicketId(),
        sourceMessageId: messageId,
        subject:        subject.slice(0, 200),
        description,
        priority,
        status:         'Open',
        assignedEngineer: engineer._id,
        createdBy:      engineer._id,
        internalNotes: [{
          note:    `Auto-created from email sent by ${fromName} <${fromEmail}>`,
          addedBy: engineer._id,
          addedAt: new Date(),
        }],
        lastResponseAt: new Date(),
      }).save();

      result.created.push(ticket.ticketId);
      result.processed++;
      logger.info(`Support Graph ticket created: ${ticket.ticketId} from ${fromEmail}`);

      // Send acknowledgement via Graph (system SMTP fallback)
      const senderSmtp: UserSmtpConfig = {
        smtpHost:   'smtp.hostinger.com',
        smtpPort:   465,
        smtpSecure: true,
        smtpUser:   engineerUser.email,
        smtpPass:   '',
        fromEmail:  engineerUser.email,
        fromName:   'Support Team',
      };
      await sendTicketAcknowledgement(
        fromEmail, fromName || account.companyName || 'Customer',
        ticket.ticketId, subject.slice(0, 200), senderSmtp,
      ).catch(() => {});
    }
  } catch (e: any) {
    const msg = e?.response?.data?.error?.message || e?.message || String(e);
    result.errors.push(`Graph support sync failed: ${msg}`);
    logger.warn(`Support Graph sync error for ${engineerUser?.email}: ${msg}`);
  }

  return result;
}