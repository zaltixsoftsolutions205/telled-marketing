import { mockInstallations } from '@/mock/store';
export const installationsApi = {
  getAll: (params?: Record<string, unknown>) => mockInstallations.getAll(params),
  getByAccount: (accountId: string) => mockInstallations.getByAccount(accountId),
  getById: (id: string) => mockInstallations.getById(id),
  create: (data: unknown) => mockInstallations.create(data as Record<string, unknown>),
  update: (id: string, data: unknown) => mockInstallations.update(id, data as Record<string, unknown>),
};
