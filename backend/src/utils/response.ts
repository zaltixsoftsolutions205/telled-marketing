import { Response } from 'express';

export const sendSuccess = <T>(res: Response, data: T, message = 'Success', statusCode = 200, meta?: object): Response =>
  res.status(statusCode).json({ success: true, message, data, ...(meta && { meta }) });

export const sendError = (res: Response, message: string, statusCode = 500, error?: string): Response =>
  res.status(statusCode).json({ success: false, message, ...(error && { error }) });

export const sendPaginated = <T>(res: Response, data: T[], total: number, page: number, limit: number, message = 'Success'): Response =>
  res.status(200).json({ success: true, message, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
