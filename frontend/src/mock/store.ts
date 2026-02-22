// ─── Centralized Mock In-Memory Database ───────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */

export type ID = string;
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

// ─── USERS ──────────────────────────────────────────────────────────────────
export let USERS: any[] = [
  { _id: 'u1', name: 'Admin User',  email: 'admin@telled.com',     role: 'admin',      isActive: true, phone: '9876543210', baseSalary: 0,     createdAt: daysAgo(180) },
  { _id: 'u2', name: 'Ravi Kumar',  email: 'sales1@telled.com',    role: 'sales',      isActive: true, phone: '9876543211', baseSalary: 50000, createdAt: daysAgo(150) },
  { _id: 'u3', name: 'Priya Singh', email: 'sales2@telled.com',    role: 'sales',      isActive: true, phone: '9876543212', baseSalary: 45000, createdAt: daysAgo(140) },
  { _id: 'u4', name: 'Arjun Patel', email: 'engineer1@telled.com', role: 'engineer',   isActive: true, phone: '9876543213', baseSalary: 55000, createdAt: daysAgo(120) },
  { _id: 'u5', name: 'Sneha Nair',  email: 'engineer2@telled.com', role: 'engineer',   isActive: true, phone: '9876543214', baseSalary: 55000, createdAt: daysAgo(100) },
  { _id: 'u6', name: 'HR Manager',  email: 'hr@telled.com',        role: 'hr_finance', isActive: true, phone: '9876543215', baseSalary: 48000, createdAt: daysAgo(90)  },
];

const PASSWORDS: Record<string, string> = {
  'admin@telled.com':     'Admin@123',
  'sales1@telled.com':    'Sales@123',
  'sales2@telled.com':    'Sales@123',
  'engineer1@telled.com': 'Eng@123',
  'engineer2@telled.com': 'Eng@123',
  'hr@telled.com':        'HR@123',
};

// ─── LEADS ──────────────────────────────────────────────────────────────────
export let LEADS: any[] = [
  { _id: 'l1',  companyName: 'TechCorp Solutions',  contactName: 'Rajesh Kumar',  contactPersonName: 'Arun Mehta',    oemName: 'Siemens',              email: 'rajesh@techcorp.com',  phone: '9111111111', city: 'Mumbai',    state: 'Maharashtra', source: 'Website',    stage: 'DRF Approved',   assignedTo: USERS[1], notes: 'High priority client',        isArchived: false, createdAt: daysAgo(60), updatedAt: daysAgo(5)  },
  { _id: 'l2',  companyName: 'Global Industries',   contactName: 'Priya Sharma',  contactPersonName: 'Neha Kapoor',   oemName: 'ABB',                  email: 'priya@global.com',     phone: '9222222222', city: 'Delhi',     state: 'Delhi',       source: 'Referral',   stage: 'DRF Submitted',  assignedTo: USERS[1], notes: 'Referred by TechCorp',        isArchived: false, createdAt: daysAgo(45), updatedAt: daysAgo(10) },
  { _id: 'l3',  companyName: 'Smart Manufacturing', contactName: 'Amit Patel',    contactPersonName: 'Suresh Patel',  oemName: 'Schneider Electric',   email: 'amit@smart.com',       phone: '9333333333', city: 'Ahmedabad', state: 'Gujarat',     source: 'Exhibition', stage: 'Quotation Sent', assignedTo: USERS[2], notes: '',                            isArchived: false, createdAt: daysAgo(40), updatedAt: daysAgo(8)  },
  { _id: 'l4',  companyName: 'Future Systems',      contactName: 'Sunita Rao',    contactPersonName: 'Aditi Sharma',  oemName: 'Rockwell Automation',  email: 'sunita@future.com',    phone: '9444444444', city: 'Hyderabad', state: 'Telangana',   source: 'LinkedIn',   stage: 'PO Received',    assignedTo: USERS[2], notes: 'Close to conversion',         isArchived: false, createdAt: daysAgo(35), updatedAt: daysAgo(3)  },
  { _id: 'l5',  companyName: 'Zenith Enterprises',  contactName: 'Kiran Mehta',   contactPersonName: 'Rahul Das',     oemName: 'Honeywell',            email: 'kiran@zenith.com',     phone: '9555555555', city: 'Bangalore', state: 'Karnataka',   source: 'Cold Call',  stage: 'New',            assignedTo: USERS[1], notes: '',                            isArchived: false, createdAt: daysAgo(20), updatedAt: daysAgo(1)  },
  { _id: 'l6',  companyName: 'Alpha Automation',    contactName: 'Deepak Joshi',  contactPersonName: 'Pooja Nair',    oemName: 'Siemens',              email: 'deepak@alpha.com',     phone: '9666666666', city: 'Pune',      state: 'Maharashtra', source: 'Email',      stage: 'Negotiation',    assignedTo: USERS[1], notes: 'Needs custom pricing',        isArchived: false, createdAt: daysAgo(30), updatedAt: daysAgo(2)  },
  { _id: 'l7',  companyName: 'BrightTech Pvt Ltd',  contactName: 'Ananya Iyer',   contactPersonName: 'Kartik Reddy',  oemName: 'ABB',                  email: 'ananya@bright.com',    phone: '9777777777', city: 'Chennai',   state: 'Tamil Nadu',  source: 'Website',    stage: 'Technical Done', assignedTo: USERS[2], notes: '',                            isArchived: false, createdAt: daysAgo(25), updatedAt: daysAgo(4)  },
  { _id: 'l8',  companyName: 'Horizon Infra',       contactName: 'Sanjay Gupta',  contactPersonName: 'Meghna Joshi',  oemName: 'Schneider Electric',   email: 'sanjay@horizon.com',   phone: '9888888888', city: 'Kolkata',   state: 'West Bengal', source: 'Referral',   stage: 'Converted',      assignedTo: USERS[1], notes: 'Converted to account',        isArchived: false, createdAt: daysAgo(90), updatedAt: daysAgo(30) },
  { _id: 'l9',  companyName: 'Pioneer Solutions',   contactName: 'Meena Reddy',   contactPersonName: 'Rohit Kumar',   oemName: 'Rockwell Automation',  email: 'meena@pioneer.com',    phone: '9999999999', city: 'Jaipur',    state: 'Rajasthan',   source: 'Exhibition', stage: 'DRF Submitted',  assignedTo: USERS[2], notes: 'DRF rejected, re-submitting', isArchived: false, createdAt: daysAgo(50), updatedAt: daysAgo(5)  },
  { _id: 'l10', companyName: 'Vertex Industries',   contactName: 'Rahul Bose',    contactPersonName: 'Swati Verma',   oemName: 'Mitsubishi Electric',  email: 'rahul@vertex.com',     phone: '9101010101', city: 'Surat',     state: 'Gujarat',     source: 'Cold Call',  stage: 'New',            assignedTo: USERS[1], notes: '',                            isArchived: false, createdAt: daysAgo(10), updatedAt: daysAgo(1)  },
  { _id: 'l11', companyName: 'Delta Corp',          contactName: 'Neha Desai',    contactPersonName: 'Ankit Tiwari',  oemName: 'Siemens',              email: 'neha@delta.com',       phone: '9112233445', city: 'Nagpur',    state: 'Maharashtra', source: 'LinkedIn',   stage: 'Lost',           assignedTo: USERS[2], notes: 'Went with competitor',        isArchived: false, createdAt: daysAgo(70), updatedAt: daysAgo(40) },
  { _id: 'l12', companyName: 'Omega Technologies',  contactName: 'Vijay Nair',    contactPersonName: 'Deepa Pillai',  oemName: 'ABB',                  email: 'vijay@omega.com',      phone: '9998887776', city: 'Kochi',     state: 'Kerala',      source: 'Website',    stage: 'DRF Approved',   assignedTo: USERS[1], notes: '',                            isArchived: false, createdAt: daysAgo(15), updatedAt: daysAgo(2)  },
];

// ─── DRFs (Document Request Forms) ──────────────────────────────────────────
export let DRFs: any[] = [
  { _id: 'drf1', leadId: { _id: 'l1',  companyName: 'TechCorp Solutions',  contactName: 'Rajesh Kumar', contactPersonName: 'Arun Mehta',   oemName: 'Siemens'             }, drfNumber: 'DRF-2026-001', title: 'Siemens DRF for TechCorp Solutions',  version: 1, status: 'Approved', sentDate: daysAgo(55), approvedDate: daysAgo(50), expiryDate: daysFromNow(40), extensionCount: 0, extensionHistory: [], notes: 'First submission',                 createdBy: USERS[1], approvedBy: USERS[0], createdAt: daysAgo(55) },
  { _id: 'drf2', leadId: { _id: 'l2',  companyName: 'Global Industries',   contactName: 'Priya Sharma', contactPersonName: 'Neha Kapoor',  oemName: 'ABB'                 }, drfNumber: 'DRF-2026-002', title: 'ABB DRF for Global Industries',       version: 1, status: 'Pending',  sentDate: daysAgo(10), expiryDate: null,             extensionCount: 0, extensionHistory: [], notes: '',                               createdBy: USERS[1], approvedBy: null,     createdAt: daysAgo(10) },
  { _id: 'drf3', leadId: { _id: 'l9',  companyName: 'Pioneer Solutions',   contactName: 'Meena Reddy',  contactPersonName: 'Rohit Kumar',  oemName: 'Rockwell Automation' }, drfNumber: 'DRF-2026-003', title: 'Rockwell Automation DRF for Pioneer Solutions', version: 1, status: 'Rejected', sentDate: daysAgo(48), rejectedDate: daysAgo(40), rejectionReason: 'Incomplete documentation', extensionCount: 0, extensionHistory: [], notes: '', createdBy: USERS[2], approvedBy: null, createdAt: daysAgo(48) },
  { _id: 'drf4', leadId: { _id: 'l9',  companyName: 'Pioneer Solutions',   contactName: 'Meena Reddy',  contactPersonName: 'Rohit Kumar',  oemName: 'Rockwell Automation' }, drfNumber: 'DRF-2026-004', title: 'Rockwell Automation DRF for Pioneer Solutions', version: 2, status: 'Pending',  sentDate: daysAgo(5),  expiryDate: null,             extensionCount: 0, extensionHistory: [], notes: 'Re-submission with complete docs', createdBy: USERS[2], approvedBy: null, createdAt: daysAgo(5) },
  { _id: 'drf5', leadId: { _id: 'l12', companyName: 'Omega Technologies',  contactName: 'Vijay Nair',   contactPersonName: 'Deepa Pillai', oemName: 'ABB'                 }, drfNumber: 'DRF-2026-005', title: 'ABB DRF for Omega Technologies',      version: 1, status: 'Approved', sentDate: daysAgo(12), approvedDate: daysAgo(8), expiryDate: daysFromNow(22), extensionCount: 1, extensionHistory: [{ extendedAt: daysAgo(3), previousExpiry: daysFromNow(10), newExpiry: daysFromNow(22), extendedBy: USERS[0], reason: 'Client request' }], notes: '', createdBy: USERS[1], approvedBy: USERS[0], createdAt: daysAgo(12) },
];
let drfSeq = 5;

// ─── ACCOUNTS ────────────────────────────────────────────────────────────────
export let ACCOUNTS: any[] = [
  { _id: 'a1', leadId: { _id: 'l8', companyName: 'Horizon Infra',       contactPersonName: 'Meghna Joshi'  }, accountName: 'Horizon Infra Account', assignedEngineer: USERS[3], assignedSales: USERS[1], status: 'Active',   licenseVersion: 'v2.1', licenseDate: daysAgo(15),  licenseExpiryDate: daysFromNow(350), notes: 'First account',        createdAt: daysAgo(28) },
  { _id: 'a2', leadId: { _id: 'l4', companyName: 'Future Systems',      contactPersonName: 'Aditi Sharma'  }, accountName: 'Future Systems Ltd',   assignedEngineer: USERS[4], assignedSales: USERS[2], status: 'Active',   licenseVersion: 'v1.5', licenseDate: daysAgo(5),   licenseExpiryDate: daysFromNow(360), notes: '',                     createdAt: daysAgo(10) },
  { _id: 'a3', leadId: { _id: 'l3', companyName: 'Smart Manufacturing', contactPersonName: 'Suresh Patel'  }, accountName: 'Smart Mfg Corp',       assignedEngineer: USERS[3], assignedSales: USERS[2], status: 'Inactive', licenseVersion: 'v1.0', licenseDate: daysAgo(10),  licenseExpiryDate: daysFromNow(355), notes: 'Temporarily inactive', createdAt: daysAgo(15) },
];

// ─── QUOTATIONS ──────────────────────────────────────────────────────────────
export let QUOTATIONS: any[] = [
  { _id: 'q1', leadId: { _id: 'l3', companyName: 'Smart Manufacturing' }, quotationNumber: 'QT-2026-001', items: [{ description: 'Industrial Controller Unit', quantity: 2, unitPrice: 85000, total: 170000 }, { description: 'Installation & Setup', quantity: 1, unitPrice: 15000, total: 15000 }], subtotal: 185000, taxRate: 18, taxAmount: 33300, total: 218300, validUntil: daysFromNow(30), terms: 'Payment within 30 days', notes: '', createdBy: USERS[1], createdAt: daysAgo(8) },
  { _id: 'q2', leadId: { _id: 'l1', companyName: 'TechCorp Solutions'  }, quotationNumber: 'QT-2026-002', items: [{ description: 'SCADA Software License', quantity: 5, unitPrice: 45000, total: 225000 }, { description: 'Annual Support', quantity: 1, unitPrice: 30000, total: 30000 }], subtotal: 255000, taxRate: 18, taxAmount: 45900, total: 300900, validUntil: daysFromNow(20), terms: '', notes: 'Special pricing', createdBy: USERS[2], createdAt: daysAgo(5) },
  { _id: 'q3', leadId: { _id: 'l6', companyName: 'Alpha Automation'    }, quotationNumber: 'QT-2026-003', items: [{ description: 'PLC Setup', quantity: 3, unitPrice: 60000, total: 180000 }], subtotal: 180000, taxRate: 18, taxAmount: 32400, total: 212400, validUntil: daysFromNow(15), terms: '', notes: '', createdBy: USERS[1], createdAt: daysAgo(2) },
];

// ─── PURCHASE ORDERS ─────────────────────────────────────────────────────────
export let PURCHASE_ORDERS: any[] = [
  { _id: 'po1', leadId: { _id: 'l4', companyName: 'Future Systems'      }, poNumber: 'PO-2026-001', amount: 218300, receivedDate: daysAgo(8),  notes: 'PO received via email', createdBy: USERS[1], createdAt: daysAgo(8)  },
  { _id: 'po2', leadId: { _id: 'l8', companyName: 'Horizon Infra'       }, poNumber: 'PO-2026-002', amount: 300900, receivedDate: daysAgo(25), notes: '',                      createdBy: USERS[2], createdAt: daysAgo(25) },
  { _id: 'po3', leadId: { _id: 'l3', companyName: 'Smart Manufacturing' }, poNumber: 'PO-2026-003', amount: 185000, receivedDate: daysAgo(12), notes: 'Partial PO',            createdBy: USERS[1], createdAt: daysAgo(12) },
];

// ─── INSTALLATIONS ───────────────────────────────────────────────────────────
export let INSTALLATIONS: any[] = [
  { _id: 'i1', accountId: { _id: 'a1', accountName: 'Horizon Infra Account' }, scheduledDate: daysAgo(20), completedDate: daysAgo(18), engineer: USERS[3], siteAddress: '14th Floor, Horizon Tower, Kolkata', status: 'Completed',   licenseVersion: 'v2.1', notes: 'Installation completed successfully', createdAt: daysAgo(22) },
  { _id: 'i2', accountId: { _id: 'a2', accountName: 'Future Systems Ltd'    }, scheduledDate: daysFromNow(3), completedDate: null,     engineer: USERS[4], siteAddress: 'Plot 42, HITEC City, Hyderabad',     status: 'Scheduled',   licenseVersion: '',     notes: 'Confirmed with client',               createdAt: daysAgo(5)  },
  { _id: 'i3', accountId: { _id: 'a2', accountName: 'Future Systems Ltd'    }, scheduledDate: daysAgo(8),  completedDate: null,        engineer: USERS[3], siteAddress: 'Unit 7, Industrial Area, Hyderabad',  status: 'In Progress', licenseVersion: 'v1.5', notes: 'Phase 1 ongoing',                     createdAt: daysAgo(10) },
  { _id: 'i4', accountId: { _id: 'a3', accountName: 'Smart Mfg Corp'        }, scheduledDate: daysAgo(5),  completedDate: null,        engineer: USERS[4], siteAddress: 'GIDC Estate, Ahmedabad',               status: 'Cancelled',   licenseVersion: '',     notes: 'Client postponed',                    createdAt: daysAgo(6)  },
];

// ─── SUPPORT TICKETS ─────────────────────────────────────────────────────────
export let SUPPORT_TICKETS: any[] = [
  { _id: 't1', accountId: { _id: 'a1', accountName: 'Horizon Infra Account' }, ticketId: 'TKT-0001', subject: 'Controller unit not responding',  description: 'The main controller unit stopped responding after power outage.', priority: 'Critical', status: 'Open',        assignedTo: USERS[3], internalNotes: [{ note: 'Checked remotely, seems hardware issue', addedBy: USERS[3], addedAt: daysAgo(1) }], createdBy: USERS[1], createdAt: daysAgo(3) },
  { _id: 't2', accountId: { _id: 'a2', accountName: 'Future Systems Ltd'    }, ticketId: 'TKT-0002', subject: 'Software license renewal request', description: 'License expires in 2 weeks, need renewal process.',                priority: 'Medium',   status: 'In Progress', assignedTo: USERS[4], internalNotes: [], createdBy: USERS[2], createdAt: daysAgo(7) },
  { _id: 't3', accountId: { _id: 'a1', accountName: 'Horizon Infra Account' }, ticketId: 'TKT-0003', subject: 'Training request for operators',   description: 'Client needs training for 5 new operators.',                      priority: 'Low',      status: 'Resolved',    assignedTo: USERS[3], internalNotes: [{ note: 'Training scheduled for next week', addedBy: USERS[3], addedAt: daysAgo(2) }], createdBy: USERS[1], createdAt: daysAgo(12) },
  { _id: 't4', accountId: { _id: 'a2', accountName: 'Future Systems Ltd'    }, ticketId: 'TKT-0004', subject: 'Network connectivity issue',       description: 'Intermittent disconnections from central server.',                priority: 'High',     status: 'Open',        assignedTo: USERS[4], internalNotes: [], createdBy: USERS[2], createdAt: daysAgo(1) },
  { _id: 't5', accountId: { _id: 'a3', accountName: 'Smart Mfg Corp'        }, ticketId: 'TKT-0005', subject: 'Annual maintenance check',         description: 'Scheduled annual preventive maintenance.',                        priority: 'Low',      status: 'Closed',      assignedTo: USERS[3], internalNotes: [], createdBy: USERS[1], createdAt: daysAgo(30) },
];

// ─── INVOICES ────────────────────────────────────────────────────────────────
export let INVOICES: any[] = [
  { _id: 'inv1', accountId: { _id: 'a1', accountName: 'Horizon Infra Account' }, invoiceNumber: 'INV-2026-001', amount: 300900, paidAmount: 300900, dueDate: daysAgo(5),      status: 'Paid',           notes: '', createdBy: USERS[0], createdAt: daysAgo(25) },
  { _id: 'inv2', accountId: { _id: 'a2', accountName: 'Future Systems Ltd'    }, invoiceNumber: 'INV-2026-002', amount: 218300, paidAmount: 100000, dueDate: daysFromNow(10), status: 'Partially Paid', notes: 'Advance received', createdBy: USERS[0], createdAt: daysAgo(10) },
  { _id: 'inv3', accountId: { _id: 'a2', accountName: 'Future Systems Ltd'    }, invoiceNumber: 'INV-2026-003', amount: 50000,  paidAmount: 0,       dueDate: daysAgo(3),      status: 'Overdue',        notes: 'Follow up needed', createdBy: USERS[0], createdAt: daysAgo(15) },
  { _id: 'inv4', accountId: { _id: 'a3', accountName: 'Smart Mfg Corp'        }, invoiceNumber: 'INV-2026-004', amount: 185000, paidAmount: 0,       dueDate: daysFromNow(20), status: 'Unpaid',         notes: '', createdBy: USERS[0], createdAt: daysAgo(3) },
];

// ─── PAYMENTS ────────────────────────────────────────────────────────────────
export let PAYMENTS: any[] = [
  { _id: 'pay1', invoiceId: { _id: 'inv1', invoiceNumber: 'INV-2026-001' }, amount: 300900, paymentDate: daysAgo(4),  mode: 'Bank Transfer', reference: 'UTR4521890123', notes: '', recordedBy: USERS[0], createdAt: daysAgo(4) },
  { _id: 'pay2', invoiceId: { _id: 'inv2', invoiceNumber: 'INV-2026-002' }, amount: 100000, paymentDate: daysAgo(8),  mode: 'UPI',           reference: 'UPI-20260210',  notes: 'Advance payment', recordedBy: USERS[5], createdAt: daysAgo(8) },
];

// ─── ENGINEER VISITS ─────────────────────────────────────────────────────────
export let ENGINEER_VISITS: any[] = [
  { _id: 'ev1', engineerId: USERS[3], accountId: { _id: 'a1', accountName: 'Horizon Infra Account' }, visitDate: daysAgo(20), visitCharges: 3000, travelAllowance: 800,  additionalExpense: 200, totalAmount: 4000, purpose: 'Installation & commissioning', hrStatus: 'Approved', approvedBy: USERS[5], notes: '', createdAt: daysAgo(20) },
  { _id: 'ev2', engineerId: USERS[4], accountId: { _id: 'a2', accountName: 'Future Systems Ltd'    }, visitDate: daysAgo(8),  visitCharges: 2500, travelAllowance: 1200, additionalExpense: 300, totalAmount: 4000, purpose: 'Site survey',                  hrStatus: 'Approved', approvedBy: USERS[5], notes: '', createdAt: daysAgo(8) },
  { _id: 'ev3', engineerId: USERS[3], accountId: { _id: 'a2', accountName: 'Future Systems Ltd'    }, visitDate: daysAgo(3),  visitCharges: 2000, travelAllowance: 600,  additionalExpense: 0,   totalAmount: 2600, purpose: 'Troubleshooting',              hrStatus: 'Pending',  approvedBy: null, notes: '', createdAt: daysAgo(3) },
  { _id: 'ev4', engineerId: USERS[4], accountId: null,                                                visitDate: daysAgo(1),  visitCharges: 1500, travelAllowance: 400,  additionalExpense: 100, totalAmount: 2000, purpose: 'Client demo visit',            hrStatus: 'Pending',  approvedBy: null, notes: 'Pre-sales support', createdAt: daysAgo(1) },
  { _id: 'ev5', engineerId: USERS[3], accountId: { _id: 'a3', accountName: 'Smart Mfg Corp'        }, visitDate: daysAgo(15), visitCharges: 3500, travelAllowance: 1500, additionalExpense: 500, totalAmount: 5500, purpose: 'Maintenance',                  hrStatus: 'Approved', approvedBy: USERS[5], notes: '', createdAt: daysAgo(15) },
  { _id: 'ev6', engineerId: USERS[4], accountId: { _id: 'a1', accountName: 'Horizon Infra Account' }, visitDate: daysAgo(5),  visitCharges: 2800, travelAllowance: 700,  additionalExpense: 0,   totalAmount: 3500, purpose: 'Support visit',                hrStatus: 'Rejected', approvedBy: USERS[5], notes: 'Out of scope', createdAt: daysAgo(5) },
];

// ─── SALARIES ────────────────────────────────────────────────────────────────
export let SALARIES: any[] = [
  { _id: 'sal1', employeeId: USERS[3], month: 1, year: 2026, baseSalary: 55000, visitChargesTotal: 13500, incentives: 5000, deductions: 2000, finalSalary: 71500, status: 'Paid',       paidDate: daysAgo(10), notes: '', createdAt: daysAgo(15) },
  { _id: 'sal2', employeeId: USERS[4], month: 1, year: 2026, baseSalary: 55000, visitChargesTotal: 7500,  incentives: 2000, deductions: 1000, finalSalary: 63500, status: 'Paid',       paidDate: daysAgo(10), notes: '', createdAt: daysAgo(15) },
  { _id: 'sal3', employeeId: USERS[3], month: 2, year: 2026, baseSalary: 55000, visitChargesTotal: 6600,  incentives: 0,    deductions: 0,    finalSalary: 61600, status: 'Calculated', paidDate: null,         notes: '', createdAt: daysAgo(2)  },
];

// ─── TRAININGS ───────────────────────────────────────────────────────────────
export let TRAININGS: any[] = [
  { _id: 'tr1', accountId: { _id: 'a1', accountName: 'Horizon Infra Account' }, customerName: 'Horizon Infra Account', status: 'Completed', mode: 'Online',  trainingDate: daysAgo(10), trainedBy: USERS[3], notes: 'Covered SCADA basics and HMI operation', createdAt: daysAgo(10) },
  { _id: 'tr2', accountId: { _id: 'a2', accountName: 'Future Systems Ltd'    }, customerName: 'Future Systems Ltd',   status: 'Pending',   mode: 'Offline', trainingDate: daysFromNow(2), trainedBy: USERS[4], notes: 'Field training at site', createdAt: daysAgo(3) },
  { _id: 'tr3', accountId: { _id: 'a1', accountName: 'Horizon Infra Account' }, customerName: 'Horizon Infra Account', status: 'Completed', mode: 'Hybrid',  trainingDate: daysAgo(5),  trainedBy: USERS[3], notes: 'Advanced PLC programming workshop', createdAt: daysAgo(5) },
  { _id: 'tr4', accountId: { _id: 'a3', accountName: 'Smart Mfg Corp'        }, customerName: 'Smart Mfg Corp',       status: 'Pending',   mode: 'Online',  trainingDate: daysFromNow(5), trainedBy: USERS[3], notes: 'Introductory session', createdAt: daysAgo(1) },
];

// ─── CRUD HELPERS ────────────────────────────────────────────────────────────
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

export const mockPaginate = <T>(items: T[], page = 1, limit = 15) => {
  const total = items.length;
  const start = (page - 1) * limit;
  return { data: items.slice(start, start + limit) as T[], pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
};

// ─── AUTH ────────────────────────────────────────────────────────────────────
export const mockAuth = {
  login: async (email: string, password: string) => {
    await delay(400);
    const user = USERS.find((u: any) => u.email === email.toLowerCase());
    if (!user || PASSWORDS[email.toLowerCase()] !== password) throw { response: { data: { message: 'Invalid email or password' } } };
    return { user, accessToken: 'mock-token-' + user._id };
  },
  logout: async () => { await delay(100); },
  getMe: async (userId: string) => { await delay(100); return USERS.find((u: any) => u._id === userId)!; },
};

// ─── LEADS MOCK ──────────────────────────────────────────────────────────────
export const mockLeads = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = LEADS.filter((l: any) => !l.isArchived);
    if (params.search) items = items.filter((l: any) => l.companyName.toLowerCase().includes((params.search as string).toLowerCase()) || l.contactName.toLowerCase().includes((params.search as string).toLowerCase()));
    if (params.stage) items = items.filter((l: any) => l.stage === params.stage);
    if (params.assignedTo) items = items.filter((l: any) => l.assignedTo?._id === params.assignedTo);
    return mockPaginate(items, Number(params.page) || 1, Number(params.limit) || 15);
  },
  getById: async (id: string) => { await delay(); return LEADS.find((l: any) => l._id === id) || null; },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const lead = { _id: 'l' + uid(), ...data, assignedTo: data.assignedTo ? USERS.find((u: any) => u._id === data.assignedTo) || USERS[1] : USERS[1], stage: 'New', isArchived: false, createdAt: now(), updatedAt: now() };
    LEADS = [lead, ...LEADS];
    return lead;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    LEADS = LEADS.map((l: any) => l._id === id ? { ...l, ...data, updatedAt: now() } : l);
    return LEADS.find((l: any) => l._id === id)!;
  },
  archive: async (id: string) => { await delay(); LEADS = LEADS.map((l: any) => l._id === id ? { ...l, isArchived: true } : l); },
};

// ─── DRF MOCK ────────────────────────────────────────────────────────────────
export const mockDRF = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...DRFs];
    if (params.status)      items = items.filter((d: any) => d.status === params.status);
    if (params.leadId)      items = items.filter((d: any) => d.leadId._id === params.leadId);
    if (params.salesPerson) items = items.filter((d: any) => { const l = LEADS.find((x: any) => x._id === d.leadId._id); return l?.assignedTo?._id === params.salesPerson; });
    if (params.oemName)     items = items.filter((d: any) => d.leadId.oemName?.toLowerCase().includes((params.oemName as string).toLowerCase()));
    if (params.multiVersion === 'true') items = items.filter((d: any) => d.version >= 2);
    if (params.from)        items = items.filter((d: any) => new Date(d.sentDate) >= new Date(params.from as string));
    if (params.to)          items = items.filter((d: any) => new Date(d.sentDate) <= new Date(params.to as string));
    return mockPaginate(items, Number(params.page) || 1, Number(params.limit) || 15);
  },
  getByLead: async (leadId: string) => { await delay(); return DRFs.filter((d: any) => d.leadId._id === leadId); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const lead = LEADS.find((l: any) => l._id === data.leadId);
    if (!lead) throw new Error('Lead not found');
    const prevForLead = DRFs.filter((d: any) => d.leadId._id === data.leadId);
    const version = prevForLead.length + 1;
    drfSeq++;
    const year = new Date().getFullYear();
    const drfNumber = `DRF-${year}-${String(drfSeq).padStart(3, '0')}`;
    const title = `${lead.oemName || 'OEM'} DRF for ${lead.companyName}`;
    const createdByUser = data.createdBy ? USERS.find((u: any) => u._id === data.createdBy) || USERS[1] : USERS[1];
    const drf = { _id: 'drf' + uid(), leadId: { _id: lead._id, companyName: lead.companyName, contactName: lead.contactName, contactPersonName: lead.contactPersonName, oemName: lead.oemName }, drfNumber, title, version, status: 'Pending', sentDate: now(), extensionCount: 0, extensionHistory: [], notes: String(data.notes || ''), createdBy: createdByUser, approvedBy: null, createdAt: now() };
    DRFs = [...DRFs, drf];
    LEADS = LEADS.map((l: any) => l._id === data.leadId ? { ...l, stage: 'DRF Submitted', updatedAt: now() } : l);
    return drf;
  },
  approve: async (id: string, data: { expiryDate: string; notes?: string }) => {
    await delay(400);
    DRFs = DRFs.map((d: any) => d._id === id ? { ...d, status: 'Approved', approvedDate: now(), expiryDate: data.expiryDate, approvedBy: USERS[0], notes: data.notes || d.notes } : d);
    const drf = DRFs.find((d: any) => d._id === id)!;
    LEADS = LEADS.map((l: any) => l._id === drf.leadId._id ? { ...l, stage: 'DRF Approved', updatedAt: now() } : l);
    return drf;
  },
  reject: async (id: string, data: { rejectionReason: string }) => {
    await delay(400);
    DRFs = DRFs.map((d: any) => d._id === id ? { ...d, status: 'Rejected', rejectedDate: now(), rejectionReason: data.rejectionReason } : d);
    const drf = DRFs.find((d: any) => d._id === id)!;
    LEADS = LEADS.map((l: any) => l._id === drf.leadId._id ? { ...l, stage: 'DRF Rejected', updatedAt: now() } : l);
    return drf;
  },
  extend: async (id: string, data: { newExpiry: string; reason: string }) => {
    await delay(300);
    DRFs = DRFs.map((d: any) => d._id === id ? { ...d, expiryDate: data.newExpiry, extensionCount: d.extensionCount + 1, extensionHistory: [...d.extensionHistory, { extendedAt: now(), previousExpiry: d.expiryDate || '', newExpiry: data.newExpiry, extendedBy: USERS[0], reason: data.reason }] } : d);
    return DRFs.find((d: any) => d._id === id)!;
  },
  getAnalytics: async () => {
    await delay(300);
    const total = DRFs.length;
    const approved = DRFs.filter((d: any) => d.status === 'Approved').length;
    const rejected = DRFs.filter((d: any) => d.status === 'Rejected').length;
    const pending  = DRFs.filter((d: any) => d.status === 'Pending').length;
    const expiringSoon = DRFs.filter((d: any) => d.status === 'Approved' && d.expiryDate && new Date(d.expiryDate).getTime() - Date.now() < 30 * 86400000).length;
    const drfBySalesPerson = USERS.filter((u: any) => u.role === 'sales').map((sp: any) => {
      const myLeadIds = LEADS.filter((l: any) => l.assignedTo?._id === sp._id).map((l: any) => l._id);
      const myDRFs = DRFs.filter((d: any) => myLeadIds.includes(d.leadId._id));
      return { name: sp.name, total: myDRFs.length, approved: myDRFs.filter((d: any) => d.status === 'Approved').length, rejected: myDRFs.filter((d: any) => d.status === 'Rejected').length };
    });
    const reasonMap: Record<string, number> = {};
    DRFs.filter((d: any) => d.status === 'Rejected' && d.rejectionReason).forEach((d: any) => { reasonMap[d.rejectionReason] = (reasonMap[d.rejectionReason] || 0) + 1; });
    const rejectionReasons = Object.entries(reasonMap).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
    const expiringList = DRFs.filter((d: any) => d.status === 'Approved' && d.expiryDate && new Date(d.expiryDate).getTime() - Date.now() < 30 * 86400000)
      .map((d: any) => ({ ...d, leadData: LEADS.find((l: any) => l._id === d.leadId._id) }))
      .sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    return { total, approved, rejected, pending, expiringSoon, approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0, rejectionRate: total > 0 ? Math.round((rejected / total) * 100) : 0, drfBySalesPerson, rejectionReasons, expiringList };
  },
};

// ─── ACCOUNTS MOCK ───────────────────────────────────────────────────────────
export const mockAccounts = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...ACCOUNTS];
    if (params.search) items = items.filter((a: any) => a.accountName.toLowerCase().includes((params.search as string).toLowerCase()));
    return mockPaginate(items, Number(params.page) || 1, Number(params.limit) || 15);
  },
  getById: async (id: string) => { await delay(); return ACCOUNTS.find((a: any) => a._id === id) || null; },
  convert: async (data: { leadId: string; accountName: string; notes?: string }) => {
    await delay(400);
    const lead = LEADS.find((l: any) => l._id === data.leadId);
    if (!lead) throw new Error('Lead not found');
    const account = { _id: 'a' + uid(), leadId: { _id: lead._id, companyName: lead.companyName, contactPersonName: lead.contactPersonName }, accountName: data.accountName, assignedEngineer: null, assignedSales: lead.assignedTo, status: 'Active', licenseVersion: '', licenseDate: null, licenseExpiryDate: null, notes: data.notes || '', createdAt: now() };
    ACCOUNTS = [...ACCOUNTS, account];
    LEADS = LEADS.map((l: any) => l._id === data.leadId ? { ...l, stage: 'Converted' } : l);
    return account;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    ACCOUNTS = ACCOUNTS.map((a: any) => a._id === id ? { ...a, ...data } : a);
    return ACCOUNTS.find((a: any) => a._id === id)!;
  },
  assignEngineer: async (id: string, engineerId: string) => {
    await delay(300);
    const engineer = USERS.find((u: any) => u._id === engineerId);
    ACCOUNTS = ACCOUNTS.map((a: any) => a._id === id ? { ...a, assignedEngineer: engineer } : a);
    return ACCOUNTS.find((a: any) => a._id === id)!;
  },
};

// ─── QUOTATIONS MOCK ─────────────────────────────────────────────────────────
export const mockQuotations = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    return mockPaginate(QUOTATIONS, Number(params.page) || 1, Number(params.limit) || 15);
  },
  getByLead: async (leadId: string) => { await delay(); return QUOTATIONS.filter((q: any) => q.leadId._id === leadId); },
  getById: async (id: string) => { await delay(); return QUOTATIONS.find((q: any) => q._id === id); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const lead = LEADS.find((l: any) => l._id === data.leadId);
    const items = (data.items as Array<{total:number}>) || [];
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const taxRate = Number(data.taxRate) || 18;
    const taxAmount = subtotal * taxRate / 100;
    const q = { _id: 'q' + uid(), leadId: { _id: lead?._id, companyName: lead?.companyName }, quotationNumber: 'QT-2026-00' + (QUOTATIONS.length + 1), items, subtotal, taxRate, taxAmount, total: subtotal + taxAmount, validUntil: data.validUntil, terms: data.terms, notes: data.notes, createdBy: USERS[1], createdAt: now() };
    QUOTATIONS = [...QUOTATIONS, q];
    LEADS = LEADS.map((l: any) => l._id === data.leadId ? { ...l, stage: 'Quotation Sent' } : l);
    return q;
  },
};

// ─── PURCHASE ORDERS MOCK ────────────────────────────────────────────────────
export const mockPurchases = {
  getAll: async (params: Record<string, unknown> = {}) => { await delay(); return mockPaginate(PURCHASE_ORDERS, Number(params.page) || 1, 15); },
  getById: async (id: string) => { await delay(); return PURCHASE_ORDERS.find((p: any) => p._id === id); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const lead = LEADS.find((l: any) => l._id === data.leadId);
    const po = { _id: 'po' + uid(), leadId: { _id: lead?._id, companyName: lead?.companyName }, poNumber: 'PO-2026-00' + (PURCHASE_ORDERS.length + 1), amount: Number(data.amount), receivedDate: data.receivedDate, notes: String(data.notes || ''), createdBy: USERS[1], createdAt: now() };
    PURCHASE_ORDERS = [...PURCHASE_ORDERS, po];
    LEADS = LEADS.map((l: any) => l._id === data.leadId ? { ...l, stage: 'PO Received' } : l);
    return po;
  },
};

// ─── INSTALLATIONS MOCK ──────────────────────────────────────────────────────
export const mockInstallations = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...INSTALLATIONS];
    if (params.status) items = items.filter((i: any) => i.status === params.status);
    return mockPaginate(items, Number(params.page) || 1, 15);
  },
  getByAccount: async (accountId: string) => { await delay(); return INSTALLATIONS.filter((i: any) => i.accountId?._id === accountId); },
  getById: async (id: string) => { await delay(); return INSTALLATIONS.find((i: any) => i._id === id); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const account = ACCOUNTS.find((a: any) => a._id === data.accountId);
    const engineer = USERS.find((u: any) => u._id === data.engineer);
    const inst = { _id: 'i' + uid(), accountId: { _id: account?._id, accountName: account?.accountName }, scheduledDate: data.scheduledDate, completedDate: null, engineer, siteAddress: data.siteAddress, status: 'Scheduled', licenseVersion: String(data.licenseVersion || ''), notes: String(data.notes || ''), createdAt: now() };
    INSTALLATIONS = [...INSTALLATIONS, inst];
    return inst;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    INSTALLATIONS = INSTALLATIONS.map((i: any) => i._id === id ? { ...i, ...data, completedDate: data.status === 'Completed' ? now() : i.completedDate } : i);
    return INSTALLATIONS.find((i: any) => i._id === id)!;
  },
};

// ─── SUPPORT MOCK ────────────────────────────────────────────────────────────
let ticketCounter = 6;
export const mockSupport = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...SUPPORT_TICKETS];
    if (params.status) items = items.filter((t: any) => t.status === params.status);
    if (params.search) items = items.filter((t: any) => t.subject.toLowerCase().includes((params.search as string).toLowerCase()));
    return mockPaginate(items, Number(params.page) || 1, 15);
  },
  getByAccount: async (accountId: string) => { await delay(); return SUPPORT_TICKETS.filter((t: any) => t.accountId._id === accountId); },
  getById: async (id: string) => { await delay(); return SUPPORT_TICKETS.find((t: any) => t._id === id); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const account = ACCOUNTS.find((a: any) => a._id === data.accountId);
    const ticket = { _id: 't' + uid(), accountId: { _id: account?._id, accountName: account?.accountName }, ticketId: 'TKT-000' + ticketCounter++, subject: data.subject, description: data.description, priority: data.priority || 'Medium', status: 'Open', assignedTo: null, internalNotes: [], createdBy: USERS[1], createdAt: now() };
    SUPPORT_TICKETS = [...SUPPORT_TICKETS, ticket];
    return ticket;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    SUPPORT_TICKETS = SUPPORT_TICKETS.map((t: any) => t._id === id ? { ...t, ...data } : t);
    return SUPPORT_TICKETS.find((t: any) => t._id === id)!;
  },
  addNote: async (id: string, note: string) => {
    await delay(300);
    const newNote = { note, addedBy: USERS[0], addedAt: now() };
    SUPPORT_TICKETS = SUPPORT_TICKETS.map((t: any) => t._id === id ? { ...t, internalNotes: [...t.internalNotes, newNote] } : t);
    return SUPPORT_TICKETS.find((t: any) => t._id === id)!;
  },
};

// ─── INVOICES MOCK ───────────────────────────────────────────────────────────
export const mockInvoices = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...INVOICES];
    if (params.status) items = items.filter((i: any) => i.status === params.status);
    return mockPaginate(items, Number(params.page) || 1, 15);
  },
  getByAccount: async (accountId: string) => { await delay(); return INVOICES.filter((i: any) => i.accountId._id === accountId); },
  getById: async (id: string) => { await delay(); return INVOICES.find((i: any) => i._id === id); },
  getStats: async () => {
    await delay();
    return {
      totalRevenue: INVOICES.filter((i: any) => i.status === 'Paid').reduce((s: number, i: any) => s + i.amount, 0),
      pending: INVOICES.filter((i: any) => i.status === 'Unpaid' || i.status === 'Partially Paid').length,
      overdue: INVOICES.filter((i: any) => i.status === 'Overdue').length,
    };
  },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const account = ACCOUNTS.find((a: any) => a._id === data.accountId);
    const inv = { _id: 'inv' + uid(), accountId: { _id: account?._id, accountName: account?.accountName }, invoiceNumber: 'INV-2026-00' + (INVOICES.length + 1), amount: Number(data.amount), paidAmount: 0, dueDate: data.dueDate, status: 'Unpaid', notes: String(data.notes || ''), createdBy: USERS[0], createdAt: now() };
    INVOICES = [...INVOICES, inv];
    return inv;
  },
  recordPayment: async (id: string, data: Record<string, unknown>) => {
    await delay(400);
    const inv = INVOICES.find((i: any) => i._id === id)!;
    const newPaid = inv.paidAmount + Number(data.amount);
    const status = newPaid >= inv.amount ? 'Paid' : 'Partially Paid';
    INVOICES = INVOICES.map((i: any) => i._id === id ? { ...i, paidAmount: newPaid, status } : i);
    const payment = { _id: 'pay' + uid(), invoiceId: { _id: inv._id, invoiceNumber: inv.invoiceNumber }, amount: Number(data.amount), paymentDate: data.paymentDate, mode: data.mode, reference: data.reference || '', notes: String(data.notes || ''), recordedBy: USERS[0], createdAt: now() };
    PAYMENTS = [...PAYMENTS, payment];
    return INVOICES.find((i: any) => i._id === id)!;
  },
  getPayments: async (id: string) => { await delay(); return PAYMENTS.filter((p: any) => p.invoiceId._id === id); },
};

// ─── ENGINEER VISITS MOCK ────────────────────────────────────────────────────
export const mockEngineerVisits = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...ENGINEER_VISITS];
    if (params.hrStatus) items = items.filter((v: any) => v.hrStatus === params.hrStatus);
    return mockPaginate(items, Number(params.page) || 1, 15);
  },
  getById: async (id: string) => { await delay(); return ENGINEER_VISITS.find((v: any) => v._id === id); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const account = data.accountId ? ACCOUNTS.find((a: any) => a._id === data.accountId) : null;
    const visit = { _id: 'ev' + uid(), engineerId: USERS[3], accountId: account ? { _id: account._id, accountName: account.accountName } : null, visitDate: data.visitDate, visitCharges: Number(data.visitCharges) || 0, travelAllowance: Number(data.travelAllowance) || 0, additionalExpense: Number(data.additionalExpense) || 0, totalAmount: (Number(data.visitCharges) || 0) + (Number(data.travelAllowance) || 0) + (Number(data.additionalExpense) || 0), purpose: data.purpose, hrStatus: 'Pending', approvedBy: null, notes: String(data.notes || ''), createdAt: now() };
    ENGINEER_VISITS = [...ENGINEER_VISITS, visit];
    return visit;
  },
  approve: async (id: string, status: 'Approved' | 'Rejected') => {
    await delay(300);
    ENGINEER_VISITS = ENGINEER_VISITS.map((v: any) => v._id === id ? { ...v, hrStatus: status, approvedBy: USERS[5] } : v);
    return ENGINEER_VISITS.find((v: any) => v._id === id)!;
  },
};

// ─── SALARIES MOCK ───────────────────────────────────────────────────────────
export const mockSalaries = {
  getAll: async (params: Record<string, unknown> = {}) => { await delay(); return mockPaginate(SALARIES, Number(params.page) || 1, 15); },
  calculate: async (data: { employeeId: string; month: number; year: number; baseSalary: number; incentives?: number; deductions?: number }) => {
    await delay(500);
    const employee = USERS.find((u: any) => u._id === data.employeeId);
    if (!employee) throw new Error('Employee not found');
    const exists = SALARIES.find((s: any) => s.employeeId._id === data.employeeId && s.month === data.month && s.year === data.year);
    if (exists) throw { response: { data: { message: 'Salary already calculated for this period' } } };
    const visitChargesTotal = ENGINEER_VISITS.filter((v: any) => v.engineerId._id === data.employeeId && v.hrStatus === 'Approved').reduce((s: number, v: any) => s + v.visitCharges, 0);
    const sal = { _id: 'sal' + uid(), employeeId: employee, month: data.month, year: data.year, baseSalary: data.baseSalary, visitChargesTotal, incentives: data.incentives || 0, deductions: data.deductions || 0, finalSalary: data.baseSalary + visitChargesTotal + (data.incentives || 0) - (data.deductions || 0), status: 'Calculated', paidDate: null, notes: '', createdAt: now() };
    SALARIES = [...SALARIES, sal];
    return sal;
  },
  markPaid: async (id: string) => {
    await delay(300);
    SALARIES = SALARIES.map((s: any) => s._id === id ? { ...s, status: 'Paid', paidDate: now() } : s);
    return SALARIES.find((s: any) => s._id === id)!;
  },
};

// ─── USERS MOCK ──────────────────────────────────────────────────────────────
export const mockUsers = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...USERS];
    if (params.role) items = items.filter((u: any) => u.role === params.role);
    if (params.search) items = items.filter((u: any) => u.name.toLowerCase().includes((params.search as string).toLowerCase()) || u.email.toLowerCase().includes((params.search as string).toLowerCase()));
    return mockPaginate(items, Number(params.page) || 1, 15);
  },
  getById: async (id: string) => { await delay(); return USERS.find((u: any) => u._id === id); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const user = { _id: 'u' + uid(), name: data.name as string, email: (data.email as string).toLowerCase(), role: data.role as string, isActive: true, phone: (data.phone as string) || '', baseSalary: 0, createdAt: now() };
    USERS.push(user);
    return user;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    const idx = USERS.findIndex((u: any) => u._id === id);
    if (idx >= 0) Object.assign(USERS[idx], data);
    return USERS[idx];
  },
  toggleStatus: async (id: string) => {
    await delay(300);
    const idx = USERS.findIndex((u: any) => u._id === id);
    if (idx >= 0) USERS[idx].isActive = !USERS[idx].isActive;
    return USERS[idx];
  },
  resetPassword: async (_id: string, _password: string) => { await delay(300); },
  getEngineers: async () => { await delay(); return USERS.filter((u: any) => u.role === 'engineer'); },
  getSalesmen: async () => { await delay(); return USERS.filter((u: any) => u.role === 'sales'); },
};

// ─── TRAINING MOCK ───────────────────────────────────────────────────────────
export const mockTraining = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...TRAININGS];
    if (params.status)     items = items.filter((t: any) => t.status === params.status);
    if (params.mode)       items = items.filter((t: any) => t.mode === params.mode);
    if (params.engineerId) items = items.filter((t: any) => t.trainedBy?._id === params.engineerId);
    if (params.accountId)  items = items.filter((t: any) => t.accountId?._id === params.accountId);
    return mockPaginate(items, Number(params.page) || 1, 15);
  },
  getById: async (id: string) => { await delay(); return TRAININGS.find((t: any) => t._id === id); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const account = ACCOUNTS.find((a: any) => a._id === data.accountId);
    const engineer = USERS.find((u: any) => u._id === data.trainedBy) || USERS[3];
    const training = { _id: 'tr' + uid(), accountId: { _id: account?._id, accountName: account?.accountName }, customerName: account?.accountName || String(data.customerName || ''), status: data.status || 'Pending', mode: data.mode, trainingDate: data.trainingDate, trainedBy: engineer, notes: String(data.notes || ''), createdAt: now() };
    TRAININGS = [...TRAININGS, training];
    return training;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    TRAININGS = TRAININGS.map((t: any) => t._id === id ? { ...t, ...data } : t);
    return TRAININGS.find((t: any) => t._id === id)!;
  },
};

// ─── DASHBOARD MOCK ──────────────────────────────────────────────────────────
export const mockDashboard = {
  getAdminStats: async () => {
    await delay(500);
    const revenueByMonth = [
      { month: 'Sep', revenue: 180000 }, { month: 'Oct', revenue: 245000 },
      { month: 'Nov', revenue: 310000 }, { month: 'Dec', revenue: 280000 },
      { month: 'Jan', revenue: 420000 }, { month: 'Feb', revenue: 390000 },
    ];
    const now30 = Date.now() + 30 * 86400000;
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
    const drfBySalesPerson = USERS.filter((u: any) => u.role === 'sales').map((sp: any) => {
      const myLeadIds = LEADS.filter((l: any) => l.assignedTo?._id === sp._id).map((l: any) => l._id);
      const myDRFs = DRFs.filter((d: any) => myLeadIds.includes(d.leadId._id));
      return { name: sp.name, total: myDRFs.length, approved: myDRFs.filter((d: any) => d.status === 'Approved').length, rejected: myDRFs.filter((d: any) => d.status === 'Rejected').length };
    });
    const reasonMap: Record<string, number> = {};
    DRFs.filter((d: any) => d.status === 'Rejected' && d.rejectionReason).forEach((d: any) => { reasonMap[d.rejectionReason] = (reasonMap[d.rejectionReason] || 0) + 1; });
    const rejectionReasons = Object.entries(reasonMap).map(([reason, count]) => ({ reason, count }));
    return {
      leads: { total: LEADS.length, new: LEADS.filter((l: any) => l.stage === 'New').length, converted: LEADS.filter((l: any) => l.stage === 'Converted').length, lost: LEADS.filter((l: any) => l.stage === 'Lost').length },
      accounts: { total: ACCOUNTS.length, active: ACCOUNTS.filter((a: any) => a.status === 'Active').length },
      invoices: { totalRevenue: INVOICES.filter((i: any) => i.status === 'Paid').reduce((s: number, i: any) => s + i.amount, 0), pending: INVOICES.filter((i: any) => ['Unpaid','Partially Paid'].includes(i.status)).length, overdue: INVOICES.filter((i: any) => i.status === 'Overdue').length },
      tickets: { open: SUPPORT_TICKETS.filter((t: any) => t.status === 'Open').length, critical: SUPPORT_TICKETS.filter((t: any) => t.priority === 'Critical').length },
      drfs: { pending: DRFs.filter((d: any) => d.status === 'Pending').length, approved: DRFs.filter((d: any) => d.status === 'Approved').length, rejected: DRFs.filter((d: any) => d.status === 'Rejected').length, expiringSoon: DRFs.filter((d: any) => d.status === 'Approved' && d.expiryDate && new Date(d.expiryDate).getTime() < now30).length, totalThisMonth: DRFs.filter((d: any) => new Date(d.sentDate) >= startOfMonth).length },
      drfBySalesPerson,
      rejectionReasons,
      recentLeads: LEADS.slice(0, 5),
      revenueByMonth,
    };
  },
  getSalesStats: async (userId: string) => {
    await delay(400);
    const myLeads = LEADS.filter((l: any) => l.assignedTo?._id === userId);
    const myAccounts = ACCOUNTS.filter((a: any) => a.assignedSales?._id === userId);
    const myLeadIds = myLeads.map((l: any) => l._id);
    const myDRFs = DRFs.filter((d: any) => myLeadIds.includes(d.leadId._id));
    const myQuotations = QUOTATIONS.filter((q: any) => myLeadIds.includes(q.leadId._id));
    const myPOs = PURCHASE_ORDERS.filter((po: any) => myLeadIds.includes(po.leadId._id));
    const stages = ['New', 'DRF Submitted', 'DRF Approved', 'Technical Done', 'Quotation Sent', 'Negotiation', 'PO Received'];
    const pipeline = stages.map(stage => ({ stage: stage.replace('DRF ', ''), count: myLeads.filter((l: any) => l.stage === stage).length }));
    return {
      myLeads: { total: myLeads.length, new: myLeads.filter((l: any) => l.stage === 'New').length, converted: myLeads.filter((l: any) => l.stage === 'Converted').length, lost: myLeads.filter((l: any) => l.stage === 'Lost').length },
      accounts: { total: myAccounts.length, active: myAccounts.filter((a: any) => a.status === 'Active').length },
      quotations: { total: myQuotations.length, totalValue: myQuotations.reduce((s: number, q: any) => s + q.total, 0) },
      purchaseOrders: { total: myPOs.length, totalValue: myPOs.reduce((s: number, po: any) => s + po.amount, 0) },
      pipeline,
      drfPending: myDRFs.filter((d: any) => d.status === 'Pending').length,
      leadsInNegotiation: myLeads.filter((l: any) => l.stage === 'Negotiation').length,
      recentLeads: myLeads.slice(0, 5),
    };
  },
  getEngineerStats: async (userId: string) => {
    await delay(400);
    const myAccounts = ACCOUNTS.filter((a: any) => a.assignedEngineer?._id === userId);
    const myTickets = SUPPORT_TICKETS.filter((t: any) => t.assignedTo?._id === userId);
    const myInstallations = INSTALLATIONS.filter((i: any) => i.engineer?._id === userId);
    const myVisits = ENGINEER_VISITS.filter((v: any) => v.engineerId?._id === userId);
    return {
      accounts: { total: myAccounts.length, active: myAccounts.filter((a: any) => a.status === 'Active').length },
      tickets: { open: myTickets.filter((t: any) => t.status === 'Open').length, inProgress: myTickets.filter((t: any) => t.status === 'In Progress').length, resolved: myTickets.filter((t: any) => t.status === 'Resolved').length, critical: myTickets.filter((t: any) => t.priority === 'Critical').length },
      installations: { scheduled: myInstallations.filter((i: any) => i.status === 'Scheduled').length, inProgress: myInstallations.filter((i: any) => i.status === 'In Progress').length, completed: myInstallations.filter((i: any) => i.status === 'Completed').length },
      visits: { pending: myVisits.filter((v: any) => v.hrStatus === 'Pending').length, total: myVisits.length },
      recentInstallations: myInstallations.filter((i: any) => ['Scheduled', 'In Progress'].includes(i.status)).slice(0, 5),
      recentTickets: myTickets.filter((t: any) => ['Open', 'In Progress'].includes(t.status)).slice(0, 5),
      recentVisits: myVisits.slice(0, 5),
      myAccountDetails: myAccounts,
    };
  },
  getHRStats: async () => {
    await delay(400);
    const pendingVisits = ENGINEER_VISITS.filter((v: any) => v.hrStatus === 'Pending');
    const totalRevenue = INVOICES.filter((i: any) => i.status === 'Paid').reduce((s: number, i: any) => s + i.amount, 0);
    const partialRevenue = INVOICES.filter((i: any) => i.status === 'Partially Paid').reduce((s: number, i: any) => s + i.paidAmount, 0);
    return {
      invoices: { totalRevenue: totalRevenue + partialRevenue, unpaid: INVOICES.filter((i: any) => i.status === 'Unpaid').length, overdue: INVOICES.filter((i: any) => i.status === 'Overdue').length, partialPaid: INVOICES.filter((i: any) => i.status === 'Partially Paid').length, total: INVOICES.length },
      visits: { pending: pendingVisits.length, total: ENGINEER_VISITS.length },
      salaries: { paid: SALARIES.filter((s: any) => s.status === 'Paid').length, pending: SALARIES.filter((s: any) => s.status === 'Calculated').length, totalPaid: SALARIES.filter((s: any) => s.status === 'Paid').reduce((sum: number, s: any) => sum + s.finalSalary, 0) },
      pendingVisitsList: pendingVisits.slice(0, 5),
      allInvoices: INVOICES.slice(0, 5),
      recentSalaries: SALARIES.slice(0, 5),
    };
  },
};
