import { Request, Response } from 'express';
import axios from 'axios';
import User from '../models/User';
import { encryptText } from '../utils/crypto';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';


const CLIENT_ID     = process.env.GRAPH_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET || '';

function getRedirectUri(): string {
  return process.env.GRAPH_REDIRECT_URI_PROD || process.env.GRAPH_REDIRECT_URI || 'http://localhost:5000/api/auth/microsoft/callback';
}

// GET /api/auth/microsoft/authorize?userId=xxx
// Generates the Microsoft OAuth consent URL — no auth required (called during login flow)
export const getMicrosoftAuthUrl = async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || (req as any).user?.id;
    if (!userId) return sendError(res, 'userId is required', 400);
    const redirectUri = getRedirectUri();
    if (!redirectUri) return sendError(res, 'Microsoft OAuth redirect URI is not configured on the server. Set GRAPH_REDIRECT_URI_PROD env variable.', 500);

    // Encode userId in the state param so we can identify the user in the callback
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64url');

    // Check if user already has a refresh token — if so, don't force consent/account picker again
    const user = await (await import('../models/User')).default
      .findById(userId).select('msRefreshToken email').lean();
    const alreadyConnected = !!(user as any)?.msRefreshToken;

    const params = new URLSearchParams({
      client_id:     CLIENT_ID,
      response_type: 'code',
      redirect_uri:  redirectUri,
      response_mode: 'query',
      scope:         'offline_access Mail.Send Mail.Read Mail.ReadWrite User.Read',
      state,
      // First time: show account picker. Already connected: let Microsoft reuse existing session silently.
      ...(alreadyConnected
        ? { login_hint: (user as any)?.email || '' }
        : { prompt: 'select_account' }),
    });

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
    sendSuccess(res, { authUrl }, 'Authorization URL generated');
  } catch (e) {
    console.error(e);
    sendError(res, 'Failed to generate authorization URL', 500);
  }
};

// GET /api/auth/microsoft/callback?code=xxx&state=xxx
// Microsoft redirects here after user grants permission
export const microsoftCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query as Record<string, string>;

    const oauthResultBase = process.env.FRONTEND_OAUTH_RESULT_URL_PROD || process.env.FRONTEND_OAUTH_RESULT_URL ||
      `${(process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()}/zieos/microsoft-oauth-result`;

    if (error) {
      console.error('Microsoft OAuth error:', error, error_description);
      return res.redirect(`${oauthResultBase}?success=false&error=${encodeURIComponent(error_description || error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${oauthResultBase}?success=false&error=missing_params`);
    }

    // Decode state to get userId
    let userId: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      userId = decoded.userId;
    } catch {
      return res.redirect(`${oauthResultBase}?success=false&error=invalid_state`);
    }

    const redirectUri = getRedirectUri();

    // Exchange authorization code for tokens
    const tokenRes = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token } = tokenRes.data;

    if (!refresh_token) {
      return res.redirect(`${oauthResultBase}?success=false&error=no_refresh_token`);
    }

    // Get user's actual email from Microsoft to confirm it matches
    const profileRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const msEmail = (profileRes.data.mail || profileRes.data.userPrincipalName || '').toLowerCase();

    // Store encrypted refresh token on user
    await User.findByIdAndUpdate(userId, {
      msRefreshToken: encryptText(refresh_token),
      useGraphApi: true,
      smtpUser: msEmail || undefined,
    });

    return res.redirect(`${oauthResultBase}?success=true&email=${encodeURIComponent(msEmail)}`);
  } catch (e: any) {
    console.error('Microsoft OAuth callback error:', e?.response?.data || e);
    const oauthResultBase = process.env.FRONTEND_OAUTH_RESULT_URL_PROD || process.env.FRONTEND_OAUTH_RESULT_URL ||
      `${(process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()}/zieos/microsoft-oauth-result`;
    return res.redirect(`${oauthResultBase}?success=false&error=${encodeURIComponent(e?.message || 'oauth_failed')}`);
  }
};

// GET /api/auth/microsoft/status — check if current user has MS OAuth connected
export const getMicrosoftStatus = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('msRefreshToken smtpUser email').lean();
    const connected = !!(user?.msRefreshToken);
    sendSuccess(res, { connected, email: connected ? (user?.smtpUser || user?.email) : null });
  } catch (e) {
    sendError(res, 'Failed to get status', 500);
  }
};

// DELETE /api/auth/microsoft/disconnect — remove stored OAuth tokens
export const disconnectMicrosoft = async (req: AuthRequest, res: Response) => {
  try {
    await User.findByIdAndUpdate(req.user!.id, {
      $unset: { msRefreshToken: '' },
      useGraphApi: false,
    });
    sendSuccess(res, null, 'Microsoft account disconnected');
  } catch (e) {
    sendError(res, 'Failed to disconnect', 500);
  }
};
