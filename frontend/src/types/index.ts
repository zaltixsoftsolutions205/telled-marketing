export type Role = 'admin' | 'sales' | 'engineer' | 'hr_finance' | 'platform_admin';
export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Not Qualified';
export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Final';

export type SalesStatus =
  | 'Uninitiated'
  | 'Sales meeting follow-up'
  | 'Under technical Demo'
  | 'Under Proposal submission Process'
  | 'Under PO-Followup'
  | 'Under payment follow-up'
  | 'Closed, and now a Customer'
  | 'Rejected, at Sales discussion stage'
  | 'Rejected, at Tech Demo Stage'
  | 'Rejected, at PO follow-up stage'
  | 'Rejected, at Payment follow-up stage'
  | 'Rejected, at license generation stage';

export const SALES_STATUSES: SalesStatus[] = [
  'Uninitiated',
  'Sales meeting follow-up',
  'Under technical Demo',
  'Under Proposal submission Process',
  'Under PO-Followup',
  'Under payment follow-up',
  'Closed, and now a Customer',
  'Rejected, at Sales discussion stage',
  'Rejected, at Tech Demo Stage',
  'Rejected, at PO follow-up stage',
  'Rejected, at Payment follow-up stage',
  'Rejected, at license generation stage',
];

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
  salesStatus?: SalesStatus;
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
  salesStatus?: SalesStatus;
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
  discount?: number;
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
  discountApplicable?: boolean;
  discountType?: 'percent' | 'flat';
  discountValue?: number;
  discountAmount?: number;
  finalAmount?: number;
  pdfPath?: string;
  uploadedFile?: string;
  uploadedFileName?: string;
  emailSent?: boolean;
  emailSentAt?: string;
  poReceived?: boolean;
  createdBy: User;
  createdAt: string;
}

export interface POLineItem {
  product: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface PurchaseOrder {
  _id: string;
  organizationId?: string;
  leadId: Lead | string;
  poNumber: string;
  amount: number;
  items?: POLineItem[];
  product?: string;
  vendorName?: string;
  vendorEmail?: string;
  receivedDate: string;
  notes?: string;
  paymentTerms?: string;
  converted: boolean;
  uploadedBy: User | string;
  isArchived: boolean;
  // 8-step workflow
  currentStep: number;
  workflowStatus: 'Draft' | 'In Progress' | 'Completed';
  // Step 2: Forward PO to ARK
  step2ForwardedToArk?: boolean;
  step2ForwardedAt?: string;
  step2PoDocName?: string;
  // Step 3: ARK Response
  step3PriceClearanceReceived?: boolean;
  step3ReceivedAt?: string;
  step3DocNames?: string[];
  // Step 4: Send Docs to Customer
  step4DocsSentToCustomer?: boolean;
  step4SentAt?: string;
  // Step 5: Invoice to ARK
  step5InvoiceToArk?: boolean;
  step5InvoiceSentAt?: string;
  step5InvoiceDocName?: string;
  // Step 6: Send Docs to ARK
  step6DocsSentToArk?: boolean;
  step6SentAt?: string;
  // Step 7: License Mail Received
  step7LicenseMailReceived?: boolean;
  step7LicenseMailReceivedAt?: string;
  // Step 8: Final Invoice
  step8FinalInvoiceSent?: boolean;
  step8FinalInvoiceSentAt?: string;
  step8FinalInvoiceAmount?: number;
  step8FinalInvoiceNumber?: string;
  // Legacy 6-step fields (kept for backward compat)
  customerInvoiceSent?: boolean;
  customerInvoiceSentAt?: string;
  poForwardedToArk?: boolean;
  poForwardedToArkAt?: string;
  priceClearanceReceived?: boolean;
  priceClearanceReceivedAt?: string;
  poSentToArk?: boolean;
  poSentToArkAt?: string;
  arkInvoiceReceived?: boolean;
  arkInvoiceReceivedAt?: string;
  arkInvoiceAmount?: number;
  vendorEmailSent?: boolean;
  vendorEmailSentAt?: string;
  invoiceGenerated?: boolean;
  invoiceGeneratedAt?: string;
  poInvoiceNumber?: string;
  invoiceAmount?: number;
  licenseGenerated?: boolean;
  licenseGeneratedAt?: string;
  licenseKey?: string;
  licenseFile?: string;
  // Payment
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
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed' | 'Reopened';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assignedTo?: User;
  assignedEngineer?: User;
  internalNotes: InternalNote[];
  lastResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  reopenedAt?: string;
  reopenCount?: number;
  parentTicketId?: string;
  customerFeedback?: string;
  customerFeedbackAt?: string;
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
  claimsTotal: number;
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

// ─── PO EXECUTION WORKFLOW ───────────────────────────────────────────────────

export interface POExecStep1 {
  oemNotified: boolean;
  oemNotifiedAt?: string;
  distributorNotified: boolean;
  distributorNotifiedAt?: string;
  status: 'Pending' | 'Sent' | 'Failed';
}

export interface POExecDocField {
  status: 'Pending' | 'Received' | 'NA';
  fileName?: string;
  url?: string;
  info?: string;
}

export interface POExecStep2 {
  licenseForm: POExecDocField;
  startupForm: POExecDocField;
  machineDetailsLink: POExecDocField;
  priceClearanceInfo: POExecDocField;
  paymentTerms: POExecDocField;
}

export interface POExecStep3 {
  licenseFormSent: boolean;
  startupFormSent: boolean;
  machineDetailsLinkSent: boolean;
  sentAt?: string;
  completedAt?: string;
  status: 'Pending' | 'Sent' | 'Completed';
}

export interface POExecStep4 {
  invoiceNumber?: string;
  amount?: number;
  paymentTerms?: string;
  customerDetails?: string;
  pdfPath?: string;
  generatedAt?: string;
  status: 'Pending' | 'Generated' | 'Sent';
}

export interface POExecStep5 {
  formsShared: boolean;
  invoiceShared: boolean;
  sharedAt?: string;
  status: 'Pending' | 'Sent';
}

export interface POExecStep6 {
  licenseStatus: 'Pending' | 'Generated' | 'Delivered';
  licenseKey?: string;
  licenseFile?: string;
  deliveryDate?: string;
}

export interface POExecStep7 {
  invoiceNumber?: string;
  amount?: number;
  tdsExemptionAttached: boolean;
  emailSent: boolean;
  sentAt?: string;
  paymentStatus: 'Unpaid' | 'Partial' | 'Paid';
  status: 'Pending' | 'Generated' | 'Sent' | 'Paid';
}

export interface POExecutionWorkflow {
  _id: string;
  organizationId: string;
  poId: string;
  poNumber?: string;
  accountId?: string;
  leadId?: string;
  companyName?: string;
  currentStep: number;
  overallStatus: 'In Progress' | 'Completed';
  step1: POExecStep1;
  step2: POExecStep2;
  step3: POExecStep3;
  step4: POExecStep4;
  step5: POExecStep5;
  step6: POExecStep6;
  step7: POExecStep7;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export interface ApiError {
  message: string;
  errors?: Record<string, string>;
}

// ─── CONTACTS ────────────────────────────────────────────────────────────────

export type ContactType = 'TELLED' | 'ARK' | 'CUSTOMER';
export type CustomerResponsibility = 'Technical' | 'Sales' | 'IT' | 'Procurement';

export interface Contact {
  _id: string;
  organizationId: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  companyName?: string;
  contactType: ContactType;
  /** Only relevant when contactType === 'CUSTOMER' */
  customerResponsibility?: CustomerResponsibility;
  linkedAccountId?: Account | string;
  notes?: string;
  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
}
