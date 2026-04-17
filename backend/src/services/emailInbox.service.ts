import { ImapFlow } from 'imapflow';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import Lead from '../models/Lead';
import logger from '../utils/logger';

const IMAP_USER = process.env.SUPPORT_EMAIL_USER || process.env.SMTP_USER || '';
const IMAP_PASS = process.env.SUPPORT_EMAIL_PASS || process.env.SMTP_PASS || '';
const IMAP_HOST = process.env.SUPPORT_EMAIL_HOST || 'imap.hostinger.com';
const IMAP_PORT = Number(process.env.SUPPORT_EMAIL_PORT || 993);

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
  const hasApproved = /\bapproved\b/.test(lower);
  const hasRejected = /\brejected\b/.test(lower);
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
 * Subject format: "RE: Requesting for the approval of DRF - {companyName}"
 * or "FW: Requesting for the approval of DRF - {companyName}"
 */
function extractCompanyFromSubject(subject: string): string | null {
  const m = subject.match(/(?:RE|FW|FWD)?:?\s*Requesting for the approval of DRF\s*[-–]\s*(.+)/i);
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
 * Used when OEM reply subject contains company name but no DRF number.
 */
async function findAttemptByCompanyName(companyName: string): Promise<any | null> {
  // Find lead with matching companyName that has a pending OEM attempt
  const leads = await Lead.find({
    companyName: { $regex: companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    isArchived: false,
  }).select('_id companyName');

  for (const lead of leads) {
    const attempt = await OEMApprovalAttempt.findOne({ leadId: lead._id, status: 'Pending' })
      .sort({ sentDate: -1 });
    if (attempt) return { attempt, lead };
  }
  return null;
}

export async function syncEmailsForDRF(): Promise<EmailSyncResult> {
  const result: EmailSyncResult = {
    scanned: 0, processed: 0,
    approved: [], rejected: [], skipped: [], errors: [],
  };

  if (!IMAP_USER || !IMAP_PASS) {
    result.errors.push('IMAP credentials not configured (SUPPORT_EMAIL_USER / SUPPORT_EMAIL_PASS)');
    return result;
  }

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
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
          result.skipped.push(`"${companyName}" — no pending DRF found in DB`);
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
