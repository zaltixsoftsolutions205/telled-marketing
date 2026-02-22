import type { Role } from '@/types';

export const can = {
  manageUsers: (role: Role) => role === 'admin',
  manageLeads: (role: Role) => role === 'admin' || role === 'sales',
  approveOEM: (role: Role) => role === 'admin',
  manageAccounts: (role: Role) => role === 'admin' || role === 'sales',
  manageQuotations: (role: Role) => role === 'admin' || role === 'sales',
  managePurchases: (role: Role) => role === 'admin' || role === 'sales',
  manageInstallations: (role: Role) => role === 'admin' || role === 'engineer',
  manageSupport: (role: Role) => role !== 'hr_finance',
  manageInvoices: (role: Role) => role === 'admin' || role === 'hr_finance',
  managePayments: (role: Role) => role === 'admin' || role === 'hr_finance',
  manageEngineerVisits: (role: Role) => role !== 'sales',
  approveVisits: (role: Role) => role === 'admin' || role === 'hr_finance',
  manageSalary: (role: Role) => role === 'admin' || role === 'hr_finance',
  viewDashboard: (_role: Role) => true,
};
