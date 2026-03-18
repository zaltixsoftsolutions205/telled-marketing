import api from './axios';

export const purchasesApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/purchase-orders', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  getByLead: async (leadId: string) => {
    const { data } = await api.get('/purchase-orders', { params: { leadId } });
    return data.data;
  },
  getById: async (id: string) => {
    const { data } = await api.get(`/purchase-orders/${id}`);
    return data.data;
  },
  create: async (body: unknown) => {
    const { data } = await api.post('/purchase-orders', body);
    return data.data;
  },
  update: async (id: string, body: unknown) => {
    const { data } = await api.put(`/purchase-orders/${id}`, body);
    return data.data;
  },
  sendToVendor: async (id: string) => {
    const { data } = await api.post(`/purchase-orders/${id}/send-to-vendor`);
    return data.data;
  },
  convertToAccount: async (poId: string, body: { accountName?: string; notes?: string }) => {
    const { data } = await api.post(`/purchase-orders/${poId}/convert`, body);
    return data.data;
  },
};
