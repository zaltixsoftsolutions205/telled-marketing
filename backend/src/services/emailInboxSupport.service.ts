// backend/src/services/emailInboxSupport.service.ts
import { ImapFlow } from 'imapflow';
import SupportTicket from '../models/SupportTicket';
import Account from '../models/Account';
import User from '../models/User';
import logger from '../utils/logger';
import { generateTicketId } from '../utils/helpers';
import { sendTicketAcknowledgement } from './email.service';
import mongoose from 'mongoose';

export interface ImapCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
}

// Keywords to identify support emails
const SUPPORT_KEYWORDS = [
  'support', 'help', 'issue', 'problem', 'error', 'bug',
  'not working', 'failed', 'crash', 'assistance', 'trouble',
  'cannot', 'unable', 'urgent', 'login', 'machine', 'access'
];

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

function cleanEmailText(source: Buffer): string {
  let text = source.toString('utf8');
  // Remove quoted-printable encoding
  text = text.replace(/=\r?\n/g, '');
  text = text.replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Remove extra whitespace
  text = text.replace(/\s+/g, ' ');
  return text;
}

function stripQuotedContent(text: string): string {
  const lines = text.split(/\r?\n/);
  const freshLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('>')) break;
    if (/^On .{5,100} wrote:/i.test(trimmed)) break;
    if (/^-{3,}\s*(Forwarded|Original)/i.test(trimmed)) break;
    freshLines.push(line);
  }
  return freshLines.join(' ');
}

async function findAccountByEmail(email: string): Promise<any | null> {
  const safeEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const emailRegex = new RegExp(`^${safeEmail}$`, 'i');

  // Try direct account contactEmail match first (most common path)
  const account = await Account.findOne({
    contactEmail: emailRegex,
    isArchived: false,
  });
  if (account) return account;

  // Try via Lead → Account relationship
  const Lead = mongoose.model('Lead');
  const lead = await Lead.findOne({
    $or: [
      { contactEmail: emailRegex },
      { email: emailRegex },
    ],
    isArchived: false,
  });
  if (lead) {
    const leadAccount = await Account.findOne({ leadId: lead._id, isArchived: false });
    if (leadAccount) return leadAccount;
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

let _syncInProgress = false;

export async function syncSupportEmails(creds?: ImapCredentials): Promise<SupportEmailSyncResult> {
  if (_syncInProgress) {
    logger.info('Support email sync already in progress — skipping concurrent run');
    return { scanned: 0, processed: 0, created: [], failed: [], errors: [] };
  }
  _syncInProgress = true;

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
      // Get unread emails from last 24 hours
      const since = new Date();
      since.setHours(since.getHours() - 24);
      
      const uidsResult = await client.search({ seen: false }, { uid: true });
      const uids: number[] = Array.isArray(uidsResult) ? uidsResult : [];
      console.log(`📧 Found ${uids.length} unread emails`);

      for (const uid of uids) {
        result.scanned++;
        
        try {
          const msg = await client.fetchOne(uid, { envelope: true, source: true }, { uid: true });
          if (!msg) continue;

          const subject = msg.envelope?.subject || '';
          const fromEmail = msg.envelope?.from?.[0]?.address || '';
          const fromName = msg.envelope?.from?.[0]?.name || '';
          
          console.log(`\n📨 Processing: ${subject} (from: ${fromEmail})`);

          // Find account first — if it's a known customer, accept all their emails as support requests
          const account = await findAccountByEmail(fromEmail);

          if (!account) {
            // Unknown sender — only create a ticket if it looks like a support email
            const combined = (subject + ' ' + cleanEmailText(msg.source || Buffer.alloc(0))).toLowerCase();
            const isSupport = SUPPORT_KEYWORDS.some(kw => combined.includes(kw));
            if (!isSupport) {
              console.log(`⏭️ Unknown sender ${fromEmail}, not a support email — skipping`);
              await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
              continue;
            }
            console.log(`❌ No account found for email: ${fromEmail}`);
            result.failed.push(`${fromEmail}: No matching account`);
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

          // Extract email content
          const freshText = stripQuotedContent(cleanEmailText(msg.source || Buffer.alloc(0)));
          const description = freshText.slice(0, 2000);
          
          // Detect priority
          const priority = detectPriority(subject, freshText);
          
          // Dedup: skip if a ticket for the same account+subject was created in the last 2 hours
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
          const duplicate = await SupportTicket.findOne({
            accountId: account._id,
            subject: subject.slice(0, 200),
            createdAt: { $gte: twoHoursAgo },
          }).lean();
          if (duplicate) {
            console.log(`⚠️ Duplicate ticket detected for "${subject}" — skipping`);
            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
            continue;
          }

          // Create ticket
          const ticket = await new SupportTicket({
            accountId: account._id,
            ticketId: generateTicketId(),
            subject: subject.slice(0, 200),
            description: description || 'No description provided',
            priority,
            status: 'Open',
            assignedEngineer: engineer._id,
            createdBy: engineer._id,
            internalNotes: [{
              note: `Auto-created from email from ${fromName} <${fromEmail}>\n\n${description.slice(0, 500)}`,
              addedBy: engineer._id,
              addedAt: new Date()
            }],
            lastResponseAt: new Date(),
          }).save();

          console.log(`✅ Created ticket: ${ticket.ticketId} (Priority: ${priority})`);
          result.created.push(ticket.ticketId);
          result.processed++;

          // Send acknowledgement to customer
          await sendTicketAcknowledgement(
            fromEmail,
            fromName || account.companyName || 'Customer',
            ticket.ticketId,
            subject.slice(0, 200),
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
    _syncInProgress = false;
  }

  // Patch ALL tickets that have no engineer — assign from account's assignedEngineer
  await patchUnassignedTickets();

  return result;
}