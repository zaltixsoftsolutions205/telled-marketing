import type { Role } from '@/types';

export const can = {
  manageUsers:         (role: Role) => role === 'admin' || role === 'manager' || role === 'hr',
  manageLeads:         (role: Role) => role === 'admin' || role === 'manager' || role === 'sales',
  approveOEM:          (role: Role) => role === 'admin' || role === 'manager',
  manageAccounts:      (role: Role) => role === 'admin' || role === 'manager' || role === 'sales',
  manageQuotations:    (role: Role) => role === 'admin' || role === 'manager' || role === 'sales',
  managePurchases:     (role: Role) => role === 'admin' || role === 'manager' || role === 'sales',
  manageInstallations: (role: Role) => role === 'admin' || role === 'manager' || role === 'engineer',
  manageSupport:       (role: Role) => role !== 'hr' && role !== 'finance',
  manageInvoices:      (role: Role) => role === 'admin' || role === 'manager' || role === 'hr' || role === 'finance',
  managePayments:      (role: Role) => role === 'admin' || role === 'manager' || role === 'hr' || role === 'finance',
  manageEngineerVisits:(role: Role) => role !== 'sales',
  approveVisits:       (role: Role) => role === 'admin' || role === 'manager' || role === 'hr',
  manageSalary:        (role: Role) => role === 'admin' || role === 'manager' || role === 'hr',
  manageAttendance:    (role: Role) => role === 'admin' || role === 'manager' || role === 'hr',
  manageLeaves:        (role: Role) => role === 'admin' || role === 'manager' || role === 'hr',
  viewDashboard:       (_role: Role) => true,
  viewContacts:        (_role: Role) => true,
  createContact:       (_role: Role) => true,
  manageAllContacts:   (role: Role) => role === 'admin' || role === 'manager',
  manageTelledContacts:(role: Role) => role === 'admin' || role === 'manager' || role === 'hr' || role === 'finance',
};
