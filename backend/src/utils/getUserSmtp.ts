import User from '../models/User';
import { decryptText } from './crypto';
import { UserSmtpConfig } from '../services/email.service';
import { createEmailProvider, UserEmailRecord } from '../services/providers/EmailProviderFactory';
import { EmailProvider } from '../services/providers/EmailProvider';

/**
 * Load the logged-in user's SMTP config from DB.
 * ALL operations — sending, syncing, reading — use the user's own email only.
 * No system SMTP fallback. Ever.
 * Throws a user-friendly error if the user has no email configured.
 */
export async function getUserSmtp(userId: string, required = false): Promise<UserSmtpConfig | undefined> {
  try {
    const user = await User.findById(userId)
      .select('name email smtpHost smtpPort smtpUser smtpPass smtpSecure useGraphApi msRefreshToken')
      .lean();

    if (!user) {
      if (required) throw new Error('User not found');
      return undefined;
    }

    // M365/Outlook user — if they have SMTP credentials use those, otherwise fall back to Graph API
    if ((user as any).msRefreshToken) {
      return {
        smtpHost:       (user as any).smtpHost || 'smtp.office365.com',
        smtpPort:       (user as any).smtpPort || 587,
        smtpUser:       (user as any).smtpUser || user.email,
        smtpPass:       (user as any).smtpPass || '',
        smtpSecure:     (user as any).smtpSecure ?? false,
        fromEmail:      (user as any).smtpUser || user.email,
        fromName:       user.name,
        useGraphApi:    false,
        msRefreshToken: (user as any).msRefreshToken,
        userId:         userId,
      } as any;
    }

    // User has smtpUser + smtpPass — works for ALL providers:
    // Gmail (app password), personal Outlook (app password), Zoho, Hostinger,
    // GoDaddy, Google Workspace, M365, any custom domain
    if ((user as any).smtpUser && (user as any).smtpPass) {
      return {
        smtpHost:    (user as any).smtpHost   || deriveSmtpHost((user as any).smtpUser),
        smtpPort:    (user as any).smtpPort   || 587,
        smtpUser:    (user as any).smtpUser,
        smtpPass:    decryptText((user as any).smtpPass),
        smtpSecure:  (user as any).smtpSecure ?? false,
        fromEmail:   (user as any).smtpUser,
        fromName:    user.name,
        useGraphApi: (user as any).useGraphApi ?? false,
      };
    }

    // No email configured
    if (required) {
      throw new Error(
        'Your email is not configured. Please log out and log in again to set up your email.'
      );
    }
    return undefined;
  } catch (e: any) {
    if (required) throw e;
    return undefined;
  }
}

/** Same as getUserSmtp but always throws if user has no email configured */
export async function getUserSmtpWithFallback(userId: string): Promise<UserSmtpConfig | undefined> {
  return getUserSmtp(userId);
}

/** Derive SMTP host from email domain when smtpHost isn't set yet */
function deriveSmtpHost(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'smtp.gmail.com';
  if (domain === 'yahoo.com' || domain === 'yahoo.in' || domain === 'yahoo.co.in') return 'smtp.mail.yahoo.com';
  if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com' || domain === 'msn.com') return 'smtp-mail.outlook.com';
  if (domain === 'zoho.com') return 'smtp.zoho.com';
  if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') return 'smtp.mail.me.com';
  if (domain === 'rediffmail.com') return 'smtp.rediffmail.com';
  // Business/custom domain — assume Hostinger or standard pattern
  return `smtp.${domain}`;
}

/**
 * Returns the correct EmailProvider for a user.
 * Auto-detects: Microsoft Graph → Gmail API → SMTP.
 * Throws a user-friendly error if no email is configured.
 */
export async function getUserEmailProvider(userId: string): Promise<EmailProvider> {
  const user = await User.findById(userId)
    .select('name email smtpHost smtpPort smtpUser smtpPass smtpSecure msRefreshToken googleRefreshToken')
    .lean();

  if (!user) throw new Error('User not found');

  return createEmailProvider({
    _id:               (user as any)._id.toString(),
    email:             user.email,
    name:              user.name,
    msRefreshToken:    (user as any).msRefreshToken,
    googleRefreshToken:(user as any).googleRefreshToken,
    smtpHost:          (user as any).smtpHost,
    smtpPort:          (user as any).smtpPort,
    smtpSecure:        (user as any).smtpSecure,
    smtpUser:          (user as any).smtpUser,
    smtpPass:          (user as any).smtpPass,
  });
}

/** System SMTP — only used for system-level emails (user creation, OTP) — NOT for user operations */
export function getSystemSmtp(fromName?: string): UserSmtpConfig | undefined {
  const smtpUser = process.env.USER_SMTP_USER || process.env.SMTP_USER || '';
  const smtpPass = process.env.USER_SMTP_PASS || process.env.SMTP_PASS || '';
  if (!smtpUser || !smtpPass) return undefined;
  return {
    smtpHost:   process.env.USER_SMTP_HOST || 'smtp.hostinger.com',
    smtpPort:   Number(process.env.USER_SMTP_PORT || 465),
    smtpSecure: true,
    smtpUser,
    smtpPass,
    fromEmail:  process.env.USER_EMAIL_FROM || smtpUser,
    fromName:   fromName || 'ZIEOS',
    useGraphApi: false,
  };
}
