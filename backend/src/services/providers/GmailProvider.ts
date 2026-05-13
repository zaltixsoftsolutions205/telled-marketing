import { EmailProvider, SendEmailOptions } from './EmailProvider';
import { decryptText } from '../../utils/crypto';
import logger from '../../utils/logger';

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_OAUTH_CLIENT_ID     || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

export class GmailProvider implements EmailProvider {
  constructor(private encryptedRefreshToken: string) {}

  async send(options: SendEmailOptions): Promise<void> {
    const refreshToken = decryptText(this.encryptedRefreshToken);
    const { google } = await import('googleapis');

    const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: 'v1', auth });
    const boundary = `boundary_${Date.now()}`;
    const fs = await import('fs');

    const parts: string[] = [
      `From: "${options.fromName}" <${options.fromEmail}>`,
      `To: ${options.to}`,
      ...(options.cc ? [`Cc: ${options.cc}`] : []),
      `Subject: ${options.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      '',
      Buffer.from(options.html).toString('base64'),
    ];

    for (const att of options.attachments || []) {
      const data = att.content ? att.content : fs.readFileSync(att.path!);
      parts.push(
        `--${boundary}`,
        `Content-Type: application/octet-stream; name="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        '',
        data.toString('base64'),
      );
    }
    parts.push(`--${boundary}--`);

    const raw = Buffer.from(parts.join('\r\n')).toString('base64url');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    logger.info(`Email sent via Gmail API FROM ${options.fromEmail} to ${options.to}: ${options.subject}`);
  }
}
