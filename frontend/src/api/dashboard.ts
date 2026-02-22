import { mockDashboard } from '@/mock/store';
export const dashboardApi = {
  getAdminStats: () => mockDashboard.getAdminStats(),
  getSalesStats: (userId: string) => mockDashboard.getSalesStats(userId),
  getEngineerStats: (userId: string) => mockDashboard.getEngineerStats(userId),
  getHRStats: () => mockDashboard.getHRStats(),
};
