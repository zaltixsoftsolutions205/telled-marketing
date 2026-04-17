import { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import AdminApplication from '../models/AdminApplication';
import { sendError, sendSuccess } from '../utils/response';
import { generateOTP, saveOTP, verifyOTP } from '../services/otp.service';
import { sendOTPEmail, sendApplicationNotificationEmail } from '../services/email.service';
import { redis } from '../config/redis';

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

    sendApplicationNotificationEmail({
      orgName, contactName, email: normalizedEmail,
      phone, address, city, state, businessType,
      gstNumber,
      applicationId: appId,
      approveUrl,
      rejectUrl,
      documentPaths,
    }).catch(e => console.error('Admin notification email failed:', e));

    sendSuccess(
      res,
      { applicationId: appId },
      'Application submitted successfully. We will review your documents and respond via email.',
      201
    );
  } catch (e: any) {
    console.error('Register submit error:', e);
    if (e.code === 11000) return sendError(res, 'Email already submitted', 409);
    sendError(res, 'Failed to submit application', 500);
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
