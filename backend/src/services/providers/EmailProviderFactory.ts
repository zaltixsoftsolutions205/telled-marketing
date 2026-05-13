import { EmailProvider } from './EmailProvider';
import { MicrosoftGraphProvider } from './MicrosoftGraphProvider';
import { GmailProvider } from './GmailProvider';
import { SmtpProvider } from './SmtpProvider';
import { decryptText, detectSmtp } from '../../utils/crypto';

export interface UserEmailRecord {
  _id: string;
  email: string;
  name: string;
  msRefreshToken?: string;
  googleRefreshToken?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
}

/**
 * Auto-detects the correct email provider for a user.
 * Priority:
 *   1. smtpUser + smtpPass → SMTP (works for all providers including M365 with SMTP AUTH enabled)
 *   2. msRefreshToken      → Microsoft Graph API (fallback if no SMTP credentials)
 *   3. googleRefreshToken  → Gmail API (fallback if no SMTP credentials)
 */
export function createEmailProvider(user: UserEmailRecord): EmailProvider {
  // SMTP credentials exist — use SMTP for all providers.
  // For M365: requires SMTP AUTH enabled by tenant admin (2-click setup in admin.microsoft.com).
  // For Gmail: use app password. For Hostinger/Zoho/Yahoo: use email password.
  if (user.smtpUser && user.smtpPass) {
    const smtpPass = decryptText(user.smtpPass);
    const detected = detectSmtp(user.smtpUser);
    return new SmtpProvider({
      host:   user.smtpHost   || detected.host,
      port:   user.smtpPort   || detected.port,
      secure: user.smtpSecure ?? detected.secure,
      user:   user.smtpUser,
      pass:   smtpPass,
    });
  }

  // No SMTP credentials — fall back to OAuth providers
  if (user.msRefreshToken) {
    return new MicrosoftGraphProvider(user.msRefreshToken, user._id.toString());
  }

  if (user.googleRefreshToken) {
    return new GmailProvider(user.googleRefreshToken);
  }

  throw new Error(
    'No email provider configured. Please connect your Microsoft, Gmail, or SMTP account in settings.'
  );
}
