import api from './axios';

export const drfApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/oem', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  getByLead: async (leadId: string) => {
    const { data } = await api.get(`/oem/lead/${leadId}`);
    return data.data;
  },
  getById: async (id: string) => {
    const { data } = await api.get('/oem', { params: { id } });
    return data.data?.[0] || null;
  },
  create: async (body: Record<string, unknown>) => {
    const { data } = await api.post(`/oem/lead/${body.leadId}`, body);
    return data.data;
  },
  approve: async (id: string, body: { expiryDate: string; notes?: string }) => {
    const { data } = await api.patch(`/oem/${id}/approve`, body);
    return data.data;
  },
  reject: async (id: string, body: { rejectionReason: string }) => {
    const { data } = await api.patch(`/oem/${id}/reject`, { reason: body.rejectionReason });
    return data.data;
  },
  resetToPending: async (id: string) => {
    const { data } = await api.patch(`/oem/${id}/reset`);
    return data.data;
  },
  resend: async (id: string) => {
    const { data } = await api.post(`/oem/${id}/resend`);
    return data.data;
  },
  extend: async (id: string, body: { newExpiry: string; reason: string }) => {
    const { data } = await api.patch(`/oem/${id}/extend`, body);
    return data.data;
  },
  reassign: async (id: string, newOwnerId: string) => {
    const { data } = await api.patch(`/oem/${id}/reassign`, { newOwnerId });
    return data.data;
  },
  getAnalytics: async () => {
    const { data } = await api.get('/oem/analytics');
    return data.data;
  },
  delete: async (id: string) => {
    await api.delete(`/oem/${id}`);
  },
  syncEmails: async () => {
    const { data } = await api.post('/oem/sync-emails');
    return data.data as {
      scanned: number; processed: number;
      approved: string[]; rejected: string[];
      skipped: string[]; errors: string[];
    };
  },
};
