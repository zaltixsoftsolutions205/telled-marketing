import api from './axios';
export const attendanceApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/attendance', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? data.data?.length ?? 0 } };
  },
  mark: async (body: unknown) => {
    const { data } = await api.post('/attendance', body);
    return data.data;
  },
  update: async (id: string, body: unknown) => {
    const { data } = await api.put(`/attendance/${id}`, body);
    return data.data;
  },
  getSummary: async (params: Record<string, unknown>) => {
    const { data } = await api.get('/attendance/summary', { params });
    return data.data;
  },
  getTodayStatus: async () => {
    const { data } = await api.get('/attendance/today');
    return data.data;
  },
  checkIn: async () => {
    const { data } = await api.post('/attendance/checkin');
    return data.data;
  },
  checkOut: async () => {
    const { data } = await api.post('/attendance/checkout');
    return data.data;
  },
};
