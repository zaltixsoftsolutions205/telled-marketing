import { mockTimesheets } from '@/mock/store';
import { useAuthStore } from '@/store/authStore';

export const timesheetApi = {
  getAll: (params?: Record<string, unknown>) => mockTimesheets.getAll(params),
  create: (body: Record<string, unknown>) => mockTimesheets.create(body, useAuthStore.getState().user),
  update: (id: string, body: Record<string, unknown>) => mockTimesheets.update(id, body),
  delete: (id: string) => mockTimesheets.delete(id),
  approve: (id: string) => mockTimesheets.approve(id),
  reject: (id: string, reason: string) => mockTimesheets.reject(id, reason),
};
