import api from './axios';

export const dashboardApi = {
  getAdminStats: async () => {
    const { data } = await api.get('/dashboard/admin');
    return data.data;
  },
  getSalesStats: async (_userId: string) => {
    const { data } = await api.get('/dashboard/sales');
    return data.data;
  },
  getEngineerStats: async (_userId: string) => {
    const { data } = await api.get('/dashboard/engineer');
    return data.data;
  },
  getHRStats: async () => {
    const { data } = await api.get('/dashboard/hr');
    return data.data;
  },
};
