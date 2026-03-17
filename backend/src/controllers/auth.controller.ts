import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import Organization from '../models/Organization';
import { sendSuccess, sendError } from '../utils/response';
import { getTokensForUser, saveRefreshToken, verifyRefreshToken, clearRefreshToken } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';

// POST /api/auth/signup  — admin creates org + account
export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orgName, name, email, password } = req.body;
    if (!orgName || !name || !email || !password) {
      sendError(res, 'orgName, name, email and password are required', 400); return;
    }
    if (await User.findOne({ email: email.toLowerCase() })) {
      sendError(res, 'Email already registered', 409); return;
    }

    // Generate a unique slug from the org name
    const baseSlug = orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const suffix   = Math.random().toString(36).slice(2, 6);
    const slug     = `${baseSlug}-${suffix}`;

    // Create org with a temporary ownerId placeholder
    const placeholderId = new mongoose.Types.ObjectId();
    const org = await new Organization({ name: orgName, slug, ownerId: placeholderId }).save();

    // Create admin user belonging to this org
    const user = await new User({
      name, email, password,
      role: 'admin',
      organizationId: org._id,
      isActive: true,
    }).save();

    // Set real ownerId
    org.ownerId = user._id as mongoose.Types.ObjectId;
    await org.save();

    const { accessToken, refreshToken } = getTokensForUser(user);
    await saveRefreshToken(user._id.toString(), refreshToken);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    sendSuccess(res, {
      user: { id: user._id, name: user.name, email: user.email, role: user.role, organizationId: org._id },
      organization: { id: org._id, name: org.name, slug: org.slug },
      accessToken,
    }, 'Organization created successfully', 201);
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 11000) { sendError(res, 'Email or org slug already exists', 409); return; }
    sendError(res, 'Signup failed', 500);
  }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { sendError(res, 'Email and password required', 400); return; }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) { sendError(res, 'Invalid credentials', 401); return; }
    if (!await user.comparePassword(password)) { sendError(res, 'Invalid credentials', 401); return; }
    const { accessToken, refreshToken } = getTokensForUser(user);
    await saveRefreshToken(user._id.toString(), refreshToken);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    sendSuccess(res, {
      user: {
        id: user._id, name: user.name, email: user.email,
        role: user.role, organizationId: user.organizationId,
        department: user.department, phone: user.phone,
      },
      accessToken,
    }, 'Login successful');
  } catch { sendError(res, 'Login failed', 500); }
};

// POST /api/auth/refresh
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) { sendError(res, 'Refresh token required', 401); return; }
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== token) { sendError(res, 'Invalid refresh token', 401); return; }
    const { accessToken, refreshToken: newRefresh } = getTokensForUser(user);
    await saveRefreshToken(user._id.toString(), newRefresh);
    res.cookie('refreshToken', newRefresh, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    sendSuccess(res, { accessToken }, 'Token refreshed');
  } catch { sendError(res, 'Token refresh failed', 401); }
};

// POST /api/auth/logout
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user) await clearRefreshToken(req.user.id);
    res.clearCookie('refreshToken');
    sendSuccess(res, null, 'Logged out');
  } catch { sendError(res, 'Logout failed', 500); }
};

// GET /api/auth/me
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('-password -refreshToken');
    if (!user) { sendError(res, 'User not found', 404); return; }
    sendSuccess(res, user);
  } catch { sendError(res, 'Failed', 500); }
};
