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
  resolve: async (id: string, note?: string, resolvedBy?: string, queryType?: string) => {
    const { data } = await api.post(`/support/${id}/resolve`, { note, resolvedBy, queryType });
    return data.data;
  },
  submitFeedback: async (id: string, feedback: string) => {
    const { data } = await api.post(`/support/${id}/feedback`, { feedback });
    return data.data;
  },
  reopen: async (id: string, reason?: string) => {
    const { data } = await api.post(`/support/${id}/reopen`, { reason });
    return data.data;
  },
  transfer: async (id: string, engineerId: string, note: string, _transferredById: string) => {
    const { data } = await api.put(`/support/${id}`, { assignedTo: engineerId, transferNote: note });
    return data.data;
  },
};
