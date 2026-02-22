import { mockSalaries } from '@/mock/store';
export const salariesApi = {
  getAll: (params?: Record<string, unknown>) => mockSalaries.getAll(params),
  calculate: (data: { employeeId: string; month: number; year: number; baseSalary: number; incentives?: number; deductions?: number }) => mockSalaries.calculate(data),
  markPaid: (id: string) => mockSalaries.markPaid(id),
};
