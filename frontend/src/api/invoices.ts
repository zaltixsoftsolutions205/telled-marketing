import { mockInvoices } from '@/mock/store';
export const invoicesApi = {
  getAll: (params?: Record<string, unknown>) => mockInvoices.getAll(params),
  getByAccount: (accountId: string) => mockInvoices.getByAccount(accountId),
  getById: (id: string) => mockInvoices.getById(id),
  getStats: () => mockInvoices.getStats(),
  create: (data: unknown) => mockInvoices.create(data as Record<string, unknown>),
  update: (_id: string, _data: unknown) => Promise.resolve(null),
  recordPayment: (id: string, data: unknown) => mockInvoices.recordPayment(id, data as Record<string, unknown>),
  getPayments: (id: string) => mockInvoices.getPayments(id),
};
