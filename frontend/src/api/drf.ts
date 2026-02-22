import { mockDRF } from '@/mock/store';

export const drfApi = {
  getAll:      (params?: Record<string, unknown>) => mockDRF.getAll(params ?? {}),
  getByLead:   (leadId: string)                   => mockDRF.getByLead(leadId),
  create:      (data: Record<string, unknown>)    => mockDRF.create(data),
  approve:     (id: string, data: { expiryDate: string; notes?: string }) => mockDRF.approve(id, data),
  reject:      (id: string, data: { rejectionReason: string })            => mockDRF.reject(id, data),
  extend:      (id: string, data: { newExpiry: string; reason: string })  => mockDRF.extend(id, data),
  getAnalytics: () => mockDRF.getAnalytics(),
};
