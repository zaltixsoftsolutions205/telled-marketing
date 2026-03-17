import { Router } from 'express';
import { signup, login, refreshToken, logout, getMe } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.post('/signup', signup);   // Admin creates org + account
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
export default router;
