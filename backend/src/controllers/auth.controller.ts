import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import Organization from '../models/Organization';
import { sendSuccess, sendError } from '../utils/response';
import {
  getTokensForUser,
  saveRefreshToken,
  verifyRefreshToken,
  clearRefreshToken
} from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { verifyOTP } from '../services/otp.service';
import jwt from 'jsonwebtoken';
import { redis } from '../config/redis';

// ✅ Load allowed emails from .env
const allowedEmails = (process.env.ALLOWED_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// POST /api/auth/signup  — admin creates org + account
export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orgName, name, email, password, otp } = req.body;

    // ✅ Required fields check
    if (!orgName || !name || !email || !password || !otp) {
      sendError(res, 'orgName, name, email, password and otp are required', 400);
      return;
    }

    const normalizedEmail = email.toLowerCase();

    // 🔐 STEP 1: Check allowed emails
    if (!allowedEmails.includes(normalizedEmail)) {
      sendError(res, 'This email is not authorized for admin registration', 403);
      return;
    }

    // 🔐 STEP 2: Verify OTP
    const isValidOtp = await verifyOTP(normalizedEmail, otp);

    if (!isValidOtp) {
      sendError(res, 'Invalid or expired OTP', 400);
      return;
    }

    // 🔐 STEP 3: Check existing user
    if (await User.findOne({ email: normalizedEmail })) {
      sendError(res, 'Email already registered', 409);
      return;
    }

    // 🔐 STEP 4: Generate unique org slug
    const baseSlug = orgName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const suffix = Math.random().toString(36).slice(2, 6);
    const slug = `${baseSlug}-${suffix}`;

    // 🔐 STEP 5: Create organization
    const placeholderId = new mongoose.Types.ObjectId();

    const org = await new Organization({
      name: orgName,
      slug,
      ownerId: placeholderId
    }).save();

    // 🔐 STEP 6: Create admin user
    const user = await new User({
      name,
      email: normalizedEmail,
      password,
      role: 'admin',
      organizationId: org._id,
      isActive: true
    }).save();

    // 🔐 STEP 7: Assign owner
    org.ownerId = user._id as mongoose.Types.ObjectId;
    await org.save();

    // 🔐 STEP 8: Generate tokens
    const { accessToken, refreshToken } = getTokensForUser(user);
    await saveRefreshToken(user._id.toString(), refreshToken);

    // 🔐 STEP 9: Set cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // ✅ SUCCESS RESPONSE
    sendSuccess(
      res,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: org._id
        },
        organization: {
          id: org._id,
          name: org.name,
          slug: org.slug
        },
        accessToken
      },
      'Organization created successfully',
      201
    );

  } catch (e: unknown) {
    if ((e as { code?: number }).code === 11000) {
      sendError(res, 'Email or org slug already exists', 409);
      return;
    }
    sendError(res, 'Signup failed', 500);
  }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return sendError(res, 'Invalid credentials', 401);
    }

    // 🔐 ACCESS TOKEN
    const accessToken = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.JWT_ACCESS_SECRET as string,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES as any }
    );

    // 🔁 REFRESH TOKEN
    const refreshToken = jwt.sign(
      { id: user._id.toString() },
      process.env.JWT_REFRESH_SECRET as string,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES as any }
    );

    // ✅ STORE IN REDIS
    await redis.set(
      `refresh:${user._id}`,
      refreshToken,
      { ex: 7 * 24 * 60 * 60 }
    );

    // 🔥 SESSION CONTROL (IMPORTANT)
    await redis.set(
      `session:${user._id}`,
      'active',
      { ex: 15 * 60 }
    );

    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    }, 'Login successful');

  } catch (e) {
    console.error(e);
    sendError(res, 'Login failed', 500);
  }
};

// POST /api/auth/refresh
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, 'Refresh token required', 400);
    }

    const decoded: any = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET as string
    );

    const storedToken = await redis.get(`refresh:${decoded.id}`);

    if (!storedToken || storedToken !== refreshToken) {
      return sendError(res, 'Invalid or expired session', 401);
    }

    const newAccessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_ACCESS_SECRET as string,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES as any }
    );

    // 🔥 EXTEND SESSION
    await redis.set(`session:${decoded.id}`, 'active', { ex: 15 * 60 });

    sendSuccess(res, { accessToken: newAccessToken }, 'Token refreshed');

  } catch (e) {
    console.error(e);
    sendError(res, 'Invalid refresh token', 401);
  }
};

// POST /api/auth/logout
export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await redis.del(`refresh:${userId}`);
    await redis.del(`session:${userId}`);

    sendSuccess(res, null, 'Logged out successfully');

  } catch (e) {
    console.error(e);
    sendError(res, 'Logout failed', 500);
  }
};

// GET /api/auth/me
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('-password -refreshToken');

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, user);
  } catch {
    sendError(res, 'Failed', 500);
  }
};