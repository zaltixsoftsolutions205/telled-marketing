import api from './axios';

export const trainingApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/training', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  getByAccount: async (accountId: string) => {
    const { data } = await api.get('/training', { params: { accountId } });
    return data.data;
  },
  getById: async (id: string) => {
    const { data } = await api.get(`/training/${id}`);
    return data.data;
  },
  create: async (body: Record<string, unknown>) => {
    const { data } = await api.post('/training', body);
    return data.data;
  },
  update: async (id: string, body: Record<string, unknown>) => {
    const { data } = await api.put(`/training/${id}`, body);
    return data.data;
  },
};
