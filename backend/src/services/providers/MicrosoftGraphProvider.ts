import axios from 'axios';
import { EmailProvider, SendEmailOptions } from './EmailProvider';
import { decryptText, encryptText } from '../../utils/crypto';
import logger from '../../utils/logger';

const CLIENT_ID     = process.env.GRAPH_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET || '';

async function refreshAccessToken(encryptedRefreshToken: string): Promise<{ accessToken: string; newEncryptedRefreshToken?: string }> {
  const refreshToken = decryptText(encryptedRefreshToken);
  const res = await axios.post(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      scope:         'offline_access Mail.Send User.Read',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const accessToken = res.data.access_token as string;
  const newRefreshToken = res.data.refresh_token as string | undefined;

  return {
    accessToken,
    newEncryptedRefreshToken: newRefreshToken ? encryptText(newRefreshToken) : undefined,
  };
}

export class MicrosoftGraphProvider implements EmailProvider {
  constructor(
    private encryptedRefreshToken: string,
    private userId: string,
  ) {}

  async send(options: SendEmailOptions): Promise<void> {
    const { accessToken, newEncryptedRefreshToken } = await refreshAccessToken(this.encryptedRefreshToken);

    // Rotate refresh token in DB if Microsoft issued a new one
    if (newEncryptedRefreshToken && newEncryptedRefreshToken !== this.encryptedRefreshToken && this.userId) {
      const User = (await import('../../models/User')).default;
      await User.findByIdAndUpdate(this.userId, { msRefreshToken: newEncryptedRefreshToken });
      logger.info(`MS refresh token rotated for user ${this.userId}`);
    }

    const toRecipients = options.to.split(',').map(e => ({ emailAddress: { address: e.trim() } }));
    const ccRecipients = options.cc
      ? options.cc.split(',').map(e => ({ emailAddress: { address: e.trim() } }))
      : [];

    const fs = await import('fs');
    const graphAttachments = (options.attachments || []).map(a => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.filename,
      contentBytes: (a.content ? a.content : fs.readFileSync(a.path!)).toString('base64'),
    }));

    try {
      await axios.post(
        'https://graph.microsoft.com/v1.0/me/sendMail',
        {
          message: {
            subject: options.subject,
            body: { contentType: 'HTML', content: options.html },
            toRecipients,
            ...(ccRecipients.length ? { ccRecipients } : {}),
            ...(graphAttachments.length ? { attachments: graphAttachments } : {}),
          },
          saveToSentItems: true,
        },
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
      );
      logger.info(`Email sent via Microsoft Graph FROM ${options.fromEmail} to ${options.to}: ${options.subject}`);
    } catch (err: any) {
      const detail = err?.response?.data?.error?.message || err?.response?.data || err?.message;
      logger.error(`Microsoft Graph sendMail failed FROM ${options.fromEmail}: ${JSON.stringify(detail)}`);
      throw new Error(`Microsoft Graph sendMail failed: ${JSON.stringify(detail)}`);
    }
  }
}
