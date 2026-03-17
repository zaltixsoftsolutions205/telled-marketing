import { mockPurchases } from '@/mock/store';
export const purchasesApi = {
  getAll:           (params?: Record<string, unknown>) => mockPurchases.getAll(params),
  getByLead:        (leadId: string) => mockPurchases.getByLead(leadId),
  getById:          (id: string) => mockPurchases.getById(id),
  create:           (data: FormData | unknown) => {
    const obj: Record<string, unknown> = {};
    if (data instanceof FormData) { data.forEach((v, k) => { obj[k] = v; }); }
    else { Object.assign(obj, data); }
    return mockPurchases.create(obj);
  },
  update:           (id: string, data: unknown) => mockPurchases.update(id, data as Record<string, unknown>),
  sendToVendor:     (id: string) => mockPurchases.sendToVendor(id),
  convertToAccount: (poId: string, data: { accountName?: string; notes?: string }) => mockPurchases.convertToAccount(poId, data),
};
