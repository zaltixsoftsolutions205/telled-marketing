import api from './axios';

export const drfApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/oem', { params });
    // backend: { data: [...], meta: { total, page, totalPages } }
    return { data: data.data || [], pagination: data.meta || { total: 0 } };
  },
  sendFromLead: async (leadData: Record<string, unknown>, formData: Record<string, string>, _user: any) => {
    const leadId = (leadData as any)._id;
    const { data } = await api.post(`/leads/${leadId}/send-drf`, formData);
    return data;
  },
  getByLead: async (leadId: string) => {
    const { data } = await api.get(`/oem/lead/${leadId}`);
    return data.data || [];
  },
  getById: async (id: string) => {
    const { data } = await api.get('/oem', { params: { limit: 200 } });
    return (data.data || []).find((d: any) => d._id === id) ?? null;
  },
  create: async (body: Record<string, unknown>) => {
    const { data } = await api.post(`/oem/lead/${body.leadId}`, body);
    return data.data;
  },
  approve: async (id: string, body: { expiryDate: string; notes?: string }) => {
    const { data } = await api.patch(`/oem/${id}/approve`, body);
    return data;
  },
  reject: async (id: string, body: { rejectionReason: string }) => {
    const { data } = await api.patch(`/oem/${id}/reject`, body);
    return data;
  },
  resetToPending: async (id: string) => {
    const { data } = await api.patch(`/oem/${id}/reset`);
    return data;
  },
  resend: async (id: string, body?: Record<string, string>) => {
    const { data } = await api.post(`/oem/${id}/resend`, body || {});
    return data;
  },
  extend: async (id: string, body: { newExpiry: string; reason: string }) => {
    const { data } = await api.patch(`/oem/${id}/extend`, body);
    return data;
  },
  reassign: async (id: string, newOwnerId: string) => {
    const { data } = await api.patch(`/oem/${id}/reassign`, { newOwnerId });
    return data;
  },
  getAnalytics: async () => {
    const { data } = await api.get('/oem/analytics');
    return data.data || {};
  },
  delete: async (id: string) => {
    const { data } = await api.delete(`/oem/${id}`);
    return data;
  },
  syncEmails: async () => {
    const { data } = await api.post('/oem/sync-emails');
    return data.data;
  },
  requestExtension: async (id: string, body?: {
    toEmail?: string; toName?: string;
    customSubject?: string; customMessage?: string;
    requestedNewExpiry?: string;
  }) => {
    const { data } = await api.patch(`/oem/${id}/request-extension`, body || {});
    return data.data;
  },
  updateProspectStatus: async (id: string, prospectStatus: string) => {
    const { data } = await api.patch(`/oem/${id}/prospect-status`, { prospectStatus });
    return data.data;
  },
  sendExtensionEmail: async (emailData: { drfNumber: string; companyName: string; oemName: string; expiryDate: string; ownerName: string }) => {
    try {
      await api.post('/leads/drf-extension-email', emailData);
    } catch { /* non-critical */ }
  },
};
