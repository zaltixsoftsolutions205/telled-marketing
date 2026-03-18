import api from './axios';

export const engineerVisitsApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/engineer-visits', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  getMyVisits: async (engineerId: string) => {
    const { data } = await api.get('/engineer-visits', { params: { engineerId } });
    return data.data;
  },
  create: async (body: unknown) => {
    const { data } = await api.post('/engineer-visits', body);
    return data.data;
  },
  approve: async (id: string) => {
    const { data } = await api.patch(`/engineer-visits/${id}/approve`);
    return data.data;
  },
  reject: async (id: string) => {
    const { data } = await api.patch(`/engineer-visits/${id}/reject`);
    return data.data;
  },
};
