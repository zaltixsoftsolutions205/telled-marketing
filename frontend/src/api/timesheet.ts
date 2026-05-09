import api from './axios';

export const timesheetApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/timesheets', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  create: async (body: Record<string, unknown>) => {
    const { data } = await api.post('/timesheets', body);
    return data.data;
  },
  update: async (id: string, body: Record<string, unknown>) => {
    const { data } = await api.put(`/timesheets/${id}`, body);
    return data.data;
  },
  delete: async (id: string) => {
    const { data } = await api.delete(`/timesheets/${id}`);
    return data.data;
  },
  submit: async (id: string) => {
    const { data } = await api.patch(`/timesheets/${id}/submit`);
    return data.data;
  },
  approve: async (id: string) => {
    const { data } = await api.patch(`/timesheets/${id}/approve`);
    return data.data;
  },
  reject: async (id: string, reason: string) => {
    const { data } = await api.patch(`/timesheets/${id}/reject`, { reason });
    return data.data;
  },
};
