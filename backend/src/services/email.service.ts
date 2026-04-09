// backend/src/services/email.service.ts
import { createTransporter } from '../config/email';
import logger from '../utils/logger';
import { getTransporter } from '../config/email';
import nodemailer from 'nodemailer';
import { getUserEmailTransporter } from '../config/userEmail';

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

const send = async (to: string, subject: string, html: string, attachments?: Array<{ filename: string; path: string }>, cc?: string) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Telled Marketing'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      ...(cc ? { cc } : {}),
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    });
    logger.info(`Email sent to ${to}${cc ? ` (cc: ${cc})` : ''}: ${subject}`);
  } catch (e) {
    logger.error('Email failed:', e);
    throw e;
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
  }
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

  await send(to, `Requesting for the approval of DRF - ${data.companyName}`, html);
};

export const sendOEMApprovalRequest = (to: string, company: string, oem: string, attempt: number, drfNumber: string) =>
  send(to, `OEM Approval Request — ${drfNumber} — ${company} (Attempt #${attempt})`,
    base(`
      <h2>OEM Approval Request</h2>
      <table>
        <tr><td style="background:#f0eaf9;font-weight:bold">DRF Number</td><td><b>${drfNumber}</b></td></tr>
        <tr><td style="background:#f0eaf9;font-weight:bold">Company</td><td>${company}</td></tr>
        <tr><td style="background:#f0eaf9;font-weight:bold">OEM / Brand</td><td>${oem || '—'}</td></tr>
        <tr><td style="background:#f0eaf9;font-weight:bold">Attempt</td><td>#${attempt}</td></tr>
      </table>
      <p>Please reply to this email with <b>Approved</b> or <b>Rejected</b>.<br/>
      Make sure to keep the DRF number <b>${drfNumber}</b> in your reply so it can be automatically processed.</p>
    `, 'OEM Approval Required'));

export const sendOEMRejectionNotification = (to: string, company: string, reason: string, attempt: number) =>
  send(to, `OEM Approval Rejected - ${company}`,
    base(`<h2>OEM Rejected</h2><p>Attempt #${attempt} for <b>${company}</b> was rejected.</p><p><b>Reason:</b> ${reason}</p><p>You may resubmit a new request.</p>`, 'OEM Rejected'));

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
  note?: string
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

  await send(to, `Support Ticket ${ticketId} - Status Updated to ${newStatus}`, html);
};

export const sendOTPEmail = async (to: string, otp: string) => {
  const transporter = getTransporter();

  // 🔥 DO NOT AWAIT
  transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Your OTP for Telled Marketing',
    html: `
      <h2>OTP Verification</h2>
      <h1>${otp}</h1>
      <p>Valid for 5 minutes</p>
    `
  }).catch(err => {
    console.error('Email failed:', err);
  });
};

export const sendTicketAssignmentNotification = async (
  to: string,
  ticketId: string,
  subject: string,
  engineerName: string
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

  await send(to, `New Support Ticket Assigned: ${ticketId}`, html);
};

export const sendUserCredentialsEmail = async (
  to: string,
  name: string,
  email: string,
  password: string
) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.USER_SMTP_HOST,
      port: Number(process.env.USER_SMTP_PORT),
      secure: true, // ✅ IMPORTANT for 465
      auth: {
        user: process.env.USER_SMTP_USER,
        pass: process.env.USER_SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Telled Marketing" <${process.env.USER_EMAIL_FROM}>`,
      to,
      subject: 'Your Login Credentials',
      html: `
        <h2>Welcome ${name}</h2>
        <p>Your account has been created.</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Password:</b> ${password}</p>
        <p>Please login and change your password.</p>
      `,
    });

    console.log("✅ Email sent to:", to);

  } catch (error) {
    console.error("❌ Email Error:", error);
    throw error;
  }
};


export default send;