import { mockQuotations } from '@/mock/store';
export const quotationsApi = {
  getAll: (params?: Record<string, unknown>) => mockQuotations.getAll(params),
  getByLead: (leadId: string) => mockQuotations.getByLead(leadId),
  getById: (id: string) => mockQuotations.getById(id),
  create: (data: unknown) => mockQuotations.create(data as Record<string, unknown>),
  update: (_id: string, _data: unknown) => Promise.resolve(null),
};
