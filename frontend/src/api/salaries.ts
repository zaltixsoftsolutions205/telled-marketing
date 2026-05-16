// import api from './axios';

// export const salariesApi = {
//   getAll: async (params?: Record<string, unknown>) => {
//     const { data } = await api.get('/salaries', { params });
//     return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
//   },
//   calculate: async (body: { employeeId: string; month: number; year: number; baseSalary: number; incentives?: number; deductions?: number; travelAllowance?: number; recalculate?: boolean }) => {
//     const { data } = await api.post('/salaries/calculate', body);
//     return data.data;
//   },
//   markPaid: async (id: string) => {
//     const { data } = await api.patch(`/salaries/${id}/mark-paid`);
//     return data.data;
//   },
//   getClaimsPreview: async (employeeId: string, month: number, year: number): Promise<number> => {
//     const { data } = await api.get('/salaries/claims-preview', { params: { employeeId, month, year } });
//     return data.data?.claimsTotal ?? 0;
//   },
//   getVisitChargesPreview: async (employeeId: string, month: number, year: number): Promise<number> => {
//     const { data } = await api.get('/salaries/visits-preview', { params: { employeeId, month, year } });
//     return data.data?.visitChargesTotal ?? 0;
//   },
// };
import api from './axios';

export const salariesApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/salaries', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  
  calculate: async (body: { 
    employeeId: string; 
    month: number; 
    year: number; 
    baseSalary: number; 
    incentives?: number; 
    deductions?: number; 
    travelAllowance?: number; 
    recalculate?: boolean;
    hra?: number;
    lta?: number;
    specialAllowance?: number;
    overtimePay?: number;
    bonuses?: number;
    medicalReimbursement?: number;
    conveyance?: number;
    perquisites?: number;
    pfDeduction?: number;
    professionalTax?: number;
    tds?: number;
    esiDeduction?: number;
    otherDeductions?: number;
    loanRepayment?: number;
    advanceDeduction?: number;
  }) => {
    const { data } = await api.post('/salaries/calculate', body);
    return data.data;
  },
  
  // ADD THIS - Bulk Payroll
  bulkCalculate: async (body: { month: number; year: number }) => {
    const { data } = await api.post('/salaries/bulk-calculate', body);
    return data;
  },
  
  // ADD THIS - Get Stats
  getStats: async (params: { month: number; year: number }) => {
    const { data } = await api.get('/salaries/stats', { params });
    return data;
  },
  
  // ADD THIS - Export Register
  exportSalaryRegister: async (params: { month: number; year: number; format: string }) => {
    const { data } = await api.get('/salaries/export', { 
      params,
      responseType: 'blob' 
    });
    return data;
  },
  
  markPaid: async (id: string, body?: { paymentMode?: string; bankReference?: string }) => {
    const { data } = await api.patch(`/salaries/${id}/mark-paid`, body || {});
    return data.data;
  },
  
  getClaimsPreview: async (employeeId: string, month: number, year: number): Promise<number> => {
    const { data } = await api.get('/salaries/claims-preview', { params: { employeeId, month, year } });
    return data.data?.claimsTotal ?? 0;
  },
  
  getVisitChargesPreview: async (employeeId: string, month: number, year: number): Promise<number> => {
    const { data } = await api.get('/salaries/visits-preview', { params: { employeeId, month, year } });
    return data.data?.visitChargesTotal ?? 0;
  },
};