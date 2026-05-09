import { ImapFlow } from 'imapflow';
import OEMApprovalAttempt from '../models/OEMApprovalAttempt';
import Lead from '../models/Lead';
import logger from '../utils/logger';
import axios from 'axios';

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
  // Format 1: "Requesting for the approval of DRF - Company Name"
  const m1 = subject.match(/Requesting for the approval of DRF\s*[-–]\s*(.+)/i);
  if (m1) return m1[1].trim();
  // Format 2: "OEM Approval Request — DRF-xxx — Company Name (Attempt #n)"
  const m2 = subject.match(/OEM Approval Request\s*[-–]+\s*DRF-[\d-]+\s*[-–]+\s*(.+?)\s*\(Attempt/i);
  if (m2) return m2[1].trim();
  return null;
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

/**
 * Read DRF approval/rejection replies from a personal Outlook/Hotmail inbox
 * using Microsoft Graph API (delegated OAuth — user's own refresh token).
 */
export async function syncEmailsForDRFViaGraph(
  encryptedRefreshToken: string,
  userEmail: string,
): Promise<EmailSyncResult> {
  const result: EmailSyncResult = {
    scanned: 0, processed: 0,
    approved: [], rejected: [], skipped: [], errors: [],
  };

  try {
    const { decryptText, encryptText } = await import('../utils/crypto');
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

    if (tokenRes.data.refresh_token && tokenRes.data.refresh_token !== refreshToken) {
      const User = (await import('../models/User')).default;
      await User.updateOne(
        { msRefreshToken: encryptedRefreshToken },
        { msRefreshToken: encryptText(tokenRes.data.refresh_token) }
      );
    }

    // Fetch all pending DRFs first — scan inbox only for those companies
    const pendingAttempts = await OEMApprovalAttempt.find({ status: 'Pending' })
      .populate('leadId', 'companyName oemEmail email _id')
      .lean();

    if (pendingAttempts.length === 0) return result;

    // Fetch last 90 days of inbox — both read and unread
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    let url = `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$filter=receivedDateTime ge ${since}&$select=id,subject,bodyPreview,body,receivedDateTime,from&$top=100&$orderby=receivedDateTime desc`;

    const allMessages: any[] = [];
    while (url) {
      const res2 = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      allMessages.push(...(res2.data.value || []));
      url = res2.data['@odata.nextLink'] || '';
    }
    result.scanned = allMessages.length;

    // Filter to only DRF-related emails
    const drfMessages = allMessages.filter(m =>
      /requesting for the approval of DRF|OEM Approval Request/i.test(m.subject || '')
    );

    for (const attempt of pendingAttempts) {
      const lead = attempt.leadId as any;
      if (!lead) continue;
      const companyName = lead.companyName;

      // Find the most recent reply for this company after sentDate
      const sentDate = new Date(attempt.sentDate);
      const replies = drfMessages.filter(m => {
        const subj = m.subject || '';
        const msgDate = new Date(m.receivedDateTime);
        return msgDate > sentDate &&
          (subj.toLowerCase().includes(companyName.toLowerCase()) ||
           extractCompanyFromSubject(subj)?.toLowerCase() === companyName.toLowerCase());
      }).sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime());

      if (replies.length === 0) {
        result.skipped.push(`${companyName} — no reply found`);
        continue;
      }

      const msg = replies[0];
      const bodyText = msg.body?.content || msg.bodyPreview || '';
      const emailDate = new Date(msg.receivedDateTime);
      const fresh = stripQuotedContent(bodyText.replace(/<[^>]+>/g, ' '));
      const fullText = fresh + ' ' + bodyText.replace(/<[^>]+>/g, ' ');

      let decision = detectDecision(fresh);
      if (!decision) decision = detectDecision(fullText);

      if (!decision) {
        result.skipped.push(`${companyName} — reply found but no approval/rejection keyword`);
        continue;
      }

      if (decision === 'Approved') {
        const expiryDate = extractExpiryDate(fresh) || extractExpiryDate(fullText);
        await OEMApprovalAttempt.findByIdAndUpdate(attempt._id, {
          status: 'Approved',
          approvedDate: emailDate,
          approvedBy: msg.from?.emailAddress?.address || 'OEM',
          ...(expiryDate ? { expiryDate } : {}),
        });
        await Lead.findByIdAndUpdate(lead._id, { stage: 'OEM Approved' });
        result.approved.push(companyName);
        logger.info(`DRF Graph auto-approved: "${companyName}" from ${msg.from?.emailAddress?.address}`);
      } else {
        await OEMApprovalAttempt.findByIdAndUpdate(attempt._id, {
          status: 'Rejected',
          rejectedDate: emailDate,
          rejectionReason: `Auto (${msg.from?.emailAddress?.address}): ${fresh.slice(0, 300)}`,
        });
        await Lead.findByIdAndUpdate(lead._id, { stage: 'OEM Rejected' });
        result.rejected.push(companyName);
        logger.info(`DRF Graph auto-rejected: "${companyName}" from ${msg.from?.emailAddress?.address}`);
      }
      result.processed++;
    }

    if (result.approved.length || result.rejected.length) {
      logger.info(`DRF Graph sync (${userEmail}): ${result.approved.length} approved, ${result.rejected.length} rejected`);
    }

  } catch (e: any) {
    const msg = e?.response?.data?.error?.message || e?.response?.data || e?.message || String(e);
    result.errors.push(`Graph DRF sync failed: ${JSON.stringify(msg)}`);
    logger.warn(`DRF Graph sync error for ${userEmail}: ${JSON.stringify(msg)}`);
  }

  return result;
}

export async function syncEmailsForDRF(creds?: ImapCredentials): Promise<EmailSyncResult> {
  const result: EmailSyncResult = {
    scanned: 0, processed: 0,
    approved: [], rejected: [], skipped: [], errors: [],
  };

  const imapUser = creds?.user || '';
  const imapPass = creds?.pass || '';
  const imapHost = creds?.host || '';
  const imapPort = creds?.port || 993;

  if (!imapUser || !imapPass || !imapHost) {
    result.errors.push('IMAP credentials not configured.');
    return result;
  }

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 30000,
    greetingTimeout: 20000,
    socketTimeout: 60000,
  });

  client.on('error', (err: Error) => {
    const msg = (err?.message || String(err)).toLowerCase();
    if (msg.includes('socket') || msg.includes('econnreset') || msg.includes('closed') || msg.includes('epipe') || msg.includes('timeout') || msg.includes('etimedout') || msg.includes('connection not available') || !msg) {
      // Harmless idle connection drop — server closes inactive IMAP connections
    } else {
      logger.warn(`ImapFlow DRF sync error: ${err?.message || String(err)}`);
    }
  });

  try {
    await client.connect();
  } catch (connErr) {
    result.errors.push(`IMAP connect failed: ${(connErr as Error).message}`);
    return result;
  }

  // Load all pending DRFs first — we search inbox FOR these, not the other way around
  const pendingAttempts = await OEMApprovalAttempt.find({ status: 'Pending' })
    .populate('leadId', 'companyName oemEmail email _id')
    .lean();

  if (pendingAttempts.length === 0) {
    try { await client.logout(); } catch { /* ignore */ }
    return result;
  }

  const lock = await client.getMailboxLock('INBOX');
  try {
    // Fetch last 90 days of headers
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const allUids: number[] = await (client as any).search({ since }, { uid: true });

    if (!allUids || allUids.length === 0) {
      lock.release();
      await client.logout();
      return result;
    }

    // Phase 1: headers only — filter to DRF-related subjects
    const relevantUids: number[] = [];
    const uidSubjectMap = new Map<number, string>();
    for await (const hdr of client.fetch(allUids, { envelope: true, internalDate: true }, { uid: true })) {
      const subject = hdr.envelope?.subject || '';
      if (/requesting for the approval of DRF|OEM Approval Request|DRF Extension Request/i.test(subject)) {
        relevantUids.push(hdr.uid);
        uidSubjectMap.set(hdr.uid, subject);
      }
    }

    logger.info(`Email sync: found ${allUids.length} messages, ${relevantUids.length} DRF-related`);
    result.scanned = allUids.length;

    if (relevantUids.length === 0) {
      lock.release();
      await client.logout();
      return result;
    }

    // Phase 2: full source only for DRF-related emails
    interface ParsedEmail { uid: number; subject: string; fromAddr: string; date: Date; rawText: string; }
    const parsedEmails: ParsedEmail[] = [];
    for await (const msg of client.fetch(relevantUids, { envelope: true, source: true, internalDate: true }, { uid: true })) {
      const subject  = msg.envelope?.subject || '';
      const fromAddr = (msg.envelope?.from?.[0]?.address || 'unknown').toLowerCase();
      const date     = msg.envelope?.date ? new Date(msg.envelope.date) : (msg.internalDate ? new Date(msg.internalDate) : new Date());
      const rawText  = rawEmailToText(msg.source || Buffer.alloc(0));
      parsedEmails.push({ uid: msg.uid, subject, fromAddr, date, rawText });
    }

    // Phase 3: for each pending DRF, find the best matching reply
    for (const attempt of pendingAttempts) {
      const lead = attempt.leadId as any;
      if (!lead) continue;
      const companyName: string = lead.companyName;
      const sentDate = new Date(attempt.sentDate);

      // Skip system senders
      const isSystem = (addr: string) => /mailer-daemon|postmaster|no-reply|noreply|bounce|delivery|mail-daemon/i.test(addr);
      const isBounce = (subj: string) => /undelivered|delivery.*(failed|failure)|bounce|returned mail|failure notice/i.test(subj);

      // Find replies for this company that arrived after the DRF was sent
      const replies = parsedEmails.filter(e => {
        if (isSystem(e.fromAddr) || isBounce(e.subject)) return false;
        if (e.date <= sentDate) return false;
        const extracted = extractCompanyFromSubject(e.subject);
        return extracted?.toLowerCase() === companyName.toLowerCase() ||
          e.subject.toLowerCase().includes(companyName.toLowerCase());
      }).sort((a, b) => b.date.getTime() - a.date.getTime()); // newest first

      if (replies.length === 0) {
        result.skipped.push(`${companyName} — no reply found`);
        continue;
      }

      // Handle extension replies
      const extensionReply = replies.find(e => /DRF Extension Request/i.test(e.subject));
      if (extensionReply) {
        const freshText = stripQuotedContent(extensionReply.rawText);
        const newExpiry = extractExpiryDate(freshText) || extractExpiryDate(extensionReply.rawText);
        if (newExpiry) {
          await OEMApprovalAttempt.findByIdAndUpdate(attempt._id, { expiryDate: newExpiry });
          result.approved.push(`${companyName} (extended to ${newExpiry.toLocaleDateString('en-IN')})`);
          result.processed++;
          logger.info(`DRF expiry extended for "${companyName}" via email from ${extensionReply.fromAddr}`);
        }
        continue;
      }

      // Use most recent reply for approval/rejection decision
      const reply = replies[0];
      const freshText = stripQuotedContent(reply.rawText);
      let decision = detectDecision(freshText);
      if (!decision) decision = detectDecision(reply.rawText);

      if (!decision) {
        result.skipped.push(`${companyName} — reply found but no approval/rejection keyword`);
        continue;
      }

      const label = `${companyName}`;
      if (decision === 'Approved') {
        const expiryDate = extractExpiryDate(freshText) || extractExpiryDate(reply.rawText);
        await OEMApprovalAttempt.findByIdAndUpdate(attempt._id, {
          status: 'Approved',
          approvedDate: reply.date,
          approvedBy: `Auto (${reply.fromAddr})`,
          ...(expiryDate ? { expiryDate } : {}),
        });
        await Lead.findByIdAndUpdate(lead._id, { stage: 'OEM Approved' });
        result.approved.push(label);
        logger.info(`DRF auto-approved: "${companyName}" from ${reply.fromAddr}${expiryDate ? `, valid until ${expiryDate.toISOString()}` : ''}`);
      } else {
        await OEMApprovalAttempt.findByIdAndUpdate(attempt._id, {
          status: 'Rejected',
          rejectedDate: reply.date,
          rejectionReason: `Auto (${reply.fromAddr}): ${freshText.slice(0, 300)}`,
        });
        await Lead.findByIdAndUpdate(lead._id, { stage: 'OEM Rejected' });
        result.rejected.push(label);
        logger.info(`DRF auto-rejected: "${companyName}" from ${reply.fromAddr}`);
      }
      result.processed++;
    }

  } catch (err: any) {
    const msg = err?.message || String(err) || 'unknown error';
    const isHarmless = /connection not available|socket|econnreset|closed|epipe|timeout|etimedout/i.test(msg);
    if (isHarmless) {
      logger.warn(`DRF IMAP connection dropped (harmless): ${msg}`);
    } else {
      result.errors.push(`Sync error: ${msg}`);
      logger.warn(`DRF email sync error: ${msg}`);
    }
  } finally {
    try { lock.release(); } catch { /* already released */ }
  }

  try { await client.logout(); } catch { /* ignore */ }

  return result;
}
