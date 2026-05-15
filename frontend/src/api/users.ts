import api from './axios';

export const usersApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/users', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  getById: async (id: string) => {
    const { data } = await api.get(`/users/${id}`);
    return data.data;
  },
  create: async (body: unknown) => {
    const { data } = await api.post('/users', body);
    return data.data;
  },
  update: async (id: string, body: unknown) => {
    const { data } = await api.put(`/users/${id}`, body);
    return data.data;
  },
  activate: async (id: string, body: { permissions: string[]; canCreateUsers: boolean; assignablePermissions: string[] }) => {
    const { data } = await api.patch(`/users/${id}/activate`, body);
    return data.data;
  },
  toggleStatus: async (id: string) => {
    const { data } = await api.patch(`/users/${id}/toggle-status`);
    return data.data;
  },
  resetPassword: async (id: string, password: string) => {
    const { data } = await api.patch(`/users/${id}/reset-password`, { password });
    return data.data;
  },
  delete: async (id: string) => {
    const { data } = await api.delete(`/users/${id}`);
    return data.data;
  },
  getEngineers: async () => {
    const { data } = await api.get('/users', { params: { role: 'engineer', limit: 200 } });
    return data.data;
  },
  getSalesmen: async () => {
    const { data } = await api.get('/users', { params: { role: 'sales', limit: 200 } });
    return data.data;
  },
};
