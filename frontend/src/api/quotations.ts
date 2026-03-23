// src/api/quotations.ts
import api from './axios';

export const quotationsApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/quotations', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  
  getById: async (id: string) => {
    const { data } = await api.get(`/quotations/${id}`);
    return data.data;
  },
  
  getByLead: async (leadId: string) => {
    const { data } = await api.get('/quotations', { params: { leadId } });
    return data.data;
  },
  
  create: async (body: unknown) => {
    const { data } = await api.post('/quotations', body);
    return data.data;
  },
  
  update: async (id: string, body: unknown) => {
    const { data } = await api.put(`/quotations/${id}`, body);
    return data.data;
  },
  
  accept: async (id: string) => {
    const { data } = await api.patch(`/quotations/${id}/accept`);
    return data.data;
  },
  
  reject: async (id: string, reason?: string) => {
    const { data } = await api.patch(`/quotations/${id}/reject`, { rejectionReason: reason });
    return data.data;
  },
  
  finalize: async (id: string, finalAmount?: number) => {
    const { data } = await api.patch(`/quotations/${id}/finalize`, { finalAmount });
    return data.data;
  },
  
  sendEmail: async (id: string) => {
    const { data } = await api.post(`/quotations/${id}/send-email`);
    return data.data;
  },
  
  sendToVendor: async (id: string, body: { vendorEmail: string; finalAmount?: number }) => {
    const { data } = await api.post(`/quotations/${id}/send-to-vendor`, body);
    return data.data;
  },
  
  generatePDF: async (id: string) => {
    const { data } = await api.post(`/quotations/${id}/generate-pdf`);
    return data.data;
  },
  
  archive: async (id: string) => {
    const { data } = await api.patch(`/quotations/${id}/archive`);
    return data.data;
  },
  
  getStats: async () => {
    const { data } = await api.get('/quotations/stats');
    return data.data;
  },
};