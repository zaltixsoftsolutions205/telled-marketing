import { Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
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
import { verifyOTP, generateOTP, saveOTP } from '../services/otp.service';
import jwt from 'jsonwebtoken';
import { redis } from '../config/redis';
import sendEmail, { sendOTPEmail } from '../services/email.service';
import { encryptText, detectSmtp } from '../utils/crypto';

// POST /api/auth/signup  — kept for internal/legacy use; new public flow uses /api/register
export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orgName, name, email, password, otp } = req.body;

    if (!orgName || !name || !email || !password || !otp) {
      sendError(res, 'orgName, name, email, password and otp are required', 400);
      return;
    }

    const normalizedEmail = email.toLowerCase();

    // 🔐 STEP 1: Verify OTP
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

const ADMIN_ROLES = ['admin', 'platform_admin'];

const issueTokens = async (user: any, res: Response) => {
  const accessToken = jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_ACCESS_SECRET as string,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES as any }
  );
  const refreshToken = jwt.sign(
    { id: user._id.toString() },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES as any }
  );
  await redis.set(`refresh:${user._id}`, refreshToken, { ex: 7 * 24 * 60 * 60 });
  await redis.set(`session:${user._id}`, 'active', { ex: 7 * 24 * 60 * 60 });
  const fullUser = await User.findById(user._id).select('-password -refreshToken -smtpPass');
  sendSuccess(res, {
    accessToken,
    refreshToken,
    user: fullUser,
  }, 'Login successful');
};

// POST /api/auth/login
// Admin/platform_admin → direct token (no OTP). Other roles → OTP step.
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return sendError(res, 'Email and password are required', 400);

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return sendError(res, 'Invalid credentials', 401);

    if (ADMIN_ROLES.includes(user.role)) {
      if (!(await user.comparePassword(password))) return sendError(res, 'Invalid credentials', 401);
      if (!user.isActive) return sendError(res, 'Your account is inactive.', 403);
      return issueTokens(user, res);
    }

    // Non-admin users: password check + OTP
    if (user.mustSetPassword) {
      user.password = password;
      user.mustSetPassword = false;
      user.isActive = true;
      await user.save();
    } else {
      if (!(await user.comparePassword(password))) return sendError(res, 'Invalid credentials', 401);
      if (!user.isActive) return sendError(res, 'Your account is inactive. Contact your admin.', 403);
    }

    // Save SMTP credentials derived from their login password
    const smtp = detectSmtp(user.email);
    await User.findByIdAndUpdate(user._id, {
      smtpHost:   smtp.host,
      smtpPort:   smtp.port,
      smtpSecure: smtp.secure,
      smtpUser:   user.email,
      smtpPass:   encryptText(password),
    });

    const otp = generateOTP();
    await saveOTP(user.email, otp);
    await sendOTPEmail(user.email, otp, 'login');

    sendSuccess(res, { userId: user._id.toString() }, 'OTP sent to your email');
  } catch (e) {
    console.error(e);
    sendError(res, 'Login failed', 500);
  }
};

// POST /api/auth/verify-login-otp — OTP step for non-admin users
export const verifyLoginOtp = async (req: Request, res: Response) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) return sendError(res, 'userId and otp are required', 400);

    const user = await User.findById(userId);
    if (!user) return sendError(res, 'User not found', 404);

    const valid = await verifyOTP(user.email, otp.toString());
    if (!valid) return sendError(res, 'Invalid or expired OTP', 400);

    return issueTokens(user, res);
  } catch (e) {
    console.error(e);
    sendError(res, 'OTP verification failed', 500);
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

    await redis.set(`session:${decoded.id}`, 'active', { ex: 7 * 24 * 60 * 60 });

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

// POST /api/auth/forgot-password
// Sends a password reset link to the user's email
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 'Email is required', 400);

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Always return success to avoid email enumeration
    if (!user) {
      return sendSuccess(res, null, 'If this email is registered, a reset link has been sent.');
    }

    // Generate token and store in Redis (15 min TTL)
    const token = crypto.randomBytes(32).toString('hex');
    await redis.set(`reset:${token}`, user._id.toString(), { ex: 15 * 60 });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    await sendEmail(
      user.email,
      'Reset Your Telled Marketing Password',
      `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
          <div style="background:linear-gradient(135deg,#4f2d7f,#6b46c1);color:#fff;padding:28px;text-align:center;border-radius:8px 8px 0 0">
            <h2 style="margin:0">Password Reset</h2>
          </div>
          <div style="padding:28px;background:#fff">
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to set a new password. This link expires in <strong>15 minutes</strong>.</p>
            <div style="text-align:center;margin:28px 0">
              <a href="${resetUrl}" style="background:#4f2d7f;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block">Reset Password</a>
            </div>
            <p style="color:#666;font-size:13px">If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
            <p style="color:#666;font-size:12px;word-break:break-all">Or copy this link: ${resetUrl}</p>
          </div>
          <div style="background:#f8f8f8;padding:14px;text-align:center;font-size:12px;color:#888;border-radius:0 0 8px 8px">
            © ${new Date().getFullYear()} Telled Marketing
          </div>
        </div>
      `
    );

    sendSuccess(res, null, 'If this email is registered, a reset link has been sent.');
  } catch (e) {
    console.error('Forgot password error:', e);
    sendError(res, 'Failed to process request', 500);
  }
};

// POST /api/auth/set-password  — new users setting their password for the first time
export const setPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return sendError(res, 'Token and password are required', 400);
    if (password.length < 8) return sendError(res, 'Password must be at least 8 characters', 400);

    const userId = await redis.get(`set_pwd:${token}`);
    if (!userId) return sendError(res, 'Invalid or expired invitation link', 400);

    const user = await User.findById(userId);
    if (!user) return sendError(res, 'User not found', 404);

    user.password = password;
    user.isActive = true;
    user.mustSetPassword = false;
    await user.save();

    await redis.del(`set_pwd:${token}`);

    sendSuccess(res, null, 'Password set successfully. You can now login.');
  } catch (e) {
    console.error('Set password error:', e);
    sendError(res, 'Failed to set password', 500);
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return sendError(res, 'Token and password are required', 400);
    if (password.length < 8) return sendError(res, 'Password must be at least 8 characters', 400);

    const userId = await redis.get(`reset:${token}`);
    if (!userId) return sendError(res, 'Invalid or expired reset link', 400);

    const user = await User.findById(userId);
    if (!user || !user.isActive) return sendError(res, 'User not found', 404);

    user.password = password;
    await user.save(); // triggers bcrypt pre-save hook

    // Invalidate the token after use
    await redis.del(`reset:${token}`);
    // Invalidate any active session
    await redis.del(`session:${userId}`);
    await redis.del(`refresh:${userId}`);

    sendSuccess(res, null, 'Password reset successfully. Please login with your new password.');
  } catch (e) {
    console.error('Reset password error:', e);
    sendError(res, 'Failed to reset password', 500);
  }
};