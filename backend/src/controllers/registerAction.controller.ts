/**
 * Magic-link action endpoints — opened directly from the notification email.
 * These return HTML pages (not JSON) since they are accessed via browser from email links.
 */
import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import AdminApplication from '../models/AdminApplication';
import User from '../models/User';
import Organization from '../models/Organization';
import { redis } from '../config/redis';
import { sendApprovalEmail, sendRejectionEmail } from '../services/email.service';

// ── helpers ────────────────────────────────────────────────────────────────

const htmlPage = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — ZIEOS</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#f4f4f4;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);max-width:520px;width:100%;overflow:hidden}
    .hdr{background:linear-gradient(135deg,#4f2d7f,#6b46c1);color:#fff;padding:28px;text-align:center}
    .hdr h1{font-size:20px;font-weight:700;margin-bottom:4px}
    .hdr p{opacity:.85;font-size:13px}
    .body{padding:28px}
    .btn{display:inline-block;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;border:none;cursor:pointer;width:100%;margin-top:8px;text-align:center}
    .btn-green{background:#16a34a;color:#fff}
    .btn-red{background:#dc2626;color:#fff}
    .btn-gray{background:#e5e7eb;color:#374151}
    textarea,input{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:10px 12px;font-size:14px;font-family:Arial,sans-serif;margin-top:6px;resize:vertical}
    textarea:focus,input:focus{outline:2px solid #7c3aed;border-color:transparent}
    label{font-size:13px;font-weight:600;color:#374151}
    .alert{padding:14px;border-radius:8px;font-size:13px;margin-bottom:16px}
    .alert-green{background:#f0fdf4;border:1px solid #86efac;color:#166534}
    .alert-red{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
    .alert-orange{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412}
    .row{display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px}
    .row span:first-child{color:#6b7280;font-weight:600}
    .row span:last-child{color:#111827}
    .ft{text-align:center;font-size:11px;color:#9ca3af;padding:14px}
  </style>
</head>
<body>
  <div class="card">
    <div class="hdr"><h1>ZIEOS</h1><p>Admin Application Review</p></div>
    <div class="body">${body}</div>
    <div class="ft">© ${new Date().getFullYear()} ZIEOS</div>
  </div>
</body>
</html>`;

// ── GET /api/register/action/approve/:token ───────────────────────────────

export const actionApprove = async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const appId = await redis.get(`app_approve:${token}`);
    if (!appId) {
      return res.status(400).send(htmlPage('Invalid Link', `
        <div class="alert alert-red">
          <strong>Link expired or already used.</strong><br/>
          This approval link is no longer valid. Please use the admin portal to manage this application.
        </div>
        <a href="${process.env.APP_URL || (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()}/admin-applications" class="btn btn-gray">Go to Admin Portal</a>
      `));
    }

    const app = await AdminApplication.findById(appId);
    if (!app) {
      await redis.del(`app_approve:${token}`);
      return res.status(404).send(htmlPage('Not Found', `
        <div class="alert alert-red"><strong>Application not found.</strong></div>
      `));
    }

    if (app.status === 'approved') {
      await redis.del(`app_approve:${token}`);
      return res.send(htmlPage('Already Approved', `
        <div class="alert alert-orange">
          <strong>This application was already approved.</strong><br/>
          Login credentials were sent to <strong>${app.email}</strong>.
        </div>
        <a href="${process.env.APP_URL || (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()}/admin-applications" class="btn btn-gray" style="margin-top:16px">View Admin Portal</a>
      `));
    }

    if (app.status === 'rejected') {
      await redis.del(`app_approve:${token}`);
      return res.status(409).send(htmlPage('Already Rejected', `
        <div class="alert alert-red">
          <strong>This application was already rejected.</strong><br/>
          You cannot approve a rejected application.
        </div>
      `));
    }

    // ── Create org + admin user ──
    const password = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) + '@1';

    const baseSlug = app.orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const placeholderId = new mongoose.Types.ObjectId();
    const org = await new Organization({ name: app.orgName, slug, ownerId: placeholderId, isActive: true }).save();

    const user = await new User({
      name: app.contactName,
      email: app.email,
      password,
      role: 'admin',
      phone: app.phone,
      organizationId: org._id,
      isActive: true,
    }).save();

    org.ownerId = user._id as mongoose.Types.ObjectId;
    await org.save();

    app.status = 'approved';
    app.approvedBy = 'email_action';
    app.approvedAt = new Date();
    app.createdUserId = user._id as mongoose.Types.ObjectId;
    await app.save();

    // Invalidate both tokens (one-time use)
    await Promise.all([
      redis.del(`app_approve:${token}`),
      redis.del(`app_reject:${token}`), // also invalidate reject token if still pending
    ]);

    // Send credentials to applicant
    await sendApprovalEmail({
      to: app.email,
      contactName: app.contactName,
      orgName: app.orgName,
      loginEmail: app.email,
      password,
    });

    return res.send(htmlPage('Application Approved', `
      <div class="alert alert-green">
        <strong>✅ Application Approved Successfully!</strong><br/>
        Login credentials have been sent to the applicant.
      </div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:16px 0">
        <div class="row"><span>Organization</span><span>${app.orgName}</span></div>
        <div class="row"><span>Contact Person</span><span>${app.contactName}</span></div>
        <div class="row"><span>Email</span><span>${app.email}</span></div>
        <div class="row"><span>Status</span><span style="color:#16a34a;font-weight:700">Approved ✅</span></div>
      </div>
      <p style="font-size:13px;color:#6b7280;margin-bottom:16px">
        The applicant will receive their login credentials at <strong>${app.email}</strong> shortly.
      </p>
      <a href="${process.env.APP_URL || (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()}/admin-applications" class="btn btn-gray">View All Applications</a>
    `));

  } catch (e: any) {
    console.error('Action approve error:', e);
    if (e.code === 11000) {
      return res.status(409).send(htmlPage('Already Exists', `
        <div class="alert alert-orange">
          <strong>This email is already registered as a user.</strong><br/>
          A duplicate account cannot be created.
        </div>
      `));
    }
    return res.status(500).send(htmlPage('Error', `
      <div class="alert alert-red"><strong>An error occurred.</strong> Please try again or use the admin portal.</div>
    `));
  }
};

// ── GET /api/register/action/reject/:token — show reason form ─────────────

export const actionRejectForm = async (req: Request, res: Response) => {
  const { token } = req.params;

  const appId = await redis.get(`app_reject:${token}`);
  if (!appId) {
    return res.status(400).send(htmlPage('Invalid Link', `
      <div class="alert alert-red">
        <strong>Link expired or already used.</strong><br/>
        This rejection link is no longer valid.
      </div>
      <a href="${process.env.APP_URL || (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()}/admin-applications" class="btn btn-gray" style="margin-top:16px">Go to Admin Portal</a>
    `));
  }

  const app = await AdminApplication.findById(appId).catch(() => null);
  if (!app) {
    return res.status(404).send(htmlPage('Not Found', `
      <div class="alert alert-red"><strong>Application not found.</strong></div>
    `));
  }

  if (app.status !== 'pending_approval') {
    await redis.del(`app_reject:${token}`);
    return res.send(htmlPage('Already Processed', `
      <div class="alert alert-orange">
        <strong>This application has already been ${app.status}.</strong><br/>
        No further action needed.
      </div>
    `));
  }

  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

  return res.send(htmlPage('Reject Application', `
    <div style="margin-bottom:20px">
      <p style="font-size:14px;color:#374151;margin-bottom:12px">You are about to <strong style="color:#dc2626">reject</strong> the following application:</p>
      <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
        <div class="row"><span>Organization</span><span>${app.orgName}</span></div>
        <div class="row"><span>Contact Person</span><span>${app.contactName}</span></div>
        <div class="row"><span>Email</span><span>${app.email}</span></div>
        <div class="row"><span>Business Type</span><span>${app.businessType}</span></div>
      </div>
    </div>

    <form method="POST" action="${backendUrl}/api/register/action/reject/${token}">
      <label for="reason">Reason for Rejection <span style="color:#dc2626">*</span></label>
      <textarea id="reason" name="reason" rows="4" required placeholder="Please provide a clear reason so the applicant understands what to improve or resubmit…"></textarea>
      <button type="submit" class="btn btn-red" style="margin-top:16px">Confirm Rejection & Notify Applicant</button>
    </form>
    <a href="${process.env.APP_URL || (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()}/admin-applications" class="btn btn-gray" style="margin-top:8px">Cancel — Go to Admin Portal</a>
  `));
};

// ── POST /api/register/action/reject/:token — process rejection ───────────

export const actionRejectSubmit = async (req: Request, res: Response) => {
  const { token } = req.params;
  const { reason } = req.body as { reason?: string };

  try {
    if (!reason?.trim()) {
      return res.status(400).send(htmlPage('Missing Reason', `
        <div class="alert alert-red"><strong>A rejection reason is required.</strong></div>
        <a href="javascript:history.back()" class="btn btn-gray" style="margin-top:16px">← Go Back</a>
      `));
    }

    const appId = await redis.get(`app_reject:${token}`);
    if (!appId) {
      return res.status(400).send(htmlPage('Invalid Link', `
        <div class="alert alert-red"><strong>Link expired or already used.</strong></div>
      `));
    }

    const app = await AdminApplication.findById(appId);
    if (!app) {
      return res.status(404).send(htmlPage('Not Found', `
        <div class="alert alert-red"><strong>Application not found.</strong></div>
      `));
    }

    if (app.status !== 'pending_approval') {
      await redis.del(`app_reject:${token}`);
      return res.send(htmlPage('Already Processed', `
        <div class="alert alert-orange">
          <strong>This application has already been ${app.status}.</strong>
        </div>
      `));
    }

    app.status = 'rejected';
    app.rejectionReason = reason.trim();
    app.rejectedAt = new Date();
    await app.save();

    // Invalidate tokens
    await Promise.all([
      redis.del(`app_reject:${token}`),
      redis.del(`app_approve:${token}`),
    ]);

    // Send rejection email to applicant
    await sendRejectionEmail({
      to: app.email,
      contactName: app.contactName,
      orgName: app.orgName,
      reason: reason.trim(),
    });

    return res.send(htmlPage('Application Rejected', `
      <div class="alert alert-red">
        <strong>❌ Application Rejected.</strong><br/>
        A notification with the reason has been sent to the applicant.
      </div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:16px 0">
        <div class="row"><span>Organization</span><span>${app.orgName}</span></div>
        <div class="row"><span>Applicant Email</span><span>${app.email}</span></div>
        <div class="row"><span>Status</span><span style="color:#dc2626;font-weight:700">Rejected ❌</span></div>
        <div class="row"><span>Reason Sent</span><span style="max-width:280px;word-break:break-word">${reason.trim()}</span></div>
      </div>
      <a href="${process.env.APP_URL || (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()}/admin-applications" class="btn btn-gray">View All Applications</a>
    `));

  } catch (e) {
    console.error('Action reject error:', e);
    return res.status(500).send(htmlPage('Error', `
      <div class="alert alert-red"><strong>An error occurred.</strong> Please try again.</div>
    `));
  }
};
