import { mockContacts } from '@/mock/store';
import { useAuthStore } from '@/store/authStore';

export const contactsApi = {
  getAll: (params?: Record<string, unknown>) => mockContacts.getAll(params),
  getById: (id: string) => mockContacts.getById(id),
  getByAccount: (accountId: string) => mockContacts.getByAccount(accountId),
  create: (body: unknown) => mockContacts.create(body as Record<string, unknown>, useAuthStore.getState().user),
  update: (id: string, body: unknown) => mockContacts.update(id, body as Record<string, unknown>),
  delete: (id: string) => mockContacts.delete(id),
};
