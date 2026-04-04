export type Role = 'admin' | 'sales' | 'engineer' | 'hr_finance';
export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Not Qualified';
export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Final';

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  ownerId: string;
  isActive: boolean;
  createdAt: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  phone?: string;
  baseSalary?: number;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
}

export type LeadStage =
  | 'New'
  | 'OEM Submitted'
  | 'OEM Approved'
  | 'OEM Rejected'
  | 'OEM Expired'
  | 'Technical Done'
  | 'Quotation Sent'
  | 'Negotiation'
  | 'PO Received'
  | 'Converted'
  | 'Lost';

export interface Lead {
  _id: string;
  companyName: string;
  contactName: string;
  contactPersonName: string;
  email: string;
  phone: string;
  oemName: string;
  oemEmail?: string;
  address?: string;
  city?: string;
  state?: string;
  source?: string;
  status: LeadStatus;
  stage: LeadStage;
  assignedTo?: User;
  website?: string;
  annualTurnover?: string;
  designation?: string;
  channelPartner?: string;
  expectedClosure?: string;
  notes?: string;
  isArchived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type DRFStatus = 'Pending' | 'Approved' | 'Rejected' | 'Expired';

export interface DRF {
  _id: string;
  leadId: Lead;
  drfNumber: string;
  title: string;
  version: number;
  status: DRFStatus;
  sentDate: string;
  approvedDate?: string;
  rejectedDate?: string;
  rejectionReason?: string;
  expiryDate?: string;
  approvedBy?: User;
  extensionCount: number;
  extensionHistory: Array<{
    extendedAt: string;
    previousExpiry: string;
    newExpiry: string;
    extendedBy: User;
    reason: string;
  }>;
  notes?: string;
  createdBy: User;
  createdAt: string;
}

export interface Account {
  _id: string;
  leadId: Lead;
  accountName: string;
  assignedEngineer?: User;
  assignedSales?: User;
  status: 'Active' | 'Inactive';
  licenseVersion?: string;
  licenseDate?: string;
  licenseExpiryDate?: string;
  notes?: string;
  createdAt: string;
}

export interface QuotationItem {
  description: string;
  quantity: number;
  listPrice?: number;
  unitPrice: number;
  total: number;
}

export interface Quotation {
  _id: string;
  leadId: Lead;
  quotationNumber: string;
  version: number;
  items: QuotationItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: QuotationStatus;
  validUntil?: string;
  delivery?: string;
  terms?: string;
  notes?: string;
  gstApplicable?: boolean;
  finalAmount?: number;
  pdfPath?: string;
  emailSent?: boolean;
  emailSentAt?: string;
  createdBy: User;
  createdAt: string;
}

export interface PurchaseOrder {
  _id: string;
  leadId: Lead | string;
  poNumber: string;
  amount: number;
  product?: string;
  vendorName?: string;
  vendorEmail?: string;
  receivedDate: string;
  notes?: string;
  vendorEmailSent: boolean;
  vendorEmailSentAt?: string;
  converted: boolean;
  uploadedBy: User | string;
  isArchived: boolean;
  paymentStatus?: 'Unpaid' | 'Paid';
  paidAmount?: number;
  paidDate?: string;
  paymentMode?: string;
  paymentReference?: string;
  paymentNotes?: string;
  paidBy?: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface Installation {
  _id: string;
  accountId: Account;
  scheduledDate: string;
  completedDate?: string;
  engineer?: User;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  siteAddress: string;
  licenseVersion?: string;
  notes?: string;
  createdAt: string;
}

export interface InternalNote {
  note: string;
  addedBy: User;
  addedAt: string;
}

export interface SupportTicket {
  _id: string;
  accountId: Account;
  ticketId: string;
  subject: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assignedTo?: User;
  internalNotes: InternalNote[];
  lastResponseAt?: string;
  resolvedAt?: string;
  createdBy: User;
  createdAt: string;
}

export interface Invoice {
  _id: string;
  accountId: Account;
  invoiceNumber: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Cancelled';
  pdfPath?: string;
  notes?: string;
  createdBy: User;
  createdAt: string;
}

export interface Payment {
  _id: string;
  invoiceId: Invoice;
  amountPaid: number;
  paymentDate: string;
  mode: 'Bank Transfer' | 'Cheque' | 'Cash' | 'UPI' | 'Online';
  referenceNumber?: string;
  notes?: string;
  recordedBy: User;
  createdAt: string;
}

export interface EngineerVisit {
  _id: string;
  engineerId: User;
  accountId?: Account;
  visitDate: string;
  visitCharges: number;
  travelAllowance: number;
  additionalExpense: number;
  totalAmount: number;
  purpose: string;
  hrStatus: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: User;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface Salary {
  _id: string;
  employeeId: User;
  month: number;
  year: number;
  baseSalary: number;
  visitChargesTotal: number;
  travelAllowance: number;
  incentives: number;
  deductions: number;
  finalSalary: number;
  status: 'Calculated' | 'Paid';
  paidDate?: string;
  payslipPdf?: string;
  pdfPath?: string;
  notes?: string;
  createdAt: string;
}

export interface Attendance {
  _id: string;
  employeeId: User | string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: 'Present' | 'Absent' | 'Half Day' | 'Leave' | 'Holiday';
  notes?: string;
  markedBy?: User | string;
  createdAt: string;
}

export interface Leave {
  _id: string;
  employeeId: User | string;
  type: 'Casual' | 'Sick' | 'Annual' | 'Unpaid';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: User | string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface Training {
  _id: string;
  accountId: Account;
  customerName: string;
  status: 'Pending' | 'Completed';
  mode: 'Online' | 'Offline' | 'Hybrid';
  trainingDate: string;
  trainedBy: User;
  notes?: string;
  createdAt: string;
}

export interface DashboardStats {
  leads: { total: number; new: number; converted: number; lost: number };
  accounts: { total: number; active: number };
  invoices: { totalRevenue: number; pending: number; overdue: number };
  tickets: { open: number; critical: number };
  drfs: { pending: number; approved: number; rejected: number; expiringSoon: number; totalThisMonth: number };
  drfBySalesPerson: Array<{ name: string; total: number; approved: number; rejected: number }>;
  rejectionReasons: Array<{ reason: string; count: number }>;
  recentLeads: Lead[];
  revenueByMonth: Array<{ month: string; revenue: number }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export interface ApiError {
  message: string;
  errors?: Record<string, string>;
}
