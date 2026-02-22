import { mockLeads } from '@/mock/store';
export const leadsApi = {
  getAll: (params?: Record<string, unknown>) => mockLeads.getAll(params),
  getById: (id: string) => mockLeads.getById(id),
  create: (data: unknown) => mockLeads.create(data as Record<string, unknown>),
  update: (id: string, data: unknown) => mockLeads.update(id, data as Record<string, unknown>),
  archive: (id: string) => mockLeads.archive(id),
};
