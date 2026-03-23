import { ImapFlow } from 'imapflow';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import Lead from '../models/Lead';
import logger from '../utils/logger';


const IMAP_USER = process.env.SMTP_USER || '';
const IMAP_PASS = process.env.SMTP_PASS || '';

const APPROVE_KEYWORDS = [
  'approved', 'approval', 'approve', 'accepted', 'accept',
  'confirmed', 'confirm', 'granted', 'authorized', 'authorised',
  'proceed', 'go ahead', 'cleared', 'sanctioned',
];

const REJECT_KEYWORDS = [
  'rejected', 'reject', 'declined', 'decline', 'denied', 'deny',
  'not approved', 'not accepted', 'refused', 'refuse',
  'cannot approve', 'unable to approve', 'regret',
];

export interface EmailSyncResult {
  scanned: number;
  processed: number;
  approved: string[];
  rejected: string[];
  skipped: string[];
  errors: string[];
}

function detectDecision(text: string): 'Approved' | 'Rejected' | null {
  const lower = text.toLowerCase();
  for (const kw of REJECT_KEYWORDS) {
    if (lower.includes(kw)) return 'Rejected';
  }
  for (const kw of APPROVE_KEYWORDS) {
    if (lower.includes(kw)) return 'Approved';
  }
  return null;
}

function extractDRFNumbers(text: string): string[] {
  const found = new Set<string>();
  // Matches: DRF-20260318-2294 | DRF-20260318-001 | DRF 20260318 2294 | DRF/20260318/001
  const re = /DRF[-\/\s]?(\d{8})[-\/\s]?(\d{3,})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(`DRF-${m[1]}-${m[2]}`);
  }
  return [...found];
}

function rawEmailToText(source: Buffer): string {
  let text = source.toString('utf8');
  // strip quoted-printable soft line breaks
  text = text.replace(/=\r?\n/g, '');
  // decode common QP chars
  text = text.replace(/=[0-9A-Fa-f]{2}/g, ' ');
  // strip HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // collapse whitespace
  text = text.replace(/\s+/g, ' ');
  return text;
}

/**
 * Strip quoted reply content so we only analyse what the replier actually wrote.
 * Removes: lines starting with ">", "On ... wrote:" blocks, forwarded headers.
 */
function stripQuotedContent(text: string): string {
  // Split into lines and drop everything from the first quoted line onward
  const lines = text.split(/\r?\n/);
  const freshLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Gmail/Outlook "On <date> ... wrote:" separator
    if (/^On .{5,100} wrote:/i.test(trimmed)) break;
    // Standard quote prefix
    if (trimmed.startsWith('>')) break;
    // Forwarded message header
    if (/^-{3,}\s*(Forwarded|Original)/i.test(trimmed)) break;
    // "From:" line in forwarded blocks
    if (/^From:\s+/i.test(trimmed) && freshLines.length > 2) break;
    freshLines.push(line);
  }
  return freshLines.join(' ');
}

async function findAttemptByDRFNumber(drfNumber: string): Promise<{ type: 'oem'; doc: any } | { type: 'lead'; doc: any } | null> {
  // 1. Try OEMApprovalAttempt (3-digit attempt number style)
  const parts = drfNumber.split('-');
  if (parts.length === 3) {
    const datePart   = parts[1];
    const attemptNum = parseInt(parts[2], 10);
    const y  = parseInt(datePart.slice(0, 4), 10);
    const mo = parseInt(datePart.slice(4, 6), 10) - 1;
    const d  = parseInt(datePart.slice(6, 8), 10);
    const dayStartExt = new Date(Date.UTC(y, mo, d, 0, 0, 0) - 24 * 60 * 60 * 1000);
    const dayEndExt   = new Date(Date.UTC(y, mo, d, 23, 59, 59, 999) + 24 * 60 * 60 * 1000);
    const oem = await OEMApprovalAttempt.findOne({
      attemptNumber: attemptNum,
      sentDate: { $gte: dayStartExt, $lte: dayEndExt },
      status: 'Pending',
    });
    if (oem) return { type: 'oem', doc: oem };
  }

  // 2. Try Lead with matching drfNumber field (4-digit random style)
  const lead = await Lead.findOne({ drfNumber, isArchived: false });
  if (lead) return { type: 'lead', doc: lead };

  return null;
}

export async function syncEmailsForDRF(): Promise<EmailSyncResult> {
  const result: EmailSyncResult = {
    scanned: 0, processed: 0,
    approved: [], rejected: [], skipped: [], errors: [],
  };

  if (!IMAP_USER || !IMAP_PASS) {
    result.errors.push('IMAP credentials not configured (SMTP_USER / SMTP_PASS)');
    return result;
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  // Prevent unhandled 'error' event from crashing the Node process
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
    // ── 1. Search ALL messages in last 60 days (read or unread) ─────────────
    // We don't filter by seen:false because the user may have already read the
    // email in Gmail. Duplicate processing is safe — findAttemptByDRFNumber
    // only matches Pending DRFs, so already-approved/rejected ones are skipped.
    const since = new Date();
    since.setDate(since.getDate() - 60);

    const uids: number[] = await (client as any).search({ since }, { uid: true });

    if (!uids || uids.length === 0) {
      result.skipped.push('No emails found in last 60 days');
      lock.release();
      await client.logout();
      return result;
    }

    logger.info(`Email sync: found ${uids.length} unread messages`);

    // ── 2. Fetch each message ────────────────────────────────────────────────
    for await (const msg of client.fetch(uids, { envelope: true, source: true }, { uid: true })) {
      result.scanned++;
      try {
        const subject  = msg.envelope?.subject || '';
        const fromAddr = msg.envelope?.from?.[0]?.address || 'unknown';
        const rawText  = rawEmailToText(msg.source || Buffer.alloc(0));
        const fullText = subject + ' ' + rawText;

        // Extract DRF numbers from full email (incl. quoted parts — number may be in thread)
        const drfNumbers = extractDRFNumbers(fullText);

        if (!drfNumbers.length) {
          // No DRF number — skip silently (don't pollute skipped list)
          continue;
        }

        // Detect decision ONLY from the fresh reply, not quoted original content
        const freshText = subject + ' ' + stripQuotedContent(rawText);
        const decision = detectDecision(freshText);

        for (const drfNumber of drfNumbers) {
          if (!decision) {
            result.skipped.push(`${drfNumber} — found in email from ${fromAddr} but no approval/rejection keyword`);
            continue;
          }

          const found = await findAttemptByDRFNumber(drfNumber);
          if (!found) {
            result.skipped.push(`${drfNumber} — DRF not found in DB`);
            continue;
          }

          if (found.type === 'oem') {
            const attempt = found.doc;
            if (decision === 'Approved') {
              attempt.status       = 'Approved';
              attempt.approvedDate = new Date();
              attempt.approvedBy   = `Auto (${fromAddr})`;
              await attempt.save();
              await Lead.findByIdAndUpdate(attempt.leadId, { stage: 'OEM Approved' });
              result.approved.push(drfNumber);
              logger.info(`DRF ${drfNumber} (OEM attempt) auto-approved via email from ${fromAddr}`);
            } else {
              attempt.status          = 'Rejected';
              attempt.rejectedDate    = new Date();
              attempt.rejectionReason = `Auto (${fromAddr}): "${subject.slice(0, 120)}"`;
              await attempt.save();
              await Lead.findByIdAndUpdate(attempt.leadId, { stage: 'OEM Rejected' });
              result.rejected.push(drfNumber);
              logger.info(`DRF ${drfNumber} (OEM attempt) auto-rejected via email from ${fromAddr}`);
            }
          } else {
            // Lead-based DRF
            const lead = found.doc;
            if (decision === 'Approved') {
              await Lead.findByIdAndUpdate(lead._id, { stage: 'OEM Approved' });
              result.approved.push(drfNumber);
              logger.info(`DRF ${drfNumber} (Lead) auto-approved via email from ${fromAddr}`);
            } else {
              await Lead.findByIdAndUpdate(lead._id, { stage: 'OEM Rejected' });
              result.rejected.push(drfNumber);
              logger.info(`DRF ${drfNumber} (Lead) auto-rejected via email from ${fromAddr}`);
            }
          }
          result.processed++;
        }

        // No need to mark as read — duplicate scans are safe because
        // findAttemptByDRFNumber only matches Pending DRFs.

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

  try { await client.logout(); } catch { /* ignore logout errors */ }

  return result;
}
