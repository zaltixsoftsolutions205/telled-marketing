import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import User from '../models/User';

const router = Router();

const CLIENT_ID     = process.env.GOOGLE_OAUTH_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const REDIRECT_URI  = process.env.GOOGLE_OAUTH_REDIRECT_URI  || 'http://localhost:5000/api/auth/google/gmail/callback';
const FRONTEND_URL  = process.env.FRONTEND_URL               || 'http://localhost:5173';

function makeOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

// GET /api/auth/google/gmail — start OAuth flow (user must be logged in)
router.get('/gmail', authenticate, (req: AuthRequest, res: Response) => {
  const oauth2Client = makeOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.send'],
    state: req.user!.id,
  });
  res.redirect(url);
});

// GET /api/auth/google/gmail/callback — Google redirects here after consent
router.get('/gmail/callback', async (req: Request, res: Response) => {
  const { code, state: userId, error } = req.query as Record<string, string>;

  if (error || !code || !userId) {
    return res.redirect(`${FRONTEND_URL}/email-config?gmail=error&reason=${error || 'missing_code'}`);
  }

  try {
    const oauth2Client = makeOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      // No refresh token — user may have already authorized before; revoke and retry
      return res.redirect(`${FRONTEND_URL}/email-config?gmail=error&reason=no_refresh_token`);
    }

    await User.findByIdAndUpdate(userId, { googleRefreshToken: tokens.refresh_token });
    res.redirect(`${FRONTEND_URL}/email-config?gmail=connected`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect(`${FRONTEND_URL}/email-config?gmail=error&reason=exchange_failed`);
  }
});

// GET /api/auth/google/gmail/status — check if current user has Gmail connected
router.get('/gmail/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('googleRefreshToken email');
    res.json({ connected: !!((user as any)?.googleRefreshToken), email: user?.email });
  } catch {
    res.json({ connected: false });
  }
});

// DELETE /api/auth/google/gmail — disconnect Gmail
router.delete('/gmail', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('googleRefreshToken');
    const token = (user as any)?.googleRefreshToken;

    if (token) {
      try {
        const oauth2Client = makeOAuth2Client();
        await oauth2Client.revokeToken(token);
      } catch { /* ignore revoke errors */ }
    }

    await User.findByIdAndUpdate(req.user!.id, { $unset: { googleRefreshToken: 1 } });
    res.json({ success: true, message: 'Gmail disconnected' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to disconnect' });
  }
});

export default router;
