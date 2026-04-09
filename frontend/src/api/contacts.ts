import api from './axios';

export const contactsApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/contacts', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },

  getById: async (id: string) => {
    const { data } = await api.get(`/contacts/${id}`);
    return data.data;
  },

  getByAccount: async (accountId: string) => {
    const { data } = await api.get(`/contacts/account/${accountId}`);
    return data.data;
  },

  create: async (body: unknown) => {
    const { data } = await api.post('/contacts', body);
    return data.data;
  },

  update: async (id: string, body: unknown) => {
    const { data } = await api.put(`/contacts/${id}`, body);
    return data.data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/contacts/${id}`);
    return data.data;
  },
};
