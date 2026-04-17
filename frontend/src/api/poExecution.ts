import { mockPOExecution } from '@/mock/store';

export const poExecutionApi = {
  getAll: (params?: Record<string, unknown>) => mockPOExecution.getAll(params),
  getById: (id: string) => mockPOExecution.getById(id),
  getByPO: (poId: string) => mockPOExecution.getByPO(poId),
  create: (poId: string) => mockPOExecution.create(poId),
  notifyOEM: (id: string) => mockPOExecution.notifyOEM(id),
  notifyDistributor: (id: string) => mockPOExecution.notifyDistributor(id),
  updateDocField: (id: string, field: string, data: Record<string, unknown>) => mockPOExecution.updateDocField(id, field, data),
  sendCustomerForms: (id: string) => mockPOExecution.sendCustomerForms(id),
  markCustomerFormsCompleted: (id: string) => mockPOExecution.markCustomerFormsCompleted(id),
  generateDistributorInvoice: (id: string, data: Record<string, unknown>) => mockPOExecution.generateDistributorInvoice(id, data),
  shareBackToDistributor: (id: string) => mockPOExecution.shareBackToDistributor(id),
  updateLicenseStatus: (id: string, data: Record<string, unknown>) => mockPOExecution.updateLicenseStatus(id, data),
  generateCustomerInvoice: (id: string, data: Record<string, unknown>) => mockPOExecution.generateCustomerInvoice(id, data),
  sendCustomerInvoice: (id: string) => mockPOExecution.sendCustomerInvoice(id),
  markCustomerPaid: (id: string) => mockPOExecution.markCustomerPaid(id),
  updateStep: (id: string, stepKey: string, data: Record<string, unknown>) => mockPOExecution.updateStep(id, stepKey, data),
};
