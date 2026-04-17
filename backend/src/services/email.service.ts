// backend/src/services/email.service.ts
import { createTransporter } from '../config/email';
import logger from '../utils/logger';
import nodemailer from 'nodemailer';
import axios from 'axios';

// ── Microsoft Graph API sender (for Outlook/M365 users) ──────────────────────
const GRAPH_CLIENT_ID     = process.env.GRAPH_CLIENT_ID     || '';
const GRAPH_CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET || '';
const GRAPH_TENANT_ID     = process.env.GRAPH_TENANT_ID     || '';

function isOutlookEmail(email: string): boolean {
  const d = email.split('@')[1]?.toLowerCase() || '';
  return d.includes('outlook') || d.includes('hotmail') || d.includes('live') || d.includes('office365') || d.includes('microsoft');
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
  attachments?: Array<{ filename: string; path: string }>,
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
      parts.push(
        `--${boundary}`,
        `Content-Type: application/octet-stream; name="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        '',
        fs.readFileSync(att.path).toString('base64'),
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

async function sendViaGraph(
  from: string,
  fromName: string,
  to: string,
  subject: string,
  html: string,
  cc?: string,
  attachments?: Array<{ filename: string; path: string }>,
): Promise<void> {
  const token = await getGraphToken();

  const toRecipients = to.split(',').map(e => ({ emailAddress: { address: e.trim() } }));
  const ccRecipients = cc ? cc.split(',').map(e => ({ emailAddress: { address: e.trim() } })) : [];

  const fs = await import('fs');
  const graphAttachments = (attachments || []).map(a => ({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: a.filename,
    contentBytes: fs.readFileSync(a.path).toString('base64'),
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
<div class="h"><h1>Telled Marketing</h1><p>${title}</p></div>
<div class="b">${content}</div>
<div class="f">© ${new Date().getFullYear()} Telled Marketing</div>
</div></body></html>`;

const send = async (
  to: string,
  subject: string,
  html: string,
  attachments?: Array<{ filename: string; path: string }>,
  cc?: string,
  replyTo?: string,
  fromName?: string,
) => {
  try {
    const transporter = createTransporter();
    const senderName = fromName || process.env.EMAIL_FROM_NAME || 'Telled Marketing';
    const senderEmail = process.env.EMAIL_FROM || process.env.SMTP_USER;
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
}

/** Send any email using user's own SMTP/Graph if available, fallback to system SMTP */
export const sendEmailWithUserSmtp = async (
  to: string,
  subject: string,
  html: string,
  senderSmtp?: UserSmtpConfig,
  attachments?: Array<{ filename: string; path: string }>,
  cc?: string,
): Promise<void> => {
  if (senderSmtp) {
    // Google Workspace (company domain on Gmail) → use Gmail API domain-wide delegation
    if (isGoogleWorkspaceEmail(senderSmtp.fromEmail)) {
      await sendViaGoogleWorkspace(senderSmtp.fromEmail, senderSmtp.fromName, to, subject, html, cc, attachments);
      return;
    }
    // Outlook/M365 users → use Graph API (bypasses SMTP AUTH requirement)
    if (isOutlookEmail(senderSmtp.fromEmail) && GRAPH_CLIENT_ID && GRAPH_CLIENT_SECRET && GRAPH_TENANT_ID) {
      await sendViaGraph(senderSmtp.fromEmail, senderSmtp.fromName, to, subject, html, cc, attachments);
      return;
    }
    // All other providers → SMTP
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
        ${row('Channel Partner', data.channelPartner || 'Telled Marketing')}
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
      from: `"${data.salesName || 'Telled Marketing'}" <${process.env.USER_EMAIL_FROM}>`,
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
    admin: 'Admin', sales: 'Sales', engineer: 'Engineer', hr_finance: 'HR & Finance',
  };
  const displayRole = roleLabel[data.role] || data.role;

  await sendViaHostinger(
    data.to,
    `Welcome to Telled Marketing — Your account is ready`,
    `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:30px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(135deg,#4f2d7f,#6b46c1);color:#fff;padding:28px;text-align:center">
      <h2 style="margin:0;font-size:20px">Welcome to Telled Marketing</h2>
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
      © ${new Date().getFullYear()} Telled Marketing
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

export const sendTicketStatusUpdate = async (
  to: string,
  ticketId: string,
  subject: string,
  oldStatus: string,
  newStatus: string,
  engineerName: string,
  note?: string,
  senderSmtp?: UserSmtpConfig,
) => {
  const statusColors: Record<string, string> = {
    'Open': '#f59e0b',
    'In Progress': '#3b82f6',
    'Resolved': '#10b981',
    'Closed': '#6b7280',
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4f2d7f; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; color: white; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Support Ticket Status Update</h2>
        </div>
        <div class="content">
          <p>Dear Customer,</p>
          <p>Your support ticket <strong>${ticketId}</strong> has been updated by <strong>${engineerName}</strong>.</p>
          
          <table style="width: 100%; margin: 20px 0;">
            <tr>
              <td style="padding: 8px; background: #f0eaf9;"><strong>Ticket ID</strong></td>
              <td style="padding: 8px;">${ticketId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f0eaf9;"><strong>Subject</strong></td>
              <td style="padding: 8px;">${subject}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background: #f0eaf9;"><strong>Status</strong></td>
              <td style="padding: 8px;">
                <span style="background: ${statusColors[oldStatus]}; padding: 4px 8px; border-radius: 4px; color: white;">${oldStatus}</span>
                →
                <span style="background: ${statusColors[newStatus]}; padding: 4px 8px; border-radius: 4px; color: white;">${newStatus}</span>
              </td>
            </tr>
            ${note ? `
            <tr>
              <td style="padding: 8px; background: #f0eaf9;"><strong>Engineer's Note</strong></td>
              <td style="padding: 8px;">${note}</td>
            </tr>
            ` : ''}
          </table>
          
          <p>You can view the full ticket details by logging into the Telled Marketing portal.</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from Telled Marketing. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmailWithUserSmtp(to, `Support Ticket ${ticketId} - Status Updated to ${newStatus}`, html, senderSmtp);
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
  attachments?: Array<{ filename: string; path: string }>
) => {
  const transporter = getHostingerTransporter();
  await transporter.sendMail({
    from: `"Telled Marketing" <${process.env.USER_EMAIL_FROM}>`,
    to,
    subject,
    html,
    ...(attachments && attachments.length ? { attachments } : {}),
  });
};

export const sendOTPEmail = async (to: string, otp: string, context: 'registration' | 'login' = 'registration') => {
  const subject = context === 'login'
    ? 'Your Sign-In OTP — Telled Marketing'
    : 'Your OTP for Telled Marketing Registration';
  const heading = context === 'login' ? 'Sign-In Verification' : 'Email Verification';
  const desc = context === 'login'
    ? 'Use the code below to complete your sign-in.'
    : 'Use the OTP below to verify your email address.';

  await sendViaHostinger(to, subject, base(`
    <h2 style="color:#4f2d7f">${heading}</h2>
    <p>${desc}</p>
    <div style="background:#f5f3ff;border:2px dashed #6b46c1;border-radius:8px;text-align:center;padding:24px;margin:20px 0">
      <span style="font-size:40px;font-weight:bold;letter-spacing:10px;color:#4f2d7f">${otp}</span>
    </div>
    <p style="color:#666;font-size:13px">This code is valid for <strong>5 minutes</strong>. Do not share it with anyone.</p>
  `, heading));
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
          <p style="margin:8px 0 0;opacity:.85;font-size:14px">Telled Marketing — Admin Review Required</p>
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
          © ${new Date().getFullYear()} Telled Marketing · This is an automated notification
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
  await sendViaHostinger(adminEmail, `🆕 Registration Application — ${data.orgName} [Action Required]`, html, attachments);
};

// Send approval email with credentials to the applicant
export const sendApprovalEmail = async (data: {
  to: string;
  contactName: string;
  orgName: string;
  loginEmail: string;
  password: string;
}) => {
  await sendViaHostinger(
    data.to,
    'Your Telled Marketing Account is Approved!',
    base(`
      <h2 style="color:#059669">Application Approved!</h2>
      <p>Dear <strong>${data.contactName}</strong>,</p>
      <p>Congratulations! Your registration for <strong>${data.orgName}</strong> on Telled Marketing has been reviewed and <strong style="color:#059669">approved</strong>.</p>
      <p>Here are your login credentials:</p>
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px;margin:16px 0">
        <table style="width:100%">
          <tr><td style="padding:6px;font-weight:bold;color:#374151">Login URL</td><td style="padding:6px"><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login">${process.env.FRONTEND_URL || 'http://localhost:5173'}/login</a></td></tr>
          <tr><td style="padding:6px;font-weight:bold;color:#374151">Email</td><td style="padding:6px">${data.loginEmail}</td></tr>
          <tr><td style="padding:6px;font-weight:bold;color:#374151">Password</td><td style="padding:6px"><strong>${data.password}</strong></td></tr>
        </table>
      </div>
      <p style="color:#dc2626;font-size:13px"><strong>Important:</strong> Please change your password after your first login for security.</p>
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
    'Update on Your Telled Marketing Registration',
    base(`
      <h2 style="color:#dc2626">Application Update</h2>
      <p>Dear <strong>${data.contactName}</strong>,</p>
      <p>Thank you for your interest in <strong>Telled Marketing</strong>. After reviewing your registration application for <strong>${data.orgName}</strong>, we regret to inform you that your application has not been approved at this time.</p>
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
          
          <p>Please log into the Telled Marketing system to view and respond to this ticket.</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from Telled Marketing.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmailWithUserSmtp(to, `New Support Ticket Assigned: ${ticketId}`, html, senderSmtp);
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
    hr_finance: 'HR & Finance',
  };
  const displayRole = role ? (roleLabel[role] || role) : 'Team Member';
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;

  try {
    await sendViaHostinger(
      to,
      `Welcome to Telled Marketing — Your Login Credentials`,
      `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:30px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(135deg,#4f2d7f,#6b46c1);color:#fff;padding:28px;text-align:center">
      <h2 style="margin:0;font-size:20px">Welcome to Telled Marketing</h2>
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
      © ${new Date().getFullYear()} Telled Marketing — Do not share your credentials with anyone.
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
}) => {
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
      <p>Regards,<br/>Telled Marketing System</p>
    </div>
  `;

  await send(
    recipients.join(','),
    `DRF Extension Required — ${data.drfNumber} (${data.companyName}) expires ${expiry}`,
    html
  );
};

export default send;