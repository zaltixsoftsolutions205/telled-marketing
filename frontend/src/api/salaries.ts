import api from './axios';

export const salariesApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/salaries', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  calculate: async (body: { employeeId: string; month: number; year: number; baseSalary: number; incentives?: number; deductions?: number }) => {
    const { data } = await api.post('/salaries/calculate', body);
    return data.data;
  },
  markPaid: async (id: string) => {
    const { data } = await api.patch(`/salaries/${id}/mark-paid`);
    return data.data;
  },
};
