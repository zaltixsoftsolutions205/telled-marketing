import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import path from 'path';
import User from '../models/User';
import { decryptText } from '../utils/crypto';
import logger from '../utils/logger';

export interface EmailAttachment {
  filename: string;
  buffer: Buffer;
  contentType: string;
}

export interface POEmail {
  uid: string;
  subject: string;
  from: string;
  fromEmail: string;
  fromDomain: string;
  date: Date;
  body: string;
  attachments: EmailAttachment[];
}

// Strict PO subject keywords — must clearly be a purchase order
const PO_SUBJECT_KEYWORDS = [
  'purchase order',
  'po#',
  'po no',
  'po number',
  'p.o. no',
  'p.o.#',
  'work order',
  'gem order',
  'gem po',
];

// Emails with these subjects are NOT purchase orders — skip them
const NON_PO_SUBJECT_KEYWORDS = [
  'quotation', 'quote', 'proposal', 'estimation', 'estimate',
  'invoice', 'bill', 'receipt', 'payment', 'proforma',
  'drf', 'approval', 'approved', 'rejected', 'clearance',
  'price clearance', 'greetings', 'newsletter', 'unsubscribe',
  'meeting', 'demo', 'follow up', 'follow-up', 'introduction',
  're: qt', 'qt0', 'fwd: qt',
];

function isPOSubject(subject: string): boolean {
  const lower = subject.toLowerCase();
  // First reject anything that looks like a non-PO email
  if (NON_PO_SUBJECT_KEYWORDS.some(kw => lower.includes(kw))) return false;
  return PO_SUBJECT_KEYWORDS.some(kw => lower.includes(kw));
}

function isPOBody(body: string): boolean {
  const lower = body.toLowerCase();
  // Reject if body is clearly about a quotation or invoice
  if (/\bquotation\b|\bquote\s+no\b|\binvoice\s+no\b/.test(lower)) return false;
  const bodyKeywords = [
    'purchase order',
    'po attached',
    /please\s+find.*\bpo\b/.source,
    /herewith.*\bpo\b/.source,
    'po no.',
    'po number',
  ];
  return bodyKeywords.some(kw => new RegExp(kw).test(lower));
}

function deriveImapHost(smtpHost: string): string {
  if (!smtpHost) return '';
  // Common SMTP→IMAP mappings
  const map: Record<string, string> = {
    'smtp.hostinger.com':    'imap.hostinger.com',
    'smtp-mail.outlook.com': 'outlook.office365.com',
    'smtp.office365.com':    'outlook.office365.com',
    'smtp.gmail.com':        'imap.gmail.com',
    'smtp.zoho.com':         'imap.zoho.com',
    'smtp.zoho.in':          'imappro.zoho.in',
    'email-smtp.amazonaws.com': '',
  };
  if (map[smtpHost]) return map[smtpHost];
  // Generic: replace smtp with imap
  return smtpHost.replace(/^smtp[.-]/i, 'imap.');
}

export async function readPOEmailsForUser(
  userId: string,
  daysBack = 60,
): Promise<POEmail[]> {
  const user = await User.findById(userId)
    .select('smtpHost smtpUser smtpPass')
    .lean();

  if (!user?.smtpUser || !user?.smtpPass) {
    throw new Error('Email not configured. Please set SMTP credentials in your profile.');
  }

  // Derive IMAP settings from the same credentials used for sending email
  const imapHost = deriveImapHost((user as any).smtpHost || '');
  if (!imapHost) throw new Error('Cannot determine IMAP host from your email configuration. Please contact admin.');

  const imapPort   = 993;
  const imapSecure = true;
  const imapUser   = (user as any).smtpUser;
  let   imapPass: string;
  try { imapPass = decryptText((user as any).smtpPass); } catch { imapPass = (user as any).smtpPass; }

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: imapSecure,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
    tls: { rejectUnauthorized: false },
    socketTimeout: 30000,
    greetingTimeout: 15000,
  });

  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  const results: POEmail[] = [];

  try {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    // Search emails with PO-related subjects OR body keywords
    const uidsResult = await client.search({ since }, { uid: true });
    const uids: number[] = Array.isArray(uidsResult) ? uidsResult : [];
    logger.info(`[IMAP] Found ${uids.length} emails in last ${daysBack} days`);

    // Process up to 200 most recent emails
    const toProcess = uids.slice(-200);

    for (const uid of toProcess) {
      try {
        const stream = await client.download(String(uid), undefined, { uid: true });
        if (!stream?.content) continue;

        const chunks: Buffer[] = [];
        for await (const chunk of stream.content) chunks.push(chunk as Buffer);
        const raw = Buffer.concat(chunks);

        const parsed = await simpleParser(raw);
        const subject = parsed.subject || '';
        const bodyText = parsed.text || '';

        // Filter: keep only emails where subject or body explicitly looks like a PO
        // (don't use attachment presence alone — too many false positives)
        if (!isPOSubject(subject) && !isPOBody(bodyText)) continue;

        const fromAddr = parsed.from?.value?.[0]?.address || '';
        const fromDomain = fromAddr.includes('@') ? fromAddr.split('@')[1] : '';

        const attachments: EmailAttachment[] = (parsed.attachments || [])
          .filter(att => {
            const ext = path.extname(att.filename || '').toLowerCase();
            return ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif', '.docx', '.doc'].includes(ext);
          })
          .map(att => ({
            filename: att.filename || 'attachment',
            buffer:   att.content as Buffer,
            contentType: att.contentType || 'application/octet-stream',
          }));

        results.push({
          uid:        String(uid),
          subject,
          from:       parsed.from?.text || '',
          fromEmail:  fromAddr,
          fromDomain,
          date:       parsed.date || new Date(),
          body:       bodyText,
          attachments,
        });
      } catch (e) {
        logger.warn(`[IMAP] Failed to parse email uid=${uid}:`, e);
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }

  logger.info(`[IMAP] Filtered ${results.length} PO-related emails`);
  return results;
}
