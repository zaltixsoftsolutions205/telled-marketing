import api from './axios';
export const leavesApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/leaves', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? data.data?.length ?? 0 } };
  },
  apply: async (body: unknown) => {
    const { data } = await api.post('/leaves', body);
    return data.data;
  },
  approve: async (id: string) => {
    const { data } = await api.patch(`/leaves/${id}/approve`);
    return data.data;
  },
  reject: async (id: string, body: { rejectionReason: string }) => {
    const { data } = await api.patch(`/leaves/${id}/reject`, body);
    return data.data;
  },
};
