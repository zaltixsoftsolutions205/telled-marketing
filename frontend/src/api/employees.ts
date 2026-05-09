import { mockEmployees } from '@/mock/store';

export const employeesApi = {
  getDetail: (id: string) => mockEmployees.getDetail(id),
  update: (id: string, body: Record<string, unknown>) => mockEmployees.update(id, body),
  uploadDocument: (id: string, file: File, label: string) => mockEmployees.uploadDocument(id, file, label),
  deleteDocument: (employeeId: string, docId: string) => mockEmployees.deleteDocument(employeeId, docId),
};
