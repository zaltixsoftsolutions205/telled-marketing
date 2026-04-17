import { Router } from 'express';
import { signup, login, verifyLoginOtp, refreshToken, logout, getMe, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-login-otp', verifyLoginOtp);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
export default router;
