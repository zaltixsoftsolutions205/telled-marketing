import { Router } from 'express';
import { signup, login, verifyLoginOtp, saveAppPassword, refreshToken, logout, getMe, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { getMicrosoftAuthUrl, microsoftCallback, getMicrosoftStatus, disconnectMicrosoft } from '../controllers/microsoftOAuth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-login-otp', verifyLoginOtp);
router.post('/save-app-password', saveAppPassword);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Microsoft OAuth2 (delegated — for personal Outlook/Hotmail users)
router.get('/microsoft/authorize', getMicrosoftAuthUrl);       // no auth — called during login flow
router.get('/microsoft/callback', microsoftCallback);          // no auth — redirect from Microsoft
router.get('/microsoft/status', authenticate, getMicrosoftStatus);
router.delete('/microsoft/disconnect', authenticate, disconnectMicrosoft);

export default router;
