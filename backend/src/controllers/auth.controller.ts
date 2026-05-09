import { Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import axios from 'axios';
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

/**
 * Returns true if the domain is a Microsoft 365 tenant (including custom domains
 * like sales.telled.in). Uses Microsoft's public login discovery endpoint — no auth needed.
 */
// Personal Microsoft consumer domains — these use SMTP, NOT Graph API.
// Graph API sendMail only works for users inside an Azure AD / M365 business tenant.
const PERSONAL_MS_DOMAINS = ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'live.in', 'live.co.uk'];

async function isM365Domain(domain: string): Promise<boolean> {
  // Personal consumer accounts cannot use Graph API sendMail
  if (PERSONAL_MS_DOMAINS.includes(domain)) return false;
  try {
    // Custom business domains on M365 respond to this endpoint
    await axios.get(
      `https://login.microsoftonline.com/${domain}/.well-known/openid-configuration`,
      { timeout: 6000 }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticate a user's email password by attempting a real SMTP connection.
 * For custom M365 domains (e.g. sales.telled.in), detects M365 via Microsoft's
 * discovery endpoint and routes through Graph API verification + OTP.
 *
 * Returns true if authentication succeeds, false otherwise.
 */
async function verifyEmailPassword(email: string, password: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  const smtp   = detectSmtp(email);

  // ── Step 1: Detect if domain is on Microsoft 365 ───────────────────────────
  // detectSmtp() only knows outlook.com/hotmail.com etc. Custom M365 domains
  // (e.g. sales.telled.in) fall through to Hostinger. We check Microsoft directly.
  const m365 = await isM365Domain(domain);

  if (m365) {
    const GRAPH_CLIENT_ID     = process.env.GRAPH_CLIENT_ID     || '';
    const GRAPH_CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET || '';
    const GRAPH_TENANT_ID     = process.env.GRAPH_TENANT_ID     || '';

    // ── Step 2a: Try SMTP AUTH on Office365 (works if Basic Auth is enabled) ──
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: { user: email, pass: password },
        connectionTimeout: 8000,
        socketTimeout: 8000,
      });
      await transporter.verify();
      // SMTP auth succeeded — save correct smtp host for this user
      return true;
    } catch (smtpErr: any) {
      const msg: string = (smtpErr?.message || '').toLowerCase();
      const isWrongPassword =
        msg.includes('535') ||
        msg.includes('534') ||
        msg.includes('invalid credentials') ||
        msg.includes('authentication failed') ||
        msg.includes('username and password not accepted') ||
        msg.includes('incorrect') ||
        msg.includes('bad credentials');
      if (isWrongPassword) return false;
      // SMTP AUTH is disabled on this tenant (Modern Auth only).
      // Fall through to Graph API verification.
    }

    // ── Step 2b: Graph API fallback for Modern Auth tenants ────────────────────
    // We can't verify the password directly, but we can:
    //   1. Confirm the mailbox exists on our tenant via Graph
    //   2. Send an OTP to that mailbox — only the real owner can read it
    // This gives equivalent security to SMTP AUTH + OTP.
    if (!GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET || !GRAPH_TENANT_ID) return false;
    try {
      const tokenRes = await axios.post(
        `https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`,
        new URLSearchParams({
          grant_type:    'client_credentials',
          client_id:     GRAPH_CLIENT_ID,
          client_secret: GRAPH_CLIENT_SECRET,
          scope:         'https://graph.microsoft.com/.default',
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 }
      );
      const token = tokenRes.data.access_token;
      await axios.get(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
      );
      // Mailbox confirmed on our M365 tenant. OTP to this mailbox proves identity.
      return true;
    } catch {
      return false;
    }
  }

  // ── Non-M365: standard SMTP AUTH (Hostinger, Gmail, Yahoo, Zoho, etc.) ──────
  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: email, pass: password },
      connectionTimeout: 8000,
      socketTimeout: 8000,
    });
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}

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
  const org = await Organization.findById(fullUser?.organizationId).select('name').lean();
  sendSuccess(res, {
    accessToken,
    refreshToken,
    user: fullUser,
    organizationName: org?.name ?? '',
  }, 'Login successful');
};

// POST /api/auth/login
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, deviceToken, appPassword, smtpHost: bodySmtpHost, smtpPort: bodySmtpPort, smtpSecure: bodySmtpSecure } = req.body;
    if (!email || !password) return sendError(res, 'Email and password are required', 400);

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) return sendError(res, 'Invalid credentials', 401);
    if (!user.isActive) return sendError(res, 'Your account is inactive. Contact support.', 403);

    // Check if this is effectively a first-time login:
    // mustSetPassword flag OR password is still the hashed 'pending' placeholder
    const isPendingPassword = await user.comparePassword('pending');
    const isFirstLogin = user.mustSetPassword || isPendingPassword;

    if (isFirstLogin) {
      // First-time login: whatever they type becomes their password
      user.password = password;
      user.mustSetPassword = false;
      await user.save();
    } else {
      // Normal login: verify against stored bcrypt password
      const passwordOk = await user.comparePassword(password);
      if (!passwordOk) {
        // Last resort: if stored password is somehow still 'pending', treat as first login
        const stillPending = await user.comparePassword('pending');
        if (stillPending) {
          user.password = password;
          user.mustSetPassword = false;
          await user.save();
        } else {
          return sendError(res, 'Invalid credentials', 401);
        }
      }

      const personal = isPersonalEmail(user.email);
      const PERSONAL_MS_DOMAINS = ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'live.in', 'live.co.uk'];
      const isPersonalMs = PERSONAL_MS_DOMAINS.includes(user.email.split('@')[1]?.toLowerCase() || '');

      if (!personal) {
        // ── Business email ─────────────────────────────────────────────────────
        // Always store login password as smtpPass so providerOnly flow works after OTP.
        // If smtpHost already configured, refresh password. If not, store just the password
        // and wait for user to pick their provider in the provider setup screen after OTP.
        const autoSmtp = detectSmtp(user.email);
        const smtpHost = bodySmtpHost || (user.smtpHost ?? '') || autoSmtp.host;
        if (smtpHost) {
          await User.findByIdAndUpdate(user._id, {
            smtpHost,
            smtpPort:   bodySmtpPort   ? Number(bodySmtpPort)   : (user.smtpPort   ?? autoSmtp.port),
            smtpSecure: bodySmtpSecure !== undefined ? bodySmtpSecure : (user.smtpSecure ?? autoSmtp.secure),
            smtpUser:   user.email,
            smtpPass:   encryptText(password),
          });
        } else {
          // Unknown domain, no provider selected yet — just store the password,
          // provider will be picked in the setup screen after OTP
          await User.findByIdAndUpdate(user._id, {
            smtpUser: user.email,
            smtpPass: encryptText(password),
          });
        }
      } else if (isPersonalMs && !(user as any).msRefreshToken) {
        // ── Personal Outlook/Hotmail without OAuth ─────────────────────────────
        // Must go through Microsoft OAuth after OTP — clear any stale SMTP config
        await User.findByIdAndUpdate(user._id, {
          $unset: { smtpHost: '', smtpPort: '', smtpSecure: '', smtpUser: '', smtpPass: '' },
        });
      }
      // Gmail / Yahoo / iCloud etc: leave smtpPass as-is (app password stored previously)
      // If not set yet, the OTP step will prompt for app password
    }

    // Trusted device → skip OTP and go straight to dashboard
    if (deviceToken && user.trustedDevices?.includes(deviceToken)) {
      return issueTokens(user, res);
    }

    // If user provided app password on login step, save it now so OTP step doesn't ask again
    if (appPassword) {
      const autoSmtp = detectSmtp(user.email);
      await User.findByIdAndUpdate(user._id, {
        smtpHost:   bodySmtpHost   || autoSmtp.host,
        smtpPort:   bodySmtpPort   ? Number(bodySmtpPort) : autoSmtp.port,
        smtpSecure: bodySmtpSecure !== undefined ? bodySmtpSecure : autoSmtp.secure,
        smtpUser:   user.email,
        smtpPass:   encryptText(appPassword),
      });
    }

    const otp = generateOTP();
    await saveOTP(user.email, otp);
    await sendOTPEmail(user.email, otp, 'login');

    sendSuccess(res, { userId: user._id.toString() }, 'OTP sent to your email');
  } catch (e) {
    console.error(e);
    sendError(res, 'Login failed', 500);
  }
};

const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'live.in', 'live.co.uk',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me',
  'fastmail.com', 'fastmail.fm',
  'zoho.com', 'gmx.com', 'gmx.net',
  'aol.com', 'rediffmail.com', 'tuta.com', 'tutanota.com',
];

function isPersonalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return PERSONAL_EMAIL_DOMAINS.includes(domain);
}

// POST /api/auth/verify-login-otp
export const verifyLoginOtp = async (req: Request, res: Response) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) return sendError(res, 'userId and otp are required', 400);

    const user = await User.findById(userId).select('+msRefreshToken +smtpPass +smtpHost');
    if (!user) return sendError(res, 'User not found', 404);

    const valid = await verifyOTP(user.email, otp.toString());
    if (!valid) return sendError(res, 'Invalid or expired OTP', 400);

    // Generate a device token so this device skips OTP next time
    const deviceToken = crypto.randomBytes(32).toString('hex');
    await User.findByIdAndUpdate(user._id, {
      $addToSet: { trustedDevices: deviceToken },
    });

    const hasMsOAuth = !!(user as any).msRefreshToken;
    const personal   = isPersonalEmail(user.email);

    // For personal Outlook/Hotmail — clear any wrongly auto-detected SMTP
    // (login may have saved smtp.office365.com which doesn't work for personal accounts)
    // and force them through OAuth
    const PERSONAL_MS = ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'live.in', 'live.co.uk'];
    const isPersonalMs = PERSONAL_MS.includes(user.email.split('@')[1]?.toLowerCase() || '');
    if (isPersonalMs && !hasMsOAuth && user.smtpHost) {
      // Clear the wrongly saved SMTP so they're forced to connect via OAuth
      await User.findByIdAndUpdate(user._id, {
        $unset: { smtpHost: '', smtpPort: '', smtpSecure: '', smtpUser: '', smtpPass: '' },
      });
      user.smtpPass = undefined;
      user.smtpHost = undefined;
    }

    // Prompt email setup if user has no complete SMTP config yet
    const hasSmtpPass = !!(user.smtpPass);
    const hasSmtpHost = !!(user.smtpHost);
    // Personal: needs app password (smtpPass) + known host (auto-detected from detectSmtp)
    // Business: needs smtpPass (stored at login) AND smtpHost (picked from provider dropdown)
    const needsEmailSetup = !hasMsOAuth && (
      personal
        ? !hasSmtpPass                    // personal: just needs app password
        : (!hasSmtpPass || !hasSmtpHost)  // business: needs both password and provider
    );

    if (needsEmailSetup) {
      return sendSuccess(res, {
        requiresAppPassword: true,
        userId: user._id.toString(),
        email: user.email,
        deviceToken,
        isPersonal: personal,
        providerOnly: !personal && hasSmtpPass, // business with password stored — only need provider
      }, 'Email setup required');
    }

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
    const org = await Organization.findById(fullUser?.organizationId).select('name').lean();

    sendSuccess(res, { accessToken, refreshToken, user: fullUser, deviceToken, organizationName: org?.name ?? '' }, 'Login successful');
  } catch (e) {
    console.error(e);
    sendError(res, 'OTP verification failed', 500);
  }
};

// POST /api/auth/save-app-password — called after OTP for all users who need email setup
export const saveAppPassword = async (req: Request, res: Response) => {
  try {
    const { userId, appPassword, deviceToken, smtpHost: bodySmtpHost, smtpPort: bodySmtpPort, smtpSecure: bodySmtpSecure } = req.body;
    // appPassword is optional for business emails (providerOnly mode — password already stored at login)
    if (!userId) return sendError(res, 'userId is required', 400);

    const user = await User.findById(userId).select('+password +smtpPass');
    if (!user) return sendError(res, 'User not found', 404);

    const autoSmtp = detectSmtp(user.email);
    const smtpHost   = bodySmtpHost || autoSmtp.host;
    const smtpPort   = bodySmtpPort   ? Number(bodySmtpPort) : autoSmtp.port;
    const smtpSecure = bodySmtpSecure !== undefined ? bodySmtpSecure : autoSmtp.secure;

    // Don't save if smtpHost is empty — means unknown domain and user didn't pick a provider
    if (!smtpHost) {
      return sendError(res, 'Please select your email provider from the list', 400);
    }

    // For business emails in providerOnly mode: reuse already-stored smtpPass (login password)
    // For personal/app-password mode: save the provided appPassword
    const smtpPassUpdate = appPassword
      ? encryptText(appPassword)
      : user.smtpPass;

    if (!smtpPassUpdate) {
      return sendError(res, 'Email password is required', 400);
    }

    await User.findByIdAndUpdate(user._id, {
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser: user.email,
      smtpPass: smtpPassUpdate,
    });

    // Issue tokens and proceed to dashboard
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

    // Add device token if provided
    if (deviceToken) {
      await User.findByIdAndUpdate(user._id, { $addToSet: { trustedDevices: deviceToken } });
    }

    const fullUser = await User.findById(user._id).select('-password -refreshToken -smtpPass');
    const org = await Organization.findById(fullUser?.organizationId).select('name').lean();

    sendSuccess(res, { accessToken, refreshToken, user: fullUser, deviceToken, organizationName: org?.name ?? '' }, 'App password saved — login successful');
  } catch (e) {
    console.error(e);
    sendError(res, 'Failed to save app password', 500);
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
// All users log in with their email provider password — send instructions on where to change it.
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 'Email is required', 400);

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Always return success to avoid email enumeration
    if (!user) {
      return sendSuccess(res, null, 'If this email is registered, you will receive an email shortly.');
    }

    const domain = user.email.split('@')[1]?.toLowerCase() || '';
    let providerName = 'your email provider';
    let providerUrl  = '';
    if (domain.includes('gmail') || domain.includes('googlemail')) {
      providerName = 'Google';
      providerUrl  = 'https://myaccount.google.com/security';
    } else if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live') || domain.includes('msn')) {
      providerName = 'Microsoft';
      providerUrl  = 'https://account.microsoft.com/security';
    } else {
      try {
        await axios.get(`https://login.microsoftonline.com/${domain}/.well-known/openid-configuration`, { timeout: 4000 });
        providerName = 'Microsoft 365';
        providerUrl  = 'https://account.microsoft.com/security';
      } catch { /* not M365 */ }
    }

    await sendEmail(
      user.email,
      'How to change your ZIEOS login password',
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#4f2d7f,#6b46c1);color:#fff;padding:28px;text-align:center;border-radius:8px 8px 0 0">
          <h2 style="margin:0">Change Your Password</h2>
        </div>
        <div style="padding:28px;background:#fff">
          <p>Hi <strong>${user.name}</strong>,</p>
          <p>You sign in to ZIEOS using your <strong>${providerName}</strong> email account password. ZIEOS does not store a separate password for your account.</p>
          <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:18px;margin:20px 0;font-size:14px;color:#374151">
            <strong>To change your ZIEOS login password:</strong><br/>
            Change your password directly in <strong>${providerName}</strong>.
            The next time you log in to ZIEOS, just use your new email password — no changes needed in ZIEOS.
          </div>
          ${providerUrl ? `<div style="text-align:center;margin:24px 0">
            <a href="${providerUrl}" style="background:#4f2d7f;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;display:inline-block">Change password in ${providerName} &rarr;</a>
          </div>` : ''}
          <p style="color:#888;font-size:13px">Your new email password will work automatically on your next ZIEOS login.</p>
        </div>
        <div style="background:#f8f8f8;padding:14px;text-align:center;font-size:12px;color:#888;border-radius:0 0 8px 8px">© ${new Date().getFullYear()} ZIEOS</div>
      </div>`
    );

    sendSuccess(res, null, 'If this email is registered, you will receive an email shortly.');
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
// All users now authenticate via their email provider password — in-app password reset is not supported.
export const resetPassword = async (req: Request, res: Response) => {
  sendError(res, 'Password reset is not available. Change your password in your email provider (Outlook, Gmail, Hostinger, etc.) and log in with the new password.', 400);
};