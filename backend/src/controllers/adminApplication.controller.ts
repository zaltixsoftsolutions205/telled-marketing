import { Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import AdminApplication from '../models/AdminApplication';
import User from '../models/User';
import Organization from '../models/Organization';
import { sendError, sendSuccess } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendApprovalEmail, sendRejectionEmail } from '../services/email.service';

// GET /api/admin-applications  — platform_admin only
export const listApplications = async (_req: Request, res: Response) => {
  try {
    const apps = await AdminApplication.find()
      .sort({ createdAt: -1 })
      .select('-documents.path'); // don't expose server paths to frontend

    sendSuccess(res, apps);
  } catch (e) {
    sendError(res, 'Failed to fetch applications', 500);
  }
};

// GET /api/admin-applications/:id  — platform_admin only
export const getApplication = async (req: Request, res: Response) => {
  try {
    const app = await AdminApplication.findById(req.params.id);
    if (!app) return sendError(res, 'Application not found', 404);
    sendSuccess(res, app);
  } catch (e) {
    sendError(res, 'Failed to fetch application', 500);
  }
};

// POST /api/admin-applications/:id/approve  — platform_admin only
export const approveApplication = async (req: AuthRequest, res: Response) => {
  try {
    const app = await AdminApplication.findById(req.params.id);
    if (!app) return sendError(res, 'Application not found', 404);
    if (app.status === 'approved') return sendError(res, 'Already approved', 409);

    const baseSlug = app.orgName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const suffix = Math.random().toString(36).slice(2, 6);
    const slug = `${baseSlug}-${suffix}`;

    const placeholderId = new mongoose.Types.ObjectId();
    const org = await new Organization({
      name: app.orgName,
      slug,
      ownerId: placeholderId,
      isActive: true,
    }).save();

    const user = await new User({
      name: app.contactName,
      email: app.email,
      password: 'pending',
      role: 'admin',
      phone: app.phone,
      organizationId: org._id,
      isActive: true,
      mustSetPassword: true,
      smtpHost:   (app as any).smtpHost,
      smtpPort:   (app as any).smtpPort,
      smtpSecure: (app as any).smtpSecure,
      smtpUser:   (app as any).smtpUser || app.email,
      smtpPass:   (app as any).smtpPass,
    }).save();

    org.ownerId = user._id as mongoose.Types.ObjectId;
    await org.save();

    // Update application
    app.status = 'approved';
    app.approvedBy = req.user?.email || 'platform_admin';
    app.approvedAt = new Date();
    app.createdUserId = user._id as mongoose.Types.ObjectId;
    await app.save();

    await sendApprovalEmail({
      to: app.email,
      contactName: app.contactName,
      orgName: app.orgName,
      loginEmail: app.email,
    });

    sendSuccess(res, {
      userId: user._id,
      orgId: org._id,
      email: app.email,
    }, 'Application approved and credentials sent');
  } catch (e: any) {
    console.error('Approve error:', e);
    if (e.code === 11000) return sendError(res, 'Email already exists as a user', 409);
    sendError(res, 'Failed to approve application', 500);
  }
};

// POST /api/admin-applications/:id/reject  — platform_admin only
export const rejectApplication = async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const app = await AdminApplication.findById(req.params.id);
    if (!app) return sendError(res, 'Application not found', 404);
    if (app.status === 'approved') return sendError(res, 'Cannot reject an approved application', 409);

    app.status = 'rejected';
    app.rejectionReason = reason || 'Application did not meet our requirements.';
    app.rejectedAt = new Date();
    await app.save();

    await sendRejectionEmail({
      to: app.email,
      contactName: app.contactName,
      orgName: app.orgName,
      reason: app.rejectionReason || '',
    });

    sendSuccess(res, null, 'Application rejected and applicant notified');
  } catch (e) {
    console.error('Reject error:', e);
    sendError(res, 'Failed to reject application', 500);
  }
};
