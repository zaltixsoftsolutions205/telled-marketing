import path from 'path';
import logger from '../utils/logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

export interface ExtractedPO {
  // Core fields
  poNumber?: string;
  amount?: number;
  vendorName?: string;
  vendorEmail?: string;
  vendorDomain?: string;
  product?: string;
  receivedDate?: string;
  // Payment & delivery
  paymentTerms?: string;
  deliveryTerms?: string;
  // Address
  billingAddress?: string;
  // Extra intel
  gstNumber?: string;
  contactPerson?: string;
  currency?: string;
  // Meta
  rawText: string;
  confidence: number;         // 0–100
  isScanned: boolean;
  sourceFile?: string;
  parseMethod: string;
}

// ── Text helpers ───────────────────────────────────────────────────────────

function cleanAmt(s: string): number {
  return parseFloat(s.replace(/,/g, '').replace(/[^\d.]/g, ''));
}

function first(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
}

// ── PO Number extraction ───────────────────────────────────────────────────

function extractPONumber(text: string): string | undefined {
  return first(text, [
    /(?:purchase\s+order\s*(?:no\.?|number|#|num))\s*[:\-]?\s*([A-Z0-9\/\-_]{3,30})/i,
    /\bP\.?O\.?\s*(?:no\.?|number|#|:)\s*([A-Z0-9\/\-_]{3,30})/i,
    /\bPO[-#\s]([A-Z0-9\/\-_]{3,20})\b/i,
    /(?:order\s*(?:no\.?|number|#))\s*[:\-]?\s*([A-Z0-9\/\-_]{3,30})/i,
    /(?:work\s+order|indent\s*(?:no\.?|#))\s*[:\-]?\s*([A-Z0-9\/\-_]{3,30})/i,
    /(?:gem[-\s]?order|gem\s*po)\s*[:\-]?\s*([A-Z0-9\/\-_]{3,30})/i,
  ]);
}

// ── Amount extraction ──────────────────────────────────────────────────────

function extractAmount(text: string): number | undefined {
  const NUM = `([\\d,]+(?:\\.\\d{1,2})?)`;
  const CUR = `(?:Rs\\.?|INR|₹|USD|\\$)?\\s*`;

  // Pass 1: labelled total
  const labelPatterns = [
    new RegExp(`(?:grand\\s+total|total\\s+amount|net\\s+total|invoice\\s+total|amount\\s+payable|payable\\s+amount|order\\s+value|po\\s+value)\\s*[:\\-=]?\\s*${CUR}${NUM}`, 'gi'),
    new RegExp(`final\\s+(?:price|amount|total|value)\\s*[:\\-=]?\\s*${CUR}${NUM}`, 'gi'),
    new RegExp(`(?:^|\\n)[\\t ]*(?:Total|TOTAL)\\s*[:\\-=]?\\s*${CUR}${NUM}`, 'gim'),
  ];
  for (const re of labelPatterns) {
    const all = [...text.matchAll(re)];
    if (all.length) {
      const v = cleanAmt(all[all.length - 1][1] || '');
      if (!isNaN(v) && v > 0) return v;
    }
  }

  // Pass 2: label then newline
  const nlPatterns = [
    /(?:grand\s+total|total\s+amount|net\s+total|invoice\s+total|amount\s+payable|final\s+(?:price|amount|total)|order\s+value)\s*[:\-=]?\s*\n\s*/gi,
    /(?:^|\n)[\t ]*(?:Total|TOTAL)\s*[:\-=]?\s*\n\s*/gim,
  ];
  for (const lre of nlPatterns) {
    for (const m of text.matchAll(lre)) {
      const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 50);
      const nm = after.match(new RegExp(`^${CUR}${NUM}`));
      if (nm?.[1]) { const v = cleanAmt(nm[1]); if (!isNaN(v) && v > 0) return v; }
    }
  }

  // Pass 3: last currency amount in document
  const allCur = [...text.matchAll(new RegExp(`(?:INR|Rs\\.?|₹|\\$)\\s*${NUM}`, 'gi'))];
  if (allCur.length) {
    const v = cleanAmt(allCur[allCur.length - 1][1]);
    if (!isNaN(v) && v > 0) return v;
  }
}

// ── Payment terms extraction ───────────────────────────────────────────────

function extractPaymentTerms(text: string): string | undefined {
  return first(text, [
    /(?:payment\s+terms?|terms?\s+of\s+payment|payment\s+conditions?)\s*[:\-]?\s*(.{5,120}?)(?:\n|$)/i,
    /\bnet\s+(\d+)\s*(?:days?|d)\b/i,
    /(\d+)\s*days?\s*(?:from\s+(?:invoice|delivery|dispatch|date\s+of\s+purchase\s+order))/i,
    /(?:advance|advance\s+payment|100%\s+advance)\s*(.{0,60}?)(?:\n|$)/i,
    /(?:lc\s+at\s+sight|letter\s+of\s+credit)\s*(.{0,60}?)(?:\n|$)/i,
    /(?:30|45|60|90)\s*days?\s*credit/i,
  ]);
}

// ── Vendor / company extraction ────────────────────────────────────────────

function extractVendorName(text: string, fromEmail: string): string | undefined {
  // Try from text
  const fromText = first(text, [
    /(?:from|vendor|supplier|party)\s*[:\-]\s*([A-Z][A-Za-z\s&.,()-]{3,60}?)(?:\n|$)/i,
    /(?:dear\s+)([A-Z][A-Za-z\s&.,()-]{3,50}?)\s*[,\n]/i,
    /^([A-Z][A-Za-z\s&.,()-]{3,50}(?:pvt\.?\s*ltd\.?|limited|inc\.?|corp\.?|llp|llc))(?:\n|$)/im,
  ]);
  if (fromText) return fromText;

  // Fall back to email domain → company name guess
  if (fromEmail?.includes('@')) {
    const domain = fromEmail.split('@')[1];
    return domain.split('.')[0].replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
  }
}

// ── Contact person ─────────────────────────────────────────────────────────

function extractContact(text: string): string | undefined {
  return first(text, [
    /(?:contact|authorized\s+by|signed\s+by|prepared\s+by|attn\.?|attention)\s*[:\-]?\s*([A-Z][a-zA-Z\s.]{3,40}?)(?:\n|$)/i,
    /(?:dear\s+(?:mr\.?|ms\.?|mrs\.?))\s*([A-Z][a-zA-Z\s.]{2,30}?)(?:,|\n)/i,
  ]);
}

// ── GST Number ────────────────────────────────────────────────────────────

function extractGST(text: string): string | undefined {
  return first(text, [
    /(?:gstin|gst\s*(?:no\.?|number|#))\s*[:\-]?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i,
    /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/,
  ]);
}

// ── Product description ────────────────────────────────────────────────────

function extractProduct(text: string): string | undefined {
  return first(text, [
    /(?:description\s+of\s+(?:goods|items?|services?)|items?\s+description|product\s+description)\s*[:\-]?\s*(.{5,120}?)(?:\n|$)/i,
    /(?:sub(?:ject)?|regarding|re)\s*[:\-]\s*(?:supply\s+of\s+)?(.{5,100}?)(?:\n|$)/i,
    /(?:for\s+supply\s+of|supply\s+of)\s+(.{5,120}?)(?:\n|$)/i,
  ]);
}

// ── Delivery terms ────────────────────────────────────────────────────────

function extractDelivery(text: string): string | undefined {
  return first(text, [
    /(?:delivery\s+terms?|delivery\s+conditions?|shipment\s+terms?)\s*[:\-]?\s*(.{5,100}?)(?:\n|$)/i,
    /(?:delivery\s+(?:within|by|before|schedule))\s+(.{5,80}?)(?:\n|$)/i,
    /(?:expected\s+delivery|delivery\s+date)\s*[:\-]?\s*(.{5,60}?)(?:\n|$)/i,
  ]);
}

// ── Date extraction ────────────────────────────────────────────────────────

function extractDate(text: string): string | undefined {
  return first(text, [
    /(?:po\s*date|order\s*date|date\s*of\s*(?:order|po|purchase))\s*[:\-]?\s*(\d{1,2}[-\/\s]\w{2,9}[-\/\s]\d{2,4})/i,
    /(?:date)\s*[:\-]?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    /\b(\d{1,2}[-\/]\w{3,9}[-\/]\d{2,4})\b/,
    /\b(\w{3,9}\s+\d{1,2},?\s+\d{4})\b/,
  ]);
}

// ── Main text→PO parser ───────────────────────────────────────────────────

export function parseTextAsPO(text: string, fromEmail = '', sourceFile = ''): ExtractedPO {
  const poNumber    = extractPONumber(text);
  const amount      = extractAmount(text);
  const paymentTerms = extractPaymentTerms(text);
  const vendorName  = extractVendorName(text, fromEmail);
  const contactPerson = extractContact(text);
  const gstNumber   = extractGST(text);
  const product     = extractProduct(text);
  const deliveryTerms = extractDelivery(text);
  const receivedDate = extractDate(text);

  const fromDomain = fromEmail.includes('@') ? fromEmail.split('@')[1] : undefined;

  // Confidence score based on how many key fields we extracted
  let confidence = 0;
  if (poNumber)     confidence += 35;
  if (amount)       confidence += 25;
  if (vendorName)   confidence += 15;
  if (paymentTerms) confidence += 10;
  if (product)      confidence += 10;
  if (receivedDate) confidence += 5;

  return {
    poNumber,
    amount,
    vendorName,
    vendorEmail: fromEmail || undefined,
    vendorDomain: fromDomain,
    product,
    receivedDate,
    paymentTerms,
    deliveryTerms,
    gstNumber,
    contactPerson,
    rawText:  text.slice(0, 3000),
    confidence,
    isScanned: false,
    sourceFile,
    parseMethod: 'text',
  };
}

// ── File → text extraction ────────────────────────────────────────────────

async function pdfToText(buffer: Buffer): Promise<{ text: string; isScanned: boolean }> {
  try {
    const result = await pdfParse(buffer);
    const text = result.text || '';
    const isScanned = text.replace(/\s/g, '').length < 80;
    return { text, isScanned };
  } catch (e) {
    logger.warn('[PO] pdf-parse failed:', e);
    return { text: '', isScanned: true };
  }
}

async function imageToText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Tesseract = require('tesseract.js');
    const { data } = await Tesseract.recognize(buffer, 'eng', { logger: () => {} });
    return data.text || '';
  } catch (e) {
    logger.warn('[PO] tesseract OCR failed:', e);
    return '';
  }
}

async function docxToText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (e) {
    logger.warn('[PO] mammoth docx parse failed:', e);
    return '';
  }
}

export async function extractPOFromFile(
  buffer: Buffer,
  filename: string,
  fromEmail = '',
): Promise<ExtractedPO | null> {
  const ext = path.extname(filename).toLowerCase();
  let text = '';
  let isScanned = false;
  let parseMethod = 'unknown';

  if (ext === '.pdf') {
    const r = await pdfToText(buffer);
    text = r.text;
    isScanned = r.isScanned;
    parseMethod = isScanned ? 'scanned-pdf' : 'pdf';

    // Scanned PDFs: we can't OCR PDF buffers directly with Tesseract (images only)
    // Just use whatever text pdf-parse extracted; confidence will be low for scanned docs
  } else if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif'].includes(ext)) {
    text = await imageToText(buffer);
    parseMethod = 'ocr-image';
  } else if (['.docx', '.doc'].includes(ext)) {
    text = await docxToText(buffer);
    parseMethod = 'docx';
  } else {
    return null;
  }

  if (!text || text.replace(/\s/g, '').length < 20) {
    return {
      rawText: '',
      confidence: 0,
      isScanned: true,
      sourceFile: filename,
      parseMethod,
    };
  }

  const result = parseTextAsPO(text, fromEmail, filename);
  result.isScanned = isScanned;
  result.parseMethod = parseMethod;
  return result;
}

// ── PO keyword check (for email body) ────────────────────────────────────

export function looksLikePO(text: string): boolean {
  const lower = text.toLowerCase();
  // Reject if it's clearly a quotation or invoice, not a PO
  if (/\bquotation\b|\bquote\s+no\b|\binvoice\s+no\b/.test(lower)) return false;
  const keywords = [
    'purchase order', 'po no', 'po number', 'p.o. no',
    'work order', 'gem order',
  ];
  return keywords.some(kw => lower.includes(kw));
}
