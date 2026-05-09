// backend/src/services/email.service.ts
import { createTransporter } from '../config/email';
import logger from '../utils/logger';
import nodemailer from 'nodemailer';
import axios from 'axios';

const appUrl = () => process.env.APP_URL || (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

// ── Microsoft Graph API sender (for Outlook/M365 users) ──────────────────────
const GRAPH_CLIENT_ID     = process.env.GRAPH_CLIENT_ID     || '';
const GRAPH_CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET || '';
const GRAPH_TENANT_ID     = process.env.GRAPH_TENANT_ID     || '';
const M365_DOMAINS        = (process.env.M365_DOMAINS || '')
  .split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

// Returns true ONLY for custom M365 business domains (not personal @outlook.com/@hotmail.com).
// Personal Microsoft accounts cannot use Graph API sendMail — they must use SMTP.
function isOutlookEmail(email: string): boolean {
  const d = email.split('@')[1]?.toLowerCase() || '';
  // Personal consumer domains → must use SMTP, not Graph API
  const personalDomains = ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'live.in', 'live.co.uk'];
  if (personalDomains.includes(d)) return false;
  // office365.com / microsoft.com are tenant domains → Graph API is fine
  if (d.includes('office365') || d.includes('microsoft')) return true;
  return M365_DOMAINS.includes(d);
}

// ── Google Workspace Domain-Wide Delegation sender ────────────────────────────
const GOOGLE_SA_EMAIL  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
const GOOGLE_SA_KEY    = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY  || '').replace(/\\n/g, '\n');
const GOOGLE_WS_DOMAINS = (process.env.GOOGLE_WORKSPACE_DOMAINS || '')
  .split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

function isGoogleWorkspaceEmail(email: string): boolean {
  if (!GOOGLE_SA_EMAIL || !GOOGLE_SA_KEY || !GOOGLE_WS_DOMAINS.length) return false;
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return GOOGLE_WS_DOMAINS.includes(domain);
}

async function sendViaGoogleWorkspace(
  from: string,
  fromName: string,
  to: string,
  subject: string,
  html: string,
  cc?: string,
  attachments?: Array<{ filename: string; path?: string; content?: Buffer }>,
): Promise<void> {
  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({
    email: GOOGLE_SA_EMAIL,
    key: GOOGLE_SA_KEY,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: from,
  });

  const gmail = google.gmail({ version: 'v1', auth });
  const boundary = `boundary_${Date.now()}`;

  const parts: string[] = [
    `From: "${fromName}" <${from}>`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    '',
    Buffer.from(html).toString('base64'),
  ];

  if (attachments?.length) {
    const fs = await import('fs');
    for (const att of attachments) {
      const attData = att.content ? att.content : fs.readFileSync(att.path!);
      parts.push(
        `--${boundary}`,
        `Content-Type: application/octet-stream; name="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        '',
        attData.toString('base64'),
      );
    }
  }
  parts.push(`--${boundary}--`);

  const raw = Buffer.from(parts.join('\r\n')).toString('base64url');
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  logger.info(`Email sent via Google Workspace FROM ${from} to ${to}: ${subject}`);
}

async function getGraphToken(): Promise<string> {
  const url = `https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     GRAPH_CLIENT_ID,
    client_secret: GRAPH_CLIENT_SECRET,
    scope:         'https://graph.microsoft.com/.default',
  });
  const res = await axios.post(url, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  return res.data.access_token;
}

// Get a fresh access token using a user's stored OAuth2 refresh token (delegated flow)
async function getGraphTokenDelegated(encryptedRefreshToken: string): Promise<string> {
  const { decryptText } = await import('../utils/crypto');
  const refreshToken = decryptText(encryptedRefreshToken);
  const res = await axios.post(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     GRAPH_CLIENT_ID,
      client_secret: GRAPH_CLIENT_SECRET,
      refresh_token: refreshToken,
      scope:         'offline_access Mail.Send Mail.Read Mail.ReadWrite User.Read',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  // If we got a new refresh token, update it in DB (token rotation)
  if (res.data.refresh_token && res.data.refresh_token !== refreshToken) {
    const { encryptText } = await import('../utils/crypto');
    const User = (await import('../models/User')).default;
    await User.updateOne(
      { msRefreshToken: encryptedRefreshToken },
      { msRefreshToken: encryptText(res.data.refresh_token) }
    );
  }

  return res.data.access_token;
}

// Send email using user's own delegated OAuth2 token (personal Outlook/Hotmail)
async function sendViaGraphDelegated(
  encryptedRefreshToken: string,
  from: string,
  fromName: string,
  to: string,
  subject: string,
  html: string,
  cc?: string,
  attachments?: Array<{ filename: string; path?: string; content?: Buffer }>,
): Promise<void> {
  const token = await getGraphTokenDelegated(encryptedRefreshToken);

  const toRecipients = to.split(',').map(e => ({ emailAddress: { address: e.trim() } }));
  const ccRecipients = cc ? cc.split(',').map(e => ({ emailAddress: { address: e.trim() } })) : [];

  const fs = await import('fs');
  const graphAttachments = (attachments || []).map(a => ({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: a.filename,
    contentBytes: (a.content ? a.content : fs.readFileSync(a.path!)).toString('base64'),
  }));

  try {
    await axios.post(
      'https://graph.microsoft.com/v1.0/me/sendMail',
      {
        message: {
          subject,
          body: { contentType: 'HTML', content: html },
          toRecipients,
          ...(ccRecipients.length ? { ccRecipients } : {}),
          ...(graphAttachments.length ? { attachments: graphAttachments } : {}),
        },
        saveToSentItems: true,
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    logger.info(`Email sent via delegated Graph FROM ${from} to ${to}: ${subject}`);
  } catch (graphErr: any) {
    const detail = graphErr?.response?.data?.error?.message || graphErr?.response?.data || graphErr?.message;
    logger.error(`Graph sendMail failed FROM ${from}: ${JSON.stringify(detail)}`);
    throw new Error(`Graph sendMail failed: ${JSON.stringify(detail)}`);
  }
}

async function sendViaGraph(
  from: string,
  fromName: string,
  to: string,
  subject: string,
  html: string,
  cc?: string,
  attachments?: Array<{ filename: string; path?: string; content?: Buffer }>,
): Promise<void> {
  const token = await getGraphToken();

  const toRecipients = to.split(',').map(e => ({ emailAddress: { address: e.trim() } }));
  const ccRecipients = cc ? cc.split(',').map(e => ({ emailAddress: { address: e.trim() } })) : [];

  const fs = await import('fs');
  const graphAttachments = (attachments || []).map(a => ({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: a.filename,
    contentBytes: (a.content ? a.content : fs.readFileSync(a.path!)).toString('base64'),
  }));

  await axios.post(
    `https://graph.microsoft.com/v1.0/users/${from}/sendMail`,
    {
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        from: { emailAddress: { address: from, name: fromName } },
        toRecipients,
        ...(ccRecipients.length ? { ccRecipients } : {}),
        ...(graphAttachments.length ? { attachments: graphAttachments } : {}),
      },
      saveToSentItems: true,
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
  );
  logger.info(`Email sent via Graph FROM ${from} to ${to}: ${subject}`);
}

const base = (content: string, title: string) => `<!DOCTYPE html><html><head><style>
body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0}
.c{max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)}
.h{background:linear-gradient(135deg,#4f2d7f,#6b46c1);color:#fff;padding:30px;text-align:center}
.b{padding:30px;color:#333;line-height:1.6}
.f{background:#f8f8f8;padding:20px;text-align:center;font-size:12px;color:#888}
table{width:100%;border-collapse:collapse;margin:16px 0}
td{padding:8px;border:1px solid #eee}
</style></head><body><div class="c">
<div class="h"><h1>ZIEOS</h1><p>${title}</p></div>
<div class="b">${content}</div>
<div class="f">© ${new Date().getFullYear()} ZIEOS</div>
</div></body></html>`;

const send = async (
  to: string,
  subject: string,
  html: string,
  attachments?: Array<{ filename: string; path?: string; content?: Buffer }>,
  cc?: string,
  replyTo?: string,
  fromName?: string,
) => {
  const senderName = fromName || process.env.EMAIL_FROM_NAME || 'ZIEOS';
  // Prefer Hostinger (USER_EMAIL_FROM) over the generic SMTP sender — Hostinger is the
  // proven working transporter used for OTPs and credentials.
  const senderEmail = process.env.USER_EMAIL_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER || '';
  if (!senderEmail) {
    throw new Error('System email (USER_EMAIL_FROM / EMAIL_FROM / SMTP_USER) is not configured');
  }
  try {
    // Use Hostinger transporter if USER_SMTP credentials are present, otherwise fall back to SMTP_HOST
    const hostingerUser = process.env.USER_SMTP_USER;
    const hostingerPass = process.env.USER_SMTP_PASS;
    const transporter = (hostingerUser && hostingerPass)
      ? nodemailer.createTransport({
          host: process.env.USER_SMTP_HOST || 'smtp.hostinger.com',
          port: Number(process.env.USER_SMTP_PORT || 465),
          secure: true,
          auth: { user: hostingerUser, pass: hostingerPass },
        })
      : createTransporter();
    await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to,
      subject,
      html,
      ...(cc ? { cc } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    });
    logger.info(`Email sent to ${to}${cc ? ` (cc: ${cc})` : ''}${replyTo ? ` (replyTo: ${replyTo})` : ''}: ${subject}`);
  } catch (e) {
    logger.error('Email failed:', e);
    throw e;
  }
};

export interface UserSmtpConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure?: boolean;
  fromEmail: string;
  fromName: string;
  useGraphApi?: boolean;    // M365 business tenant — client credentials Graph API
  msRefreshToken?: string;  // personal Outlook/Hotmail — delegated OAuth2 refresh token (encrypted)
}

/** Send any email using user's own SMTP/Graph if available, fallback to system SMTP */
export const sendEmailWithUserSmtp = async (
  to: string,
  subject: string,
  html: string,
  senderSmtp?: UserSmtpConfig,
  attachments?: Array<{ filename: string; path?: string; content?: Buffer }>,
  cc?: string,
): Promise<void> => {
  if (senderSmtp) {
    // ── Personal Outlook/Hotmail with delegated OAuth token ──────────────────
    // msRefreshToken takes priority — it means the user connected via OAuth2
    if (senderSmtp.msRefreshToken) {
      await sendViaGraphDelegated(senderSmtp.msRefreshToken, senderSmtp.fromEmail, senderSmtp.fromName, to, subject, html, cc, attachments);
      return;
    }

    // ── Google Workspace domain-wide delegation ───────────────────────────────
    if (isGoogleWorkspaceEmail(senderSmtp.fromEmail)) {
      await sendViaGoogleWorkspace(senderSmtp.fromEmail, senderSmtp.fromName, to, subject, html, cc, attachments);
      return;
    }

    // ── Microsoft 365 business tenant (client credentials) ───────────────────
    if (senderSmtp.useGraphApi && GRAPH_CLIENT_ID && GRAPH_CLIENT_SECRET && GRAPH_TENANT_ID) {
      await sendViaGraph(senderSmtp.fromEmail, senderSmtp.fromName, to, subject, html, cc, attachments);
      return;
    }

    // ── All other providers (Gmail, Zoho, Hostinger, GoDaddy, Yahoo…) → SMTP ─
    const transporter = nodemailer.createTransport({
      host: senderSmtp.smtpHost,
      port: senderSmtp.smtpPort,
      secure: senderSmtp.smtpSecure ?? (senderSmtp.smtpPort === 465),
      auth: { user: senderSmtp.smtpUser, pass: senderSmtp.smtpPass },
    });
    await transporter.sendMail({
      from: `"${senderSmtp.fromName}" <${senderSmtp.fromEmail}>`,
      to,
      subject,
      html,
      replyTo: senderSmtp.fromEmail,
      ...(cc ? { cc } : {}),
      ...(attachments?.length ? { attachments } : {}),
    });
    logger.info(`Email sent FROM ${senderSmtp.fromEmail} to ${to}: ${subject}`);
  } else {
    await send(to, subject, html, attachments, cc);
  }
};

export const sendDRFEmail = async (
  to: string,
  data: {
    drfNumber: string;
    version: number;
    companyName: string;
    contactName: string;
    oemName: string;
    salesName: string;
    salesEmail?: string;
    salesPhone?: string;
    address?: string;
    website?: string;
    annualTurnover?: string;
    designation?: string;
    contactNo?: string;
    email?: string;
    channelPartner?: string;
    interestedModules?: string;
    expectedClosure?: string;
  },
  senderSmtp?: UserSmtpConfig
) => {
  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:8px 12px;border:1px solid #ddd;background:#f5f3ff;font-weight:bold;width:45%;vertical-align:top">${label}</td>
      <td style="padding:8px 12px;border:1px solid #ddd;vertical-align:top">${value || '—'}</td>
    </tr>`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px">
      <p>Dear Sir,</p>
      <p>Please find the below account for DRF approval.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        ${row('Account Name & Group Name', data.companyName)}
        ${row('Address & Location', data.address || '')}
        ${row('Web site', data.website || '')}
        ${row('Annual Turnover', data.annualTurnover || '')}
        ${row('Contact Person', data.contactName || '')}
        ${row('Designation', data.designation || '')}
        ${row('Contact No.', data.contactNo || '')}
        ${row('E-mail', data.email || '')}
        ${row('Partner Sales Rep', data.salesName)}
        ${row('Channel Partner', data.channelPartner || 'ZIEOS')}
        ${row('Potential / Interested Modules', data.interestedModules || data.oemName || '')}
        ${row('Expected Closure', data.expectedClosure || '')}
      </table>
      <p>Regards,</p>
      <p style="margin:0"><strong>${data.salesName}</strong></p>
      ${data.salesPhone ? `<p style="margin:4px 0">P: ${data.salesPhone}</p>` : ''}
      ${data.salesEmail ? `<p style="margin:4px 0">E: ${data.salesEmail}</p>` : ''}
    </div>
  `;

  const subject = `Requesting for the approval of DRF - ${data.companyName}`;

  if (senderSmtp) {
    // Route through the unified sender (handles Google Workspace + Outlook + SMTP)
    await sendEmailWithUserSmtp(to, subject, html, senderSmtp);
    logger.info(`DRF sent FROM ${senderSmtp.fromEmail} to ${to}`);
  } else {
    const transporter = getHostingerTransporter();
    await transporter.sendMail({
      from: `"${data.salesName || 'ZIEOS'}" <${process.env.USER_EMAIL_FROM}>`,
      to,
      replyTo: data.salesEmail || process.env.USER_EMAIL_FROM,
      subject,
      html,
    });
    logger.info(`DRF sent via system SMTP to ${to}`);
  }
};

export const sendWelcomeEmail = async (data: {
  to: string;
  name: string;
  role: string;
  orgName: string;
  loginUrl: string;
}) => {
  const roleLabel: Record<string, string> = {
    admin: 'Admin', manager: 'Manager', sales: 'Sales', engineer: 'Engineer', hr: 'HR', finance: 'Finance',
  };
  const displayRole = roleLabel[data.role] || data.role;

  await sendViaHostinger(
    data.to,
    `Welcome to ZIEOS — Your account is ready`,
    `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:30px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(135deg,#4f2d7f,#6b46c1);color:#fff;padding:28px;text-align:center">
      <h2 style="margin:0;font-size:20px">Welcome to ZIEOS</h2>
      <p style="margin:6px 0 0;opacity:.85;font-size:13px">${data.orgName}</p>
    </div>
    <div style="padding:28px">
      <p style="color:#374151;margin-top:0">Hi <strong>${data.name}</strong>,</p>
      <p style="color:#374151">You have been added to <strong>${data.orgName}</strong> as <strong>${displayRole}</strong>.</p>

      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:18px;font-size:14px;color:#374151;margin:20px 0">
        <p style="margin:0 0 8px 0"><strong>Sign in with your email ID and your password</strong></p>
        <p style="margin:0;color:#6b7280;font-size:13px">Use your email address and your own email account password (Gmail, Outlook, Hostinger, or any provider) to sign in. An OTP will be sent to your email to verify your identity.</p>
      </div>

      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px;font-size:13px;color:#92400e;margin-bottom:24px">
        <strong>Your login email:</strong> ${data.to}<br/>
        <span style="font-size:12px;margin-top:4px;display:block">Use your own email password to sign in — no separate password will be sent.</span>
      </div>

      <div style="text-align:center;margin:28px 0">
        <a href="${data.loginUrl}"
           style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px">
          Sign In →
        </a>
      </div>
    </div>
    <div style="background:#f8f8f8;padding:14px;text-align:center;font-size:11px;color:#9ca3af">
      © ${new Date().getFullYear()} ZIEOS
    </div>
  </div>
</body>
</html>`
  );
};

export const sendOEMApprovalRequest = async (to: string, company: string, oem: string, attempt: number, drfNumber: string, senderSmtp?: UserSmtpConfig) => {
  const subject = `OEM Approval Request — ${drfNumber} — ${company} (Attempt #${attempt})`;
  const html = base(`
      <h2>OEM Approval Request</h2>
      <table>
        <tr><td style="background:#f0eaf9;font-weight:bold">DRF Number</td><td><b>${drfNumber}</b></td></tr>
        <tr><td style="background:#f0eaf9;font-weight:bold">Company</td><td>${company}</td></tr>
        <tr><td style="background:#f0eaf9;font-weight:bold">OEM / Brand</td><td>${oem || '—'}</td></tr>
        <tr><td style="background:#f0eaf9;font-weight:bold">Attempt</td><td>#${attempt}</td></tr>
      </table>
      <p>Please reply to this email with <b>Approved</b> or <b>Rejected</b>.<br/>
      Make sure to keep the DRF number <b>${drfNumber}</b> in your reply so it can be automatically processed.</p>
    `, 'OEM Approval Required');
  await sendEmailWithUserSmtp(to, subject, html, senderSmtp);
};

export const sendOEMRejectionNotification = async (to: string, company: string, reason: string, attempt: number, senderSmtp?: UserSmtpConfig) => {
  const subject = `OEM Approval Rejected - ${company}`;
  const html = base(`<h2>OEM Rejected</h2><p>Attempt #${attempt} for <b>${company}</b> was rejected.</p><p><b>Reason:</b> ${reason}</p><p>You may resubmit a new request.</p>`, 'OEM Rejected');
  await sendEmailWithUserSmtp(to, subject, html, senderSmtp);
};

export const sendOEMExpiryReminder = (to: string, company: string, expiry: Date) =>
  send(to, `OEM Approval Expiring - ${company}`,
    base(`<h2>OEM Expiring Soon</h2><p>Approval for <b>${company}</b> expires on <b>${expiry.toLocaleDateString()}</b>.</p>`, 'Action Required'));

export const sendInvoiceReminder = (to: string, company: string, invNum: string, amount: number, due: Date) =>
  send(to, `Invoice Reminder - ${invNum}`,
    base(`<h2>Payment Reminder</h2><p>Dear ${company},</p><p>Invoice <b>${invNum}</b> for <b>₹${amount.toLocaleString()}</b> is due on <b>${due.toLocaleDateString()}</b>.</p>`, 'Payment Reminder'));

export const sendTicketClosureNotification = (to: string, ticketId: string, subject: string) =>
  send(to, `Support Ticket Closed - ${ticketId}`,
    base(`<h2>Ticket Closed</h2><p>Ticket <b>${ticketId}</b> (${subject}) has been auto-closed due to inactivity.</p>`, 'Ticket Closed'));

export const sendPayslip = (to: string, name: string, month: string, year: number) =>
  send(to, `Payslip for ${month} ${year}`,
    base(`<h2>Payslip Ready</h2><p>Dear ${name}, your payslip for <b>${month} ${year}</b> is ready. Login to download.</p>`, 'Monthly Payslip'));
// backend/src/services/email.service.ts - Add these functions at the end

const supportEmailWrapper = (content: string) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;padding:24px 0">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td height="5" style="background:linear-gradient(90deg,#4f2d7f,#6b46c1);font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td style="padding:28px 36px">${content}</td></tr>
      <tr><td style="background:#f9fafb;padding:16px 36px;border-top:1px solid #f0f0f0;text-align:center">
        <p style="margin:0;font-size:12px;color:#9ca3af">&copy; ${new Date().getFullYear()} — Support Team. All rights reserved.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

export const sendTicketAcknowledgement = async (
  to: string,
  customerName: string,
  ticketId: string,
  subject: string,
  senderSmtp?: UserSmtpConfig,
) => {
  const html = supportEmailWrapper(`
    <p style="margin:0 0 16px;font-size:15px;color:#222">Dear <strong>${customerName}</strong>,</p>
    <p style="margin:0 0 12px;font-size:14px;color:#555;line-height:1.7">Your request has been successfully received. Our team is reviewing the details and will get back to you shortly.</p>
    <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.7">Thank you for reaching out to us.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;margin-bottom:8px">
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:500;width:40%;border-bottom:1px dashed #ddd6fe">Ticket ID</td><td style="padding:10px 16px;color:#111;font-size:13px;font-weight:600;border-bottom:1px dashed #ddd6fe">${ticketId}</td></tr>
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:500">Subject</td><td style="padding:10px 16px;color:#111;font-size:13px;font-weight:600">${subject}</td></tr>
    </table>
  `);
  await sendEmailWithUserSmtp(to, `We've received your request — ${ticketId}`, html, senderSmtp);
};

export const sendTicketStatusUpdate = async (
  to: string,
  ticketId: string,
  subject: string,
  oldStatus: string,
  newStatus: string,
  engineerName: string,
  note?: string,
  senderSmtp?: UserSmtpConfig,
  customerName?: string,
) => {
  const name = customerName || 'Customer';

  const statusMessages: Record<string, { heading: string; body: string; color: string }> = {
    'Open': {
      heading: 'Ticket Open',
      body: `Your ticket has been created and is currently in <strong>Open</strong> status. Our support team will review your request and begin processing it soon.<br><br>We appreciate your patience.`,
      color: '#f59e0b',
    },
    'In Progress': {
      heading: 'Ticket In Progress',
      body: `Your ticket is currently <strong>In Progress</strong>. Our team is actively working on your request and will keep you updated on the progress.<br><br>Please feel free to share any additional details if required.`,
      color: '#3b82f6',
    },
    'Resolved': {
      heading: 'Ticket Resolved',
      body: `We are pleased to inform you that your ticket has been <strong>Resolved</strong>.<br><br>If the issue persists or you need further assistance, please reply to this message — we are happy to help.<br><br>Thank you for choosing our support services.`,
      color: '#10b981',
    },
    'Reopened': {
      heading: 'Ticket Reopened',
      body: `Your ticket has been <strong>Reopened</strong>. Our team will pick it up and work towards a resolution as soon as possible.`,
      color: '#f97316',
    },
  };

  const cfg = statusMessages[newStatus] || { heading: `Status: ${newStatus}`, body: `Your ticket status has been updated to <strong>${newStatus}</strong>.`, color: '#6b7280' };

  const html = supportEmailWrapper(`
    <p style="margin:0 0 16px;font-size:15px;color:#222">Dear <strong>${name}</strong>,</p>
    <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.7">${cfg.body}</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;margin-bottom:${note ? '16px' : '8px'}">
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:500;width:40%;border-bottom:1px dashed #ddd6fe">Ticket ID</td><td style="padding:10px 16px;color:#111;font-size:13px;font-weight:600;border-bottom:1px dashed #ddd6fe">${ticketId}</td></tr>
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:500;border-bottom:1px dashed #ddd6fe">Subject</td><td style="padding:10px 16px;color:#111;font-size:13px;font-weight:600;border-bottom:1px dashed #ddd6fe">${subject}</td></tr>
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:500">Status</td><td style="padding:10px 16px"><span style="background:${cfg.color};color:#fff;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">${newStatus}</span></td></tr>
    </table>
    ${note ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;font-size:13px;color:#92400e"><strong>Note:</strong> ${note}</div>` : ''}
  `);

  await sendEmailWithUserSmtp(to, `Support Ticket ${ticketId} — ${cfg.heading}`, html, senderSmtp);
};

// ── Hostinger transporter (used for OTPs, registration emails, credentials) ──
const getHostingerTransporter = () =>
  nodemailer.createTransport({
    host: process.env.USER_SMTP_HOST || 'smtp.hostinger.com',
    port: Number(process.env.USER_SMTP_PORT || 465),
    secure: true,
    auth: {
      user: process.env.USER_SMTP_USER,
      pass: process.env.USER_SMTP_PASS,
    },
  });

const sendViaHostinger = async (
  to: string,
  subject: string,
  html: string,
  textContent?: string,
  attachments?: Array<{ filename: string; path: string }>
) => {
  const transporter = getHostingerTransporter();
  const fromEmail = process.env.USER_EMAIL_FROM || '';
  await transporter.sendMail({
    from: `"ZIEOS" <${fromEmail}>`,
    replyTo: fromEmail,
    to,
    subject,
    html,
    // Plain-text fallback reduces spam score significantly
    text: textContent || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    headers: {
      // Proper headers that mail servers expect from transactional senders
      'X-Mailer': 'ZIEOS Mailer',
      'X-Priority': '3',
      'Precedence': 'bulk',
      'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`,
    },
    ...(attachments && attachments.length ? { attachments } : {}),
  });
};

export const sendOTPEmail = async (to: string, otp: string, context: 'registration' | 'login' = 'registration') => {
  const subject = context === 'login'
    ? `${otp} is your ZIEOS sign-in code`
    : `${otp} is your ZIEOS verification code`;
  const heading = context === 'login' ? 'Sign-in verification code' : 'Email verification code';
  const desc = context === 'login'
    ? 'Use the code below to complete your sign-in. This code expires in 5 minutes.'
    : 'Use the code below to verify your email address. This code expires in 5 minutes.';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:32px 16px">
<tr><td align="center">
<table width="100%" style="max-width:480px;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb">
  <tr><td style="padding:28px 32px 0">
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">ZIEOS</p>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827">${heading}</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6">${desc}</p>
  </td></tr>
  <tr><td style="padding:0 32px">
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="background:#f3f4f6;border-radius:8px;padding:20px">
      <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#111827;font-family:monospace">${otp}</span>
    </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 32px 28px">
    <p style="margin:0 0 12px;font-size:13px;color:#6b7280;line-height:1.5">If you did not request this code, you can safely ignore this email. Do not share this code with anyone.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
    <p style="margin:0;font-size:12px;color:#9ca3af">© ${new Date().getFullYear()} ZIEOS · Zaltix Solutions</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const text = `${heading}\n\nYour code: ${otp}\n\n${desc}\n\nDo not share this code with anyone.\n\n© ${new Date().getFullYear()} ZIEOS`;

  await sendViaHostinger(to, subject, html, text);
};

// Notify admin team about a new application — with one-click Approve / Reject buttons
export const sendApplicationNotificationEmail = async (data: {
  orgName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  businessType: string;
  gstNumber?: string;
  applicationId: string;
  approveUrl: string;  // one-click approve magic link
  rejectUrl: string;   // one-click reject magic link (opens reason form)
  documentPaths: Array<{ label: string; path: string }>;
}) => {
  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:8px 12px;border:1px solid #ddd;background:#f5f3ff;font-weight:bold;width:40%;vertical-align:top">${label}</td>
      <td style="padding:8px 12px;border:1px solid #ddd;vertical-align:top">${value || '—'}</td>
    </tr>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
      <div style="max-width:660px;margin:30px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#4f2d7f,#6b46c1);color:#fff;padding:30px;text-align:center">
          <h1 style="margin:0;font-size:22px;font-weight:700">New Registration Application</h1>
          <p style="margin:8px 0 0;opacity:.85;font-size:14px">ZIEOS — Admin Review Required</p>
        </div>

        <!-- Body -->
        <div style="padding:28px">
          <p style="color:#444;margin-top:0">A new organization has submitted a registration request. Review the details below and take action.</p>

          <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px">
            ${row('Organization Name', data.orgName)}
            ${row('Contact Person', data.contactName)}
            ${row('Email', data.email)}
            ${row('Phone', data.phone)}
            ${row('Address', `${data.address}, ${data.city}, ${data.state}`)}
            ${row('Business Type', data.businessType)}
            ${row('GST Number', data.gstNumber || 'Not provided')}
            ${row('Application ID', data.applicationId)}
          </table>

          <p style="color:#666;font-size:13px;margin-bottom:24px">
            ${data.documentPaths.length > 0
              ? `<strong>${data.documentPaths.length} document(s)</strong> are attached to this email. Please review them before approving.`
              : 'No documents were uploaded with this application.'}
          </p>

          <!-- Action Buttons -->
          <div style="background:#f9f7ff;border:1px solid #e0d9f5;border-radius:8px;padding:24px;text-align:center">
            <p style="margin:0 0 18px;font-weight:600;color:#333;font-size:15px">Take Action on this Application</p>
            <div style="display:inline-flex;gap:16px">
              <!-- Approve Button -->
              <a href="${data.approveUrl}"
                 style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:.3px;margin-right:12px">
                ✅ Approve
              </a>
              <!-- Reject Button -->
              <a href="${data.rejectUrl}"
                 style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:.3px">
                ❌ Reject
              </a>
            </div>
            <p style="margin:14px 0 0;font-size:12px;color:#888">
              Approving will automatically create the account and send login credentials to the applicant.<br/>
              Rejecting will open a form where you can provide a reason.
            </p>
          </div>

          <p style="color:#aaa;font-size:11px;margin-top:20px;text-align:center">
            These links are valid for 7 days. Each link can only be used once.
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f8f8f8;padding:16px;text-align:center;font-size:12px;color:#888">
          © ${new Date().getFullYear()} ZIEOS · This is an automated notification
        </div>
      </div>
    </body>
    </html>
  `;

  const attachments = data.documentPaths.map(d => ({
    filename: d.label,
    path: d.path,
  }));

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.USER_EMAIL_FROM || '';
  await sendViaHostinger(adminEmail, `🆕 Registration Application — ${data.orgName} [Action Required]`, html, undefined, attachments);
};

// Send approval email with credentials to the applicant
export const sendApprovalEmail = async (data: {
  to: string;
  contactName: string;
  orgName: string;
  loginEmail: string;
}) => {
  await sendViaHostinger(
    data.to,
    'Your ZIEOS Account is Approved!',
    base(`
      <h2 style="color:#059669">Application Approved!</h2>
      <p>Dear <strong>${data.contactName}</strong>,</p>
      <p>Congratulations! Your registration for <strong>${data.orgName}</strong> on ZIEOS has been reviewed and <strong style="color:#059669">approved</strong>.</p>
      <p>You can now log in using the details below:</p>
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px;margin:16px 0">
        <table style="width:100%">
          <tr><td style="padding:6px;font-weight:bold;color:#374151">Login URL</td><td style="padding:6px"><a href="${appUrl()}/login">${appUrl()}/login</a></td></tr>
          <tr><td style="padding:6px;font-weight:bold;color:#374151">Email</td><td style="padding:6px">${data.loginEmail}</td></tr>
          <tr><td style="padding:6px;font-weight:bold;color:#374151">Password</td><td style="padding:6px">Use your own email account password</td></tr>
        </table>
      </div>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:16px 0;font-size:13px;color:#92400e">
        <strong>How to login:</strong> Enter your email address and use the same password you use to access your email inbox (e.g. Gmail password, Outlook password, etc.).
        If your provider requires an App Password for third-party apps, you will be guided to set it up after your first login.
      </div>
      <p>If you have any questions, please contact us at <a href="mailto:${process.env.USER_EMAIL_FROM}">${process.env.USER_EMAIL_FROM}</a>.</p>
    `, 'Account Approved')
  );
};

// Send rejection email to the applicant
export const sendRejectionEmail = async (data: {
  to: string;
  contactName: string;
  orgName: string;
  reason: string;
}) => {
  await sendViaHostinger(
    data.to,
    'Update on Your ZIEOS Registration',
    base(`
      <h2 style="color:#dc2626">Application Update</h2>
      <p>Dear <strong>${data.contactName}</strong>,</p>
      <p>Thank you for your interest in <strong>ZIEOS</strong>. After reviewing your registration application for <strong>${data.orgName}</strong>, we regret to inform you that your application has not been approved at this time.</p>
      ${data.reason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:14px;margin:16px 0"><strong>Reason:</strong> ${data.reason}</div>` : ''}
      <p>If you believe this is an error or would like to reapply with updated documents, please contact us at <a href="mailto:${process.env.USER_EMAIL_FROM}">${process.env.USER_EMAIL_FROM}</a>.</p>
      <p>We appreciate your understanding.</p>
    `, 'Application Status')
  );
};

export const sendTicketAssignmentNotification = async (
  to: string,
  ticketId: string,
  subject: string,
  engineerName: string,
  senderSmtp?: UserSmtpConfig,
) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4f2d7f; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Support Ticket Assigned</h2>
        </div>
        <div class="content">
          <p>Dear ${engineerName},</p>
          <p>A new support ticket has been assigned to you:</p>
          
          <table style="width: 100%; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; background: #f0eaf9;"><strong>Ticket ID</strong></td>
              <td style="padding: 8px;">${ticketId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f0eaf9;"><strong>Subject</strong></td>
              <td style="padding: 8px;">${subject}</td>
            </tr>
          </table>
          
          <p>Please log into the ZIEOS system to view and respond to this ticket.</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from ZIEOS.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmailWithUserSmtp(to, `New Support Ticket Assigned: ${ticketId}`, html, senderSmtp);
};

export const sendFeedbackRequestEmail = async (
  to: string,
  ticketId: string,
  subject: string,
  companyName: string,
  senderSmtp?: UserSmtpConfig,
  feedbackUrl?: string,
) => {
  const html = supportEmailWrapper(`
    <p style="margin:0 0 16px;font-size:15px;color:#222">Dear <strong>${companyName}</strong>,</p>
    <p style="margin:0 0 12px;font-size:14px;color:#555;line-height:1.7">We are pleased to inform you that your ticket has been <strong>Resolved</strong>.</p>
    <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.7">If the issue persists or you need further assistance, please reply to this message — we are happy to help.<br><br>Thank you for choosing our support services.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;margin-bottom:20px">
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:500;width:40%;border-bottom:1px dashed #ddd6fe">Ticket ID</td><td style="padding:10px 16px;color:#111;font-size:13px;font-weight:600;border-bottom:1px dashed #ddd6fe">${ticketId}</td></tr>
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:500;border-bottom:1px dashed #ddd6fe">Subject</td><td style="padding:10px 16px;color:#111;font-size:13px;font-weight:600;border-bottom:1px dashed #ddd6fe">${subject}</td></tr>
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;font-weight:500">Status</td><td style="padding:10px 16px"><span style="background:#10b981;color:#fff;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">Resolved</span></td></tr>
    </table>

    ${feedbackUrl ? `
    <!-- Feedback form CTA -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 24px;margin-bottom:20px;text-align:center">
      <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#15803d">Share Your Feedback</p>
      <p style="margin:0 0 16px;font-size:13px;color:#374151;line-height:1.6">We value your experience. Please take a moment to let us know how we did — it helps us serve you better.</p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
        <tr><td style="background:#16a34a;border-radius:8px">
          <a href="${feedbackUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:.3px">Submit Feedback &rarr;</a>
        </td></tr>
      </table>
      <p style="margin:12px 0 0;font-size:11px;color:#9ca3af">Or copy this link: <a href="${feedbackUrl}" style="color:#16a34a;word-break:break-all">${feedbackUrl}</a></p>
    </div>
    ` : ''}

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400e">
      <strong>Note:</strong> This ticket will be automatically closed after <strong>3 days</strong> if no feedback is received.
    </div>
  `);
  await sendEmailWithUserSmtp(to, `Support Ticket Resolved — ${ticketId}`, html, senderSmtp);
};

export const sendAccountWelcomeEmail = async (data: {
  to: string;
  customerName: string;
  orgName: string;
  engineerName: string;
  engineerPhone?: string;
  engineerEmail?: string;
  loginUrl?: string;
  supportEmail?: string;
}, senderSmtp?: UserSmtpConfig) => {
  const loginUrl = data.loginUrl || appUrl();
  const supportEmail = data.supportEmail || senderSmtp?.fromEmail || process.env.EMAIL_FROM || '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;padding:24px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">

      <!-- Top bar -->
      <tr><td height="5" style="background:linear-gradient(90deg,#4f2d7f,#6b46c1);font-size:0;line-height:0">&nbsp;</td></tr>

      <!-- Header -->
      <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f0f0f0">
        <p style="margin:0;font-size:24px;font-weight:700;color:#4f2d7f">${data.orgName}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#9ca3af;letter-spacing:.5px">WELCOME ONBOARD</p>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:32px 40px">
        <p style="margin:0 0 16px;font-size:15px;color:#222">Dear <strong>${data.customerName}</strong>,</p>
        <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.8">
          Welcome to <strong>${data.orgName}</strong> — we're excited to have you onboard.<br>
          Your account has been successfully activated, and you now have full access to our platform. You're all set to explore powerful tools designed to streamline your operations and accelerate your growth.
        </p>

        <!-- Divider -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>

        <!-- Getting Started -->
        <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#4f2d7f">Getting Started</p>
        <p style="margin:0 0 6px;font-size:14px;color:#555;line-height:1.8">Here are a few quick steps to help you begin:</p>
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 8px">
          <tr><td style="padding:4px 0;font-size:14px;color:#374151">&#8226;&nbsp; Log in to your dashboard</td></tr>
          <tr><td style="padding:4px 0;font-size:14px;color:#374151">&#8226;&nbsp; Complete your profile setup</td></tr>
          <tr><td style="padding:4px 0;font-size:14px;color:#374151">&#8226;&nbsp; Explore key features tailored for your needs</td></tr>
        </table>

        <!-- CTA Button -->
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px">
          <tr><td style="background:#4f2d7f;border-radius:8px;padding:0">
            <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:.3px">Access Your Account &rarr;</a>
          </td></tr>
        </table>

        <!-- Divider -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>

        <!-- What You Can Do -->
        <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#4f2d7f">What You Can Do Next</p>
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 8px">
          <tr><td style="padding:4px 0;font-size:14px;color:#374151">&#8226;&nbsp; Manage your operations seamlessly</td></tr>
          <tr><td style="padding:4px 0;font-size:14px;color:#374151">&#8226;&nbsp; Track performance and insights in real-time</td></tr>
          <tr><td style="padding:4px 0;font-size:14px;color:#374151">&#8226;&nbsp; Collaborate with your team efficiently</td></tr>
          <tr><td style="padding:4px 0;font-size:14px;color:#374151">&#8226;&nbsp; Customize the platform to fit your workflow</td></tr>
        </table>

        <!-- Divider -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>

        <!-- Support -->
        <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#4f2d7f">We're Here to Help</p>
        <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.8">
          Our support team is always available to guide you. If you need assistance, simply reply to this email or contact us at <strong>${supportEmail}</strong>.
        </p>

        <!-- Divider -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>

        <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.8">
          We look forward to being a part of your journey and helping you achieve more with <strong>${data.orgName}</strong>.
        </p>

        <!-- Signature -->
        <p style="margin:0 0 4px;font-size:14px;color:#374151;font-weight:600">Warm regards,</p>
        <p style="margin:0 0 2px;font-size:15px;color:#111;font-weight:700">${data.engineerName}</p>
        <p style="margin:0 0 2px;font-size:13px;color:#374151;font-weight:600">${data.orgName}</p>
        ${data.engineerPhone ? `<p style="margin:0 0 2px;font-size:13px;color:#555">${data.engineerPhone}${loginUrl ? ` | ${loginUrl}` : ''}</p>` : ''}
        <p style="margin:0;font-size:13px;color:#555">${data.engineerEmail || supportEmail}</p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f9fafb;padding:18px 40px;border-top:1px solid #f0f0f0;text-align:center">
        <p style="margin:0;font-size:12px;color:#9ca3af;font-style:italic">Empowering your business with smarter solutions.</p>
        <p style="margin:6px 0 0;font-size:11px;color:#d1d5db">&copy; ${new Date().getFullYear()} ${data.orgName}. All rights reserved.</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

  await sendEmailWithUserSmtp(
    data.to,
    `Welcome to ${data.orgName} — Your Account is Ready`,
    html,
    senderSmtp,
  );
};

export const sendTicketReopenedEmail = async (
  to: string,
  ticketId: string,
  subject: string,
  companyName: string,
  senderSmtp?: UserSmtpConfig,
) => {
  const html = `
    <!DOCTYPE html><html><head>
    <style>
      body{font-family:Arial,sans-serif;}
      .container{max-width:600px;margin:0 auto;padding:20px;}
      .header{background:#e65100;color:white;padding:20px;text-align:center;}
      .content{padding:20px;background:#f9f9f9;}
      .footer{text-align:center;padding:20px;color:#666;font-size:12px;}
    </style></head><body>
    <div class="container">
      <div class="header"><h2>Support Ticket Reopened</h2></div>
      <div class="content">
        <p>Dear ${companyName},</p>
        <p>Your support ticket has been <strong>reopened</strong> and our team is working on it again.</p>
        <table style="width:100%;margin:16px 0;">
          <tr><td style="padding:8px;background:#f0eaf9;"><strong>Ticket ID</strong></td><td style="padding:8px;">${ticketId}</td></tr>
          <tr><td style="padding:8px;background:#f0eaf9;"><strong>Subject</strong></td><td style="padding:8px;">${subject}</td></tr>
        </table>
        <p style="color:#e65100;"><strong>Note:</strong> If this issue is not resolved within <strong>3 days</strong>, a new support ticket will be automatically created.</p>
      </div>
      <div class="footer"><p>This is an automated notification from ZIEOS Support System.</p></div>
    </div></body></html>
  `;
  await sendEmailWithUserSmtp(to, `Support Ticket Reopened - ${ticketId}`, html, senderSmtp);
};

export const sendUserCredentialsEmail = async (
  to: string,
  name: string,
  email: string,
  password: string,
  role?: string,
  orgName?: string,
) => {
  const roleLabel: Record<string, string> = {
    admin:      'Admin',
    sales:      'Sales',
    engineer:   'Engineer',
    hr: 'HR', finance: 'Finance',
  };
  const displayRole = role ? (roleLabel[role] || role) : 'Team Member';
  const loginUrl = `${appUrl()}/login`;

  try {
    await sendViaHostinger(
      to,
      `Welcome to ZIEOS — Your Login Credentials`,
      `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:30px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(135deg,#4f2d7f,#6b46c1);color:#fff;padding:28px;text-align:center">
      <h2 style="margin:0;font-size:20px">Welcome to ZIEOS</h2>
      <p style="margin:6px 0 0;opacity:.85;font-size:13px">${orgName || 'Your Organization'}</p>
    </div>
    <div style="padding:28px">
      <p style="color:#374151;margin-top:0">Hi <strong>${name}</strong>,</p>
      <p style="color:#374151">Your account has been created. You have been assigned the role of <strong>${displayRole}</strong>. Use the credentials below to log in.</p>

      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:20px;margin:20px 0">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-weight:600;width:40%">Login URL</td>
            <td style="padding:8px 0"><a href="${loginUrl}" style="color:#7c3aed">${loginUrl}</a></td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-weight:600;border-top:1px solid #ede9fe">Email</td>
            <td style="padding:8px 0;border-top:1px solid #ede9fe"><strong>${email}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-weight:600;border-top:1px solid #ede9fe">Password</td>
            <td style="padding:8px 0;border-top:1px solid #ede9fe"><strong style="font-size:16px;letter-spacing:1px">${password}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-weight:600;border-top:1px solid #ede9fe">Role</td>
            <td style="padding:8px 0;border-top:1px solid #ede9fe">${displayRole}</td>
          </tr>
        </table>
      </div>

      <div style="text-align:center;margin-bottom:20px">
        <a href="${loginUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px">Login Now →</a>
      </div>

      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:12px;font-size:13px;color:#9a3412">
        <strong>Important:</strong> Please change your password after your first login for security.
      </div>
    </div>
    <div style="background:#f8f8f8;padding:14px;text-align:center;font-size:11px;color:#9ca3af">
      © ${new Date().getFullYear()} ZIEOS — Do not share your credentials with anyone.
    </div>
  </div>
</body>
</html>`
    );
    console.log('✅ Credentials email sent to:', to);
  } catch (error) {
    console.error('❌ Credentials email error:', error);
    throw error;
  }
};


export const sendDRFExtensionEmail = async (data: {
  drfNumber: string;
  companyName: string;
  oemName: string;
  expiryDate: string;
  ownerName: string;
}, senderSmtp?: UserSmtpConfig) => {
  // Recipients configured via env var: comma-separated email list
  const recipients = (process.env.DRF_EXTENSION_RECIPIENTS || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);
  if (!recipients.length) {
    logger.warn('DRF extension email skipped — DRF_EXTENSION_RECIPIENTS not configured');
    return;
  }

  const expiry = new Date(data.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px">
      <p>Dear Team,</p>
      <p>The following DRF is expiring within <strong>5 days</strong> and is still awaiting OEM approval. Please arrange for an extension.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr>
          <td style="padding:8px 12px;border:1px solid #ddd;background:#f5f3ff;font-weight:bold;width:45%">DRF Number</td>
          <td style="padding:8px 12px;border:1px solid #ddd">${data.drfNumber}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #ddd;background:#f5f3ff;font-weight:bold">Company</td>
          <td style="padding:8px 12px;border:1px solid #ddd">${data.companyName}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #ddd;background:#f5f3ff;font-weight:bold">OEM / Product</td>
          <td style="padding:8px 12px;border:1px solid #ddd">${data.oemName || '—'}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #ddd;background:#f5f3ff;font-weight:bold">Expiry Date</td>
          <td style="padding:8px 12px;border:1px solid #ddd;color:#dc2626;font-weight:bold">${expiry}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #ddd;background:#f5f3ff;font-weight:bold">Owner</td>
          <td style="padding:8px 12px;border:1px solid #ddd">${data.ownerName || '—'}</td>
        </tr>
      </table>
      <p>Please take immediate action to extend or follow up on this DRF before it expires.</p>
      <p>Regards,<br/>ZIEOS System</p>
    </div>
  `;

  const subject = `DRF Extension Required — ${data.drfNumber} (${data.companyName}) expires ${expiry}`;
  await sendEmailWithUserSmtp(recipients.join(','), subject, html, senderSmtp);
};

export const sendOEMExtensionRequest = async (
  to: string,
  data: {
    drfNumber: string; companyName: string; oemName: string;
    expiryDate: string; salesName: string; salesEmail?: string;
    customSubject?: string; customMessage?: string;
    toName?: string; requestedNewExpiry?: string;
  },
  senderSmtp?: UserSmtpConfig
) => {
  const expiry = new Date(data.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const subject = data.customSubject || `DRF Extension Request — ${data.drfNumber} — ${data.companyName}`;
  const greeting = data.toName ? `Dear ${data.toName},` : 'Dear Sir/Madam,';
  const customPara = data.customMessage
    ? `<p style="color:#374151;white-space:pre-line">${data.customMessage}</p>`
    : `<p>We are writing to request an extension for the DRF approval for <strong>${data.companyName}</strong>.</p>`;
  const newExpiryRow = data.requestedNewExpiry
    ? `<tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f5f3ff;font-weight:bold;color:#059669">Requested New Expiry</td><td style="padding:8px 12px;border:1px solid #ddd;color:#059669;font-weight:bold">${new Date(data.requestedNewExpiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>`
    : '';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px">
      <p>${greeting}</p>
      ${customPara}
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f5f3ff;font-weight:bold;width:45%">DRF Number</td><td style="padding:8px 12px;border:1px solid #ddd">${data.drfNumber}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f5f3ff;font-weight:bold">Company</td><td style="padding:8px 12px;border:1px solid #ddd">${data.companyName}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f5f3ff;font-weight:bold">OEM / Brand</td><td style="padding:8px 12px;border:1px solid #ddd">${data.oemName || '—'}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f5f3ff;font-weight:bold;color:#dc2626">Current Expiry</td><td style="padding:8px 12px;border:1px solid #ddd;color:#dc2626;font-weight:bold">${expiry}</td></tr>
        ${newExpiryRow}
      </table>
      <p>Kindly reply to this email with the new <strong>valid until date</strong> for the extension, keeping DRF number <strong>${data.drfNumber}</strong> in your reply.</p>
      <p>Regards,<br/><strong>${data.salesName}</strong>${data.salesEmail ? `<br/>${data.salesEmail}` : ''}</p>
    </div>
  `;
  await sendEmailWithUserSmtp(to, subject, html, senderSmtp);
};

export default send;