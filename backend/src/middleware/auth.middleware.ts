import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response';
import User from '../models/User';
import { redis } from '../config/redis';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    name: string;
    organizationId: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      sendError(res, 'No token provided', 401);
      return;
    }

    const token = authHeader.split(' ')[1];

    const decoded: any = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET as string
    );

    // 🔥 REDIS SESSION CHECK
    const session = await redis.get(`session:${decoded.id}`);

    if (!session) {
      sendError(res, 'Session expired. Login again', 401);
      return;
    }

    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      sendError(res, 'User not found or inactive', 401);
      return;
    }

    req.user = {
      id: decoded.id,
      role: user.role,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId.toString(),
    };

    next();

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendError(res, 'Token expired', 401);
    } else {
      sendError(res, 'Invalid token', 401);
    }
  }
};