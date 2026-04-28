import api from './axios';

export interface LeavePolicy {
  Casual: number;
  Sick: number;
  Annual: number;
  Unpaid: number;
}

export interface LeaveBalance {
  Casual: { allocated: number; used: number; remaining: number };
  Sick: { allocated: number; used: number; remaining: number };
  Annual: { allocated: number; used: number; remaining: number };
  Unpaid: { allocated: number; used: number; remaining: number };
}

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
  getBalance: async (params?: { employeeId?: string; year?: number }): Promise<LeaveBalance> => {
    const { data } = await api.get('/leaves/balance', { params });
    return data.data;
  },
  getPolicy: async (): Promise<LeavePolicy> => {
    const { data } = await api.get('/settings/leave-policy');
    return data.data;
  },
  savePolicy: async (policy: LeavePolicy): Promise<LeavePolicy> => {
    const { data } = await api.put('/settings/leave-policy', policy);
    return data.data;
  },
};
