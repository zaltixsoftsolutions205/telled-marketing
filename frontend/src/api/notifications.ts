import api from './axios';

export const notificationsApi = {
  getAll: async () => {
    const { data } = await api.get('/notifications');
    return { data: data.data as Notification[], unreadCount: data.meta?.unreadCount ?? 0 };
  },
  markRead: async (id: string) => {
    await api.put(`/notifications/${id}/read`);
  },
  markAllRead: async () => {
    await api.put('/notifications/read-all');
  },
};

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'leave' | 'visit' | 'support' | 'salary' | 'general';
  link?: string;
  isRead: boolean;
  createdAt: string;
}
