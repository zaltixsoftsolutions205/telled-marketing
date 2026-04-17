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
import { sendWelcomeEmail } from '../services/email.service';
import { encryptText, detectSmtp } from '../utils/crypto';

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
    const { name, email, role, department, phone, baseSalary, emailPassword } = req.body;

    if (!name || !email || !role) {
      sendError(res, 'Name, email, role required', 400);
      return;
    }

    const normalizedEmail = email.toLowerCase();

    // ✅ CHECK EXISTING USER
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      sendError(res, 'User already exists', 409);
      return;
    }

    // ✅ CREATE USER — password will be set on first login
    const user = await new User({
      name,
      email: normalizedEmail,
      password: 'pending',
      role,
      department,
      phone,
      baseSalary,
      organizationId: req.user!.organizationId,
      isActive: false,
      mustSetPassword: true,
    }).save();

    // Fetch org name for the email
    const Organization = (await import('../models/Organization')).default;
    const org = await Organization.findById(req.user!.organizationId).select('name').lean();

    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;

    // 📧 SEND WELCOME EMAIL
    await sendWelcomeEmail({
      to: normalizedEmail,
      name,
      role,
      orgName: org?.name || '',
      loginUrl,
    });

    sendSuccess(res, { id: user._id, name: user.name, email: user.email, role: user.role }, 'User created — welcome email sent', 201);

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
    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user!.id) { sendError(res, 'Cannot deactivate your own account', 400); return; }
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
    const { appPassword } = req.body;
    if (!appPassword) { sendError(res, 'App password is required', 400); return; }

    const user = await User.findById(req.user!.id);
    if (!user) { sendError(res, 'User not found', 404); return; }

    const smtp = detectSmtp(user.email);
    await User.findByIdAndUpdate(req.user!.id, {
      smtpHost:   smtp.host,
      smtpPort:   smtp.port,
      smtpSecure: smtp.secure,
      smtpUser:   user.email,
      smtpPass:   encryptText(appPassword),
    });

    sendSuccess(res, null, 'Email configuration saved');
  } catch { sendError(res, 'Failed to save email config', 500); }
};
