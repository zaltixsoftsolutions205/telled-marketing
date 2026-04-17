import { create } from 'zustand';

export type NotifType = 'lead' | 'quotation' | 'drf' | 'purchase' | 'account' | 'invoice' | 'support' | 'leave' | 'salary' | 'visit' | 'installation' | 'training' | 'general';

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  type: NotifType;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  push: (n: Omit<AppNotification, '_id' | 'isRead' | 'createdAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  push: (n) => set((s) => {
    const notif: AppNotification = {
      ...n,
      _id: uid(),
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    const notifications = [notif, ...s.notifications].slice(0, 100);
    return { notifications, unreadCount: s.unreadCount + 1 };
  }),

  markRead: (id) => set((s) => ({
    notifications: s.notifications.map(n => n._id === id ? { ...n, isRead: true } : n),
    unreadCount: Math.max(0, s.unreadCount - (s.notifications.find(n => n._id === id && !n.isRead) ? 1 : 0)),
  })),

  markAllRead: () => set((s) => ({
    notifications: s.notifications.map(n => ({ ...n, isRead: true })),
    unreadCount: 0,
  })),
}));

// Convenience helper — call this from any page after an action
export function notify(title: string, message: string, type: NotifType = 'general', link?: string) {
  useNotificationStore.getState().push({ title, message, type, link });
}
