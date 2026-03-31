import mongoose from 'mongoose';
import Notification from '../models/Notification';
import User from '../models/User';

interface NotifyPayload {
  title: string;
  message: string;
  type?: 'leave' | 'visit' | 'support' | 'salary' | 'general';
  link?: string;
}

/** Notify a single user by their userId */
export async function notifyUser(
  userId: string | mongoose.Types.ObjectId,
  payload: NotifyPayload
) {
  try {
    await Notification.create({ userId, ...payload });
  } catch {}
}

/** Notify all users with a given role (within same org if orgId provided) */
export async function notifyRole(
  role: string | string[],
  payload: NotifyPayload,
  orgId?: string | mongoose.Types.ObjectId
) {
  try {
    const filter: Record<string, unknown> = {
      role: Array.isArray(role) ? { $in: role } : role,
      isActive: true,
    };
    if (orgId) filter.organizationId = orgId;
    const users = await User.find(filter).select('_id').lean();
    if (!users.length) return;
    await Notification.insertMany(users.map(u => ({ userId: u._id, ...payload })));
  } catch {}
}
