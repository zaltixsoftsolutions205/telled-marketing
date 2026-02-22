import { mockSupport } from '@/mock/store';
export const supportApi = {
  getAll: (params?: Record<string, unknown>) => mockSupport.getAll(params),
  getByAccount: (accountId: string) => mockSupport.getByAccount(accountId),
  getById: (id: string) => mockSupport.getById(id),
  create: (data: unknown) => mockSupport.create(data as Record<string, unknown>),
  update: (id: string, data: unknown) => mockSupport.update(id, data as Record<string, unknown>),
  addNote: (id: string, note: string) => mockSupport.addNote(id, note),
};
