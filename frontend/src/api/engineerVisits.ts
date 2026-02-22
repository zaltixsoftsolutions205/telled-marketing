import { mockEngineerVisits } from '@/mock/store';
export const engineerVisitsApi = {
  getAll: (params?: Record<string, unknown>) => mockEngineerVisits.getAll(params),
  getById: (id: string) => mockEngineerVisits.getById(id),
  create: (data: unknown) => mockEngineerVisits.create(data as Record<string, unknown>),
  update: (_id: string, _data: unknown) => Promise.resolve(null),
  approve: (id: string, status: 'Approved' | 'Rejected', _notes?: string) => mockEngineerVisits.approve(id, status),
};
