// ─── Centralized Mock In-Memory Database ───────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */

export type ID = string;
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

// ─── CURRENT ORG CONTEXT ─────────────────────────────────────────────────────
// Set on login/signup; read by all mock queries to enforce org isolation
let _currentOrgId: string | null = null;
export const setCurrentOrgId = (id: string | null) => { _currentOrgId = id; };
export const getCurrentOrgId  = () => _currentOrgId;

// ─── ORGANIZATIONS ───────────────────────────────────────────────────────────
export let ORGANIZATIONS: any[] = [];

// ─── USERS ──────────────────────────────────────────────────────────────────
export let USERS: any[] = [];

let PASSWORDS: Record<string, string> = {};

// ─── LEADS ──────────────────────────────────────────────────────────────────
export let LEADS: any[] = [];

// ─── DRFs (Document Request Forms) ──────────────────────────────────────────
export let DRFs: any[] = [];
let drfSeq = 0;

// ─── ACCOUNTS ────────────────────────────────────────────────────────────────
export let ACCOUNTS: any[] = [];

// ─── QUOTATIONS ──────────────────────────────────────────────────────────────
export let QUOTATIONS: any[] = [];

// ─── PURCHASE ORDERS ─────────────────────────────────────────────────────────
export let PURCHASE_ORDERS: any[] = [];

// ─── INSTALLATIONS ───────────────────────────────────────────────────────────
export let INSTALLATIONS: any[] = [];

// ─── SUPPORT TICKETS ─────────────────────────────────────────────────────────
export let SUPPORT_TICKETS: any[] = [];

// ─── INVOICES ────────────────────────────────────────────────────────────────
export let INVOICES: any[] = [];

// ─── PAYMENTS ────────────────────────────────────────────────────────────────
export let PAYMENTS: any[] = [];

// ─── ENGINEER VISITS ─────────────────────────────────────────────────────────
export let ENGINEER_VISITS: any[] = [];

// ─── SALARIES ────────────────────────────────────────────────────────────────
export let SALARIES: any[] = [];

// ─── TRAININGS ───────────────────────────────────────────────────────────────
export let TRAININGS: any[] = [];

// ─── CONTACTS ────────────────────────────────────────────────────────────────
export let CONTACTS: any[] = [];

// ─── PO EXECUTION WORKFLOWS ──────────────────────────────────────────────────
export let PO_EXECUTION_WORKFLOWS: any[] = [];

// ─── TIMESHEETS ───────────────────────────────────────────────────────────────
export let TIMESHEETS: any[] = [];

// ─── CRUD HELPERS ────────────────────────────────────────────────────────────
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

// Filter helpers scoped to the current org
const orgUsers        = () => USERS.filter((u: any) => u.organizationId === _currentOrgId);
const orgLeads        = () => LEADS.filter((l: any) => l.organizationId === _currentOrgId);
const orgDRFs         = () => DRFs.filter((d: any) => d.organizationId === _currentOrgId);
const orgAccounts     = () => ACCOUNTS.filter((a: any) => a.organizationId === _currentOrgId);
const orgQuotations   = () => QUOTATIONS.filter((q: any) => q.organizationId === _currentOrgId);
const orgPOs          = () => PURCHASE_ORDERS.filter((p: any) => p.organizationId === _currentOrgId);
const orgInstalls     = () => INSTALLATIONS.filter((i: any) => i.organizationId === _currentOrgId);
const orgTickets      = () => SUPPORT_TICKETS.filter((t: any) => t.organizationId === _currentOrgId);
const orgInvoices     = () => INVOICES.filter((i: any) => i.organizationId === _currentOrgId);
const orgPayments     = () => PAYMENTS.filter((p: any) => p.organizationId === _currentOrgId);
const orgVisits       = () => ENGINEER_VISITS.filter((v: any) => v.organizationId === _currentOrgId);
const orgSalaries     = () => SALARIES.filter((s: any) => s.organizationId === _currentOrgId);
const orgTrainings    = () => TRAININGS.filter((t: any) => t.organizationId === _currentOrgId);
const orgContacts     = () => CONTACTS.filter((c: any) => c.organizationId === _currentOrgId);
const orgPOWorkflows  = () => PO_EXECUTION_WORKFLOWS.filter((w: any) => w.organizationId === _currentOrgId);
const orgTimesheets   = () => TIMESHEETS.filter((t: any) => t.organizationId === _currentOrgId);

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
    if (!user || !user.isActive) throw { response: { data: { message: 'Invalid email or password' } } };
    if (PASSWORDS[email.toLowerCase()] !== password) throw { response: { data: { message: 'Invalid email or password' } } };
    _currentOrgId = user.organizationId;
    return { user, accessToken: 'mock-token-' + user._id };
  },
  logout: async () => { await delay(100); _currentOrgId = null; },
  getMe: async (userId: string) => { await delay(100); return USERS.find((u: any) => u._id === userId)!; },

  // Admin signs up and creates a new organization
  signup: async (orgName: string, adminName: string, email: string, password: string) => {
    await delay(500);
    const lowerEmail = email.toLowerCase();
    if (USERS.find((u: any) => u.email === lowerEmail)) {
      throw { response: { data: { message: 'Email already registered' } } };
    }
    const orgId  = 'org' + uid();
    const userId = 'u'   + uid();
    const slug   = orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + uid().slice(0, 4);

    const org: any = { _id: orgId, name: orgName, slug, ownerId: userId, isActive: true, createdAt: now() };
    const user: any = {
      _id: userId, name: adminName, email: lowerEmail, role: 'admin',
      department: 'Management', isActive: true, phone: '',
      baseSalary: 0, organizationId: orgId, createdAt: now(),
    };
    ORGANIZATIONS = [...ORGANIZATIONS, org];
    USERS         = [...USERS, user];
    PASSWORDS[lowerEmail] = password;

    _currentOrgId = orgId;
    return {
      user,
      organization: org,
      accessToken: 'mock-token-' + userId,
    };
  },
};

// ─── LEADS MOCK ──────────────────────────────────────────────────────────────
export const mockLeads = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = orgLeads().filter((l: any) => !l.isArchived);
    if (params.search)     items = items.filter((l: any) => l.companyName.toLowerCase().includes((params.search as string).toLowerCase()) || (l.contactPersonName || l.contactName || '').toLowerCase().includes((params.search as string).toLowerCase()));
    if (params.stage)      items = items.filter((l: any) => l.stage === params.stage);
    if (params.status)     items = items.filter((l: any) => l.status === params.status);
    if (params.assignedTo) items = items.filter((l: any) => l.assignedTo?._id === params.assignedTo);
    return mockPaginate(items, Number(params.page) || 1, Number(params.limit) || 15);
  },
  getById: async (id: string) => { await delay(); return orgLeads().find((l: any) => l._id === id) || null; },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const assignedUser = data.assignedTo
      ? orgUsers().find((u: any) => u._id === data.assignedTo) || orgUsers().find((u: any) => u.role === 'sales')
      : orgUsers().find((u: any) => u.role === 'sales');
    const lead = {
      _id: 'l' + uid(), organizationId: _currentOrgId,
      status: 'New', stage: 'New', isArchived: false,
      ...data,
      assignedTo: assignedUser,
      createdAt: now(), updatedAt: now(),
    };
    LEADS = [lead, ...LEADS];
    return lead;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    const old = orgLeads().find((l: any) => l._id === id);
    LEADS = LEADS.map((l: any) => l._id === id && l.organizationId === _currentOrgId ? { ...l, ...data, updatedAt: now() } : l);
    const updated = orgLeads().find((l: any) => l._id === id)!;
    // Auto-create DRF when status changes to Qualified
    if (data.status === 'Qualified' && old?.status !== 'Qualified') {
      const activeDRF = orgDRFs().find((d: any) => d.leadId._id === id && ['Pending', 'Approved'].includes(d.status));
      if (!activeDRF) {
        await mockDRF.create({ leadId: id, notes: 'Auto-created on lead qualification', createdBy: updated.assignedTo?._id, _autoCreated: true });
      }
    }
    return updated;
  },
  archive: async (id: string) => { await delay(); LEADS = LEADS.map((l: any) => l._id === id && l.organizationId === _currentOrgId ? { ...l, isArchived: true } : l); },
  importLeads: async (rows: Array<Record<string, string>>) => {
    await delay(500);
    const imported: any[] = [];
    const defaultSales = orgUsers().find((u: any) => u.role === 'sales');
    for (const row of rows) {
      // Try to find company name and contact from any available key
      const keys = Object.keys(row);
      const companyName = row.companyName || row.company || keys.find(k => k.toLowerCase().includes('company') || k.toLowerCase().includes('organization') || k.toLowerCase().includes('account'))
        ? (row.companyName || row.company || row[keys.find(k => k.toLowerCase().includes('company') || k.toLowerCase().includes('organization') || k.toLowerCase().includes('account')) || ''] || '')
        : '';
      const contactName = row.contactPersonName || row.contactName || row.name || row.contact ||
        row[keys.find(k => k.toLowerCase().includes('contact') || k.toLowerCase().includes('name')) || ''] || '';
      if (!companyName && !contactName) continue;
      const lead = {
        _id: 'l' + uid(), organizationId: _currentOrgId,
        companyName: String(companyName).trim() || String(contactName).trim(),
        contactPersonName: String(contactName).trim() || String(companyName).trim(),
        contactName: String(contactName).trim() || String(companyName).trim(),
        email: row.email?.trim() || '',
        phone: row.phone?.trim() || '',
        oemName: row.oemName?.trim() || '',
        designation: row.designation?.trim() || '',
        source: row.source?.trim() || 'Import',
        city: row.city?.trim() || '',
        state: row.state?.trim() || '',
        notes: row.notes?.trim() || '',
        status: 'New', stage: 'New', isArchived: false,
        assignedTo: defaultSales,
        createdAt: now(), updatedAt: now(),
      };
      LEADS = [lead, ...LEADS];
      imported.push(lead);
    }
    return { imported: imported.length };
  },
};

// ─── DRF MOCK ────────────────────────────────────────────────────────────────
export const mockDRF = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...orgDRFs()];
    if (params.status)      items = items.filter((d: any) => d.status === params.status);
    if (params.leadId)      items = items.filter((d: any) => d.leadId._id === params.leadId);
    if (params.salesPerson) items = items.filter((d: any) => { const l = orgLeads().find((x: any) => x._id === d.leadId._id); return l?.assignedTo?._id === params.salesPerson; });
    if (params.oemName)     items = items.filter((d: any) => d.leadId.oemName?.toLowerCase().includes((params.oemName as string).toLowerCase()));
    if (params.multiVersion === 'true') items = items.filter((d: any) => d.version >= 2);
    if (params.from)        items = items.filter((d: any) => new Date(d.sentDate) >= new Date(params.from as string));
    if (params.to)          items = items.filter((d: any) => new Date(d.sentDate) <= new Date(params.to as string));
    return mockPaginate(items, Number(params.page) || 1, Number(params.limit) || 15);
  },
  getByLead: async (leadId: string) => { await delay(); return orgDRFs().filter((d: any) => d.leadId._id === leadId); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const lead = orgLeads().find((l: any) => l._id === data.leadId);
    if (!lead) throw new Error('Lead not found');

    // Business Rule: ONE active DRF per company per org
    if (!data._autoCreated && !data.forceCreate) {
      const activeForCompany = orgDRFs().find((d: any) =>
        d.leadId.companyName.toLowerCase() === lead.companyName.toLowerCase() &&
        ['Pending', 'Approved'].includes(d.status) &&
        d.leadId._id !== data.leadId
      );
      if (activeForCompany) {
        throw { response: { data: { message: `An active DRF already exists for "${lead.companyName}". Owner: ${activeForCompany.createdBy?.name || 'Unknown'}`, existingDRF: activeForCompany } } };
      }

      // Version control: only same sales user or admin can create new version
      const prevForLead = orgDRFs().filter((d: any) => d.leadId._id === data.leadId);
      if (prevForLead.length > 0) {
        const existingOwner = prevForLead[prevForLead.length - 1].createdBy;
        const requestingUser = orgUsers().find((u: any) => u._id === data.createdBy);
        if (requestingUser?.role !== 'admin' && existingOwner?._id !== data.createdBy) {
          throw { response: { data: { message: `Only ${existingOwner?.name || 'the original owner'} or an admin can create a new version of this DRF` } } };
        }
      }
    }

    const prevForLead = orgDRFs().filter((d: any) => d.leadId._id === data.leadId);
    const version = prevForLead.length + 1;
    drfSeq++;
    const year = new Date().getFullYear();
    const drfNumber = `DRF-${year}-${String(drfSeq).padStart(3, '0')}`;
    const title = `${lead.oemName || 'OEM'} DRF for ${lead.companyName}`;
    const createdByUser = data.createdBy
      ? orgUsers().find((u: any) => u._id === data.createdBy) || orgUsers().find((u: any) => u.role === 'sales')
      : orgUsers().find((u: any) => u.role === 'sales');
    const drf = {
      _id: 'drf' + uid(), organizationId: _currentOrgId,
      leadId: { _id: lead._id, companyName: lead.companyName, contactName: lead.contactName, contactPersonName: lead.contactPersonName, oemName: lead.oemName },
      drfNumber, title, version, status: 'Pending', sentDate: now(),
      extensionCount: 0, extensionHistory: [],
      notes: String(data.notes || ''), createdBy: createdByUser, approvedBy: null, createdAt: now(),
      // DRF email form details (populated when sent from Lead)
      oemEmail:          data.oemEmail          || lead.oemEmail || '',
      contactPerson:     data.contactPerson     || lead.contactPersonName || '',
      designation:       data.designation       || lead.designation || '',
      contactNo:         data.contactNo         || lead.phone || '',
      email:             data.email             || lead.email || '',
      address:           data.address           || lead.address || '',
      website:           data.website           || lead.website || '',
      annualTurnover:    data.annualTurnover     || lead.annualTurnover || '',
      interestedModules: data.interestedModules  || lead.oemName || '',
      channelPartner:    data.channelPartner     || lead.channelPartner || '',
      expectedClosure:   data.expectedClosure    || lead.expectedClosure || '',
      partnerSalesRep:   data.partnerSalesRep    || '',
      accountName:       data.accountName        || lead.companyName || '',
    };
    DRFs = [...DRFs, drf];
    LEADS = LEADS.map((l: any) => l._id === data.leadId ? { ...l, stage: 'OEM Submitted', updatedAt: now() } : l);
    return drf;
  },
  approve: async (id: string, data: { expiryDate: string; notes?: string }) => {
    await delay(400);
    const admin = orgUsers().find((u: any) => u.role === 'admin');
    DRFs = DRFs.map((d: any) => d._id === id ? { ...d, status: 'Approved', approvedDate: now(), expiryDate: data.expiryDate, approvedBy: admin, notes: data.notes || d.notes } : d);
    const drf = orgDRFs().find((d: any) => d._id === id)!;
    LEADS = LEADS.map((l: any) => l._id === drf.leadId._id ? { ...l, stage: 'OEM Approved', updatedAt: now() } : l);
    return drf;
  },
  reject: async (id: string, data: { rejectionReason: string }) => {
    await delay(400);
    DRFs = DRFs.map((d: any) => d._id === id ? { ...d, status: 'Rejected', rejectedDate: now(), rejectionReason: data.rejectionReason } : d);
    const drf = orgDRFs().find((d: any) => d._id === id)!;
    LEADS = LEADS.map((l: any) => l._id === drf.leadId._id ? { ...l, stage: 'OEM Rejected', updatedAt: now() } : l);
    return drf;
  },
  extend: async (id: string, data: { newExpiry: string; reason: string }) => {
    await delay(300);
    const admin = orgUsers().find((u: any) => u.role === 'admin');
    DRFs = DRFs.map((d: any) => d._id === id ? { ...d, expiryDate: data.newExpiry, extensionCount: d.extensionCount + 1, extensionHistory: [...d.extensionHistory, { extendedAt: now(), previousExpiry: d.expiryDate || '', newExpiry: data.newExpiry, extendedBy: admin, reason: data.reason }] } : d);
    return orgDRFs().find((d: any) => d._id === id)!;
  },
  reassign: async (drfId: string, newOwnerId: string) => {
    await delay(400);
    const drf = orgDRFs().find((d: any) => d._id === drfId);
    if (!drf) throw new Error('DRF not found');
    const newOwner = orgUsers().find((u: any) => u._id === newOwnerId && u.role === 'sales' && u.isActive);
    if (!newOwner) throw new Error('Target user must be an active sales member');
    LEADS = LEADS.map((l: any) => l._id === drf.leadId._id ? { ...l, assignedTo: newOwner, updatedAt: now() } : l);
    DRFs  = DRFs.map((d: any) => d._id === drfId ? { ...d, createdBy: newOwner } : d);
    return { drfId, newOwner };
  },
  markQuotationSent: async (id: string) => {
    await delay(100);
    DRFs = DRFs.map((d: any) => d._id === id ? { ...d, quotationSent: true } : d);
  },
  getAnalytics: async () => {
    await delay(300);
    const items    = orgDRFs();
    const total    = items.length;
    const approved = items.filter((d: any) => d.status === 'Approved').length;
    const rejected = items.filter((d: any) => d.status === 'Rejected').length;
    const pending  = items.filter((d: any) => d.status === 'Pending').length;
    const expiringSoon = items.filter((d: any) => d.status === 'Approved' && d.expiryDate && new Date(d.expiryDate).getTime() - Date.now() < 30 * 86400000).length;
    const drfBySalesPerson = orgUsers().filter((u: any) => u.role === 'sales').map((sp: any) => {
      const myLeadIds = orgLeads().filter((l: any) => l.assignedTo?._id === sp._id).map((l: any) => l._id);
      const myDRFs    = items.filter((d: any) => myLeadIds.includes(d.leadId._id));
      return { name: sp.name, total: myDRFs.length, approved: myDRFs.filter((d: any) => d.status === 'Approved').length, rejected: myDRFs.filter((d: any) => d.status === 'Rejected').length };
    });
    const reasonMap: Record<string, number> = {};
    items.filter((d: any) => d.status === 'Rejected' && d.rejectionReason).forEach((d: any) => { reasonMap[d.rejectionReason] = (reasonMap[d.rejectionReason] || 0) + 1; });
    const rejectionReasons = Object.entries(reasonMap).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
    const expiringList = items.filter((d: any) => d.status === 'Approved' && d.expiryDate && new Date(d.expiryDate).getTime() - Date.now() < 30 * 86400000)
      .sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    const totalThisMonth = items.filter((d: any) => { const m = new Date(d.createdAt); const n = new Date(); return m.getMonth() === n.getMonth() && m.getFullYear() === n.getFullYear(); }).length;
    return { total, approved, rejected, pending, expiringSoon, totalThisMonth, approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0, rejectionRate: total > 0 ? Math.round((rejected / total) * 100) : 0, drfBySalesPerson, rejectionReasons, expiringList };
  },
  resetToPending: async (id: string) => {
    await delay(300);
    DRFs = DRFs.map((d: any) => d._id === id ? { ...d, status: 'Pending', approvedDate: null, approvedBy: null, rejectedDate: null, rejectionReason: null } : d);
    return orgDRFs().find((d: any) => d._id === id)!;
  },
  resend: async (id: string) => {
    await delay(300);
    DRFs = DRFs.map((d: any) => d._id === id ? { ...d, sentDate: now(), attemptNumber: (d.attemptNumber || 1) + 1 } : d);
    return orgDRFs().find((d: any) => d._id === id)!;
  },
  delete: async (id: string) => {
    await delay(200);
    DRFs = DRFs.filter((d: any) => d._id !== id);
  },
  syncEmails: async () => {
    await delay(800);
    return { scanned: 0, processed: 0, approved: [], rejected: [], skipped: [], errors: [] };
  },
  // Used when sending DRF from the Leads page — lead may not exist in mock LEADS array
  sendFromLead: async (leadData: Record<string, unknown>, formData: Record<string, string>, createdByUser: any) => {
    await delay(400);
    const leadId = String(leadData._id || leadData.id || '');
    // Resolve creator — prefer fresh copy from USERS array so name is always populated
    const resolvedCreator = (createdByUser?._id && orgUsers().find((u: any) => u._id === createdByUser._id))
      || (createdByUser?.id && orgUsers().find((u: any) => u._id === createdByUser.id))
      || createdByUser;
    const prevForLead = orgDRFs().filter((d: any) => d.leadId._id === leadId);
    const version = prevForLead.length + 1;
    drfSeq++;
    const year = new Date().getFullYear();
    const drfNumber = `DRF-${year}-${String(drfSeq).padStart(3, '0')}`;
    const oemName = String(leadData.oemName || formData.interestedModules || 'OEM');
    const companyName = String(leadData.companyName || formData.accountName || '');
    const title = `${oemName} DRF for ${companyName}`;
    const drf = {
      _id: 'drf' + uid(), organizationId: _currentOrgId,
      leadId: {
        _id: leadId,
        companyName,
        contactName:       String(leadData.contactName || ''),
        contactPersonName: String(leadData.contactPersonName || formData.contactPerson || ''),
        oemName,
      },
      drfNumber, title, version, status: 'Pending', sentDate: now(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      extensionCount: 0, extensionHistory: [],
      extensionRequested: false, extensionRequestedAt: null,
      notes: '', createdBy: resolvedCreator, approvedBy: null, createdAt: now(),
      oemEmail:          formData.oemEmail          || '',
      contactPerson:     formData.contactPerson     || '',
      designation:       formData.designation       || '',
      contactNo:         formData.contactNo         || '',
      email:             formData.email             || '',
      address:           formData.address           || '',
      website:           formData.website           || '',
      annualTurnover:    formData.annualTurnover     || '',
      interestedModules: formData.interestedModules  || oemName,
      channelPartner:    formData.channelPartner     || '',
      expectedClosure:   formData.expectedClosure    || '',
      partnerSalesRep:   formData.partnerSalesRep    || '',
      accountName:       formData.accountName        || companyName,
    };
    DRFs = [...DRFs, drf];
    return drf;
  },
  requestExtension: async (id: string) => {
    await delay(300);
    DRFs = DRFs.map((d: any) =>
      d._id === id ? { ...d, extensionRequested: true, extensionRequestedAt: now() } : d
    );
    return DRFs.find((d: any) => d._id === id) || null;
  },
};

// ─── ACCOUNTS MOCK ───────────────────────────────────────────────────────────
export const mockAccounts = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...orgAccounts()];
    if (params.search) items = items.filter((a: any) => a.accountName.toLowerCase().includes((params.search as string).toLowerCase()));
    return mockPaginate(items, Number(params.page) || 1, Number(params.limit) || 15);
  },
  getById: async (id: string) => { await delay(); return orgAccounts().find((a: any) => a._id === id) || null; },
  convert: async (data: { leadId: string; accountName: string; notes?: string }) => {
    await delay(400);
    const lead = orgLeads().find((l: any) => l._id === data.leadId);
    if (!lead) throw new Error('Lead not found');
    const account = { _id: 'a' + uid(), organizationId: _currentOrgId, leadId: { _id: lead._id, companyName: lead.companyName, contactPersonName: lead.contactPersonName }, accountName: data.accountName, assignedEngineer: null, assignedSales: lead.assignedTo, status: 'Active', licenseVersion: '', licenseDate: null, licenseExpiryDate: null, notes: data.notes || '', createdAt: now() };
    ACCOUNTS = [...ACCOUNTS, account];
    LEADS = LEADS.map((l: any) => l._id === data.leadId ? { ...l, stage: 'Converted' } : l);
    return account;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    ACCOUNTS = ACCOUNTS.map((a: any) => a._id === id && a.organizationId === _currentOrgId ? { ...a, ...data } : a);
    return orgAccounts().find((a: any) => a._id === id)!;
  },
  assignEngineer: async (id: string, engineerId: string) => {
    await delay(300);
    const engineer = orgUsers().find((u: any) => u._id === engineerId);
    ACCOUNTS = ACCOUNTS.map((a: any) => a._id === id && a.organizationId === _currentOrgId ? { ...a, assignedEngineer: engineer } : a);
    return orgAccounts().find((a: any) => a._id === id)!;
  },
  delete: async (id: string) => {
    await delay(300);
    const account = orgAccounts().find((a: any) => a._id === id);
    if (!account) throw { response: { data: { message: 'Account not found' } } };
    ACCOUNTS = ACCOUNTS.filter((a: any) => a._id !== id);
    return { success: true };
  },
};

// ─── QUOTATIONS MOCK ─────────────────────────────────────────────────────────
export const mockQuotations = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    const poLeadIds = new Set(orgPOs().map((p: any) => p.leadId?._id || p.leadId));
    let items = orgQuotations().map((q: any) => ({ ...q, poReceived: poLeadIds.has(q.leadId?._id || q.leadId) }));
    if (params.status) items = items.filter((q: any) => q.status === params.status);
    if (params.leadId) items = items.filter((q: any) => q.leadId._id === params.leadId);
    if (params.poFilter === 'po_received') items = items.filter((q: any) => q.poReceived);
    if (params.poFilter === 'po_not_received') items = items.filter((q: any) => !q.poReceived);
    return mockPaginate(items, Number(params.page) || 1, Number(params.limit) || 15);
  },
  getByLead: async (leadId: string) => { await delay(); return orgQuotations().filter((q: any) => q.leadId._id === leadId); },
  getById: async (id: string) => { await delay(); return orgQuotations().find((q: any) => q._id === id); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const lead = orgLeads().find((l: any) => l._id === data.leadId);
    if (!lead) throw new Error('Lead not found');
    // Require approved DRF
    const approvedDRF = orgDRFs().find((d: any) => d.leadId._id === data.leadId && d.status === 'Approved');
    if (!approvedDRF) {
      throw { response: { data: { message: 'A Quotation can only be created after the DRF is Approved' } } };
    }
    const prevQuotes = orgQuotations().filter((q: any) => q.leadId._id === data.leadId);
    const version = prevQuotes.length + 1;
    const items = (data.items as Array<{total:number}>) || [];
    const subtotal  = items.reduce((s, i) => s + i.total, 0);
    const taxRate   = Number(data.taxRate) || 18;
    const taxAmount = subtotal * taxRate / 100;
    const createdBy = data.createdBy
      ? orgUsers().find((u: any) => u._id === data.createdBy) || orgUsers().find((u: any) => u.role === 'sales')
      : orgUsers().find((u: any) => u.role === 'sales') || orgUsers()[0];
    const q = {
      _id: 'q' + uid(), organizationId: _currentOrgId,
      leadId: { _id: lead._id, companyName: lead.companyName, email: lead.email, contactPersonName: lead.contactPersonName || lead.contactName },
      quotationNumber: `QT-${new Date().getFullYear()}-${String(orgQuotations().length + 1).padStart(3, '0')}`,
      version, status: 'Sent', items, subtotal, taxRate, taxAmount,
      total: subtotal + taxAmount,
      validUntil: data.validUntil, terms: data.terms, notes: data.notes,
      emailSent: false, pdfPath: null, createdBy, createdAt: now(),
    };
    QUOTATIONS = [...QUOTATIONS, q];
    LEADS = LEADS.map((l: any) => l._id === data.leadId ? { ...l, stage: 'Quotation Sent', updatedAt: now() } : l);
    return q;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    QUOTATIONS = QUOTATIONS.map((q: any) => q._id === id && q.organizationId === _currentOrgId ? { ...q, ...data } : q);
    return orgQuotations().find((q: any) => q._id === id)!;
  },
  accept: async (id: string) => {
    await delay(300);
    QUOTATIONS = QUOTATIONS.map((q: any) => q._id === id && q.organizationId === _currentOrgId ? { ...q, status: 'Accepted' } : q);
    const q = orgQuotations().find((q: any) => q._id === id)!;
    LEADS = LEADS.map((l: any) => l._id === q.leadId._id ? { ...l, stage: 'Negotiation', updatedAt: now() } : l);
    return q;
  },
  reject: async (id: string) => {
    await delay(300);
    QUOTATIONS = QUOTATIONS.map((q: any) => q._id === id && q.organizationId === _currentOrgId ? { ...q, status: 'Rejected' } : q);
    return orgQuotations().find((q: any) => q._id === id)!;
  },
  sendEmail: async (id: string) => {
    await delay(600);
    QUOTATIONS = QUOTATIONS.map((q: any) => q._id === id && q.organizationId === _currentOrgId ? { ...q, emailSent: true, emailSentAt: now() } : q);
    return orgQuotations().find((q: any) => q._id === id)!;
  },
  generatePDF: async (id: string) => {
    await delay(800);
    const q = orgQuotations().find((qt: any) => qt._id === id)!;
    const pdfPath = `quotation_${(q.quotationNumber as string).replace(/-/g, '_')}.pdf`;
    QUOTATIONS = QUOTATIONS.map((qt: any) => qt._id === id && qt.organizationId === _currentOrgId ? { ...qt, pdfPath } : qt);
    return orgQuotations().find((qt: any) => qt._id === id)!;
  },
  delete: async (id: string) => {
    await delay(300);
    const q = orgQuotations().find((q: any) => q._id === id);
    if (!q) throw { response: { data: { message: 'Quotation not found' } } };
    QUOTATIONS = QUOTATIONS.filter((q: any) => q._id !== id);
    return { success: true };
  },
};

// ─── PURCHASE ORDERS MOCK ────────────────────────────────────────────────────
export const mockPurchases = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...orgPOs()];
    if (params.leadId) items = items.filter((p: any) => p.leadId._id === params.leadId);
    return mockPaginate(items, Number(params.page) || 1, Number(params.limit) || 15);
  },
  getByLead: async (leadId: string) => { await delay(); return orgPOs().filter((p: any) => p.leadId._id === leadId); },
  getById: async (id: string) => { await delay(); return orgPOs().find((p: any) => p._id === id); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const lead = orgLeads().find((l: any) => l._id === data.leadId);
    const createdBy = data.createdBy
      ? orgUsers().find((u: any) => u._id === data.createdBy) || orgUsers().find((u: any) => u.role === 'sales')
      : orgUsers().find((u: any) => u.role === 'sales') || orgUsers()[0];
    const po = {
      _id: 'po' + uid(), organizationId: _currentOrgId,
      leadId: { _id: lead?._id, companyName: lead?.companyName },
      poNumber: `PO-${new Date().getFullYear()}-${String(orgPOs().length + 1).padStart(3, '0')}`,
      amount: Number(data.amount),
      product: String(data.product || ''),
      vendorName: String(data.vendorName || ''),
      vendorEmail: String(data.vendorEmail || ''),
      documentPath: data.documentPath || null,
      receivedDate: data.receivedDate,
      notes: String(data.notes || ''),
      isSubmitted: false, vendorEmailSent: false,
      createdBy, createdAt: now(),
    };
    PURCHASE_ORDERS = [...PURCHASE_ORDERS, po];
    LEADS = LEADS.map((l: any) => l._id === data.leadId ? { ...l, stage: 'PO Received', updatedAt: now() } : l);
    return po;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    PURCHASE_ORDERS = PURCHASE_ORDERS.map((p: any) => p._id === id && p.organizationId === _currentOrgId ? { ...p, ...data } : p);
    return orgPOs().find((p: any) => p._id === id)!;
  },
  sendToVendor: async (id: string) => {
    await delay(600);
    const po = orgPOs().find((p: any) => p._id === id);
    if (!po?.vendorEmail) throw { response: { data: { message: 'No vendor email address set on this PO' } } };
    PURCHASE_ORDERS = PURCHASE_ORDERS.map((p: any) => p._id === id && p.organizationId === _currentOrgId
      ? { ...p, isSubmitted: true, vendorEmailSent: true, vendorEmailSentAt: now() } : p);
    return orgPOs().find((p: any) => p._id === id)!;
  },
  convertToAccount: async (poId: string, data: { accountName?: string; notes?: string }) => {
    await delay(500);
    const po = orgPOs().find((p: any) => p._id === poId);
    if (!po) throw new Error('PO not found');
    const lead = orgLeads().find((l: any) => l._id === po.leadId._id);
    if (!lead) throw new Error('Lead not found');
    const existing = orgAccounts().find((a: any) => a.leadId?._id === lead._id);
    if (existing) throw { response: { data: { message: 'An account already exists for this lead' } } };
    const account = {
      _id: 'a' + uid(), organizationId: _currentOrgId,
      leadId: { _id: lead._id, companyName: lead.companyName, contactPersonName: lead.contactPersonName },
      accountName: data.accountName || lead.companyName,
      assignedEngineer: null, assignedSales: lead.assignedTo,
      status: 'Active', notes: data.notes || '', createdAt: now(),
    };
    ACCOUNTS = [...ACCOUNTS, account];
    LEADS = LEADS.map((l: any) => l._id === lead._id ? { ...l, stage: 'Converted', updatedAt: now() } : l);
    return account;
  },
  delete: async (id: string) => {
    await delay(300);
    const po = orgPOs().find((p: any) => p._id === id);
    if (!po) throw { response: { data: { message: 'Purchase order not found' } } };
    PURCHASE_ORDERS = PURCHASE_ORDERS.filter((p: any) => p._id !== id);
    return { success: true };
  },
  generateInvoice: async (id: string, data: Record<string, unknown>) => {
    await delay(400);
    const num = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    PURCHASE_ORDERS = PURCHASE_ORDERS.map((p: any) => p._id === id
      ? { ...p, invoiceGenerated: true, invoiceGeneratedAt: now(), poInvoiceNumber: num, invoiceAmount: data.amount || p.amount }
      : p);
    return orgPOs().find((p: any) => p._id === id);
  },
  generateLicense: async (id: string, data: Record<string, unknown>) => {
    await delay(400);
    PURCHASE_ORDERS = PURCHASE_ORDERS.map((p: any) => p._id === id
      ? { ...p, licenseGenerated: true, licenseGeneratedAt: now(), licenseKey: data.licenseKey || '', licenseFile: data.licenseFile || '' }
      : p);
    return orgPOs().find((p: any) => p._id === id);
  },
  sendCustomerInvoice: async (id: string) => {
    await delay(500);
    PURCHASE_ORDERS = PURCHASE_ORDERS.map((p: any) => p._id === id
      ? { ...p, customerInvoiceSent: true, customerInvoiceSentAt: now() }
      : p);
    return orgPOs().find((p: any) => p._id === id);
  },
};

// ─── INSTALLATIONS MOCK ──────────────────────────────────────────────────────
export const mockInstallations = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...orgInstalls()];
    if (params.status) items = items.filter((i: any) => i.status === params.status);
    return mockPaginate(items, Number(params.page) || 1, 15);
  },
  getByAccount: async (accountId: string) => { await delay(); return orgInstalls().filter((i: any) => i.accountId?._id === accountId); },
  getById: async (id: string) => { await delay(); return orgInstalls().find((i: any) => i._id === id); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const account  = orgAccounts().find((a: any) => a._id === data.accountId);
    const engineer = orgUsers().find((u: any) => u._id === data.engineer);
    const inst = { _id: 'i' + uid(), organizationId: _currentOrgId, accountId: { _id: account?._id, accountName: account?.accountName }, scheduledDate: data.scheduledDate, completedDate: null, engineer, siteAddress: data.siteAddress, status: 'Scheduled', licenseVersion: String(data.licenseVersion || ''), notes: String(data.notes || ''), createdAt: now() };
    INSTALLATIONS = [...INSTALLATIONS, inst];
    return inst;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    INSTALLATIONS = INSTALLATIONS.map((i: any) => i._id === id && i.organizationId === _currentOrgId ? { ...i, ...data, completedDate: data.status === 'Completed' ? now() : i.completedDate } : i);
    return orgInstalls().find((i: any) => i._id === id)!;
  },
};

// ─── SUPPORT MOCK ────────────────────────────────────────────────────────────
let ticketCounter = 1;
export const mockSupport = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...orgTickets()];
    if (params.status) items = items.filter((t: any) => t.status === params.status);
    if (params.search) items = items.filter((t: any) => t.subject.toLowerCase().includes((params.search as string).toLowerCase()));
    return mockPaginate(items, Number(params.page) || 1, 15);
  },
  getByAccount: async (accountId: string) => { await delay(); return orgTickets().filter((t: any) => t.accountId._id === accountId); },
  getById: async (id: string) => { await delay(); return orgTickets().find((t: any) => t._id === id); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const account   = orgAccounts().find((a: any) => a._id === data.accountId);
    const createdBy = orgUsers().find((u: any) => u.role === 'sales') || orgUsers()[0];
    const ticket = { _id: 't' + uid(), organizationId: _currentOrgId, accountId: { _id: account?._id, accountName: account?.accountName }, ticketId: 'TKT-000' + ticketCounter++, subject: data.subject, description: data.description, priority: data.priority || 'Medium', status: 'Open', assignedTo: null, internalNotes: [], createdBy, createdAt: now() };
    SUPPORT_TICKETS = [...SUPPORT_TICKETS, ticket];
    return ticket;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    SUPPORT_TICKETS = SUPPORT_TICKETS.map((t: any) => t._id === id && t.organizationId === _currentOrgId ? { ...t, ...data } : t);
    return orgTickets().find((t: any) => t._id === id)!;
  },
  addNote: async (id: string, note: string) => {
    await delay(300);
    const admin = orgUsers().find((u: any) => u.role === 'admin') || orgUsers()[0];
    const newNote = { note, addedBy: admin, addedAt: now() };
    SUPPORT_TICKETS = SUPPORT_TICKETS.map((t: any) => t._id === id && t.organizationId === _currentOrgId ? { ...t, internalNotes: [...t.internalNotes, newNote] } : t);
    return orgTickets().find((t: any) => t._id === id)!;
  },
};

// ─── INVOICES MOCK ───────────────────────────────────────────────────────────
export const mockInvoices = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...orgInvoices()];
    if (params.status) items = items.filter((i: any) => i.status === params.status);
    return mockPaginate(items, Number(params.page) || 1, 15);
  },
  getByAccount: async (accountId: string) => { await delay(); return orgInvoices().filter((i: any) => i.accountId._id === accountId); },
  getById: async (id: string) => { await delay(); return orgInvoices().find((i: any) => i._id === id); },
  getStats: async () => {
    await delay();
    const items = orgInvoices();
    return {
      totalRevenue: items.filter((i: any) => i.status === 'Paid').reduce((s: number, i: any) => s + i.amount, 0),
      pending:      items.filter((i: any) => i.status === 'Unpaid' || i.status === 'Partially Paid').length,
      overdue:      items.filter((i: any) => i.status === 'Overdue').length,
    };
  },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const account   = orgAccounts().find((a: any) => a._id === data.accountId);
    const createdBy = orgUsers().find((u: any) => u.role === 'admin') || orgUsers()[0];
    const inv = { _id: 'inv' + uid(), organizationId: _currentOrgId, accountId: { _id: account?._id, accountName: account?.accountName }, invoiceNumber: 'INV-2026-00' + (orgInvoices().length + 1), amount: Number(data.amount), paidAmount: 0, dueDate: data.dueDate, status: 'Unpaid', notes: String(data.notes || ''), createdBy, createdAt: now() };
    INVOICES = [...INVOICES, inv];
    return inv;
  },
  recordPayment: async (id: string, data: Record<string, unknown>) => {
    await delay(400);
    const inv     = orgInvoices().find((i: any) => i._id === id)!;
    const newPaid = inv.paidAmount + Number(data.amountPaid);
    const status  = newPaid >= inv.amount ? 'Paid' : 'Partially Paid';
    INVOICES = INVOICES.map((i: any) => i._id === id ? { ...i, paidAmount: newPaid, status } : i);
    const recorder = orgUsers().find((u: any) => u.role === 'hr_finance') || orgUsers().find((u: any) => u.role === 'admin') || orgUsers()[0];
    const payment = { _id: 'pay' + uid(), organizationId: _currentOrgId, invoiceId: { _id: inv._id, invoiceNumber: inv.invoiceNumber }, amountPaid: Number(data.amountPaid), paymentDate: data.paymentDate, mode: data.mode, referenceNumber: data.referenceNumber || '', notes: String(data.notes || ''), recordedBy: { _id: recorder._id, name: recorder.name }, createdAt: now() };
    PAYMENTS = [...PAYMENTS, payment];
    return payment;
  },
  getPayments: async (id: string) => { await delay(); return orgPayments().filter((p: any) => p.invoiceId._id === id); },
};

// ─── ENGINEER VISITS MOCK ────────────────────────────────────────────────────
export const mockEngineerVisits = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...orgVisits()];
    if (params.hrStatus) items = items.filter((v: any) => v.hrStatus === params.hrStatus);
    return mockPaginate(items, Number(params.page) || 1, 15);
  },
  getMyVisits: async (engineerId: string) => { await delay(); return orgVisits().filter((v: any) => v.engineerId._id === engineerId); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const engineer = orgUsers().find((u: any) => u._id === data.engineerId);
    const account  = data.accountId ? orgAccounts().find((a: any) => a._id === data.accountId) : null;
    const total    = Number(data.visitCharges) + Number(data.travelAllowance) + Number(data.additionalExpense);
    const visit    = { _id: 'ev' + uid(), organizationId: _currentOrgId, engineerId: engineer, accountId: account ? { _id: account._id, accountName: account.accountName } : null, visitDate: data.visitDate, visitCharges: Number(data.visitCharges), travelAllowance: Number(data.travelAllowance), additionalExpense: Number(data.additionalExpense), totalAmount: total, purpose: data.purpose, hrStatus: 'Pending', approvedBy: null, notes: String(data.notes || ''), createdAt: now() };
    ENGINEER_VISITS = [...ENGINEER_VISITS, visit];
    return visit;
  },
  approve: async (id: string) => {
    await delay(300);
    const approver = orgUsers().find((u: any) => u.role === 'hr_finance') || orgUsers()[0];
    ENGINEER_VISITS = ENGINEER_VISITS.map((v: any) => v._id === id && v.organizationId === _currentOrgId ? { ...v, hrStatus: 'Approved', approvedBy: approver, approvedAt: now() } : v);
    return orgVisits().find((v: any) => v._id === id)!;
  },
  reject: async (id: string) => {
    await delay(300);
    const approver = orgUsers().find((u: any) => u.role === 'hr_finance') || orgUsers()[0];
    ENGINEER_VISITS = ENGINEER_VISITS.map((v: any) => v._id === id && v.organizationId === _currentOrgId ? { ...v, hrStatus: 'Rejected', approvedBy: approver, approvedAt: now() } : v);
    return orgVisits().find((v: any) => v._id === id)!;
  },
};

// ─── SALARIES MOCK ────────────────────────────────────────────────────────────
export const mockSalaries = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    return mockPaginate(orgSalaries(), Number(params.page) || 1, 15);
  },
  calculate: async (data: Record<string, unknown>) => {
    await delay(400);
    const employee  = orgUsers().find((u: any) => u._id === data.employeeId);
    const visits    = orgVisits().filter((v: any) => v.engineerId._id === data.employeeId && v.hrStatus === 'Approved' && new Date(v.visitDate).getMonth() + 1 === Number(data.month) && new Date(v.visitDate).getFullYear() === Number(data.year));
    const visitTotal = visits.reduce((s: number, v: any) => s + v.totalAmount, 0);
    const salary = { _id: 'sal' + uid(), organizationId: _currentOrgId, employeeId: employee, month: Number(data.month), year: Number(data.year), baseSalary: employee?.baseSalary || 0, visitChargesTotal: visitTotal, incentives: Number(data.incentives) || 0, deductions: Number(data.deductions) || 0, finalSalary: (employee?.baseSalary || 0) + visitTotal + (Number(data.incentives) || 0) - (Number(data.deductions) || 0), status: 'Calculated', paidDate: null, notes: String(data.notes || ''), createdAt: now() };
    SALARIES = [...SALARIES, salary];
    return salary;
  },
  markPaid: async (id: string) => {
    await delay(300);
    SALARIES = SALARIES.map((s: any) => s._id === id && s.organizationId === _currentOrgId ? { ...s, status: 'Paid', paidDate: now() } : s);
    return orgSalaries().find((s: any) => s._id === id)!;
  },
};

// ─── USERS MOCK ───────────────────────────────────────────────────────────────
export const mockUsers = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...orgUsers()];
    if (params.role)   items = items.filter((u: any) => u.role === params.role);
    if (params.search) items = items.filter((u: any) => u.name.toLowerCase().includes((params.search as string).toLowerCase()) || u.email.toLowerCase().includes((params.search as string).toLowerCase()));
    if (params.isActive !== undefined) items = items.filter((u: any) => u.isActive === (params.isActive === 'true' || params.isActive === true));
    return mockPaginate(items, Number(params.page) || 1, Number(params.limit) || 15);
  },
  getById: async (id: string) => { await delay(); return orgUsers().find((u: any) => u._id === id) || null; },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const lowerEmail = (data.email as string).toLowerCase();
    if (USERS.find((u: any) => u.email === lowerEmail)) throw { response: { data: { message: 'Email already exists' } } };
    const user = { _id: 'u' + uid(), organizationId: _currentOrgId, ...data, email: lowerEmail, isActive: true, createdAt: now() };
    PASSWORDS[lowerEmail] = data.password as string;
    USERS = [...USERS, user];
    return user;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    const { password, organizationId, ...safeData } = data as any;
    USERS = USERS.map((u: any) => u._id === id && u.organizationId === _currentOrgId ? { ...u, ...safeData } : u);
    return orgUsers().find((u: any) => u._id === id)!;
  },
  toggleStatus: async (id: string) => {
    await delay(300);
    USERS = USERS.map((u: any) => u._id === id && u.organizationId === _currentOrgId ? { ...u, isActive: !u.isActive } : u);
    const user = USERS.find((u: any) => u._id === id)!;
    return { isActive: user.isActive };
  },
  resetPassword: async (id: string, password: string) => {
    await delay(300);
    const user = USERS.find((u: any) => u._id === id && u.organizationId === _currentOrgId);
    if (user) PASSWORDS[user.email] = password;
    return { success: true };
  },
  delete: async (id: string) => {
    await delay(300);
    const user = USERS.find((u: any) => u._id === id && u.organizationId === _currentOrgId);
    if (!user) throw { response: { data: { message: 'User not found' } } };
    // Remove from all related collections
    LEADS             = LEADS.map((l: any) => l.assignedTo?._id === id ? { ...l, assignedTo: null } : l);
    DRFs              = DRFs.filter((d: any) => d.createdBy?._id !== id);
    INSTALLATIONS     = INSTALLATIONS.filter((i: any) => i.assignedTo?._id !== id);
    SUPPORT_TICKETS   = SUPPORT_TICKETS.filter((t: any) => t.assignedTo?._id !== id);
    ENGINEER_VISITS   = ENGINEER_VISITS.filter((v: any) => v.engineerId !== id && v.engineer?._id !== id);
    SALARIES          = SALARIES.filter((s: any) => s.engineerId !== id && s.engineer?._id !== id);
    TRAININGS         = TRAININGS.filter((t: any) => t.assignedTo?._id !== id);
    delete PASSWORDS[user.email];
    USERS = USERS.filter((u: any) => u._id !== id);
    return { success: true };
  },
  getEngineers: async () => { await delay(200); return orgUsers().filter((u: any) => u.role === 'engineer' && u.isActive); },
  getSalesmen:  async () => { await delay(200); return orgUsers().filter((u: any) => u.role === 'sales'    && u.isActive); },
};

// ─── TRAINING MOCK ────────────────────────────────────────────────────────────
export const mockTraining = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...orgTrainings()];
    if (params.status) items = items.filter((t: any) => t.status === params.status);
    return mockPaginate(items, Number(params.page) || 1, 15);
  },
  getByAccount: async (accountId: string) => { await delay(); return orgTrainings().filter((t: any) => t.accountId._id === accountId); },
  getById: async (id: string) => { await delay(); return orgTrainings().find((t: any) => t._id === id); },
  create: async (data: Record<string, unknown>) => {
    await delay(400);
    const account   = orgAccounts().find((a: any) => a._id === data.accountId);
    const trainedBy = orgUsers().find((u: any) => u._id === data.trainedBy) || orgUsers().find((u: any) => u.role === 'engineer');
    const training  = { _id: 'tr' + uid(), organizationId: _currentOrgId, accountId: { _id: account?._id, accountName: account?.accountName }, customerName: account?.accountName || '', status: 'Pending', mode: data.mode, trainingDate: data.trainingDate, trainedBy, notes: String(data.notes || ''), createdAt: now() };
    TRAININGS = [...TRAININGS, training];
    return training;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    TRAININGS = TRAININGS.map((t: any) => t._id === id && t.organizationId === _currentOrgId ? { ...t, ...data } : t);
    return orgTrainings().find((t: any) => t._id === id)!;
  },
};

// ─── DASHBOARD MOCK ───────────────────────────────────────────────────────────
export const mockDashboard = {
  getAdminStats: async () => {
    await delay(300);
    const leads    = orgLeads().filter((l: any) => !l.isArchived);
    const accounts = orgAccounts();
    const invoices = orgInvoices();
    const tickets  = orgTickets();
    const drfs     = orgDRFs();
    const installs = orgInstalls();

    const revenueByMonth: Record<string, number> = {};
    invoices.filter((i: any) => i.status === 'Paid').forEach((i: any) => {
      const m = new Date(i.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
      revenueByMonth[m] = (revenueByMonth[m] || 0) + i.amount;
    });

    const engineerMap: Record<string, any> = {};
    installs.forEach((i: any) => {
      const engId = i.engineer?._id || i.engineer || 'unassigned';
      const engName = i.engineer?.name || 'Unassigned';
      if (!engineerMap[engId]) engineerMap[engId] = { _id: engId, engineerName: engName, total: 0, completed: 0, inProgress: 0, scheduled: 0 };
      engineerMap[engId].total++;
      if (i.status === 'Completed') engineerMap[engId].completed++;
      else if (i.status === 'In Progress') engineerMap[engId].inProgress++;
      else if (i.status === 'Scheduled') engineerMap[engId].scheduled++;
    });

    return {
      leads:    { total: leads.length, new: leads.filter((l: any) => l.stage === 'New').length, converted: leads.filter((l: any) => l.stage === 'Converted').length, lost: leads.filter((l: any) => l.stage === 'Lost').length },
      accounts: { total: accounts.length, active: accounts.filter((a: any) => a.status === 'Active').length },
      invoices: { totalRevenue: invoices.filter((i: any) => i.status === 'Paid').reduce((s: number, i: any) => s + i.amount, 0), pending: invoices.filter((i: any) => ['Unpaid','Partially Paid'].includes(i.status)).length, overdue: invoices.filter((i: any) => i.status === 'Overdue').length },
      tickets:  { open: tickets.filter((t: any) => t.status === 'Open').length, critical: tickets.filter((t: any) => t.priority === 'Critical').length },
      drfs:     { pending: drfs.filter((d: any) => d.status === 'Pending').length, approved: drfs.filter((d: any) => d.status === 'Approved').length, rejected: drfs.filter((d: any) => d.status === 'Rejected').length, expiringSoon: drfs.filter((d: any) => d.status === 'Approved' && d.expiryDate && new Date(d.expiryDate).getTime() - Date.now() < 30 * 86400000).length, totalThisMonth: 0 },
      installations: { total: installs.length, completed: installs.filter((i: any) => i.status === 'Completed').length, inProgress: installs.filter((i: any) => i.status === 'In Progress').length, scheduled: installs.filter((i: any) => i.status === 'Scheduled').length, pending: installs.filter((i: any) => ['Scheduled', 'In Progress'].includes(i.status)).length },
      installsByEngineer: Object.values(engineerMap).sort((a: any, b: any) => b.total - a.total),
      drfBySalesPerson: [],
      rejectionReasons: [],
      recentLeads: leads.slice(0, 5),
      revenueByMonth: Object.entries(revenueByMonth).map(([month, revenue]) => ({ month, revenue })),
    };
  },

  getSalesStats: async (userId: string) => {
    await delay(300);
    const myLeads    = orgLeads().filter((l: any) => !l.isArchived && l.assignedTo?._id === userId);
    const myLeadIds  = myLeads.map((l: any) => l._id);
    const myAccounts = orgAccounts().filter((a: any) => a.assignedSales?._id === userId);
    const myQuotes   = orgQuotations().filter((q: any) => myLeadIds.includes(q.leadId._id));
    const myPOs      = orgPOs().filter((p: any) => myLeadIds.includes(p.leadId._id));
    const myDRFs     = orgDRFs().filter((d: any) => myLeadIds.includes(d.leadId._id));

    const STAGES = ['New','OEM Submitted','OEM Approved','Quotation Sent','Negotiation','PO Received','Converted','Lost'];
    const pipeline = STAGES.map((stage) => ({ stage, count: myLeads.filter((l: any) => l.stage === stage).length }));

    const funnel = [
      { stage: 'Leads', count: myLeads.length },
      { stage: 'DRFs', count: myDRFs.length },
      { stage: 'Quotations', count: myQuotes.length },
      { stage: 'POs', count: myPOs.length },
      { stage: 'Converted', count: myLeads.filter((l: any) => l.stage === 'Converted').length },
    ];

    // Org-wide sales leaderboard
    const salesLeaderboard = orgUsers().filter((u: any) => u.role === 'sales' && u.isActive).map((sp: any) => {
      const spLeadIds = orgLeads().filter((l: any) => !l.isArchived && l.assignedTo?._id === sp._id).map((l: any) => l._id);
      const spPOs = orgPOs().filter((p: any) => spLeadIds.includes(p.leadId._id));
      const spDRFs = orgDRFs().filter((d: any) => spLeadIds.includes(d.leadId._id));
      const converted = orgLeads().filter((l: any) => l.assignedTo?._id === sp._id && l.stage === 'Converted').length;
      return {
        userId: sp._id, name: sp.name,
        revenue: spPOs.reduce((s: number, p: any) => s + p.amount, 0),
        leads: spLeadIds.length, converted,
        drfApproved: spDRFs.filter((d: any) => d.status === 'Approved').length,
        conversionRate: spLeadIds.length > 0 ? Math.round((converted / spLeadIds.length) * 100) : 0,
      };
    }).sort((a: any, b: any) => b.revenue - a.revenue);

    const nowMs = Date.now();
    const alerts: any[] = [];
    myDRFs.filter((d: any) => d.status === 'Approved' && d.expiryDate && new Date(d.expiryDate).getTime() - nowMs < 14 * 86400000 && new Date(d.expiryDate).getTime() > nowMs)
      .forEach((d: any) => alerts.push({ type: 'warning', message: `DRF ${d.drfNumber} for ${d.leadId.companyName} expires in ${Math.ceil((new Date(d.expiryDate).getTime() - nowMs) / 86400000)} days`, entityId: d._id, entityType: 'drf' }));
    myLeads.filter((l: any) => !['Converted','Lost'].includes(l.stage) && nowMs - new Date(l.updatedAt).getTime() > 30 * 86400000)
      .forEach((l: any) => alerts.push({ type: 'warning', message: `"${l.companyName}" has no activity for 30+ days`, entityId: l._id, entityType: 'lead' }));
    myQuotes.filter((q: any) => q.status === 'Sent' && q.validUntil && new Date(q.validUntil).getTime() < nowMs)
      .forEach((q: any) => alerts.push({ type: 'danger', message: `Quotation ${q.quotationNumber} for ${q.leadId.companyName} has expired`, entityId: q._id, entityType: 'quotation' }));
    myDRFs.filter((d: any) => d.status === 'Pending' && nowMs - new Date(d.sentDate).getTime() > 7 * 86400000)
      .forEach((d: any) => alerts.push({ type: 'warning', message: `DRF ${d.drfNumber} for ${d.leadId.companyName} pending for 7+ days`, entityId: d._id, entityType: 'drf' }));

    return {
      myLeads: {
        total: myLeads.length,
        new: myLeads.filter((l: any) => l.status === 'New').length,
        contacted: myLeads.filter((l: any) => l.status === 'Contacted').length,
        qualified: myLeads.filter((l: any) => l.status === 'Qualified').length,
        converted: myLeads.filter((l: any) => l.stage === 'Converted').length,
        lost: myLeads.filter((l: any) => l.stage === 'Lost').length,
      },
      accounts: { total: myAccounts.length, active: myAccounts.filter((a: any) => a.status === 'Active').length },
      quotations: { total: myQuotes.length, totalValue: myQuotes.reduce((s: number, q: any) => s + (q.total || 0), 0), accepted: myQuotes.filter((q: any) => q.status === 'Accepted').length },
      purchaseOrders: { total: myPOs.length, totalValue: myPOs.reduce((s: number, p: any) => s + (p.amount || 0), 0) },
      pipeline, funnel, salesLeaderboard, alerts,
      myRank: salesLeaderboard.findIndex((e: any) => e.userId === userId) + 1,
      leadsInNegotiation: myLeads.filter((l: any) => l.stage === 'Negotiation').length,
      drfPending: myDRFs.filter((d: any) => d.status === 'Pending').length,
      conversionRate: myLeads.length > 0 ? Math.round((myLeads.filter((l: any) => l.stage === 'Converted').length / myLeads.length) * 100) : 0,
      drfApprovalRate: myDRFs.length > 0 ? Math.round((myDRFs.filter((d: any) => d.status === 'Approved').length / myDRFs.length) * 100) : 0,
      recentLeads: myLeads.slice(-5).reverse(),
    };
  },

  getEngineerStats: async (userId: string) => {
    await delay(300);
    const myVisits   = orgVisits().filter((v: any) => v.engineerId?._id === userId || v.engineerId === userId);
    const myInstalls = orgInstalls().filter((i: any) => i.engineer?._id === userId || i.engineer === userId);
    const myTickets  = orgTickets().filter((t: any) => (t.assignedTo?._id === userId || t.assignedTo === userId) && t.status !== 'Resolved');
    const myAccounts = orgAccounts();

    return {
      accounts: {
        total:  myAccounts.length,
        active: myAccounts.filter((a: any) => a.status === 'Active').length,
      },
      tickets: {
        open:     myTickets.filter((t: any) => t.status === 'Open').length,
        critical: myTickets.filter((t: any) => t.priority === 'Critical').length,
        resolved: orgTickets().filter((t: any) => (t.assignedTo?._id === userId || t.assignedTo === userId) && t.status === 'Resolved').length,
      },
      installations: {
        scheduled:  myInstalls.filter((i: any) => i.status === 'Scheduled').length,
        inProgress: myInstalls.filter((i: any) => i.status === 'In Progress').length,
        completed:  myInstalls.filter((i: any) => i.status === 'Completed').length,
      },
      visits: {
        pending: myVisits.filter((v: any) => v.hrStatus === 'Pending').length,
        total:   myVisits.length,
      },
      recentInstallations: myInstalls.slice(-5).reverse(),
      recentTickets:       myTickets.slice(-5).reverse(),
      recentVisits:        myVisits.slice(-5).reverse(),
    };
  },

  getHRStats: async () => {
    await delay(300);
    const invoices      = orgInvoices();
    const visits        = orgVisits();
    const salaries      = orgSalaries();

    return {
      invoices: {
        totalRevenue: invoices.filter((i: any) => i.status === 'Paid').reduce((s: number, i: any) => s + i.amount, 0),
        total:        invoices.length,
        unpaid:       invoices.filter((i: any) => i.status === 'Unpaid').length,
        overdue:      invoices.filter((i: any) => i.status === 'Overdue').length,
        partialPaid:  invoices.filter((i: any) => i.status === 'Partially Paid').length,
      },
      visits: {
        pending: visits.filter((v: any) => v.hrStatus === 'Pending').length,
        total:   visits.length,
      },
      salaries: {
        pending:   salaries.filter((s: any) => s.status === 'Calculated').length,
        paid:      salaries.filter((s: any) => s.status === 'Paid').length,
        totalPaid: salaries.filter((s: any) => s.status === 'Paid').reduce((sum: number, s: any) => sum + (s.finalSalary || 0), 0),
      },
      allInvoices:      invoices.slice(-10).reverse(),
      pendingVisitsList: visits.filter((v: any) => v.hrStatus === 'Pending').slice(0, 10),
      recentSalaries:   salaries.slice(-10).reverse(),
    };
  },
};

// ─── CONTACTS MOCK ───────────────────────────────────────────────────────────
export const mockContacts = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...orgContacts()];
    if (params.contactType) items = items.filter((c: any) => c.contactType === params.contactType);
    if (params.customerResponsibility) items = items.filter((c: any) => c.customerResponsibility === params.customerResponsibility);
    if (params.search) {
      const s = (params.search as string).toLowerCase();
      items = items.filter((c: any) =>
        c.name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        (c.companyName || '').toLowerCase().includes(s)
      );
    }
    items.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return mockPaginate(items, Number(params.page) || 1, Number(params.limit) || 15);
  },
  getById: async (id: string) => {
    await delay();
    return orgContacts().find((c: any) => c._id === id) || null;
  },
  getByAccount: async (accountId: string) => {
    await delay();
    return orgContacts().filter((c: any) =>
      c.linkedAccountId?._id === accountId || c.linkedAccountId === accountId
    );
  },
  create: async (data: Record<string, unknown>, currentUser: any) => {
    await delay(400);
    const account = data.linkedAccountId
      ? orgAccounts().find((a: any) => a._id === data.linkedAccountId)
      : null;
    const contact = {
      _id: 'c' + uid(),
      organizationId: _currentOrgId,
      ...data,
      linkedAccountId: account
        ? { _id: account._id, accountName: account.accountName }
        : undefined,
      createdBy: {
        _id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
      },
      createdAt: now(),
      updatedAt: now(),
    };
    CONTACTS = [contact, ...CONTACTS];
    return contact;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    const account = data.linkedAccountId
      ? orgAccounts().find((a: any) => a._id === data.linkedAccountId)
      : undefined;
    const patch: any = { ...data, updatedAt: now() };
    if (account) patch.linkedAccountId = { _id: account._id, accountName: account.accountName };
    CONTACTS = CONTACTS.map((c: any) =>
      c._id === id && c.organizationId === _currentOrgId ? { ...c, ...patch } : c
    );
    return orgContacts().find((c: any) => c._id === id)!;
  },
  delete: async (id: string) => {
    await delay(300);
    CONTACTS = CONTACTS.filter(
      (c: any) => !(c._id === id && c.organizationId === _currentOrgId)
    );
    return { success: true };
  },
};

// ─── PO EXECUTION WORKFLOW MOCK ──────────────────────────────────────────────
const defaultStep1 = () => ({ oemNotified: false, distributorNotified: false, status: 'Pending' });
const defaultDocField = () => ({ status: 'Pending' });
const defaultStep2 = () => ({
  licenseForm:        { status: 'Pending' },
  startupForm:        { status: 'NA' },
  machineDetailsLink: { status: 'Pending' },
  priceClearanceInfo: { status: 'Pending' },
  paymentTerms:       { status: 'Pending' },
});
const defaultStep3 = () => ({ licenseFormSent: false, startupFormSent: false, machineDetailsLinkSent: false, status: 'Pending' });
const defaultStep4 = () => ({ status: 'Pending' });
const defaultStep5 = () => ({ formsShared: false, invoiceShared: false, status: 'Pending' });
const defaultStep6 = () => ({ licenseStatus: 'Pending' });
const defaultStep7 = () => ({ tdsExemptionAttached: false, emailSent: false, paymentStatus: 'Unpaid', status: 'Pending' });

const computeCurrentStep = (w: any): number => {
  if (w.step7.status === 'Paid' || w.step7.paymentStatus === 'Paid') return 7;
  if (w.step7.status !== 'Pending') return 7;
  if (w.step6.licenseStatus === 'Delivered') return 7;
  if (w.step6.licenseStatus !== 'Pending') return 6;
  if (w.step5.status === 'Sent') return 6;
  if (w.step4.status !== 'Pending') return 5;
  const s2 = w.step2;
  const docsReceived = ['licenseForm','machineDetailsLink','priceClearanceInfo','paymentTerms'].every((k: string) => s2[k].status === 'Received') &&
    (s2.startupForm.status === 'Received' || s2.startupForm.status === 'NA');
  if (docsReceived) return 4;
  if (w.step3.status !== 'Pending') return 3;
  if (w.step1.status === 'Sent') return 2;
  return 1;
};

export const mockPOExecution = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = [...orgPOWorkflows()];
    if (params.poId)    items = items.filter((w: any) => w.poId === params.poId);
    if (params.status)  items = items.filter((w: any) => w.overallStatus === params.status);
    if (params.search) {
      const s = (params.search as string).toLowerCase();
      items = items.filter((w: any) => (w.companyName || '').toLowerCase().includes(s) || (w.poNumber || '').toLowerCase().includes(s));
    }
    items.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { data: items, total: items.length };
  },
  getById: async (id: string) => {
    await delay();
    return orgPOWorkflows().find((w: any) => w._id === id) || null;
  },
  getByPO: async (poId: string) => {
    await delay();
    return orgPOWorkflows().find((w: any) => w.poId === poId) || null;
  },
  create: async (poId: string) => {
    await delay(400);
    const existing = orgPOWorkflows().find((w: any) => w.poId === poId);
    if (existing) return existing;
    const po = orgPOs().find((p: any) => p._id === poId);
    const lead = po ? orgLeads().find((l: any) => l._id === po.leadId._id) : null;
    const w = {
      _id: 'pex' + uid(),
      organizationId: _currentOrgId,
      poId,
      poNumber: po?.poNumber || '',
      accountId: null,
      leadId: lead?._id || null,
      companyName: po?.leadId?.companyName || lead?.companyName || '',
      currentStep: 1,
      overallStatus: 'In Progress',
      step1: defaultStep1(),
      step2: defaultStep2(),
      step3: defaultStep3(),
      step4: defaultStep4(),
      step5: defaultStep5(),
      step6: defaultStep6(),
      step7: defaultStep7(),
      createdAt: now(),
      updatedAt: now(),
    };
    PO_EXECUTION_WORKFLOWS = [w, ...PO_EXECUTION_WORKFLOWS];
    return w;
  },
  updateStep: async (id: string, stepKey: string, data: Record<string, unknown>) => {
    await delay(300);
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) => {
      if (w._id !== id || w.organizationId !== _currentOrgId) return w;
      const updated = { ...w, [stepKey]: { ...w[stepKey], ...data }, updatedAt: now() };
      updated.currentStep = computeCurrentStep(updated);
      const allDone = updated.step7.status === 'Paid' || updated.step7.paymentStatus === 'Paid';
      updated.overallStatus = allDone ? 'Completed' : 'In Progress';
      return updated;
    });
    return orgPOWorkflows().find((w: any) => w._id === id)!;
  },
  notifyOEM: async (id: string) => {
    await delay(600);
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) =>
      w._id === id && w.organizationId === _currentOrgId
        ? { ...w, step1: { ...w.step1, oemNotified: true, oemNotifiedAt: now(), status: w.step1.distributorNotified ? 'Sent' : w.step1.status }, updatedAt: now() }
        : w
    );
    const updated = orgPOWorkflows().find((w: any) => w._id === id)!;
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) => w._id === id ? { ...w, currentStep: computeCurrentStep(updated) } : w);
    return orgPOWorkflows().find((w: any) => w._id === id)!;
  },
  notifyDistributor: async (id: string) => {
    await delay(600);
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) =>
      w._id === id && w.organizationId === _currentOrgId
        ? { ...w, step1: { ...w.step1, distributorNotified: true, distributorNotifiedAt: now(), status: w.step1.oemNotified ? 'Sent' : w.step1.status }, updatedAt: now() }
        : w
    );
    const updated = orgPOWorkflows().find((w: any) => w._id === id)!;
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) => w._id === id ? { ...w, currentStep: computeCurrentStep(updated) } : w);
    return orgPOWorkflows().find((w: any) => w._id === id)!;
  },
  updateDocField: async (id: string, field: string, data: Record<string, unknown>) => {
    await delay(300);
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) => {
      if (w._id !== id || w.organizationId !== _currentOrgId) return w;
      const step2 = { ...w.step2, [field]: { ...w.step2[field], ...data } };
      const updated = { ...w, step2, updatedAt: now() };
      updated.currentStep = computeCurrentStep(updated);
      return updated;
    });
    return orgPOWorkflows().find((w: any) => w._id === id)!;
  },
  sendCustomerForms: async (id: string) => {
    await delay(600);
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) => {
      if (w._id !== id || w.organizationId !== _currentOrgId) return w;
      const step3 = { ...w.step3, licenseFormSent: true, startupFormSent: true, machineDetailsLinkSent: true, sentAt: now(), status: 'Sent' };
      const updated = { ...w, step3, updatedAt: now() };
      updated.currentStep = computeCurrentStep(updated);
      return updated;
    });
    return orgPOWorkflows().find((w: any) => w._id === id)!;
  },
  markCustomerFormsCompleted: async (id: string) => {
    await delay(300);
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) => {
      if (w._id !== id || w.organizationId !== _currentOrgId) return w;
      const step3 = { ...w.step3, status: 'Completed', completedAt: now() };
      const updated = { ...w, step3, updatedAt: now() };
      updated.currentStep = computeCurrentStep(updated);
      return updated;
    });
    return orgPOWorkflows().find((w: any) => w._id === id)!;
  },
  generateDistributorInvoice: async (id: string, data: Record<string, unknown>) => {
    await delay(600);
    const wf = orgPOWorkflows().find((w: any) => w._id === id);
    if (!wf) throw new Error('Workflow not found');
    const invNum = `DINV-${new Date().getFullYear()}-${String(orgPOWorkflows().length).padStart(3, '0')}`;
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) => {
      if (w._id !== id || w.organizationId !== _currentOrgId) return w;
      const step4 = { ...w.step4, invoiceNumber: invNum, amount: Number(data.amount), paymentTerms: String(data.paymentTerms || ''), customerDetails: String(data.customerDetails || ''), pdfPath: `dist_invoice_${invNum}.pdf`, generatedAt: now(), status: 'Generated' };
      const updated = { ...w, step4, updatedAt: now() };
      updated.currentStep = computeCurrentStep(updated);
      return updated;
    });
    return orgPOWorkflows().find((w: any) => w._id === id)!;
  },
  shareBackToDistributor: async (id: string) => {
    await delay(600);
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) => {
      if (w._id !== id || w.organizationId !== _currentOrgId) return w;
      const step5 = { formsShared: true, invoiceShared: true, sharedAt: now(), status: 'Sent' };
      const updated = { ...w, step5, updatedAt: now() };
      updated.currentStep = computeCurrentStep(updated);
      return updated;
    });
    return orgPOWorkflows().find((w: any) => w._id === id)!;
  },
  updateLicenseStatus: async (id: string, data: Record<string, unknown>) => {
    await delay(400);
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) => {
      if (w._id !== id || w.organizationId !== _currentOrgId) return w;
      const step6 = { ...w.step6, ...data };
      const updated = { ...w, step6, updatedAt: now() };
      updated.currentStep = computeCurrentStep(updated);
      // When license is delivered, convert lead to customer (set stage = Converted)
      if (data.licenseStatus === 'Delivered') {
        const po = orgPOs().find((p: any) => p._id === updated.poId);
        if (po) LEADS = LEADS.map((l: any) => l._id === po.leadId._id ? { ...l, stage: 'Converted', updatedAt: now() } : l);
      }
      return updated;
    });
    return orgPOWorkflows().find((w: any) => w._id === id)!;
  },
  generateCustomerInvoice: async (id: string, data: Record<string, unknown>) => {
    await delay(600);
    const wf = orgPOWorkflows().find((w: any) => w._id === id);
    if (!wf) throw new Error('Workflow not found');
    const invNum = `CINV-${new Date().getFullYear()}-${String(orgPOWorkflows().length).padStart(3, '0')}`;
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) => {
      if (w._id !== id || w.organizationId !== _currentOrgId) return w;
      const step7 = { ...w.step7, invoiceNumber: invNum, amount: Number(data.amount), tdsExemptionAttached: Boolean(data.tdsExemptionAttached), status: 'Generated', generatedAt: now() };
      const updated = { ...w, step7, updatedAt: now() };
      updated.currentStep = computeCurrentStep(updated);
      return updated;
    });
    return orgPOWorkflows().find((w: any) => w._id === id)!;
  },
  sendCustomerInvoice: async (id: string) => {
    await delay(600);
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) => {
      if (w._id !== id || w.organizationId !== _currentOrgId) return w;
      const step7 = { ...w.step7, emailSent: true, sentAt: now(), status: 'Sent' };
      const updated = { ...w, step7, updatedAt: now() };
      updated.currentStep = computeCurrentStep(updated);
      return updated;
    });
    return orgPOWorkflows().find((w: any) => w._id === id)!;
  },
  markCustomerPaid: async (id: string) => {
    await delay(300);
    PO_EXECUTION_WORKFLOWS = PO_EXECUTION_WORKFLOWS.map((w: any) => {
      if (w._id !== id || w.organizationId !== _currentOrgId) return w;
      const step7 = { ...w.step7, paymentStatus: 'Paid', status: 'Paid' };
      const updated = { ...w, step7, overallStatus: 'Completed', updatedAt: now() };
      updated.currentStep = 7;
      return updated;
    });
    return orgPOWorkflows().find((w: any) => w._id === id)!;
  },
};

// ─── TIMESHEETS MOCK ─────────────────────────────────────────────────────────
export const mockTimesheets = {
  getAll: async (params: Record<string, unknown> = {}) => {
    await delay();
    let items = orgTimesheets();
    if (params.userId)  items = items.filter((t: any) => t.userId === params.userId);
    if (params.month)   items = items.filter((t: any) => new Date(t.date).getMonth() + 1 === Number(params.month));
    if (params.year)    items = items.filter((t: any) => new Date(t.date).getFullYear() === Number(params.year));
    if (params.status)  items = items.filter((t: any) => t.status === params.status);
    items = [...items].sort((a: any, b: any) => b.date.localeCompare(a.date));
    return mockPaginate(items, Number(params.page) || 1, Number(params.limit) || 20);
  },
  create: async (data: Record<string, unknown>, user: any) => {
    await delay(300);
    const entry = {
      _id: 'ts' + uid(),
      organizationId: _currentOrgId,
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      status: 'Submitted',
      ...data,
      createdAt: now(),
      updatedAt: now(),
    };
    TIMESHEETS = [entry, ...TIMESHEETS];
    return entry;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    TIMESHEETS = TIMESHEETS.map((t: any) =>
      t._id === id && t.organizationId === _currentOrgId ? { ...t, ...data, updatedAt: now() } : t
    );
    return orgTimesheets().find((t: any) => t._id === id)!;
  },
  delete: async (id: string) => {
    await delay(200);
    TIMESHEETS = TIMESHEETS.filter((t: any) => !(t._id === id && t.organizationId === _currentOrgId));
  },
  approve: async (id: string) => {
    await delay(200);
    TIMESHEETS = TIMESHEETS.map((t: any) =>
      t._id === id && t.organizationId === _currentOrgId ? { ...t, status: 'Approved', updatedAt: now() } : t
    );
    return orgTimesheets().find((t: any) => t._id === id)!;
  },
  reject: async (id: string, reason: string) => {
    await delay(200);
    TIMESHEETS = TIMESHEETS.map((t: any) =>
      t._id === id && t.organizationId === _currentOrgId ? { ...t, status: 'Rejected', rejectionReason: reason, updatedAt: now() } : t
    );
    return orgTimesheets().find((t: any) => t._id === id)!;
  },
};
