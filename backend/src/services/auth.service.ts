import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

export interface TokenPayload { id: string; role: string; email: string; name: string; }

export const generateAccessToken = (p: TokenPayload): string =>
  jwt.sign(p, process.env.JWT_ACCESS_SECRET!, { expiresIn: (process.env.JWT_ACCESS_EXPIRES || '15m') as jwt.SignOptions['expiresIn'] });

export const generateRefreshToken = (p: TokenPayload): string =>
  jwt.sign(p, process.env.JWT_REFRESH_SECRET!, { expiresIn: (process.env.JWT_REFRESH_EXPIRES || '7d') as jwt.SignOptions['expiresIn'] });

export const verifyRefreshToken = (token: string): TokenPayload =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as TokenPayload;

export const saveRefreshToken = (userId: string, token: string) =>
  User.findByIdAndUpdate(userId, { refreshToken: token });

export const clearRefreshToken = (userId: string) =>
  User.findByIdAndUpdate(userId, { refreshToken: null });

export const getTokensForUser = (user: IUser) => {
  const payload: TokenPayload = { id: user._id.toString(), role: user.role, email: user.email, name: user.name };
  return { accessToken: generateAccessToken(payload), refreshToken: generateRefreshToken(payload) };
};
