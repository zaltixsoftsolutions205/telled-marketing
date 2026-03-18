import api from './axios';

export const invoicesApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/invoices', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  getByAccount: async (accountId: string) => {
    const { data } = await api.get('/invoices', { params: { accountId } });
    return data.data;
  },
  getById: async (id: string) => {
    const { data } = await api.get(`/invoices/${id}`);
    return data.data;
  },
  getStats: async () => {
    const { data } = await api.get('/invoices/stats');
    return data.data;
  },
  create: async (body: unknown) => {
    const { data } = await api.post('/invoices', body);
    return data.data;
  },
  update: async (id: string, body: unknown) => {
    const { data } = await api.put(`/invoices/${id}`, body);
    return data.data;
  },
  recordPayment: async (id: string, body: unknown) => {
    const { data } = await api.post(`/invoices/${id}/payments`, body);
    return data.data;
  },
  getPayments: async (id: string) => {
    const { data } = await api.get(`/invoices/${id}/payments`);
    return data.data;
  },
};
