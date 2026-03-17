import { mockEngineerVisits } from '@/mock/store';
export const engineerVisitsApi = {
  getAll:      (params?: Record<string, unknown>) => mockEngineerVisits.getAll(params),
  getMyVisits: (engineerId: string)               => mockEngineerVisits.getMyVisits(engineerId),
  create:      (data: unknown)                    => mockEngineerVisits.create(data as Record<string, unknown>),
  approve:     (id: string)                       => mockEngineerVisits.approve(id),
  reject:      (id: string)                       => mockEngineerVisits.reject(id),
};
