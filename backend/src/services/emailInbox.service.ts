import { ImapFlow } from 'imapflow';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import Lead from '../models/Lead';
import logger from '../utils/logger';

export interface ImapCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
}

function smtpHostToImap(smtpHost: string): string {
  if (smtpHost.includes('office365') || smtpHost.includes('outlook')) return 'imap-mail.outlook.com';
  return smtpHost.replace(/^smtp\./, 'imap.');
}

export interface EmailSyncResult {
  scanned: number;
  processed: number;
  approved: string[];
  rejected: string[];
  skipped: string[];
  errors: string[];
}

/** Detect Approved / Rejected from fresh reply text only */
function detectDecision(text: string): 'Approved' | 'Rejected' | null {
  const lower = text.toLowerCase();
  const hasApproved = /\b(approved|approve|approving|granted|confirmed|accepted|go ahead|proceed)\b/.test(lower);
  const hasRejected = /\b(rejected|reject|rejecting|declined|decline|not approved|cannot approve|denied)\b/.test(lower);
  if (hasApproved && hasRejected) return null; // ambiguous
  if (hasApproved) return 'Approved';
  if (hasRejected) return 'Rejected';
  return null;
}

/**
 * Extract expiry date from text like "Valid till 10-05-2026" or "valid till 10/05/2026"
 * Returns ISO date string or null.
 */
function extractExpiryDate(text: string): Date | null {
  // Pattern: valid till / valid until / validity / expiry + date
  const m = text.match(/valid\s+(?:till|until|upto|up to|through)[:\s]+(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i);
  if (!m) return null;
  const parts = m[1].split(/[-\/\.]/);
  if (parts.length !== 3) return null;
  let day = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (year < 100) year += 2000;
  const d = new Date(Date.UTC(year, month - 1, day));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Extract company name from DRF email subject.
 * Handles arbitrary prefixes like [EXTERNAL], RE:, FW:, FWD:
 * Subject format: "... Requesting for the approval of DRF - {companyName}"
 */
function extractCompanyFromSubject(subject: string): string | null {
  const m = subject.match(/Requesting for the approval of DRF\s*[-–]\s*(.+)/i);
  return m ? m[1].trim() : null;
}

/** Convert raw email buffer to plain text */
function rawEmailToText(source: Buffer): string {
  let text = source.toString('utf8');
  text = text.replace(/=\r?\n/g, '');
  text = text.replace(/=[0-9A-Fa-f]{2}/g, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\s+/g, ' ');
  return text;
}

/** Strip quoted/forwarded content — only analyse what the replier wrote */
function stripQuotedContent(text: string): string {
  const lines = text.split(/\r?\n/);
  const freshLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^On .{5,100} wrote:/i.test(trimmed)) break;
    if (trimmed.startsWith('>')) break;
    if (/^-{3,}\s*(Forwarded|Original)/i.test(trimmed)) break;
    if (/^From:\s+/i.test(trimmed) && freshLines.length > 2) break;
    freshLines.push(line);
  }
  return freshLines.join(' ');
}

/**
 * Find a pending OEM attempt by company name (case-insensitive, partial match).
 * Returns { attempt, lead } if pending found, or { alreadyProcessed: true } if already approved/rejected.
 */
async function findAttemptByCompanyName(companyName: string): Promise<any | null> {
  const leads = await Lead.find({
    companyName: { $regex: companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    isArchived: false,
  }).select('_id companyName');

  for (const lead of leads) {
    const pending = await OEMApprovalAttempt.findOne({ leadId: lead._id, status: 'Pending' })
      .sort({ sentDate: -1 });
    if (pending) return { attempt: pending, lead };
    // Check if already processed
    const processed = await OEMApprovalAttempt.findOne({ leadId: lead._id, status: { $in: ['Approved', 'Rejected'] } })
      .sort({ sentDate: -1 });
    if (processed) return { alreadyProcessed: true, status: processed.status, lead };
  }
  return null;
}

export async function syncEmailsForDRF(creds?: ImapCredentials): Promise<EmailSyncResult> {
  const result: EmailSyncResult = {
    scanned: 0, processed: 0,
    approved: [], rejected: [], skipped: [], errors: [],
  };

  const imapUser = creds?.user || process.env.SUPPORT_EMAIL_USER || process.env.SMTP_USER || '';
  const imapPass = creds?.pass || process.env.SUPPORT_EMAIL_PASS || process.env.SMTP_PASS || '';
  const imapHost = creds?.host || process.env.SUPPORT_EMAIL_HOST || 'imap.hostinger.com';
  const imapPort = creds?.port || Number(process.env.SUPPORT_EMAIL_PORT || 993);

  if (!imapUser || !imapPass) {
    result.errors.push('IMAP credentials not configured. Please set up your email in Email Configuration.');
    return result;
  }

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  client.on('error', (err: Error) => {
    logger.error('ImapFlow socket error:', err.message);
  });

  try {
    await client.connect();
  } catch (connErr) {
    result.errors.push(`IMAP connect failed: ${(connErr as Error).message}`);
    return result;
  }

  const lock = await client.getMailboxLock('INBOX');
  try {
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const uids: number[] = await (client as any).search({ since }, { uid: true });

    if (!uids || uids.length === 0) {
      result.skipped.push('No emails found in last 60 days');
      lock.release();
      await client.logout();
      return result;
    }

    logger.info(`Email sync: found ${uids.length} messages`);

    for await (const msg of client.fetch(uids, { envelope: true, source: true }, { uid: true })) {
      result.scanned++;
      try {
        const subject  = msg.envelope?.subject || '';
        const fromAddr = (msg.envelope?.from?.[0]?.address || 'unknown').toLowerCase();

        // Skip bounces and system emails
        const isSystemSender = /mailer-daemon|postmaster|no-reply|noreply|bounce|delivery|mail-daemon|notification@|alerts@/i.test(fromAddr);
        const isBounceSubject = /undelivered|delivery.*(failed|failure|status|notification)|bounce|mail delivery|returned mail|failure notice/i.test(subject);
        if (isSystemSender || isBounceSubject) continue;

        // Only process replies to OUR DRF emails
        const isDRFReply = /requesting for the approval of DRF/i.test(subject);
        if (!isDRFReply) continue;

        const rawText  = rawEmailToText(msg.source || Buffer.alloc(0));
        const freshText = subject + ' ' + stripQuotedContent(rawText);
        const decision  = detectDecision(freshText);

        if (!decision) {
          result.skipped.push(`"${subject.slice(0, 60)}" — no approval/rejection keyword found`);
          continue;
        }

        // Extract company name from subject
        const companyName = extractCompanyFromSubject(subject);
        if (!companyName) {
          result.skipped.push(`"${subject.slice(0, 60)}" — could not extract company name`);
          continue;
        }

        const found = await findAttemptByCompanyName(companyName);
        if (!found) {
          result.skipped.push(`"${companyName}" — no DRF found in DB`);
          continue;
        }
        if (found.alreadyProcessed) {
          result.skipped.push(`"${companyName}" — DRF already ${found.status}`);
          continue;
        }

        const { attempt, lead } = found;
        const label = `${lead.companyName} (${attempt.drfNumber || attempt._id})`;

        if (decision === 'Approved') {
          // Extract expiry date from email body if present
          const expiryDate = extractExpiryDate(freshText) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          attempt.status       = 'Approved';
          attempt.approvedDate = new Date();
          attempt.approvedBy   = `Auto (${fromAddr})`;
          attempt.expiryDate   = expiryDate;
          await attempt.save();
          await Lead.findByIdAndUpdate(lead._id, { stage: 'OEM Approved' });
          result.approved.push(label);
          logger.info(`DRF auto-approved for "${lead.companyName}" via email from ${fromAddr}, expiry: ${expiryDate.toISOString()}`);
        } else {
          attempt.status          = 'Rejected';
          attempt.rejectedDate    = new Date();
          attempt.rejectionReason = `Auto (${fromAddr}): "${subject.slice(0, 120)}"`;
          await attempt.save();
          await Lead.findByIdAndUpdate(lead._id, { stage: 'OEM Rejected' });
          result.rejected.push(label);
          logger.info(`DRF auto-rejected for "${lead.companyName}" via email from ${fromAddr}`);
        }
        result.processed++;

      } catch (msgErr) {
        result.errors.push(`uid ${msg.uid}: ${(msgErr as Error).message}`);
      }
    }

  } catch (err) {
    result.errors.push(`Sync error: ${(err as Error).message}`);
    logger.error('DRF email sync error:', err);
  } finally {
    lock.release();
  }

  try { await client.logout(); } catch { /* ignore */ }

  return result;
}
