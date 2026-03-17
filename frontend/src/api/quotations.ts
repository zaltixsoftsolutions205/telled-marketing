import { mockQuotations } from '@/mock/store';
export const quotationsApi = {
  getAll:       (params?: Record<string, unknown>) => mockQuotations.getAll(params),
  getByLead:    (leadId: string) => mockQuotations.getByLead(leadId),
  getById:      (id: string) => mockQuotations.getById(id),
  create:       (data: unknown) => mockQuotations.create(data as Record<string, unknown>),
  update:       (id: string, data: unknown) => mockQuotations.update(id, data as Record<string, unknown>),
  accept:       (id: string) => mockQuotations.accept(id),
  reject:       (id: string) => mockQuotations.reject(id),
  sendEmail:    (id: string) => mockQuotations.sendEmail(id),
  generatePDF:  (id: string) => mockQuotations.generatePDF(id),
};
