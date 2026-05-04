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

const APPROVAL_KEYWORDS = new RegExp(
  '\\b(' + [
    'approved', 'approve', 'approving',
    'granted', 'grant', 'granting',
    'confirmed', 'confirm', 'confirming',
    'accepted', 'accept', 'accepting',
    'go\\s+ahead',
    'proceed', 'proceeding',
    'sanctioned', 'sanction', 'sanctioning',
    'cleared', 'clearance',
    'authorized', 'authorised', 'authorize', 'authorise', 'authorizing', 'authorising',
    'validated', 'validate',
    'good\\s+to\\s+go',
    'endorsed', 'endorse', 'endorsing',
    'ratified', 'ratify',
    'permitted', 'permit', 'permitting',
    'consented', 'consent',
    'agreed', 'agreement\\s+given',
    'in\\s+favour', 'in\\s+favor',
    'no\\s+objection', 'noc\\s+(?:issued|granted|given)',
    'duly\\s+approved', 'hereby\\s+approved',
    'we\\s+approve', 'we\\s+confirm', 'we\\s+accept', 'we\\s+authorize', 'we\\s+authorise',
    'glad\\s+to\\s+approve', 'happy\\s+to\\s+approve', 'pleased\\s+to\\s+approve',
    'registration\\s+approved', 'registration\\s+accepted', 'registration\\s+confirmed',
    'drf\\s+approved', 'oem\\s+approved', 'partnership\\s+approved',
    'empanelled', 'empaneled', 'empanelment\\s+approved',
    'vendor\\s+approved', 'registered\\s+(?:as\\s+)?(?:vendor|partner)',
    'kindly\\s+proceed', 'you\\s+may\\s+proceed', 'please\\s+proceed',
  ].join('|') + ')\\b',
  'i'
);

const REJECTION_KEYWORDS = new RegExp(
  '(?:' + [
    '\\b(?:rejected|reject|rejecting)\\b',
    '\\b(?:declined|decline|declining)\\b',
    '\\bnot\\s+approved\\b',
    '\\bcannot\\s+approve\\b',
    "\\bcan't\\s+approve\\b",
    '\\b(?:denied|deny|denying)\\b',
    '\\bregret(?:fully|ted)?\\b',
    '\\bregrettably\\b',
    '\\bunable\\s+to\\s+approve\\b',
    '\\bnot\\s+able\\s+to\\s+approve\\b',
    '\\bcannot\\s+proceed\\b',
    '\\bunable\\s+to\\s+proceed\\b',
    '\\bnot\\s+able\\s+to\\s+proceed\\b',
    '\\bnot\\s+accepted\\b',
    '\\bcannot\\s+accept\\b',
    '\\bunable\\s+to\\s+accept\\b',
    '\\bnot\\s+authorized\\b',
    '\\bnot\\s+authorised\\b',
    '\\bnot\\s+sanctioned\\b',
    '\\bcannot\\s+sanction\\b',
    '\\bnot\\s+permitted\\b',
    '\\bpermission\\s+(?:not\\s+)?denied\\b',
    '\\bnot\\s+eligible\\b',
    '\\b(?:ineligible|disqualified)\\b',
    '\\b(?:blacklisted|blacklist)\\b',
    '\\b(?:debarred|debar)\\b',
    '\\b(?:deregistered|de-registered)\\b',
    '\\bnot\\s+interested\\b',
    '\\bno\\s+longer\\s+interested\\b',
    '\\b(?:withdrawn|withdrawal)\\b',
    '\\b(?:cancelled|canceled|cancellation)\\b',
    '\\bon\\s+hold\\b',
    '\\bput\\s+on\\s+hold\\b',
    '\\bnot\\s+entertained\\b',
    '\\bcannot\\s+entertain\\b',
    '\\bnot\\s+moving\\s+forward\\b',
    '\\bnot\\s+progressing\\b',
    '\\bnot\\s+proceeding\\b',
    '\\bregistration\\s+(?:rejected|declined)\\b',
    '\\bdrf\\s+rejected\\b',
    '\\boem\\s+rejected\\b',
    '\\bvendor\\s+(?:rejected|not\\s+approved|not\\s+registered)\\b',
    '\\bsorry\\s+(?:we\\s+)?(?:cannot|are\\s+unable)\\b',
    '\\bunfortunately\\s+(?:we\\s+)?(?:cannot|are\\s+unable|do\\s+not)\\b',
    '\\bregret\\s+to\\s+(?:inform|advise|notify)\\b',
    '\\bwe\\s+regret\\s+to\\b',
    '\\bwe\\s+are\\s+sorry\\s+to\\s+inform\\b',
    '\\bsorry\\s+to\\s+inform\\b',
    '\\bnot\\s+feasible\\b',
    '\\bnot\\s+viable\\b',
    '\\bnot\\s+possible\\b',
    '\\bnot\\s+in\\s+a\\s+position\\s+to\\b',
    '\\bnot\\s+shortlisted\\b',
    '\\bnot\\s+selected\\b',
    '\\bnot\\s+recommended\\b',
    '\\bnot\\s+suitable\\b',
    '\\bnot\\s+applicable\\b',
    '\\bdoes\\s+not\\s+meet\\b',
    '\\bfail(?:ed)?\\s+to\\s+qualif(?:y|ied)\\b',
    '\\bcannot\\s+consider\\b',
    '\\bnot\\s+considered\\b',
    '\\bcannot\\s+be\\s+(?:entertained|considered|processed|accepted)\\b',
    '\\bunable\\s+to\\s+register\\b',
    '\\bnot\\s+registered\\b',
    '\\bempanelment\\s+(?:rejected|not\\s+approved|declined)\\b',
    '\\bno\\s+longer\\s+valid\\b',
    '\\bnot\\s+valid\\b',
    '\\binvalid\\b',
    '\\blapsed\\b',
    '\\bterminated\\b',
    '\\bsuspended\\b',
    '\\brevoked\\b',
    '\\bnot\\s+renew(?:ed|ing|able)\\b',
  ].join('|') + ')',
  'i'
);

/** Detect Approved / Rejected from fresh reply text only */
function detectDecision(text: string): 'Approved' | 'Rejected' | null {
  const hasApproved = APPROVAL_KEYWORDS.test(text);
  const hasRejected = REJECTION_KEYWORDS.test(text);
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
  const patterns = [
    /valid\s+(?:till|until|upto|up\s+to|through)[:\s]+(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
    /validity[:\s]+(?:till|until|upto|up\s+to)?[:\s]*(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
    /validity\s+(?:period\s+)?(?:is\s+)?(?:till|until|upto|up\s+to)?[:\s]*(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
    /approved?\s+(?:valid\s+)?(?:till|until|upto|up\s+to|through)[:\s]+(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
    /approval\s+valid\s+(?:till|until|upto|up\s+to)[:\s]+(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
    /approval\s+(?:date\s+)?(?:till|until|upto|up\s+to)[:\s]+(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
    /expir(?:y|es?|ation)\s+(?:date[:\s]+|on[:\s]+|by[:\s]+)?(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
    /expir(?:y|es?|ation)[:\s]+(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
    /valid\s+(?:from\s+\S+\s+)?to[:\s]+(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
    /(?:registration|drf|oem|authoriz(?:ation|ed)|authoris(?:ation|ed))\s+valid\s+(?:till|until|upto|up\s+to)[:\s]+(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
    /(?:empanelment|empanelment)\s+valid\s+(?:till|until|upto|up\s+to)[:\s]+(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
    /(?:renewal\s+)?due\s+(?:on|by|date)[:\s]+(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
    /valid\s+for\s+(?:one|1|two|2|three|3|six|6|twelve|12)\s+(?:year|month)s?\s+(?:from|till|until)?[:\s]*(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const parts = m[1].split(/[-\/\.]/);
    if (parts.length !== 3) continue;
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
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
 * emailDate: the date of the incoming reply email — used to skip emails older than
 * the DRF's sentDate (prevents old replies from re-triggering after a resend).
 */
async function findAttemptByCompanyName(companyName: string, emailDate?: Date): Promise<any | null> {
  const leads = await Lead.find({
    companyName: { $regex: companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    isArchived: false,
  }).select('_id companyName');

  for (const lead of leads) {
    // Look at the most recent attempt regardless of status
    const latest = await OEMApprovalAttempt.findOne({ leadId: lead._id })
      .sort({ sentDate: -1 });
    if (!latest) continue;

    // If the reply email predates the DRF sentDate it belongs to a previous cycle — skip
    if (emailDate && emailDate < new Date(latest.sentDate)) {
      return { alreadyProcessed: true, status: 'stale', lead };
    }

    if (latest.status === 'Pending') return { attempt: latest, lead };

    // Already actioned in this cycle
    return { alreadyProcessed: true, status: latest.status, lead };
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

    for await (const msg of client.fetch(uids, { envelope: true, source: true, internalDate: true }, { uid: true })) {
      result.scanned++;
      try {
        const subject   = msg.envelope?.subject || '';
        const fromAddr  = (msg.envelope?.from?.[0]?.address || 'unknown').toLowerCase();
        const emailDate = msg.envelope?.date ? new Date(msg.envelope.date) : (msg.internalDate ? new Date(msg.internalDate) : undefined);

        // Skip bounces and system emails
        const isSystemSender = /mailer-daemon|postmaster|no-reply|noreply|bounce|delivery|mail-daemon|notification@|alerts@/i.test(fromAddr);
        const isBounceSubject = /undelivered|delivery.*(failed|failure|status|notification)|bounce|mail delivery|returned mail|failure notice/i.test(subject);
        if (isSystemSender || isBounceSubject) continue;

        // Check for extension reply first
        const isExtensionReply = /DRF Extension Request/i.test(subject);
        if (isExtensionReply) {
          const extCompany = subject.match(/DRF Extension Request\s*[-–]\s*DRF-[\d]+-[\d]+\s*[-–]\s*(.+)/i)?.[1]?.trim();
          if (extCompany) {
            const rawText = rawEmailToText(msg.source || Buffer.alloc(0));
            const freshText = stripQuotedContent(rawText);
            const newExpiry = extractExpiryDate(freshText) || extractExpiryDate(rawText);
            if (newExpiry) {
              const leads = await Lead.find({ companyName: { $regex: extCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }, isArchived: false }).select('_id');
              for (const lead of leads) {
                const attempt = await OEMApprovalAttempt.findOne({ leadId: lead._id, status: 'Approved' }).sort({ sentDate: -1 });
                if (attempt) {
                  attempt.expiryDate = newExpiry;
                  await attempt.save();
                  result.approved.push(`${extCompany} (extended to ${newExpiry.toLocaleDateString('en-IN')})`);
                  result.processed++;
                  logger.info(`DRF expiry extended for "${extCompany}" to ${newExpiry.toISOString()} via email from ${fromAddr}`);
                }
              }
            } else {
              result.skipped.push(`"${subject.slice(0, 60)}" — extension reply but no new date found`);
            }
          }
          continue;
        }

        // Only process replies to OUR DRF emails
        const isDRFReply = /requesting for the approval of DRF/i.test(subject);
        if (!isDRFReply) continue;

        const rawText  = rawEmailToText(msg.source || Buffer.alloc(0));
        const freshText = subject + ' ' + stripQuotedContent(rawText);
        let decision  = detectDecision(freshText);

        // If fresh text has no decision, scan full body (catches decisions in nested/forwarded replies)
        if (!decision) {
          // Strip the original DRF subject line to avoid false positives from quoted original
          const fullTextWithoutSubject = rawText.replace(/Requesting for the approval of DRF[^.!\n]*/gi, '');
          decision = detectDecision(fullTextWithoutSubject);
        }

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

        const found = await findAttemptByCompanyName(companyName, emailDate);
        if (!found) {
          result.skipped.push(`"${companyName}" — no DRF found in DB`);
          continue;
        }
        if (found.alreadyProcessed) {
          if (found.status !== 'stale') {
            result.skipped.push(`"${companyName}" — DRF already ${found.status}`);
          }
          continue;
        }

        const { attempt, lead } = found;
        const label = `${lead.companyName} (${attempt.drfNumber || attempt._id})`;

        if (decision === 'Approved') {
          const expiryDate = extractExpiryDate(freshText);
          attempt.status       = 'Approved';
          attempt.approvedDate = new Date();
          attempt.approvedBy   = `Auto (${fromAddr})`;
          if (expiryDate) attempt.expiryDate = expiryDate;
          await attempt.save();
          await Lead.findByIdAndUpdate(lead._id, { stage: 'OEM Approved' });
          result.approved.push(label);
          logger.info(`DRF auto-approved for "${lead.companyName}" via email from ${fromAddr}${expiryDate ? `, valid until: ${expiryDate.toISOString()}` : ''}`);
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
