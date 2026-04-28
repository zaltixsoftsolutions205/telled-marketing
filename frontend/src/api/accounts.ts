import api from './axios';

export const accountsApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/accounts', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  getById: async (id: string) => {
    const { data } = await api.get(`/accounts/${id}`);
    return data.data;
  },
  convert: async (body: { leadId: string; accountName: string; notes?: string }) => {
    const { data } = await api.post('/accounts/convert', body);
    return data.data;
  },
  update: async (id: string, body: unknown) => {
    const { data } = await api.put(`/accounts/${id}`, body);
    return data.data;
  },
  assignEngineer: async (id: string, engineerId: string) => {
    const { data } = await api.patch(`/accounts/${id}/assign-engineer`, { engineerId });
    return data.data;
  },
  sendWelcomeMail: async (id: string) => {
    const { data } = await api.post(`/accounts/${id}/send-welcome`);
    return data;
  },
  delete: async (id: string) => {
    const { data } = await api.delete(`/accounts/${id}`);
    return data.data;
  },
};
