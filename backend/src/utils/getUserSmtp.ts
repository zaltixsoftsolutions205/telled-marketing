import User from '../models/User';
import { decryptText } from './crypto';
import { UserSmtpConfig } from '../services/email.service';

/** Get system SMTP config from env vars */
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

/** Get user SMTP, fall back to system SMTP — never throws, never returns undefined if system is configured */
export async function getUserSmtpWithFallback(userId: string): Promise<UserSmtpConfig | undefined> {
  const userSmtp = await getUserSmtp(userId);
  if (userSmtp) return userSmtp;
  // Fall back to system SMTP with user's display name
  const user = await User.findById(userId).select('name').lean();
  return getSystemSmtp((user as any)?.name);
}

const systemSmtpConfig = () => ({
  smtpHost:   process.env.USER_SMTP_HOST || 'smtp.hostinger.com',
  smtpPort:   Number(process.env.USER_SMTP_PORT || 465),
  smtpUser:   process.env.USER_SMTP_USER || '',
  smtpPass:   process.env.USER_SMTP_PASS || '',
  smtpSecure: true,
  fromEmail:  process.env.USER_EMAIL_FROM || process.env.USER_SMTP_USER || '',
  useGraphApi: false,
});

/**
 * Load the logged-in user's SMTP config from DB.
 * If user has no personal SMTP, falls back to system SMTP with user's own name as fromName.
 * This ensures emails always show the acting user's name, not "ZIEOS".
 * Throws with a user-friendly message if called with `required = true` and system SMTP is also missing.
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

    // Personal Outlook/Hotmail with delegated OAuth — use msRefreshToken path
    if (user.msRefreshToken) {
      return {
        smtpHost:        '',
        smtpPort:        587,
        smtpUser:        user.smtpUser || user.email,
        smtpPass:        '',
        smtpSecure:      false,
        fromEmail:       user.smtpUser || user.email,
        fromName:        user.name,
        useGraphApi:     false,
        msRefreshToken:  user.msRefreshToken,
      };
    }

    // User has their own SMTP fully configured (host + user + pass all present)
    if (user.smtpHost && user.smtpUser && user.smtpPass) {
      return {
        smtpHost:    user.smtpHost,
        smtpPort:    user.smtpPort   || 587,
        smtpUser:    user.smtpUser,
        smtpPass:    decryptText(user.smtpPass),
        smtpSecure:  user.smtpSecure ?? false,
        fromEmail:   user.smtpUser,
        fromName:    user.name,
        useGraphApi: user.useGraphApi ?? false,
      };
    }

    // No personal SMTP configured for this user
    if (required) {
      throw new Error(
        'Your email is not configured for sending. Please log out and log in again ' +
        'to set up your email provider, then retry.'
      );
    }

    // Non-required fallback: use system SMTP (for welcome emails, notifications etc.)
    const sys = systemSmtpConfig();
    if (!sys.smtpUser || !sys.smtpPass) return undefined;

    return {
      ...sys,
      fromName: user.name,
    };
  } catch (e: any) {
    if (required) throw e;
    return undefined;
  }
}
