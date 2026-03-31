import api from './axios';

export const leadsApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/leads', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  getById: async (id: string) => {
    const { data } = await api.get(`/leads/${id}`);
    return data.data;
  },
  create: async (body: unknown) => {
    const { data } = await api.post('/leads', body);
    return data.data;
  },
  update: async (id: string, body: unknown) => {
    const { data } = await api.put(`/leads/${id}`, body);
    return data.data;
  },
  archive: async (id: string) => {
    const { data } = await api.patch(`/leads/${id}/archive`);
    return data.data;
  },
  delete: async (id: string) => {
    const { data } = await api.delete(`/leads/${id}`);
    return data;
  },
  importLeads: async (rows: Array<Record<string, string>>) => {
    const { data } = await api.post('/leads/import', { rows });
    return data.data;
  },
  sendDrf: async (id: string) => {
    const { data } = await api.post(`/leads/${id}/send-drf`);
    return data.data;
  },
};
