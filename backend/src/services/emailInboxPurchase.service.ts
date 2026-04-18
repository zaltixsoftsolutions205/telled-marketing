import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import PurchaseOrder from '../models/PurchaseOrder';
import Lead from '../models/Lead';
import User from '../models/User';
import logger from '../utils/logger';
import { generatePONumber } from '../utils/helpers';
import mongoose from 'mongoose';

export interface ImapCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
}

// ── PO detection keywords ─────────────────────────────────────────────────────
const PO_KEYWORDS = [
  'purchase order', 'purchase order number', 'po number', 'po#', 'po #',
  'order confirmation', 'order acknowledgment', 'sales order',
  'purchase order received', 'new purchase order', 'po confirmation',
  'purchase confirmation', 'please find our purchase order',
  'please find the purchase order', 'purchase order attached', 'po attached',
  'vendor order', 'supply order', 'work order', 'indent', 'procurement order',
  'material request', 'order placement', 'confirmed order',
  // Indian business formats
  'p.o.', 'p/o', 'purchase indent', 'supply indent', 'order copy',
  'आर्डर', 'खरीद आदेश', 'po copy', 'po document',
  // Scanned copy indicators
  'scanned copy', 'scan copy', 'please find attached', 'attached herewith',
  'find enclosed', 'enclosed herewith',
];

// ── PO number extraction ──────────────────────────────────────────────────────
const PO_NUMBER_PATTERNS = [
  /PO(?:[-\s]?#?)(?:[-\s]?)([A-Z0-9/-]{3,25})/gi,
  /Purchase\s+Order\s+(?:No\.?|Number|#)?\s*[:\s-]*([A-Z0-9/-]{3,25})/gi,
  /Order\s+(?:No\.?|Number|#)?\s*[:\s-]*([A-Z0-9/-]{3,25})/gi,
  /P\.?O\.?\s*[:#]?\s*([A-Z0-9/-]{3,25})/gi,
  /\[PO#?\s*([A-Z0-9/-]{3,25})\]/gi,
  /Indent\s+(?:No\.?|Number)?\s*[:\s-]*([A-Z0-9/-]{3,25})/gi,
  /Work\s+Order\s+(?:No\.?|#)?\s*[:\s-]*([A-Z0-9/-]{3,25})/gi,
  /Ref(?:erence)?\s+(?:No\.?|#)?\s*[:\s-]*([A-Z0-9/-]{3,25})/gi,
];

// ── Amount / currency extraction ──────────────────────────────────────────────
const AMOUNT_PATTERNS = [
  /(?:Total|Amount|Order\s+Total|Invoice\s+Total|Grand\s+Total|Net\s+Total|Sub\s+Total|Value)\s*[:\s]*(?:INR|USD|EUR|GBP|AED|SGD|₹|\$|€|£)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
  /(?:INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi,
  /(?:USD|\$)\s*([\d,]+(?:\.\d{1,2})?)/gi,
  /(?:EUR|€)\s*([\d,]+(?:\.\d{1,2})?)/gi,
  /([\d,]+(?:\.\d{1,2})?)\s*(?:INR|USD|EUR|₹|\$)/gi,
];

const CURRENCY_PATTERNS: Array<[RegExp, string]> = [
  [/\bINR\b|₹/gi, 'INR'],
  [/\bUSD\b|\$/g, 'USD'],
  [/\bEUR\b|€/g, 'EUR'],
  [/\bGBP\b|£/g, 'GBP'],
  [/\bAED\b/g, 'AED'],
];

// ── Payment terms extraction ──────────────────────────────────────────────────
const PAYMENT_TERMS_PATTERNS = [
  /Payment\s+Terms?\s*[:\-]?\s*([^\n.]{3,60})/gi,
  /Terms?\s+of\s+Payment\s*[:\-]?\s*([^\n.]{3,60})/gi,
  /(?:Net|Due)\s+(\d{1,3})\s*(?:days?|d\b)/gi,
  /(\d{1,3})%?\s*advance[^\n.]{0,40}/gi,
  /(?:50|30|40|60|70|80|100)\s*%\s*(?:advance|upfront|prepaid|on delivery|on dispatch)/gi,
  /LC\s*at\s*sight|Letter\s+of\s+Credit/gi,
  /COD|Cash\s+on\s+Delivery/gi,
  /(?:30|60|90|120)\s*days?\s+(?:credit|from\s+invoice)/gi,
  /(?:Immediate|Advance|Net\s+30|Net\s+60|Net\s+90|Net\s+45)/gi,
];

// ── Vendor/company extraction ─────────────────────────────────────────────────
const VENDOR_PATTERNS = [
  /(?:Company|Vendor|Supplier|Seller|Buyer|Customer|Purchaser|Bill\s+To|Ship\s+To)\s*[:\-]\s*([A-Za-z0-9\s&.,'-]{2,80}?)(?:\n|,(?!\d)|$)/gi,
  /(?:Regards|Thanks|Thank\s+you|Sincerely|Best\s+regards)[,.\s]*\r?\n\s*([A-Za-z][A-Za-z0-9\s&.'-]{2,60})/gi,
  /^([A-Z][A-Za-z\s&.'-]{5,60}(?:Ltd\.?|Pvt\.?|Limited|Inc\.?|Corp\.?|LLP|Co\.?|Industries|Enterprises|Solutions|Technologies|Systems))/gm,
];

// ── Product extraction ────────────────────────────────────────────────────────
const PRODUCT_PATTERNS = [
  /(?:Product|Item|Description|Material|Goods|Services?|Scope\s+of\s+Work|Subject)\s*[:\-]\s*([A-Za-z0-9\s&.,\/-]{3,200}?)(?:\n|$)/gi,
  /(?:Supply\s+of|Purchase\s+of|Procurement\s+of)\s+([A-Za-z0-9\s&.,\/-]{3,150}?)(?:\n|\.|,|$)/gi,
];

// ── Date extraction ───────────────────────────────────────────────────────────
const DATE_PATTERNS = [
  /(?:PO\s+Date|Order\s+Date|Date\s+of\s+Order|Dated?|Issue\s+Date)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
  /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/g,
  /(\d{4}-\d{2}-\d{2})/g,
  /(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})/gi,
];

export interface PurchaseOrderEmailResult {
  scanned: number;
  processed: number;
  created: string[];
  updated: string[];
  skipped: string[];
  errors: string[];
}

// ── Text utilities ────────────────────────────────────────────────────────────
function rawEmailToText(source: Buffer): string {
  let text = source.toString('utf8');
  text = text.replace(/=\r?\n/g, '');
  text = text.replace(/=[0-9A-Fa-f]{2}/g, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\s+/g, ' ');
  return text;
}

function stripQuotedContent(text: string): string {
  const lines = text.split(/\r?\n/);
  const fresh: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^On .{5,100} wrote:/i.test(t)) break;
    if (t.startsWith('>')) break;
    if (/^-{3,}\s*(Forwarded|Original)/i.test(t)) break;
    if (/^From:\s+/i.test(t) && fresh.length > 2) break;
    fresh.push(line);
  }
  return fresh.join(' ');
}

// ── OCR scanned PDF/image attachment ─────────────────────────────────────────
async function ocrImage(buf: Buffer): Promise<string> {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(buf);
    await worker.terminate();
    return text;
  } catch (e) {
    logger.warn('Tesseract OCR failed:', (e as Error).message);
    return '';
  }
}

async function ocrScannedPdf(_pdfBuf: Buffer): Promise<string> {
  // canvas/pdfjs-dist removed — scanned PDFs return empty text
  return '';
}

async function ocrAttachment(attachment: Attachment): Promise<string> {
  try {
    const contentType = attachment.contentType || '';
    const content = attachment.content;
    if (!content) return '';
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content as any);

    if (contentType.startsWith('image/')) {
      const text = await ocrImage(buf);
      logger.info(`OCR image: ${text.length} chars`);
      return text;
    }

    if (contentType === 'application/pdf') {
      // Try text extraction first (fast)
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const parsed = await pdfParse(buf);
        if (parsed.text && parsed.text.trim().length > 50) {
          logger.info(`PDF text: ${parsed.text.length} chars`);
          return parsed.text;
        }
        // Text extraction got very little — scanned PDF, fall through to OCR
        logger.info('PDF has little text — trying page OCR');
      } catch { /* fall through to OCR */ }

      const text = await ocrScannedPdf(buf);
      logger.info(`PDF OCR: ${text.length} chars`);
      return text;
    }

    if (contentType.includes('word') || contentType.includes('officedocument') || contentType.includes('msword')) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: buf });
      logger.info(`DOCX: ${result.value.length} chars`);
      return result.value;
    }
  } catch (e) {
    logger.warn('Attachment parsing failed:', (e as Error).message);
  }
  return '';
}

// ── Extractor functions ───────────────────────────────────────────────────────
function extractPONumber(text: string): string | null {
  for (const pat of PO_NUMBER_PATTERNS) {
    pat.lastIndex = 0;
    const m = pat.exec(text);
    if (m?.[1]) {
      pat.lastIndex = 0;
      const num = m[1].trim().toUpperCase();
      if (num.length >= 3 && num.length <= 25) return num;
    }
    pat.lastIndex = 0;
  }
  return null;
}

function extractAmount(text: string): number | null {
  for (const pat of AMOUNT_PATTERNS) {
    pat.lastIndex = 0;
    const m = pat.exec(text);
    if (m?.[1]) {
      const amount = parseFloat(m[1].replace(/,/g, ''));
      pat.lastIndex = 0;
      if (!isNaN(amount) && amount > 0) return amount;
    }
    pat.lastIndex = 0;
  }
  return null;
}

function extractCurrency(text: string): string {
  for (const [pat, code] of CURRENCY_PATTERNS) {
    pat.lastIndex = 0;
    if (pat.test(text)) { pat.lastIndex = 0; return code; }
    pat.lastIndex = 0;
  }
  return 'INR';
}

function extractPaymentTerms(text: string): string | null {
  for (const pat of PAYMENT_TERMS_PATTERNS) {
    pat.lastIndex = 0;
    const m = pat.exec(text);
    if (m) {
      pat.lastIndex = 0;
      const term = (m[1] || m[0]).trim().replace(/\s+/g, ' ');
      if (term.length >= 3 && term.length <= 100) return term;
    }
    pat.lastIndex = 0;
  }
  return null;
}

function extractVendorName(text: string, fromName: string, fromEmail: string, imapUser: string): string | null {
  for (const pat of VENDOR_PATTERNS) {
    pat.lastIndex = 0;
    for (const m of [...text.matchAll(pat)]) {
      if (m?.[1]) {
        const name = m[1].trim().replace(/[,.]$/, '').replace(/\s+/g, ' ');
        const skip = ['please', 'confirm', 'order', 'purchase', 'regards', 'thanks', 'thank', 'best', 'sincerely', 'email', 'phone', 'address'];
        if (name.length > 2 && name.length < 100 && !skip.includes(name.toLowerCase())) {
          pat.lastIndex = 0;
          return name;
        }
      }
    }
    pat.lastIndex = 0;
  }
  if (fromName && fromName.length > 2 && fromName.length < 80) return fromName;
  if (fromEmail && fromEmail !== imapUser) return fromEmail.split('@')[0];
  return null;
}

function extractVendorEmail(text: string, fromEmail: string, imapUser: string): string | null {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (m && m[0] !== imapUser) return m[0];
  if (fromEmail && fromEmail !== imapUser) return fromEmail;
  return null;
}

function extractProduct(text: string): string | null {
  for (const pat of PRODUCT_PATTERNS) {
    pat.lastIndex = 0;
    const m = pat.exec(text);
    if (m?.[1]) {
      const p = m[1].trim();
      pat.lastIndex = 0;
      if (p.length > 2 && p.length < 300) return p;
    }
    pat.lastIndex = 0;
  }
  return null;
}

function extractReceivedDate(text: string): Date | null {
  for (const pat of DATE_PATTERNS) {
    pat.lastIndex = 0;
    const m = pat.exec(text);
    if (m?.[1]) {
      const d = new Date(m[1]);
      pat.lastIndex = 0;
      if (!isNaN(d.getTime())) return d;
    }
    pat.lastIndex = 0;
  }
  return null;
}

// ── Email classification ──────────────────────────────────────────────────────
function isPurchaseOrderEmail(subject: string, body: string): boolean {
  const combined = (subject + ' ' + body).toLowerCase();
  return PO_KEYWORDS.some(k => combined.includes(k));
}

function hasAttachmentIndicator(subject: string, body: string): boolean {
  const combined = (subject + ' ' + body).toLowerCase();
  return /attached|attachment|enclosed|herewith|find\s+(the|our|attached|enclosed)|scan/.test(combined);
}

const PRICE_CLEARANCE_KEYWORDS = [
  'price clearance', 'price approved', 'clearance approved', 'price confirmation',
  'price confirmed', 'rate approved', 'rate clearance', 'approved price', 'price ok',
  'clearance', 're: po', 're:po',
];

const ARK_INVOICE_KEYWORDS = [
  'invoice', 'bill', 'tax invoice', 'proforma invoice', 'performa invoice',
  'invoice attached', 'please find invoice', 'invoice for po',
];

function isPriceClearanceEmail(subject: string, body: string): boolean {
  const combined = (subject + ' ' + body).toLowerCase();
  return PRICE_CLEARANCE_KEYWORDS.some(k => combined.includes(k));
}

function isArkInvoiceEmail(subject: string, body: string): boolean {
  const combined = (subject + ' ' + body).toLowerCase();
  return ARK_INVOICE_KEYWORDS.some(k => combined.includes(k));
}

// ── Lead matching ─────────────────────────────────────────────────────────────
async function findLeadByVendorInfo(
  vendorName: string | null,
  vendorEmail: string | null,
  fromDomain: string,
): Promise<any | null> {
  // 1. Match by exact email
  if (vendorEmail) {
    const lead = await Lead.findOne({
      $or: [{ email: { $regex: new RegExp(vendorEmail, 'i') } }, { oemEmail: { $regex: new RegExp(vendorEmail, 'i') } }],
      isArchived: false,
    });
    if (lead) return lead;
  }

  // 2. Match by sender email domain (e.g. tata.com → leads with tata emails)
  if (fromDomain && fromDomain.length > 4) {
    const lead = await Lead.findOne({
      $or: [
        { email: { $regex: new RegExp('@' + fromDomain.replace(/\./g, '\\.'), 'i') } },
        { oemEmail: { $regex: new RegExp('@' + fromDomain.replace(/\./g, '\\.'), 'i') } },
      ],
      isArchived: false,
    });
    if (lead) { logger.info(`Matched lead by domain ${fromDomain}: ${lead.companyName}`); return lead; }

    // 3. Match company name from domain (strip TLD and common words)
    const domainName = fromDomain.split('.')[0].replace(/[-_]/g, ' ');
    if (domainName.length > 2) {
      const lead = await Lead.findOne({
        companyName: { $regex: new RegExp(domainName, 'i') },
        isArchived: false,
      });
      if (lead) { logger.info(`Matched lead by domain name "${domainName}": ${lead.companyName}`); return lead; }
    }
  }

  // 4. Match by vendor name
  if (vendorName && vendorName.length > 2) {
    const lead = await Lead.findOne({
      $or: [
        { companyName: { $regex: new RegExp(vendorName, 'i') } },
        { oemName: { $regex: new RegExp(vendorName, 'i') } },
        { contactPersonName: { $regex: new RegExp(vendorName, 'i') } },
      ],
      isArchived: false,
    }).sort({ createdAt: -1 });
    if (lead) return lead;
  }

  return null;
}

async function findPOByArkEmail(fromEmail: string, text: string): Promise<any | null> {
  const poNumber = extractPONumber(text);
  if (poNumber) {
    const po = await PurchaseOrder.findOne({ poNumber, isArchived: false });
    if (po) return po;
  }
  if (fromEmail) {
    return PurchaseOrder.findOne({
      vendorEmail: { $regex: new RegExp(fromEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      isArchived: false,
      poForwardedToArk: true,
    }).sort({ createdAt: -1 });
  }
  return null;
}

// ── Main sync function ────────────────────────────────────────────────────────
export async function syncPurchaseOrderEmails(
  creds?: ImapCredentials,
  syncedByUserId?: string,
): Promise<PurchaseOrderEmailResult> {
  const result: PurchaseOrderEmailResult = {
    scanned: 0, processed: 0, created: [], updated: [], skipped: [], errors: [],
  };

  const imapUser = creds?.user || process.env.SUPPORT_EMAIL_USER || process.env.SMTP_USER || '';
  const imapPass = creds?.pass || process.env.SUPPORT_EMAIL_PASS || process.env.SMTP_PASS || '';
  const imapHost = creds?.host || process.env.SUPPORT_EMAIL_HOST || 'imap.hostinger.com';
  const imapPort = creds?.port || parseInt(process.env.SUPPORT_EMAIL_PORT || '993');

  if (!imapUser || !imapPass) {
    result.errors.push('IMAP credentials not configured. Set up your email in Email Configuration.');
    return result;
  }

  // Resolve default uploader (the sales user whose inbox we're reading, or any admin)
  let defaultUploaderId: mongoose.Types.ObjectId | undefined;
  if (syncedByUserId) {
    defaultUploaderId = new mongoose.Types.ObjectId(syncedByUserId);
  } else {
    const admin = await User.findOne({ role: 'admin', isActive: true }).select('_id');
    if (admin) defaultUploaderId = admin._id as mongoose.Types.ObjectId;
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
    if (/socket|ECONNRESET|closed|EPIPE/i.test(err.message)) {
      logger.warn('IMAP connection closed by server (harmless)');
    } else {
      logger.error('ImapFlow PO sync error:', err.message);
    }
  });

  try {
    await client.connect();
    logger.info(`IMAP connected for PO sync: ${imapUser}`);
  } catch (connErr) {
    result.errors.push(`IMAP connect failed: ${(connErr as Error).message}`);
    return result;
  }

  const lock = await client.getMailboxLock('INBOX');
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const uids: number[] = await (client as any).search({ since }, { uid: true });
    if (!uids || uids.length === 0) {
      result.skipped.push('No emails in last 30 days');
      lock.release();
      await client.logout();
      return result;
    }

    logger.info(`PO sync (${imapUser}): ${uids.length} messages`);

    for await (const msg of client.fetch(uids, { envelope: true, source: true }, { uid: true })) {
      result.scanned++;
      try {
        const subject   = msg.envelope?.subject || '';
        const fromName  = msg.envelope?.from?.[0]?.name || '';
        const fromEmail = (msg.envelope?.from?.[0]?.address || '').toLowerCase();
        const fromDomain = fromEmail.split('@')[1] || '';

        // Skip bounces and system senders
        if (/mailer-daemon|postmaster|no-reply|noreply|bounce|notification@|alerts@/i.test(fromEmail)) continue;
        if (/undelivered|delivery.*failed|bounce|mail delivery|returned mail/i.test(subject)) continue;

        // Parse full MIME (gets attachment objects)
        const parsed: ParsedMail = await simpleParser(msg.source || Buffer.alloc(0));
        const bodyText = parsed.text || rawEmailToText(msg.source || Buffer.alloc(0));
        const freshText = subject + ' ' + stripQuotedContent(bodyText);

        // ── Always read ALL parseable attachments before any decision ───────────
        let attachmentText = '';
        const hasReadableAttachment = parsed.attachments?.some(a => {
          const ct = a.contentType || '';
          return ct.startsWith('image/') || ct === 'application/pdf' ||
            ct.includes('word') || ct.includes('officedocument');
        }) ?? false;

        if (parsed.attachments?.length) {
          for (const att of parsed.attachments) {
            const ct = att.contentType || '';
            if (
              ct.startsWith('image/') ||
              ct === 'application/pdf' ||
              ct.includes('word') ||
              ct.includes('officedocument')
            ) {
              const ocr = await ocrAttachment(att);
              if (ocr) attachmentText += ' ' + ocr;
            }
          }
        }

        const fullText = freshText + ' ' + attachmentText;

        // ── Price clearance from ARK ──────────────────────────────────────────
        if (isPriceClearanceEmail(subject, bodyText) && !isPurchaseOrderEmail(subject, fullText)) {
          const po = await findPOByArkEmail(fromEmail, fullText);
          if (po && !po.priceClearanceReceived) {
            await PurchaseOrder.findByIdAndUpdate(po._id, {
              priceClearanceReceived: true,
              priceClearanceReceivedAt: new Date(),
            });
            result.updated.push(`${po.poNumber} (price clearance)`);
            result.processed++;
          } else {
            result.skipped.push(`Price clearance from ${fromEmail} — no matching PO`);
          }
          continue;
        }

        // ── ARK invoice ───────────────────────────────────────────────────────
        if (isArkInvoiceEmail(subject, bodyText) && !isPurchaseOrderEmail(subject, fullText)) {
          const po = await findPOByArkEmail(fromEmail, fullText);
          if (po && po.poSentToArk && !po.arkInvoiceReceived) {
            const invoiceAmount = extractAmount(fullText);
            await PurchaseOrder.findByIdAndUpdate(po._id, {
              arkInvoiceReceived: true,
              arkInvoiceReceivedAt: new Date(),
              ...(invoiceAmount ? { arkInvoiceAmount: invoiceAmount } : {}),
            });
            result.updated.push(`${po.poNumber} (ARK invoice)`);
            result.processed++;
          } else {
            result.skipped.push(`Invoice from ${fromEmail} — no matching PO awaiting ARK invoice`);
          }
          continue;
        }

        // ── Decide if this is a PO email ─────────────────────────────────────
        // 1. PO keywords found anywhere (subject, body, or attachment text)
        const keywordMatch = isPurchaseOrderEmail(subject, fullText);

        // 2. Has readable attachment + sender is a known lead (even with no keywords)
        const knownSender = hasReadableAttachment && !keywordMatch
          ? !!(await Lead.findOne({
              $or: [
                { email: { $regex: new RegExp(fromEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
                { oemEmail: { $regex: new RegExp(fromEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
                { email: { $regex: new RegExp('@' + fromDomain.replace(/\./g, '\\.'), 'i') } },
              ],
              isArchived: false,
            }))
          : false;

        // 3. Attachment has content but subject/body empty — treat if attachment has any PO-like data
        const attachmentOnly = hasReadableAttachment && attachmentText.length > 100 &&
          !keywordMatch && !knownSender &&
          isPurchaseOrderEmail('', attachmentText);

        if (!keywordMatch && !knownSender && !attachmentOnly) continue;

        // ── Extract fields ────────────────────────────────────────────────────
        const poNumber    = extractPONumber(fullText);
        const amount      = extractAmount(fullText);
        const currency    = extractCurrency(fullText);
        const vendorName  = extractVendorName(fullText, fromName, fromEmail, imapUser);
        const vendorEmail = extractVendorEmail(fullText, fromEmail, imapUser);
        const product     = extractProduct(fullText);
        const receivedDate = extractReceivedDate(fullText) || new Date();
        const paymentTerms = extractPaymentTerms(fullText);

        logger.info(`PO sync extract — PO:${poNumber} Amt:${amount} ${currency} Vendor:${vendorName} Terms:${paymentTerms}`);

        // ── Lead matching ─────────────────────────────────────────────────────
        let lead = await findLeadByVendorInfo(vendorName, vendorEmail, fromDomain);

        if (!lead && fromEmail) {
          lead = await Lead.findOne({
            $or: [{ email: new RegExp(fromEmail, 'i') }, { oemEmail: new RegExp(fromEmail, 'i') }],
            isArchived: false,
          });
        }

        // Auto-create lead if not found
        if (!lead) {
          const companyName = vendorName || fromName || fromDomain.split('.')[0] || 'Unknown Vendor';
          const admin = await User.findOne({ role: 'admin', isActive: true });
          if (admin) {
            lead = await new Lead({
              companyName,
              contactName: fromName || fromEmail.split('@')[0] || 'Unknown',
              email: vendorEmail || fromEmail || 'unknown@unknown.com',
              phone: 'N/A',
              status: 'New',
              stage: 'PO Received',
              assignedTo: syncedByUserId ? new mongoose.Types.ObjectId(syncedByUserId) : admin._id,
              isArchived: false,
              notes: `Auto-created from PO email (${fromEmail}) — ${new Date().toISOString()}`,
            }).save();
          }
        }

        if (!lead) {
          result.skipped.push(`${poNumber || 'Unknown'} — could not create lead`);
          continue;
        }

        // ── Upsert PO ─────────────────────────────────────────────────────────
        const existingPO = poNumber ? await PurchaseOrder.findOne({ poNumber }) : null;

        if (existingPO) {
          const upd: any = {};
          if (amount && !existingPO.amount) upd.amount = amount;
          if (product && !existingPO.product) upd.product = product;
          if (paymentTerms && !existingPO.paymentTerms) upd.paymentTerms = paymentTerms;
          if (currency) upd.currency = currency;

          if (Object.keys(upd).length) {
            await PurchaseOrder.findByIdAndUpdate(existingPO._id, upd);
            result.updated.push(existingPO.poNumber);
          } else {
            result.skipped.push(`${existingPO.poNumber} — already exists, no new data`);
          }
        } else {
          const finalPO = poNumber || generatePONumber();
          await new PurchaseOrder({
            leadId:         lead._id,
            poNumber:       finalPO,
            amount:         amount || 0,
            product:        product || '',
            vendorName:     vendorName || '',
            vendorEmail:    vendorEmail || '',
            receivedDate,
            paymentTerms:   paymentTerms || undefined,
            currency,
            syncedFromEmail: imapUser,
            notes: `Auto-created from email\nSubject: ${subject}\nFrom: ${fromEmail}\n${new Date().toISOString()}`,
            uploadedBy:     defaultUploaderId || new mongoose.Types.ObjectId(),
            converted:      false,
            isArchived:     false,
          }).save();

          await Lead.findByIdAndUpdate(lead._id, { stage: 'PO Received' });
          result.created.push(finalPO);
          logger.info(`Created PO ${finalPO} for ${lead.companyName} from ${fromEmail}`);
        }

        result.processed++;
      } catch (msgErr) {
        result.errors.push(`uid ${msg.uid}: ${(msgErr as Error).message}`);
        logger.error('PO email msg error:', msgErr);
      }
    }

  } catch (err) {
    result.errors.push(`Sync error: ${(err as Error).message}`);
    logger.error('PO sync error:', err);
  } finally {
    lock.release();
  }

  try { await client.logout(); } catch { /* ignore */ }

  logger.info(`PO Sync (${imapUser}): scanned=${result.scanned} created=${result.created.length} updated=${result.updated.length} skipped=${result.skipped.length} errors=${result.errors.length}`);
  return result;
}
