import { Request, Response } from 'express';
import User from '../models/User';
import { sendSuccess, sendError } from '../utils/response';
import { getTokensForUser, saveRefreshToken, verifyRefreshToken, clearRefreshToken } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { sendError(res, 'Email and password required', 400); return; }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) { sendError(res, 'Invalid credentials', 401); return; }
    if (!await user.comparePassword(password)) { sendError(res, 'Invalid credentials', 401); return; }
    const { accessToken, refreshToken } = getTokensForUser(user);
    await saveRefreshToken(user._id.toString(), refreshToken);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    sendSuccess(res, { user: { id: user._id, name: user.name, email: user.email, role: user.role }, accessToken }, 'Login successful');
  } catch { sendError(res, 'Login failed', 500); }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) { sendError(res, 'Refresh token required', 401); return; }
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== token) { sendError(res, 'Invalid refresh token', 401); return; }
    const { accessToken, refreshToken: newRefresh } = getTokensForUser(user);
    await saveRefreshToken(user._id.toString(), newRefresh);
    res.cookie('refreshToken', newRefresh, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    sendSuccess(res, { accessToken }, 'Token refreshed');
  } catch { sendError(res, 'Token refresh failed', 401); }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user) await clearRefreshToken(req.user.id);
    res.clearCookie('refreshToken');
    sendSuccess(res, null, 'Logged out');
  } catch { sendError(res, 'Logout failed', 500); }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('-password -refreshToken');
    if (!user) { sendError(res, 'User not found', 404); return; }
    sendSuccess(res, user);
  } catch { sendError(res, 'Failed', 500); }
};
