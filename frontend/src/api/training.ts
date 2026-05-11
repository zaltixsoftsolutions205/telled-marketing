import { mockTraining } from '@/mock/store';

export const trainingApi = {
  getAll: async (params?: Record<string, unknown>) => {
    return mockTraining.getAll(params || {});
  },
  getByAccount: (accountId: string) => mockTraining.getByAccount(accountId),
  getById: (id: string) => mockTraining.getById(id),
  create: (body: Record<string, unknown>) => mockTraining.create(body),
  update: (id: string, body: Record<string, unknown>) => mockTraining.update(id, body),
};
