import api from './axios';

export const purchasesApi = {
  getAll: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/purchase-orders', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  getByLead: async (leadId: string) => {
    const { data } = await api.get('/purchase-orders', { params: { leadId } });
    return data.data;
  },
  getById: async (id: string) => {
    const { data } = await api.get(`/purchase-orders/${id}`);
    return data.data;
  },
  create: async (body: unknown) => {
    const { data } = await api.post('/purchase-orders', body);
    return data.data;
  },
  update: async (id: string, body: unknown) => {
    const { data } = await api.put(`/purchase-orders/${id}`, body);
    return data.data;
  },
  sendToVendor: async (id: string, vendorEmail: string, cc?: string) => {
    const { data } = await api.post(`/purchase-orders/${id}/send-to-vendor`, { vendorEmail, ...(cc ? { cc } : {}) });
    return data.data;
  },
  sendCustomerInvoice: async (id: string, customerEmail: string, cc?: string, file?: File) => {
    if (file) {
      const form = new FormData();
      form.append('customerEmail', customerEmail);
      if (cc) form.append('cc', cc);
      form.append('attachment', file);
      const { data } = await api.post(`/purchase-orders/${id}/send-customer-invoice`, form);
      return data.data;
    }
    const { data } = await api.post(`/purchase-orders/${id}/send-customer-invoice`, { customerEmail, ...(cc ? { cc } : {}) });
    return data.data;
  },
  forwardToArk: async (id: string, arkEmail: string, arkName?: string, cc?: string, file?: File) => {
    if (file) {
      const form = new FormData();
      form.append('arkEmail', arkEmail);
      if (arkName) form.append('arkName', arkName);
      if (cc) form.append('cc', cc);
      form.append('attachment', file);
      const { data } = await api.post(`/purchase-orders/${id}/forward-to-ark`, form);
      return data.data;
    }
    const { data } = await api.post(`/purchase-orders/${id}/forward-to-ark`, { arkEmail, ...(arkName ? { arkName } : {}), ...(cc ? { cc } : {}) });
    return data.data;
  },
  markPriceClearance: async (id: string) => {
    const { data } = await api.post(`/purchase-orders/${id}/mark-price-clearance`);
    return data.data;
  },
  sendPoToArk: async (id: string, arkEmail: string, cc?: string, file?: File) => {
    if (file) {
      const form = new FormData();
      form.append('arkEmail', arkEmail);
      if (cc) form.append('cc', cc);
      form.append('attachment', file);
      const { data } = await api.post(`/purchase-orders/${id}/send-po-to-ark`, form);
      return data.data;
    }
    const { data } = await api.post(`/purchase-orders/${id}/send-po-to-ark`, { arkEmail, ...(cc ? { cc } : {}) });
    return data.data;
  },
  markArkInvoice: async (id: string, amount?: number) => {
    const { data } = await api.post(`/purchase-orders/${id}/mark-ark-invoice`, { amount });
    return data.data;
  },
  convertToAccount: async (poId: string, body: { accountName?: string; notes?: string }) => {
    const { data } = await api.post(`/purchase-orders/${poId}/convert`, body);
    return data.data;
  },
  recordPayment: async (id: string, body: unknown) => {
    const { data } = await api.post(`/purchase-orders/${id}/payment`, body);
    return data.data;
  },
  getVendorPayments: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/purchase-orders/vendor-payments', { params });
    return { data: data.data, pagination: { total: data.meta?.total ?? 0 } };
  },
  delete: async (id: string) => {
    const { data } = await api.delete(`/purchase-orders/${id}`);
    return data.data;
  },
};
