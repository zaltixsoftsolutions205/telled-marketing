import { Response } from 'express';
import User from '../models/User';
import Lead from '../models/Lead';
import Installation from '../models/Installation';
import SupportTicket from '../models/SupportTicket';
import EngineerVisit from '../models/EngineerVisit';
import Salary from '../models/Salary';
import Leave from '../models/Leave';
import Attendance from '../models/Attendance';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';
import { sendEmailWithUserSmtp, UserSmtpConfig } from '../services/email.service';
import sendEmail from '../services/email.service';
import { detectSmtp, encryptText } from '../utils/crypto';
import { getUserSmtp, getUserSmtpWithFallback } from '../utils/getUserSmtp';

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { role, search, isActive } = req.query;
    const filter: Record<string, unknown> = { organizationId: req.user!.organizationId };
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      const re = { $regex: sanitizeQuery(search as string), $options: 'i' };
      filter.$or = [{ name: re }, { email: re }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).select('-password -refreshToken -emailPassword').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    sendPaginated(res, users, total, page, limit);
  } catch { sendError(res, 'Failed to fetch users', 500); }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, role, department, phone, baseSalary } = req.body;

    if (!name || !email || !role) {
      sendError(res, 'Name, email, role required', 400);
      return;
    }

    const requesterRole = req.user!.role;
    // HR cannot create admin/manager/platform_admin accounts
    if (requesterRole === 'hr' && (role === 'admin' || role === 'manager' || role === 'platform_admin')) {
      sendError(res, 'HR cannot create Admin or Manager accounts', 403);
      return;
    }
    // Manager cannot create admin/manager/platform_admin accounts
    if (requesterRole === 'manager' && (role === 'admin' || role === 'manager' || role === 'platform_admin')) {
      sendError(res, 'Manager cannot create Admin accounts', 403);
      return;
    }

    const normalizedEmail = email.toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      sendError(res, 'User already exists', 409);
      return;
    }

    // Create user with pending password — user will set their own password on first login
    const user = await new User({
      name,
      email: normalizedEmail,
      password: 'pending',
      role,
      department,
      phone,
      baseSalary,
      organizationId: req.user!.organizationId,
      isActive: true,
      mustSetPassword: true,
    }).save();

    // Fetch org name
    const Organization = (await import('../models/Organization')).default;
    const org = await Organization.findById(req.user!.organizationId).select('name').lean();
    const orgName = org?.name || '';
    const loginUrl = `${process.env.APP_URL || (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()}/login`;

    // Load the logged-in user's SMTP config — welcome email falls back to system SMTP if needed
    const senderSmtp = await getUserSmtp(req.user!.id);

    const roleLabel: Record<string, string> = {
      admin: 'Admin', manager: 'Manager', sales: 'Sales', engineer: 'Engineer', hr: 'HR', finance: 'Finance',
    };
    const displayRole = roleLabel[role] || role;

    // Welcome email — no generated password, user logs in with their own email password
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:30px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(135deg,#4f2d7f,#6b46c1);color:#fff;padding:28px;text-align:center">
      <h2 style="margin:0;font-size:20px">Welcome to ZIEOS</h2>
      <p style="margin:6px 0 0;opacity:.85;font-size:13px">${orgName}</p>
    </div>
    <div style="padding:28px">
      <p style="color:#374151;margin-top:0">Hi <strong>${name}</strong>,</p>
      <p style="color:#374151">You have been added to <strong>${orgName}</strong> as <strong>${displayRole}</strong>.</p>

      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:20px;margin:20px 0">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-weight:600;width:40%">Login URL</td>
            <td style="padding:8px 0"><a href="${loginUrl}" style="color:#7c3aed">${loginUrl}</a></td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-weight:600;border-top:1px solid #ede9fe">Your Email</td>
            <td style="padding:8px 0;border-top:1px solid #ede9fe"><strong>${normalizedEmail}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-weight:600;border-top:1px solid #ede9fe">Password</td>
            <td style="padding:8px 0;border-top:1px solid #ede9fe;color:#374151">Use your own email account password</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-weight:600;border-top:1px solid #ede9fe">Role</td>
            <td style="padding:8px 0;border-top:1px solid #ede9fe">${displayRole}</td>
          </tr>
        </table>
      </div>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;font-size:13px;color:#15803d;margin-bottom:20px">
        <strong>How to login:</strong> Go to the login page, enter your email address (<strong>${normalizedEmail}</strong>), and use your own email account password (the password you use to access your email inbox).
      </div>

      <div style="text-align:center;margin-bottom:20px">
        <a href="${loginUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px">Login Now →</a>
      </div>
    </div>
    <div style="background:#f8f8f8;padding:14px;text-align:center;font-size:11px;color:#9ca3af">
      © ${new Date().getFullYear()} ZIEOS
    </div>
  </div>
</body>
</html>`;

    const subject = `Welcome to ZIEOS — You've been added to ${orgName}`;

    // Welcome email — send from admin's own email; system SMTP is the final fallback
    // so new users always receive their welcome regardless of admin email config
    let emailSent = true;
    try {
      if (senderSmtp) {
        await sendEmailWithUserSmtp(normalizedEmail, subject, html, senderSmtp);
      } else {
        await sendEmail(normalizedEmail, subject, html);
      }
    } catch {
      try {
        await sendEmail(normalizedEmail, subject, html);
      } catch (finalErr: any) {
        emailSent = false;
        console.error('[createUser] Welcome email failed:', finalErr?.message);
      }
    }

    sendSuccess(res, {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailSent,
    }, emailSent ? 'User created — welcome email sent' : 'User created — welcome email could not be sent', 201);

  } catch (e) {
    console.error(e);
    sendError(res, 'Failed to create user', 500);
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    ['password', 'refreshToken', 'organizationId'].forEach(f => delete req.body[f]);
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user!.organizationId },
      req.body,
      { new: true, runValidators: true }
    ).select('-password -refreshToken');
    if (!user) { sendError(res, 'User not found', 404); return; }
    sendSuccess(res, user, 'User updated');
  } catch { sendError(res, 'Failed to update user', 500); }
};

export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ _id: req.params.id, organizationId: req.user!.organizationId });
    if (!user) { sendError(res, 'User not found', 404); return; }
    if (user._id.toString() === req.user!.id) { sendError(res, 'Cannot deactivate your own account', 400); return; }
    // HR cannot deactivate admin accounts
    if (req.user!.role === 'hr' && user.role === 'admin') { sendError(res, 'HR cannot deactivate Admin accounts', 403); return; }
    user.isActive = !user.isActive;
    await user.save();
    sendSuccess(res, { isActive: user.isActive }, `User ${user.isActive ? 'activated' : 'deactivated'}`);
  } catch { sendError(res, 'Failed', 500); }
};

export const resetPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) { sendError(res, 'Password must be at least 6 characters', 400); return; }
    const user = await User.findOne({ _id: req.params.id, organizationId: req.user!.organizationId });
    if (!user) { sendError(res, 'User not found', 404); return; }
    user.password = password;
    await user.save();
    sendSuccess(res, null, 'Password reset');
  } catch { sendError(res, 'Failed', 500); }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orgId = req.user!.organizationId;

    if (id === req.user!.id) {
      sendError(res, 'You cannot delete your own account', 400); return;
    }

    const user = await User.findOne({ _id: id, organizationId: orgId });
    if (!user) { sendError(res, 'User not found', 404); return; }

    // Cascade: nullify optional references, delete owned records
    await Promise.all([
      Lead.updateMany({ assignedTo: id }, { $unset: { assignedTo: '' } }),
      Installation.deleteMany({ engineerId: id }),
      SupportTicket.deleteMany({ createdBy: id }),
      EngineerVisit.deleteMany({ engineerId: id }),
      Salary.deleteMany({ employeeId: id }),
      Leave.deleteMany({ employeeId: id }),
      Attendance.deleteMany({ employeeId: id }),
      Notification.deleteMany({ userId: id }),
    ]);

    await User.deleteOne({ _id: id, organizationId: orgId });
    sendSuccess(res, null, 'User deleted');
  } catch { sendError(res, 'Failed to delete user', 500); }
};

// PUT /api/users/me/email-config  — save app password for sending DRF emails
export const updateEmailConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { appPassword, smtpHost: bodyHost, smtpPort: bodyPort, smtpSecure: bodySecure } = req.body;
    if (!appPassword) { sendError(res, 'App password is required', 400); return; }

    const user = await User.findById(req.user!.id);
    if (!user) { sendError(res, 'User not found', 404); return; }

    // Use explicitly provided host, or auto-detect, or existing
    const auto = detectSmtp(user.email);
    const smtpHost   = bodyHost   || auto.host   || user.smtpHost   || '';
    const smtpPort   = bodyPort   ? Number(bodyPort)   : (auto.port   || user.smtpPort   || 587);
    const smtpSecure = bodySecure !== undefined ? bodySecure : (auto.secure ?? user.smtpSecure ?? false);

    if (!smtpHost) { sendError(res, 'Could not detect SMTP host. Please provide smtpHost.', 400); return; }

    await User.findByIdAndUpdate(req.user!.id, {
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser:   user.email,
      smtpPass:   encryptText(appPassword),
    });

    sendSuccess(res, null, 'Email configuration saved');
  } catch { sendError(res, 'Failed to save email config', 500); }
};

// PUT /api/users/:id — allow users to update their own IMAP settings (non-admin self-update)
export const updateMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = req.params.id;
    // Non-admins can only update themselves
    if (req.user!.role !== 'admin' && targetId !== req.user!.id) {
      sendError(res, 'Forbidden', 403); return;
    }
    const allowed = ['name', 'phone', 'department'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key];
    }
    const user = await User.findByIdAndUpdate(targetId, update, { new: true, runValidators: true })
      .select('-password -refreshToken -smtpPass');
    if (!user) { sendError(res, 'User not found', 404); return; }
    sendSuccess(res, user, 'Profile updated');
  } catch { sendError(res, 'Failed to update profile', 500); }
};
