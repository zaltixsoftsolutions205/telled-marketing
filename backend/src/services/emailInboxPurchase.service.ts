import { ImapFlow } from 'imapflow';
import PurchaseOrder from '../models/PurchaseOrder';
import Lead from '../models/Lead';
import User from '../models/User';
import logger from '../utils/logger';
import { generatePONumber } from '../utils/helpers';
import mongoose from 'mongoose';

const IMAP_HOST = process.env.SUPPORT_EMAIL_HOST || 'imap.hostinger.com';
const IMAP_PORT = parseInt(process.env.SUPPORT_EMAIL_PORT || '993');
const IMAP_USER = process.env.SUPPORT_EMAIL_USER || process.env.SMTP_USER || '';
const IMAP_PASS = process.env.SUPPORT_EMAIL_PASS || process.env.SMTP_PASS || '';

// Keywords to identify purchase order emails
const PO_KEYWORDS = [
  'purchase order',
  'purchase order number',
  'po number',
  'po#',
  'po #',
  'order confirmation',
  'order acknowledgment',
  'sales order',
  'purchase order received',
  'new purchase order',
  'po confirmation',
  'order details',
  'purchase confirmation',
  'please find our purchase order',
  'please find the purchase order',
];

// Patterns for extracting PO number
const PO_NUMBER_PATTERNS = [
  /PO(?:[-\s]?#?)(?:[-\s]?)([A-Z0-9-]{4,20})/gi,
  /Purchase\s+Order\s+(?:Number|#)?\s*[:\s-]*([A-Z0-9-]{4,20})/gi,
  /Order\s+(?:Number|#)?\s*[:\s-]*([A-Z0-9-]{4,20})/gi,
  /PO\s*:\s*([A-Z0-9-]{4,20})/gi,
  /PO\s+([A-Z0-9-]{4,20})/gi,
];

// Patterns for extracting amount
const AMOUNT_PATTERNS = [
  /(?:Total|Amount|Order\s+Total|Invoice\s+Total)\s*[:\s$₹]*([\d,]+(?:\.\d{2})?)/gi,
  /Grand\s+Total\s*[:\s$₹]*([\d,]+(?:\.\d{2})?)/gi,
  /₹\s*([\d,]+(?:\.\d{2})?)/gi,
  /\$\s*([\d,]+(?:\.\d{2})?)/gi,
  /(?:order\s+total|total\s+amount)\s*[:\s]*([\d,]+)/gi,
];

// Patterns for extracting vendor/company name - IMPROVED
const VENDOR_PATTERNS = [
  // Company field
  /(?:Company|Vendor|Supplier|Seller|From|Customer)\s*[:\s-]*([A-Za-z0-9\s&.,]+?)(?:\n|,|$|@|Regards|Please)/gi,
  // After "Regards" or "Thanks" - common in emails
  /(?:Regards|Thanks|Thank you|Best regards|Sincerely)[,\s]*(?:[A-Za-z\s]+?)(?:\n|$)/gi,
  // Extract from the signature line
  /^([A-Za-z\s]{3,50})$/gm,
  // Extract from the content before "Please confirm"
  /(.+?)\s*Please confirm/gi,
];

// Patterns for extracting product description
const PRODUCT_PATTERNS = [
  /(?:Product|Item|Description|Item\s+Details?)\s*[:\s-]*([A-Za-z0-9\s&.,-]+?)(?:\n|,|$)/gi,
  /Item\s*:\s*([A-Za-z0-9\s&.,-]+)/gi,
  /Product\s*:\s*([A-Za-z0-9\s&.,-]+)/gi,
];

// Patterns for extracting date
const DATE_PATTERNS = [
  /(?:Date|Order Date|PO Date)\s*[:\s-]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
  /(\d{1,2}\/\d{1,2}\/\d{4})/g,
  /(\d{4}-\d{2}-\d{2})/g,
  /(?:Ordered on|Received on)\s*[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/gi,
];

export interface PurchaseOrderEmailResult {
  scanned: number;
  processed: number;
  created: string[];
  updated: string[];
  skipped: string[];
  errors: string[];
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractPONumber(text: string): string | null {
  for (const pattern of PO_NUMBER_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      pattern.lastIndex = 0;
      return match[1].trim();
    }
    pattern.lastIndex = 0;
  }
  return null;
}

function extractAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      pattern.lastIndex = 0;
      if (!isNaN(amount) && amount > 0) {
        return amount;
      }
    }
    pattern.lastIndex = 0;
  }
  return null;
}

function extractVendorName(text: string, fromName: string, fromEmail: string): string | null {
  // First try to extract from patterns
  for (const pattern of VENDOR_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      if (match && match[1]) {
        let name = match[1].trim();
        // Clean up common words
        name = name.replace(/^(Company|Vendor|Supplier|From):\s*/i, '');
        name = name.replace(/[,.]$/, '');
        name = name.replace(/\s+/g, ' ');
        
        // Filter out common non-company words
        const excludeWords = ['please', 'confirm', 'order', 'purchase', 'regards', 'thanks', 'thank', 'best', 'sincerely'];
        if (name.length > 2 && name.length < 100 && !excludeWords.includes(name.toLowerCase())) {
          pattern.lastIndex = 0;
          logger.info(`Extracted vendor name from pattern: ${name}`);
          return name;
        }
      }
    }
    pattern.lastIndex = 0;
  }
  
  // If no company name found, try to extract from the email body before "Please confirm"
  const confirmMatch = text.match(/(.+?)\s*Please confirm/gi);
  if (confirmMatch && confirmMatch[1]) {
    let name = confirmMatch[1].trim();
    // Remove common prefixes
    name = name.replace(/^(Company|Vendor|Supplier|From):\s*/i, '');
    name = name.replace(/\s+/g, ' ');
    if (name.length > 2 && name.length < 100) {
      logger.info(`Extracted vendor name from confirmation text: ${name}`);
      return name;
    }
  }
  
  // Try to extract from "Regards" line
  const regardsMatch = text.match(/(?:Regards|Thanks|Thank you|Best regards|Sincerely)[,\s]*\n?\s*([A-Za-z\s]{3,50})/i);
  if (regardsMatch && regardsMatch[1]) {
    let name = regardsMatch[1].trim();
    name = name.replace(/[,.]$/, '');
    if (name.length > 2 && name.length < 50) {
      logger.info(`Extracted vendor name from regards: ${name}`);
      return name;
    }
  }
  
  // If still no name, use the sender's name or email
  if (fromName && fromName.length > 2 && fromName.length < 50) {
    logger.info(`Using sender name as vendor: ${fromName}`);
    return fromName;
  }
  
  if (fromEmail) {
    const emailName = fromEmail.split('@')[0];
    if (emailName && emailName.length > 2) {
      logger.info(`Using email prefix as vendor: ${emailName}`);
      return emailName;
    }
  }
  
  return null;
}

function extractVendorEmail(text: string, fromEmail: string): string | null {
  // First try to find email in the email body
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  
  // If found an email in body, use that
  if (emailMatch) {
    // But don't use our own email address
    if (emailMatch[0] !== IMAP_USER) {
      return emailMatch[0];
    }
  }
  
  // Otherwise, use the sender's email (from address)
  if (fromEmail && fromEmail !== IMAP_USER) {
    return fromEmail;
  }
  
  return null;
}

function extractProduct(text: string): string | null {
  for (const pattern of PRODUCT_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      let product = match[1].trim();
      pattern.lastIndex = 0;
      if (product.length > 2 && product.length < 200) {
        return product;
      }
    }
    pattern.lastIndex = 0;
  }
  
  // Try to find product after "Product:" or "Item:" without the pattern
  const productMatch = text.match(/Product[:\s]+([A-Za-z0-9\s&.,-]+)/i);
  if (productMatch && productMatch[1]) {
    return productMatch[1].trim();
  }
  
  return null;
}

function extractReceivedDate(text: string): Date | null {
  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      const date = new Date(match[1]);
      pattern.lastIndex = 0;
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    pattern.lastIndex = 0;
  }
  return null;
}

function isPurchaseOrderEmail(subject: string, body: string): boolean {
  const combined = (subject + ' ' + body).toLowerCase();
  for (const keyword of PO_KEYWORDS) {
    if (combined.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  return false;
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

function stripQuotedContent(text: string): string {
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

async function findLeadByVendorInfo(vendorName: string | null, vendorEmail: string | null): Promise<any | null> {
  // First try to find by email
  if (vendorEmail) {
    const leadByEmail = await Lead.findOne({
      $or: [
        { contactEmail: { $regex: new RegExp(vendorEmail, 'i') } },
        { email: { $regex: new RegExp(vendorEmail, 'i') } },
      ],
      isArchived: false,
    });
    
    if (leadByEmail) {
      logger.info(`Found lead by email: ${leadByEmail.companyName}`);
      return leadByEmail;
    }
  }
  
  // Then try by name
  if (vendorName && vendorName.length > 2) {
    // Try exact match first
    let leadByName = await Lead.findOne({
      companyName: { $regex: new RegExp(`^${vendorName}$`, 'i') },
      isArchived: false,
    });
    
    // Try partial match
    if (!leadByName) {
      leadByName = await Lead.findOne({
        companyName: { $regex: new RegExp(vendorName, 'i') },
        isArchived: false,
      });
    }
    
    // Try by contact person name
    if (!leadByName) {
      leadByName = await Lead.findOne({
        contactPersonName: { $regex: new RegExp(vendorName, 'i') },
        isArchived: false,
      });
    }
    
    if (leadByName) {
      logger.info(`Found lead by name: ${leadByName.companyName}`);
      return leadByName;
    }
  }
  
  return null;
}

async function getDefaultAdminUser(): Promise<any> {
  const admin = await User.findOne({ role: 'admin', isActive: true });
  if (!admin) {
    logger.warn('No admin user found for PO creation');
    return null;
  }
  return admin;
}

export async function syncPurchaseOrderEmails(): Promise<PurchaseOrderEmailResult> {
  const result: PurchaseOrderEmailResult = {
    scanned: 0,
    processed: 0,
    created: [],
    updated: [],
    skipped: [],
    errors: [],
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
    // Hostinger IMAP drops idle connections — harmless, next sync reconnects
    if (err.message && (err.message.includes('socket') || err.message.includes('ECONNRESET') || err.message.includes('closed') || err.message.includes('EPIPE'))) {
      logger.warn('IMAP connection closed by server (harmless)');
    } else {
      logger.error('ImapFlow PO sync error:', err.message);
    }
  });

  try {
    await client.connect();
  } catch (connErr) {
    result.errors.push(`IMAP connect failed: ${(connErr as Error).message}`);
    return result;
  }

  const lock = await client.getMailboxLock('INBOX');
  try {
    // Search emails from last 24 hours for purchase orders
    const since = new Date();
    since.setDate(since.getDate() - 1);

    const uids: number[] = await (client as any).search({ since }, { uid: true });

    if (!uids || uids.length === 0) {
      result.skipped.push('No emails found in last 24 hours');
      lock.release();
      await client.logout();
      return result;
    }

    logger.info(`PO Email sync: found ${uids.length} messages in last 24 hours`);

    for await (const msg of client.fetch(uids, { envelope: true, source: true }, { uid: true })) {
      result.scanned++;
      try {
        const subject = msg.envelope?.subject || '';
        const fromName = msg.envelope?.from?.[0]?.name || '';
        const fromEmail = msg.envelope?.from?.[0]?.address || '';
        const rawText = rawEmailToText(msg.source || Buffer.alloc(0));
        
        // Skip non-PO emails quickly
        if (!isPurchaseOrderEmail(subject, rawText)) {
          continue;
        }

        logger.info(`Processing PO email from ${fromEmail} (${fromName}) with subject: ${subject}`);

        // Extract data from email
        const freshText = subject + ' ' + stripQuotedContent(rawText);
        const poNumber = extractPONumber(freshText);
        const amount = extractAmount(freshText);
        // FIXED: Pass fromName and fromEmail for better extraction
        const vendorName = extractVendorName(freshText, fromName, fromEmail);
        const vendorEmail = extractVendorEmail(freshText, fromEmail);
        const product = extractProduct(freshText);
        const receivedDate = extractReceivedDate(freshText) || new Date();

        logger.info(`Extracted: PO=${poNumber}, Amount=${amount}, VendorName=${vendorName}, VendorEmail=${vendorEmail}, Product=${product}`);

        // Try to find matching lead
        let lead = await findLeadByVendorInfo(vendorName, vendorEmail);
        
        // If still no lead found, try to find by from email
        if (!lead && fromEmail) {
          lead = await Lead.findOne({
            $or: [
              { contactEmail: { $regex: new RegExp(fromEmail, 'i') } },
              { email: { $regex: new RegExp(fromEmail, 'i') } },
            ],
            isArchived: false,
          });
          
          if (lead) {
            logger.info(`Found lead by from email: ${lead.companyName}`);
          }
        }
        
        // If still no lead found, try to create a new lead automatically
        if (!lead && (vendorName || fromEmail)) {
          const finalVendorName = vendorName || fromName || fromEmail.split('@')[0] || 'Unknown Vendor';
          logger.info(`No matching lead found. Creating new lead for: ${finalVendorName}`);
          
          const defaultAdmin = await getDefaultAdminUser();
          if (defaultAdmin) {
            lead = await new Lead({
              companyName: finalVendorName,
              contactEmail: vendorEmail || fromEmail,
              contactPersonName: vendorName || fromName || fromEmail.split('@')[0] || 'Unknown',
              status: 'New',
              stage: 'PO Received',
              assignedTo: defaultAdmin._id,
              isArchived: false,
              notes: `Auto-created from PO email from ${fromEmail} on ${new Date().toISOString()}`,
            }).save();
            
            logger.info(`Created new lead: ${lead.companyName} (${lead._id})`);
          }
        }

        if (!lead) {
          result.skipped.push(`${poNumber || 'Unknown'} — No matching lead found and could not create lead from email from ${fromEmail}`);
          continue;
        }

        // Check if PO already exists
        let existingPO = null;
        if (poNumber) {
          existingPO = await PurchaseOrder.findOne({ poNumber });
        }

        if (existingPO) {
          // Update existing PO
          const updateData: any = {};
          if (amount && !existingPO.amount) updateData.amount = amount;
          if (product && !existingPO.product) updateData.product = product;
          // vendorName and vendorEmail are always entered manually — never auto-filled from email
          
          if (Object.keys(updateData).length > 0) {
            await PurchaseOrder.findByIdAndUpdate(existingPO._id, updateData);
            result.updated.push(existingPO.poNumber);
            logger.info(`Updated PO ${existingPO.poNumber} from email from ${fromEmail}`);
          } else {
            result.skipped.push(`${existingPO.poNumber} — Already exists, no new data`);
          }
        } else {
          // Create new PO
          const defaultAdmin = await getDefaultAdminUser();

          const newPO = await new PurchaseOrder({
            leadId: lead._id,
            poNumber: poNumber || generatePONumber(),
            amount: amount || 0,
            product: product || '',
            vendorName: '',   // must be entered manually
            vendorEmail: '',  // must be entered manually
            receivedDate: receivedDate,
            notes: `Auto-created from email on ${new Date().toISOString()}\n\nOriginal Subject: ${subject}`,
            uploadedBy: defaultAdmin?._id || lead.assignedTo || new mongoose.Types.ObjectId(),
            vendorEmailSent: false,
            converted: false,
            isArchived: false,
          }).save();

          // Update lead stage to PO Received
          await Lead.findByIdAndUpdate(lead._id, { stage: 'PO Received' });

          result.created.push(newPO.poNumber);
          logger.info(`Created PO ${newPO.poNumber} for lead ${lead.companyName} from email ${fromEmail} — vendor details pending manual entry`);
        }

        result.processed++;

      } catch (msgErr) {
        const errorMsg = `uid ${msg.uid}: ${(msgErr as Error).message}`;
        result.errors.push(errorMsg);
        logger.error('Error processing PO email:', msgErr);
      }
    }

  } catch (err) {
    result.errors.push(`Sync error: ${(err as Error).message}`);
    logger.error('PO email sync error:', err);
  } finally {
    lock.release();
  }

  try {
    await client.logout();
  } catch {
    /* ignore logout errors */
  }

  // Log summary
  logger.info(`PO Sync Summary: Scanned=${result.scanned}, Processed=${result.processed}, Created=${result.created.length}, Updated=${result.updated.length}, Skipped=${result.skipped.length}, Errors=${result.errors.length}`);
  
  return result;
}