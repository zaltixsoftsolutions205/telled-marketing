import { mockUsers } from '@/mock/store';
export const usersApi = {
  getAll: (params?: Record<string, unknown>) => mockUsers.getAll(params),
  getById: (id: string) => mockUsers.getById(id),
  create: (data: unknown) => mockUsers.create(data as Record<string, unknown>),
  update: (id: string, data: unknown) => mockUsers.update(id, data as Record<string, unknown>),
  toggleStatus: (id: string) => mockUsers.toggleStatus(id),
  resetPassword: (id: string, password: string) => mockUsers.resetPassword(id, password),
  getEngineers: () => mockUsers.getEngineers(),
  getSalesmen: () => mockUsers.getSalesmen(),
};
