import api from './axios';

export const installationsApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/installations', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  getByAccount: async (accountId: string) => {
    const { data } = await api.get('/installations', { params: { accountId } });
    return data.data;
  },
  getById: async (id: string) => {
    const { data } = await api.get(`/installations/${id}`);
    return data.data;
  },
  create: async (body: unknown) => {
    const { data } = await api.post('/installations', body);
    return data.data;
  },
  update: async (id: string, body: unknown) => {
    const { data } = await api.put(`/installations/${id}`, body);
    return data.data;
  },
};
