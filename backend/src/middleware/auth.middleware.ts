import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response';
import User from '../models/User';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; email: string; name: string; organizationId: string };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { sendError(res, 'No token provided', 401); return; }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as {
      id: string; role: string; email: string; name: string; organizationId: string;
    };
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    if (!user || !user.isActive) { sendError(res, 'User not found or inactive', 401); return; }
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name,
      organizationId: user.organizationId.toString(),
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) sendError(res, 'Token expired', 401);
    else if (error instanceof jwt.JsonWebTokenError) sendError(res, 'Invalid token', 401);
    else sendError(res, 'Authentication failed', 500);
  }
};
