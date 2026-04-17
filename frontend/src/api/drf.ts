import { mockDRF } from '@/mock/store';
import api from './axios';

export const drfApi = {
  getAll: (params?: Record<string, unknown>) => mockDRF.getAll(params),
  sendFromLead: async (leadData: Record<string, unknown>, formData: Record<string, string>, _user: any) => {
    const leadId = (leadData as any)._id;
    const { data } = await api.post(`/leads/${leadId}/send-drf`, formData);
    return data;
  },
  getByLead: (leadId: string) => mockDRF.getByLead(leadId),
  getById: async (id: string) => {
    const result = await mockDRF.getAll();
    return result.data?.find((d: any) => d._id === id) ?? null;
  },
  create: (body: Record<string, unknown>) => mockDRF.create(body),
  approve: (id: string, body: { expiryDate: string; notes?: string }) => mockDRF.approve(id, body),
  reject: (id: string, body: { rejectionReason: string }) => mockDRF.reject(id, body),
  resetToPending: (id: string) => mockDRF.resetToPending(id),
  resend: (id: string) => mockDRF.resend(id),
  extend: (id: string, body: { newExpiry: string; reason: string }) => mockDRF.extend(id, body),
  reassign: (id: string, newOwnerId: string) => mockDRF.reassign(id, newOwnerId),
  getAnalytics: () => mockDRF.getAnalytics(),
  delete: (id: string) => mockDRF.delete(id),
  syncEmails: () => mockDRF.syncEmails(),
  requestExtension: (id: string) => mockDRF.requestExtension(id),
  sendExtensionEmail: async (data: { drfNumber: string; companyName: string; oemName: string; expiryDate: string; ownerName: string }) => {
    try {
      await api.post('/leads/drf-extension-email', data);
    } catch { /* non-critical — backend may be unavailable in demo mode */ }
  },
};
