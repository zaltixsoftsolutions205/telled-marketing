import api from './axios';

export const poExecutionApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/purchase-orders', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  getById: async (id: string) => {
    const { data } = await api.get(`/purchase-orders/${id}`);
    return data.data;
  },
  getByPO: async (poId: string) => {
    const { data } = await api.get(`/purchase-orders/${poId}`);
    return data.data;
  },
  create: async (poId: string) => {
    const { data } = await api.get(`/purchase-orders/${poId}`);
    return data.data;
  },
  notifyOEM: async (id: string) => {
    const { data } = await api.post(`/purchase-orders/${id}/forward-to-ark`, {});
    return data.data;
  },
  notifyDistributor: async (id: string) => {
    const { data } = await api.post(`/purchase-orders/${id}/step2-forward-to-ark`, {});
    return data.data;
  },
  updateDocField: async (id: string, _field: string, formData: Record<string, unknown>) => {
    const { data } = await api.put(`/purchase-orders/${id}`, formData);
    return data.data;
  },
  sendCustomerForms: async (id: string) => {
    const { data } = await api.post(`/purchase-orders/${id}/step4-send-docs-to-customer`, {});
    return data.data;
  },
  markCustomerFormsCompleted: async (id: string) => {
    const { data } = await api.post(`/purchase-orders/${id}/step3-price-clearance`, {});
    return data.data;
  },
  generateDistributorInvoice: async (id: string, formData: Record<string, unknown>) => {
    const { data } = await api.post(`/purchase-orders/${id}/step5-invoice-to-ark`, formData);
    return data.data;
  },
  shareBackToDistributor: async (id: string) => {
    const { data } = await api.post(`/purchase-orders/${id}/step6-send-docs-to-ark`, {});
    return data.data;
  },
  updateLicenseStatus: async (id: string, formData: Record<string, unknown>) => {
    const { data } = await api.post(`/purchase-orders/${id}/step7-license-received`, formData);
    return data.data;
  },
  generateCustomerInvoice: async (id: string, formData: Record<string, unknown>) => {
    const { data } = await api.post(`/purchase-orders/${id}/step8-final-invoice`, formData);
    return data.data;
  },
  sendCustomerInvoice: async (id: string) => {
    const { data } = await api.post(`/purchase-orders/${id}/send-customer-invoice`, {});
    return data.data;
  },
  markCustomerPaid: async (id: string) => {
    const { data } = await api.post(`/purchase-orders/${id}/payment`, { paidAmount: 0, paidDate: new Date().toISOString(), paymentMode: 'Bank Transfer' });
    return data.data;
  },
  updateStep: async (id: string, stepKey: string, formData: Record<string, unknown>) => {
    const { data } = await api.put(`/purchase-orders/${id}`, { [stepKey]: true, ...formData });
    return data.data;
  },
};
