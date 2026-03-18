import { createTransporter } from '../config/email';
import logger from '../utils/logger';

const base = (content: string, title: string) => `<!DOCTYPE html><html><head><style>
body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0}
.c{max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.1)}
.h{background:linear-gradient(135deg,#4f2d7f,#6b46c1);color:#fff;padding:30px;text-align:center}
.b{padding:30px;color:#333;line-height:1.6}
.f{background:#f8f8f8;padding:20px;text-align:center;font-size:12px;color:#888}
table{width:100%;border-collapse:collapse;margin:16px 0}
td{padding:8px;border:1px solid #eee}
</style></head><body><div class="c">
<div class="h"><h1>Telled CRM</h1><p>${title}</p></div>
<div class="b">${content}</div>
<div class="f">© ${new Date().getFullYear()} Telled CRM</div>
</div></body></html>`;

const send = async (to: string, subject: string, html: string, attachments?: Array<{ filename: string; path: string }>) => {
  try {
    await createTransporter().sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to, subject, html,
      ...(attachments ? { attachments } : {}),
    });
    logger.info(`Email sent to ${to}: ${subject}`);
  } catch (e) { logger.error('Email failed:', e); }
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
  },
  pdfPath: string
) => {
  const html = base(`
    <h2 style="color:#4f2d7f">Dealer Registration Form — ${data.drfNumber}</h2>
    <p>Dear <b>${data.contactName}</b>,</p>
    <p>
      Your lead <b>${data.companyName}</b> has been <span style="color:#16a34a;font-weight:bold">Qualified</span>
      and a Dealer Registration Form (DRF) has been automatically raised on your behalf.
    </p>
    <table>
      <tr><td style="background:#f0eaf9;font-weight:bold">DRF Number</td><td>${data.drfNumber}</td></tr>
      <tr><td style="background:#f0eaf9;font-weight:bold">Version</td><td>v${data.version}</td></tr>
      <tr><td style="background:#f0eaf9;font-weight:bold">Company</td><td>${data.companyName}</td></tr>
      <tr><td style="background:#f0eaf9;font-weight:bold">OEM / Brand</td><td>${data.oemName || '—'}</td></tr>
      <tr><td style="background:#f0eaf9;font-weight:bold">Sales Executive</td><td>${data.salesName}</td></tr>
      <tr><td style="background:#f0eaf9;font-weight:bold">Status</td><td><span style="color:#d97706;font-weight:bold">Pending Review</span></td></tr>
    </table>
    <p style="margin-top:16px">
      Please find the DRF document attached. The form is now under review by the admin team.
      You will be notified once it is <b>Approved</b> or <b>Rejected</b>.
    </p>
    <p style="color:#888;font-size:12px">This is an auto-generated email from Telled CRM.</p>
  `, `DRF Raised — ${data.companyName}`);

  await send(to, `DRF ${data.drfNumber} — ${data.companyName} (Qualified)`, html, [
    { filename: `DRF-${data.drfNumber}.pdf`, path: pdfPath },
  ]);
};

export const sendOEMApprovalRequest = (to: string, company: string, oem: string, attempt: number) =>
  send(to, `OEM Approval Request - ${company} (Attempt #${attempt})`,
    base(`<h2>OEM Approval Request</h2><p>Company: <b>${company}</b></p><p>OEM: <b>${oem}</b></p><p>Attempt: <b>#${attempt}</b></p>`, 'OEM Approval Required'));

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

export default send;
