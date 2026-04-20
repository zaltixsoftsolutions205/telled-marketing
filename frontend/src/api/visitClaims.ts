// frontend/src/api/visitClaims.ts
import api from './axios';

export interface Expense {
  type: 'travel' | 'food' | 'accommodation' | 'materials' | 'other';
  description: string;
  amount: number;
  receipt?: string;
  date: string;
}

export interface VisitClaim {
  _id: string;
  visitId: any;
  engineerId: any;
  accountId?: any;
  claimNumber: string;
  expenses: Expense[];
  totalAmount: number;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
  submittedAt?: string;
  rejectionReason?: string;
  approvalNotes?: string;
  paymentMode?: string;
  invoiceFile?: string;
  notes?: string;
  reviewedBy?: any;
  reviewedAt?: string;
  paidAt?: string;
  paymentReference?: string;
  createdAt: string;
}

export const visitClaimsApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/visit-claims', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  
  getStats: async () => {
    const { data } = await api.get('/visit-claims/stats');
    return data.data;
  },
  
  create: async (body: { visitId: string; expenses: Expense[]; notes?: string }) => {
    const { data } = await api.post('/visit-claims', body);
    return data.data;
  },
  
  submit: async (id: string, paymentMode: string, invoiceFile?: File) => {
    const form = new FormData();
    form.append('paymentMode', paymentMode);
    if (invoiceFile) form.append('invoiceFile', invoiceFile);
    const { data } = await api.patch(`/visit-claims/${id}/submit`, form);
    return data.data;
  },
  
  approve: async (id: string, approvalNotes?: string) => {
    const { data } = await api.patch(`/visit-claims/${id}/approve`, { approvalNotes });
    return data.data;
  },
  
  reject: async (id: string, rejectionReason: string) => {
    const { data } = await api.patch(`/visit-claims/${id}/reject`, { rejectionReason });
    return data.data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/visit-claims/${id}`);
    return data.data;
  },

  markAsPaid: async (id: string, paymentReference?: string) => {
    const { data } = await api.patch(`/visit-claims/${id}/pay`, { paymentReference });
    return data.data;
  }
};