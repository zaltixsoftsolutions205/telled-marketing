import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { sendError } from '../utils/response';

export const errorHandler = (err: Error & { statusCode?: number; code?: number }, req: Request, res: Response, _next: NextFunction): void => {
  logger.error(`${req.method} ${req.url} - ${err.message}`);
  if (err.name === 'ValidationError') { sendError(res, 'Validation failed', 400, err.message); return; }
  if (err.name === 'CastError') { sendError(res, 'Invalid ID format', 400); return; }
  if (err.code === 11000) { sendError(res, 'Duplicate entry', 409); return; }
  sendError(res, err.message || 'Internal server error', err.statusCode || 500);
};

export const notFound = (req: Request, res: Response): void => {
  sendError(res, `Route ${req.method} ${req.url} not found`, 404);
};
