import api from './axios';

export const employeesApi = {
  getDetail: async (id: string) => {
    const { data } = await api.get(`/employees/${id}`);
    return data.data;
  },
  update: async (id: string, body: Record<string, unknown>) => {
    const { data } = await api.put(`/employees/${id}`, body);
    return data.data;
  },
  uploadDocument: async (id: string, file: File, label: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('label', label);
    const { data } = await api.post(`/employees/${id}/documents`, form);
    return data.data;
  },
  deleteDocument: async (employeeId: string, docId: string) => {
    const { data } = await api.delete(`/employees/${employeeId}/documents/${docId}`);
    return data.data;
  },
};
