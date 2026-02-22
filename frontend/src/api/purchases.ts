import { mockPurchases } from '@/mock/store';
export const purchasesApi = {
  getAll: (params?: Record<string, unknown>) => mockPurchases.getAll(params),
  getByLead: (leadId: string) => Promise.resolve([]),
  getById: (id: string) => mockPurchases.getById(id),
  create: (data: FormData | unknown) => {
    const obj: Record<string, unknown> = {};
    if (data instanceof FormData) { data.forEach((v, k) => { obj[k] = v; }); }
    else { Object.assign(obj, data); }
    return mockPurchases.create(obj);
  },
  update: (_id: string, _data: unknown) => Promise.resolve(null),
};
