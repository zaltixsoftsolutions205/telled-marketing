import { mockInvoices } from '@/mock/store';

export const invoicesApi = {
  getAll: (params?: Record<string, unknown>) => mockInvoices.getAll(params || {}),
  getByAccount: (accountId: string) => mockInvoices.getByAccount(accountId),
  getByType: (invoiceType: 'customer' | 'vendor', params?: Record<string, unknown>) =>
    mockInvoices.getAll({ invoiceType, ...params }),
  getById: (id: string) => mockInvoices.getById(id),
  getStats: () => mockInvoices.getStats(),
  create: (body: unknown) => mockInvoices.create(body as Record<string, unknown>),
  recordPayment: (id: string, body: unknown) => mockInvoices.recordPayment(id, body as Record<string, unknown>),
  update: (id: string, body: unknown) => mockInvoices.update(id, body as Record<string, unknown>),
  getPayments: (id: string) => mockInvoices.getPayments(id),
};
