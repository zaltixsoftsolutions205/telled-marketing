import api from './axios';

export const dashboardApi = {
  getAdminStats: async () => {
    const { data } = await api.get('/dashboard/admin');
    return data.data;
  },
  getSalesStats: async (userId: string) => {
    const { data } = await api.get('/dashboard/sales', { params: { userId } });
    return data.data;
  },
  getEngineerStats: async (userId: string) => {
    const { data } = await api.get('/dashboard/engineer', { params: { userId } });
    return data.data;
  },
  getHRStats: async () => {
    const { data } = await api.get('/dashboard/hr');
    return data.data;
  },
};
