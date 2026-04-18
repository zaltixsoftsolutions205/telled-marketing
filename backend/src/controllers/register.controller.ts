import { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import AdminApplication from '../models/AdminApplication';
import { sendError, sendSuccess } from '../utils/response';
import { generateOTP, saveOTP, verifyOTP } from '../services/otp.service';
import { sendOTPEmail, sendApplicationNotificationEmail } from '../services/email.service';
import { redis } from '../config/redis';
import logger from '../utils/logger';

const ACTION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

// POST /api/register/send-otp
export const registerSendOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 'Email is required', 400);

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await AdminApplication.findOne({ email: normalizedEmail });
    if (existing?.status === 'approved') {
      return sendError(res, 'This email is already registered. Please login.', 409);
    }

    const otp = generateOTP();
    await saveOTP(normalizedEmail, otp);
    await sendOTPEmail(normalizedEmail, otp);

    sendSuccess(res, null, 'OTP sent to your email. Valid for 5 minutes.');
  } catch (e) {
    console.error('Register OTP error:', e);
    sendError(res, 'Failed to send OTP', 500);
  }
};

// POST /api/register/verify-otp
export const registerVerifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return sendError(res, 'Email and OTP are required', 400);

    const normalizedEmail = email.toLowerCase().trim();
    const isValid = await verifyOTP(normalizedEmail, otp);
    if (!isValid) return sendError(res, 'Invalid or expired OTP', 400);

    sendSuccess(res, { emailVerified: true }, 'Email verified successfully');
  } catch (e) {
    console.error('Register verify OTP error:', e);
    sendError(res, 'OTP verification failed', 500);
  }
};

// POST /api/register/submit  (multipart/form-data)
export const registerSubmit = async (req: Request, res: Response) => {
  try {
    const {
      orgName, contactName, email, phone,
      address, city, state, businessType, gstNumber,
    } = req.body;

    if (!orgName || !contactName || !email || !phone || !address || !city || !state || !businessType) {
      return sendError(res, 'All required fields must be filled', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await AdminApplication.findOne({ email: normalizedEmail });
    if (existing) {
      if (existing.status === 'approved') {
        return sendError(res, 'This email is already registered. Please login.', 409);
      }
      // Clean up any previous application (pending or rejected) so they can reapply
      const oldId = (existing._id as any).toString();
      await Promise.all([
        AdminApplication.deleteOne({ email: normalizedEmail }),
        redis.del(`app_approve:${oldId}`),
        redis.del(`app_reject:${oldId}`),
      ]);
    }

    // Build documents from multer fields
    const filesMap = req.files as Record<string, Express.Multer.File[]>;
    const documents = Object.entries(filesMap || {}).flatMap(([fieldname, fileArr]) =>
      fileArr.map((f) => ({
        type: fieldname as any,
        filename: f.filename,
        originalName: f.originalname,
        path: f.path,
        mimetype: f.mimetype,
        size: f.size,
      }))
    );

    const application = await new AdminApplication({
      orgName, contactName, email: normalizedEmail,
      phone, address, city, state, businessType,
      gstNumber: gstNumber || undefined,
      emailVerified: true,
      documents,
      status: 'pending_approval',
    }).save();

    const appId = (application._id as any).toString();

    // Generate one-time action tokens (stored in Redis, 7-day TTL)
    const approveToken = crypto.randomBytes(32).toString('hex');
    const rejectToken  = crypto.randomBytes(32).toString('hex');
    await Promise.all([
      redis.set(`app_approve:${approveToken}`, appId, { ex: ACTION_TTL }),
      redis.set(`app_reject:${rejectToken}`,  appId, { ex: ACTION_TTL }),
    ]);

    // Build action URLs pointing to the backend directly
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const approveUrl = `${backendUrl}/api/register/action/approve/${approveToken}`;
    const rejectUrl  = `${backendUrl}/api/register/action/reject/${rejectToken}`;

    const documentPaths = documents.map(d => ({
      label: `${d.type}_${d.originalName}`,
      path: path.resolve(d.path),
    }));

    try {
      await sendApplicationNotificationEmail({
        orgName, contactName, email: normalizedEmail,
        phone, address, city, state, businessType,
        gstNumber,
        applicationId: appId,
        approveUrl,
        rejectUrl,
        documentPaths,
      });
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.USER_EMAIL_FROM || '';
      logger.info(`[Register] Notification email sent to admin (${adminEmail}) for application ${appId}`);
      console.log(`✅ [Register] Notification email sent to: ${adminEmail}`);
    } catch (emailErr: any) {
      logger.error('[Register] Failed to send admin notification email:', emailErr);
      console.error(`❌ [Register] Email send FAILED for application ${appId}:`, emailErr?.message || emailErr);
    }

    sendSuccess(
      res,
      { applicationId: appId },
      'Application submitted successfully. We will review your documents and respond via email.',
      201
    );
  } catch (e: any) {
    console.error('Register submit error:', e);
    if (e.code === 11000) return sendError(res, 'Email already submitted', 409);
    sendError(res, `Failed to submit application: ${e?.message || e}`, 500);
  }
};

// GET /api/register/test-email  — test admin notification email config
export const testEmail = async (_req: Request, res: Response) => {
  const config = {
    USER_SMTP_HOST:  process.env.USER_SMTP_HOST  || '(not set)',
    USER_SMTP_PORT:  process.env.USER_SMTP_PORT  || '(not set)',
    USER_SMTP_USER:  process.env.USER_SMTP_USER  || '(not set)',
    USER_SMTP_PASS:  process.env.USER_SMTP_PASS  ? '✅ set' : '❌ NOT SET',
    USER_EMAIL_FROM: process.env.USER_EMAIL_FROM || '(not set)',
    ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL || '(not set)',
  };

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.USER_SMTP_HOST || 'smtp.hostinger.com',
      port: Number(process.env.USER_SMTP_PORT || 465),
      secure: true,
      auth: {
        user: process.env.USER_SMTP_USER,
        pass: process.env.USER_SMTP_PASS,
      },
    });

    await transporter.verify();

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.USER_EMAIL_FROM || '';
    await transporter.sendMail({
      from: `"ZIEOS Test" <${process.env.USER_EMAIL_FROM}>`,
      to: adminEmail,
      subject: '✅ ZIEOS Email Test — Production',
      html: `<p>This is a test email from your ZIEOS production server. If you received this, email sending is working correctly.</p><p>Config used: ${JSON.stringify(config)}</p>`,
    });

    sendSuccess(res, { config, sent: true }, `Test email sent to: ${adminEmail}`);
  } catch (err: any) {
    res.status(500).json({ success: false, config, error: err?.message || String(err) });
  }
};

// GET /api/register/status?email=xxx
export const registerStatus = async (req: Request, res: Response) => {
  try {
    const { email } = req.query as { email: string };
    if (!email) return sendError(res, 'Email is required', 400);

    const app = await AdminApplication.findOne(
      { email: email.toLowerCase().trim() },
      'status orgName contactName createdAt'
    );

    if (!app) return sendError(res, 'No application found for this email', 404);

    sendSuccess(res, {
      status: app.status,
      orgName: app.orgName,
      contactName: app.contactName,
      submittedAt: app.createdAt,
    });
  } catch (e) {
    sendError(res, 'Failed to fetch status', 500);
  }
};
