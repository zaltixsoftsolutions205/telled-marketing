import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';
import { readPOEmailsForUser } from '../services/imapReader.service';
import { extractPOFromFile, looksLikePO, parseTextAsPO, ExtractedPO } from '../services/poIntelligence.service';
import Lead from '../models/Lead';
import PurchaseOrder from '../models/PurchaseOrder';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

export interface DetectedPO {
  emailUid:    string;
  emailSubject: string;
  emailFrom:   string;
  emailFromEmail: string;
  emailFromDomain: string;
  emailDate:   string;
  filename:    string;
  extracted:   ExtractedPO;
  suggestedLeadId?: string;
  suggestedLeadName?: string;
  alreadyImported: boolean;
}

// ── POST /api/po-sync/scan ────────────────────────────────────────────────
// Connects to inbox and returns detected POs (does NOT create records)
export const scanEmailsForPOs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const daysBack = Number(req.body?.daysBack) || 60;
    const userId   = req.user!.id;

    logger.info(`[POSync] Scanning emails for user=${userId} days=${daysBack}`);

    let emails;
    try {
      emails = await readPOEmailsForUser(userId, daysBack);
    } catch (e: any) {
      sendError(res, e.message || 'Failed to connect to mailbox', 400);
      return;
    }

    const detected: DetectedPO[] = [];

    for (const email of emails) {
      // First try attachments
      if (email.attachments.length > 0) {
        for (const att of email.attachments) {
          try {
            const extracted = await extractPOFromFile(att.buffer, att.filename, email.fromEmail);
            if (!extracted || extracted.confidence < 25) continue;

            const match = await findMatchingLead(
              extracted.vendorName,
              email.fromDomain,
              req.user!.organizationId,
            );

            // Only process emails from known leads
            if (!match) {
              logger.info(`[POSync] Skipping ${email.fromEmail} — sender not in leads`);
              continue;
            }

            const alreadyImported = extracted.poNumber
              ? !!(await PurchaseOrder.findOne({ poNumber: extracted.poNumber }).lean())
              : false;

            detected.push({
              emailUid:        email.uid,
              emailSubject:    email.subject,
              emailFrom:       email.from,
              emailFromEmail:  email.fromEmail,
              emailFromDomain: email.fromDomain,
              emailDate:       email.date.toISOString(),
              filename:        att.filename,
              extracted,
              suggestedLeadId:   match._id?.toString(),
              suggestedLeadName: match.companyName,
              alreadyImported,
            });
          } catch (e) {
            logger.warn('[POSync] Failed to extract from attachment:', e);
          }
        }
      } else if (looksLikePO(email.body)) {
        // No attachment — try email body
        const extracted = parseTextAsPO(email.body, email.fromEmail, 'email-body');
        if (extracted.confidence >= 25) {
          const match = await findMatchingLead(
            extracted.vendorName,
            email.fromDomain,
            req.user!.organizationId,
          );

          // Only process emails from known leads
          if (!match) {
            logger.info(`[POSync] Skipping body email from ${email.fromEmail} — sender not in leads`);
            continue;
          }

          const alreadyImported = extracted.poNumber
            ? !!(await PurchaseOrder.findOne({ poNumber: extracted.poNumber }).lean())
            : false;

          detected.push({
            emailUid:        email.uid,
            emailSubject:    email.subject,
            emailFrom:       email.from,
            emailFromEmail:  email.fromEmail,
            emailFromDomain: email.fromDomain,
            emailDate:       email.date.toISOString(),
            filename:        'email-body',
            extracted,
            suggestedLeadId:   match._id?.toString(),
            suggestedLeadName: match.companyName,
            alreadyImported,
          });
        }
      }
    }

    // Only return POs not yet imported — user only wants new ones from inbox
    const newDetected = detected
      .filter(d => !d.alreadyImported)
      .sort((a, b) => b.extracted.confidence - a.extracted.confidence);

    sendSuccess(res, { detected: newDetected, emailsScanned: emails.length });
  } catch (err) {
    logger.error('[POSync] scanEmailsForPOs error:', err);
    sendError(res, 'Failed to scan emails', 500);
  }
};

// ── POST /api/po-sync/import ──────────────────────────────────────────────
// Creates a PO record from a confirmed detection
export const importDetectedPO = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      leadId,
      poNumber,
      amount,
      vendorName,
      vendorEmail,
      product,
      receivedDate,
      paymentTerms,
      notes,
    } = req.body;

    if (!leadId) { sendError(res, 'leadId is required', 400); return; }
    if (!amount || amount <= 0) { sendError(res, 'Valid amount is required', 400); return; }

    // Generate PO number if not provided
    const finalPoNumber = poNumber || await generatePONumber();

    // Check duplicate
    const existing = await PurchaseOrder.findOne({ poNumber: finalPoNumber }).lean();
    if (existing) { sendError(res, `PO number ${finalPoNumber} already exists`, 409); return; }

    const po = new PurchaseOrder({
      leadId,
      poNumber: finalPoNumber,
      amount: Number(amount),
      vendorName,
      vendorEmail,
      product,
      receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
      notes: [
        paymentTerms ? `Payment Terms: ${paymentTerms}` : '',
        notes || '',
      ].filter(Boolean).join('\n') || undefined,
      converted:   false,
      uploadedBy:  req.user!.id,
      isArchived:  false,
      paymentStatus: 'Unpaid',
    });

    await po.save();

    const populated = await PurchaseOrder.findById(po._id)
      .populate('leadId', 'companyName')
      .populate('uploadedBy', 'name email');

    sendSuccess(res, populated, 'PO imported successfully', 201);
  } catch (err) {
    logger.error('[POSync] importDetectedPO error:', err);
    sendError(res, 'Failed to import PO', 500);
  }
};

// ── GET /api/po-sync/test-connection ─────────────────────────────────────
// Quick IMAP connection test
export const testImapConnection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const emails = await readPOEmailsForUser(req.user!.id, 1);
    sendSuccess(res, { connected: true, emailsFound: emails.length }, 'Connection successful');
  } catch (e: any) {
    sendError(res, `Connection failed: ${e.message}`, 400);
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────

async function findMatchingLead(
  vendorName?: string,
  domain?: string,
  organizationId?: string,
): Promise<{ _id: unknown; companyName: string } | null> {
  if (!vendorName && !domain) return null;

  const filter: Record<string, unknown> = { isArchived: false };
  if (organizationId) filter.organizationId = organizationId;

  if (vendorName) {
    const words = vendorName.replace(/\b(pvt|ltd|limited|inc|corp|llp|private)\b/gi, '').trim();
    const lead = await Lead.findOne({
      ...filter,
      companyName: { $regex: words.split(/\s+/).filter(w => w.length > 2).join('|'), $options: 'i' },
    }).select('_id companyName').lean();
    if (lead) return lead as { _id: unknown; companyName: string };
  }

  if (domain && domain.length > 4) {
    const lead = await Lead.findOne({
      ...filter,
      $or: [
        { email: { $regex: `@${domain}`, $options: 'i' } },
        { website: { $regex: domain, $options: 'i' } },
      ],
    }).select('_id companyName').lean();
    if (lead) return lead as { _id: unknown; companyName: string };
  }

  return null;
}

async function generatePONumber(): Promise<string> {
  const now  = new Date();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const prefix = `PO${mm}${yyyy}`;
  const last = await PurchaseOrder.findOne(
    { poNumber: { $regex: `^${prefix}` } },
    { poNumber: 1 },
    { sort: { poNumber: -1 } },
  ).lean();
  let next = 1;
  if (last?.poNumber) {
    const n = parseInt(last.poNumber.slice(prefix.length), 10);
    if (!isNaN(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(3, '0')}`;
}
