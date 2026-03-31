import { Response } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';
import { generatePassword } from '../utils/password';
import { sendUserCredentialsEmail } from '../services/email.service';
import { redis } from '../config/redis';

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
      User.find(filter).select('-password -refreshToken').sort({ createdAt: -1 }).skip(skip).limit(limit),
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

    const normalizedEmail = email.toLowerCase();


    // ✅ DOMAIN VALIDATION (ONLY COMPANY EMAILS)
    const allowedDomains = process.env.ALLOWED_DOMAINS
      ? process.env.ALLOWED_DOMAINS.split(',').map(d => d.trim())
      : [];

    const emailDomain = normalizedEmail.split('@')[1];

    console.log("ENV DOMAINS:", process.env.ALLOWED_DOMAINS);
    console.log("PARSED DOMAINS:", allowedDomains);
    console.log("EMAIL DOMAIN:", emailDomain);

    if (!allowedDomains.includes(emailDomain)) {
      sendError(res, 'Only company emails allowed', 403);
      return;
    }

    // ✅ CHECK EXISTING USER
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      sendError(res, 'User already exists', 409);
      return;
    }

    // 🔐 AUTO PASSWORD
    const generatedPassword = generatePassword();

    // ✅ CREATE USER
    const user = await new User({
      name,
      email: normalizedEmail,
      password: generatedPassword,
      role,
      department,
      phone,
      baseSalary,
      organizationId: req.user!.organizationId,
    }).save();

    // 🔥 STORE TEMP PASSWORD IN REDIS (OPTIONAL)
    await redis.set(`user:${user._id}`, generatedPassword, { ex: 600 });

    // 📧 SEND EMAIL
    await sendUserCredentialsEmail(
      normalizedEmail,
      name,
      normalizedEmail,
      generatedPassword
    );

    sendSuccess(
      res,
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      'User created & credentials sent',
      201
    );

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
