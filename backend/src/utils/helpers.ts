import { Request } from 'express';

export const getPaginationParams = (req: Request) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
  return { page, limit, skip: (page - 1) * limit };
};

export const generateTicketId = (): string => {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TKT-${ts}-${rnd}`;
};

export const generateInvoiceNumber = (): string => {
  const y = new Date().getFullYear();
  const m = String(new Date().getMonth() + 1).padStart(2, '0');
  return `INV-${y}${m}-${Math.floor(Math.random() * 9000 + 1000)}`;
};

export const generatePONumber = (): string =>
  `PO-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;

export const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const sanitizeQuery = (q: string): string => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
