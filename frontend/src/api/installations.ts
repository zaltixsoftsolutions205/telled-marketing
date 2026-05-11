import { mockInstallations } from '@/mock/store';

export const installationsApi = {
  getAll: (params?: Record<string, unknown>) => mockInstallations.getAll(params || {}),
  getByAccount: (accountId: string) => mockInstallations.getByAccount(accountId),
  getById: (id: string) => mockInstallations.getById(id),
  create: (body: unknown) => mockInstallations.create(body as Record<string, unknown>),
  update: (id: string, body: unknown) => mockInstallations.update(id, body as Record<string, unknown>),
};
