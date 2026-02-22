import { mockAccounts } from '@/mock/store';
export const accountsApi = {
  getAll: (params?: Record<string, unknown>) => mockAccounts.getAll(params),
  getById: (id: string) => mockAccounts.getById(id),
  convert: (data: { leadId: string; accountName: string; notes?: string }) => mockAccounts.convert(data),
  update: (id: string, data: unknown) => mockAccounts.update(id, data as Record<string, unknown>),
  assignEngineer: (id: string, engineerId: string) => mockAccounts.assignEngineer(id, engineerId),
};
