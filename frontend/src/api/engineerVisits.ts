import api from './axios';

export const engineerVisitsApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/engineer-visits', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  getById: async (id: string) => {
    const { data } = await api.get(`/engineer-visits/${id}`);
    return data.data;
  },
  getMyVisits: async (engineerId: string) => {
    const { data } = await api.get('/engineer-visits', { params: { engineerId } });
    return data.data;
  },
  create: async (body: unknown) => {
    const { data } = await api.post('/engineer-visits', body);
    return data.data;
  },
  schedule: async (body: unknown) => {
    const { data } = await api.post('/engineer-visits/schedule', body);
    return data.data;
  },
  complete: async (id: string, body: unknown) => {
    const { data } = await api.patch(`/engineer-visits/${id}/complete`, body);
    return data.data;
  },
  updateStatus: async (id: string, status: string) => {
    const { data } = await api.patch(`/engineer-visits/${id}/status`, { status });
    return data.data;
  },
  approve: async (id: string) => {
    const { data } = await api.patch(`/engineer-visits/${id}/approve`);
    return data.data;
  },
  reject: async (id: string, reason?: string) => {
    const { data } = await api.patch(`/engineer-visits/${id}/reject`, { reason });
    return data.data;
  },
  getPerformance: async (engineerId?: string) => {
    const { data } = await api.get('/engineer-visits/performance', { params: engineerId ? { engineerId } : {} });
    return data.data;
  },
};
