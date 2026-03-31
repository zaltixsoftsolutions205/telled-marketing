import { Response } from 'express';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const unreadCount = await Notification.countDocuments({ userId: req.user!.id, isRead: false });
    sendSuccess(res, notifications, 'Notifications fetched', 200, { unreadCount });
  } catch {
    sendError(res, 'Failed to fetch notifications', 500);
  }
};

export const markRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { isRead: true }
    );
    sendSuccess(res, null, 'Marked as read');
  } catch {
    sendError(res, 'Failed', 500);
  }
};

export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ userId: req.user!.id, isRead: false }, { isRead: true });
    sendSuccess(res, null, 'All marked as read');
  } catch {
    sendError(res, 'Failed', 500);
  }
};
