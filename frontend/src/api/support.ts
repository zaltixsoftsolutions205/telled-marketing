import api from './axios';

export const supportApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/support', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  getByAccount: async (accountId: string) => {
    const { data } = await api.get('/support', { params: { accountId } });
    return data.data;
  },
  getById: async (id: string) => {
    const { data } = await api.get(`/support/${id}`);
    return data.data;
  },
  create: async (body: unknown) => {
    const { data } = await api.post('/support', body);
    return data.data;
  },
  update: async (id: string, body: unknown) => {
    const { data } = await api.put(`/support/${id}`, body);
    return data.data;
  },
  addNote: async (id: string, note: string) => {
    const { data } = await api.post(`/support/${id}/notes`, { note });
    return data.data;
  },
};
