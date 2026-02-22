import { mockTraining } from '@/mock/store';

export const trainingApi = {
  getAll:  (params?: Record<string, unknown>) => mockTraining.getAll(params ?? {}),
  getById: (id: string)                       => mockTraining.getById(id),
  create:  (data: Record<string, unknown>)    => mockTraining.create(data),
  update:  (id: string, data: Record<string, unknown>) => mockTraining.update(id, data),
};
