import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus, Search, ToggleLeft, ToggleRight, KeyRound, Eye, EyeOff,
  Trash2, Mail, UserSquare2, User, Shield, FileText, Upload, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ExcelImportButton from '@/components/common/ExcelImportButton';
import { usersApi } from '@/api/users';
import { employeesApi } from '@/api/employees';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { formatDate } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import type { User as UserType, Role } from '@/types';

// Roles admin can create (only managers)
const ADMIN_CREATES: Role[] = ['manager'];
// Roles manager can create (all employees, not admin/manager)
const MANAGER_CREATES: Role[] = ['sales', 'engineer', 'hr', 'finance'];
// HR can create non-admin, non-manager employees
const HR_ROLES: Role[] = ['sales', 'engineer', 'hr', 'finance'];

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin', manager: 'Manager', sales: 'Sales', engineer: 'Engineer',
  hr: 'HR', finance: 'Finance', platform_admin: 'Platform Admin',
};
const ROLE_COLOR: Record<Role, string> = {
  admin:          'bg-violet-100  text-violet-800',
  manager:        'bg-purple-100  text-purple-800',
  sales:          'bg-blue-100    text-blue-800',
  engineer:       'bg-emerald-100 text-emerald-800',
  hr:             'bg-amber-100   text-amber-800',
  finance:        'bg-orange-100  text-orange-800',
  platform_admin: 'bg-rose-100    text-rose-800',
};

const ALL_MODULES = [
  { key: 'leads',         label: 'Leads & DRFs' },
  { key: 'quotations',    label: 'Quotations' },
  { key: 'purchases',     label: 'Purchase Orders' },
  { key: 'accounts',      label: 'Accounts' },
  { key: 'support',       label: 'Support Tickets' },
  { key: 'installations', label: 'Installations' },
  { key: 'invoices',      label: 'Invoices' },
  { key: 'payments',      label: 'Payments' },
  { key: 'salary',        label: 'Salary & Payroll' },
  { key: 'attendance',    label: 'Attendance' },
  { key: 'leaves',        label: 'Leave Management' },
  { key: 'visits',        label: 'Visits & Claims' },
  { key: 'contacts',      label: 'Contacts' },
  { key: 'timesheet',     label: 'Timesheet' },
];

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  manager:  ALL_MODULES.map(m => m.key),
  sales:    ['leads', 'quotations', 'purchases', 'accounts', 'contacts', 'timesheet', 'attendance', 'leaves'],
  engineer: ['accounts', 'support', 'installations', 'visits', 'contacts', 'timesheet', 'attendance', 'leaves'],
  hr:       ['salary', 'attendance', 'leaves', 'visits', 'contacts', 'timesheet'],
  finance:  ['invoices', 'payments', 'accounts', 'contacts', 'timesheet'],
  admin:    ALL_MODULES.map(m => m.key),
};

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const DOC_LABELS = [
  'Aadhar Card', 'PAN Card', 'Resume / CV', 'Offer Letter',
  'Appointment Letter', 'Experience Certificate', 'Education Certificate',
  'Bank Account Details', 'Passport', 'Other',
];

type CreateForm = {
  // Basic
  name: string; email: string; role: Role;
  department: string; phone: string; baseSalary: string;
  joiningDate: string;
  // Personal
  bloodGroup: string; dateOfBirth: string; gender: string;
  address: string; emergencyContact: string; emergencyPhone: string;
  aadharNumber: string; panNumber: string;
  bankAccount: string; ifscCode: string;
  // Access
  permissions: string[];
};

const makeEmptyForm = (defaultRole: Role): CreateForm => ({
  name: '', email: '', role: defaultRole,
  department: '', phone: '', baseSalary: '', joiningDate: '',
  bloodGroup: '', dateOfBirth: '', gender: '',
  address: '', emergencyContact: '', emergencyPhone: '',
  aadharNumber: '', panNumber: '', bankAccount: '', ifscCode: '',
  permissions: DEFAULT_PERMISSIONS[defaultRole] ?? [],
});

type Tab = 'basic' | 'personal' | 'documents' | 'access';

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin   = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager';

  // Which roles can this user create?
  const CREATABLE_ROLES: Role[] = isAdmin ? ADMIN_CREATES : isManager ? MANAGER_CREATES : HR_ROLES;
  const defaultCreateRole: Role = isAdmin ? 'manager' : 'sales';

  // Filter roles shown in the role dropdown when viewing the user list
  const FILTER_ROLES: Role[] = isAdmin
    ? ['manager']
    : isManager
    ? MANAGER_CREATES
    : HR_ROLES;

  const [users, setUsers]   = useState<UserType[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab]   = useState<Tab>('basic');
  const [form, setForm]             = useState<CreateForm>(() => makeEmptyForm(isAdmin ? 'manager' : 'sales'));
  const [saving, setSaving]         = useState(false);

  // Documents inside create modal
  const [pendingDocs, setPendingDocs] = useState<{ label: string; file: File }[]>([]);
  const [docLabel, setDocLabel]       = useState('Aadhar Card');
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset password
  const [showReset, setShowReset]     = useState(false);
  const [selected, setSelected]       = useState<UserType | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPwd, setShowResetPwd] = useState(false);

  // Confirm dialogs
  const [toggleTarget, setToggleTarget] = useState<UserType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search)     params.search = search;
      if (roleFilter) params.role   = roleFilter;
      const res = await usersApi.getAll(params);
      setUsers(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch { setUsers([]); setTotal(0); }
    finally { setLoading(false); }
  }, [page, search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const f = (k: keyof CreateForm, v: string) => setForm(prev => ({
    ...prev, [k]: v,
    ...(k === 'role' ? { permissions: DEFAULT_PERMISSIONS[v] ?? [] } : {}),
  }));

  const togglePerm = (key: string) => setForm(prev => ({
    ...prev,
    permissions: prev.permissions.includes(key)
      ? prev.permissions.filter(p => p !== key)
      : [...prev.permissions, key],
  }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await usersApi.create({
        ...form,
        baseSalary: form.baseSalary ? Number(form.baseSalary) : 0,
      });
      // upload pending docs
      for (const d of pendingDocs) {
        try { await employeesApi.uploadDocument(created._id, d.file, d.label); } catch {}
      }
      setShowCreate(false);
      setForm(makeEmptyForm(defaultCreateRole));
      setPendingDocs([]);
      setActiveTab('basic');
      load();
      // If email failed, notify admin to inform the user manually
      if (created.emailSent === false) {
        alert(
          `✅ User "${created.name}" created successfully.\n\n` +
          `⚠️ Welcome email could not be sent (your email provider may not support SMTP).\n\n` +
          `Please inform ${created.email} manually:\n` +
          `→ Go to: ${window.location.origin}/login\n` +
          `→ Enter their email address\n` +
          `→ Use their own email account password to login`
        );
      }
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      alert(msg || 'Failed to create user');
    } finally { setSaving(false); }
  };

  const handleToggle = async () => {
    if (!toggleTarget) return;
    const { isActive } = await usersApi.toggleStatus(toggleTarget._id);
    setUsers(prev => prev.map(u => u._id === toggleTarget._id ? { ...u, isActive } : u));
    setToggleTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await usersApi.delete(deleteTarget._id);
    setUsers(prev => prev.filter(u => u._id !== deleteTarget._id));
    setTotal(prev => prev - 1);
    setDeleteTarget(null);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await usersApi.resetPassword(selected._id, newPassword);
      setShowReset(false); setNewPassword('');
    } finally { setSaving(false); }
  };

  const addPendingDoc = (file: File) => {
    setPendingDocs(prev => [...prev, { label: docLabel, file }]);
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'basic',     label: 'Basic Info',     icon: User },
    { id: 'personal',  label: 'Personal',        icon: FileText },
    { id: 'documents', label: 'Documents',        icon: Upload },
    { id: 'access',    label: 'Module Access',    icon: Shield },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {isAdmin && (
        <div className="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-sm text-violet-700">
          <Shield size={15} className="mt-0.5 flex-shrink-0" />
          <span>As admin, you create <strong>Managers</strong> and assign their module access. Managers then create and manage all other employees.</span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-header">{isAdmin ? 'Managers & Access' : 'Users & Access'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? `${total} manager${total !== 1 ? 's' : ''} in your organization` : `${total} employees in your organization`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isAdmin && (
            <ExcelImportButton
              entityName="Users"
              columnHint="name, email, role (sales/engineer/hr/finance), department, phone, baseSalary"
              onImport={async (rows) => {
                let imported = 0;
                for (const row of rows) {
                  const name = row.name || row.Name || '';
                  const email = row.email || row.Email || '';
                  if (!name || !email) continue;
                  const role = (CREATABLE_ROLES.includes(row.role as Role) ? row.role : defaultCreateRole) as Role;
                  try {
                    await usersApi.create({ name, email, role, department: row.department || '', phone: row.phone || '', baseSalary: parseFloat(row.baseSalary || '0') || 0, password: 'Telled@123', permissions: DEFAULT_PERMISSIONS[role] ?? [] });
                    imported++;
                  } catch {}
                }
                load();
                return { imported };
              }}
            />
          )}
          <button onClick={() => { setForm(makeEmptyForm(defaultCreateRole)); setActiveTab('basic'); setPendingDocs([]); setShowCreate(true); }}
            className="btn-primary flex items-center gap-2">
            <Plus size={16} /> {isAdmin ? 'Add Manager' : 'Add Employee'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search users…" className="input-field pl-9" />
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Roles</option>
          {FILTER_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>

      {/* Desktop Table */}
      <div className="glass-card !p-0 overflow-hidden hidden md:block">
        {loading ? <LoadingSpinner className="h-48" /> : users.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Department</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">Access</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-medium">{u.name}</td>
                    <td className="table-cell text-gray-500">{u.email}</td>
                    <td className="table-cell">
                      <span className={`badge capitalize ${ROLE_COLOR[u.role as Role] || 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABEL[u.role as Role] || u.role}
                      </span>
                    </td>
                    <td className="table-cell text-gray-400">{u.department || '—'}</td>
                    <td className="table-cell text-gray-400">{u.phone || '—'}</td>
                    <td className="table-cell">
                      <span className="text-xs text-gray-400">
                        {u.permissions?.length ?? DEFAULT_PERMISSIONS[u.role]?.length ?? 0} modules
                      </span>
                    </td>
                    <td className="table-cell"><StatusBadge status={u.isActive ? 'Active' : 'Inactive'} /></td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/employees/${u._id}`)} title="View Profile"
                          className="p-1 text-gray-400 hover:text-violet-600">
                          <UserSquare2 size={15} />
                        </button>
                        <button onClick={() => setToggleTarget(u)} title={u.isActive ? 'Deactivate' : 'Activate'}
                          className="p-1 text-gray-400 hover:text-violet-600">
                          {u.isActive ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                        </button>
                        <button onClick={() => { setSelected(u); setShowReset(true); }} title="Reset Password"
                          className="p-1 text-gray-400 hover:text-violet-600">
                          <KeyRound size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(u)} title="Delete User"
                          className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 15 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 15)}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
              <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      {loading ? <LoadingSpinner className="h-48 md:hidden" /> : users.length === 0 ? (
        <div className="md:hidden text-center text-gray-400 py-16 glass-card">No users found</div>
      ) : (
        <div className="md:hidden space-y-3">
          {users.map(u => (
            <div key={u._id} className="glass-card !p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{u.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{u.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`badge text-xs capitalize ${ROLE_COLOR[u.role as Role] || 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABEL[u.role as Role] || u.role}
                  </span>
                  <StatusBadge status={u.isActive ? 'Active' : 'Inactive'} />
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                {u.department && <p><span className="text-gray-400">Dept:</span> {u.department}</p>}
                {u.phone && <p><span className="text-gray-400">Phone:</span> {u.phone}</p>}
                <p><span className="text-gray-400">Access:</span> {u.permissions?.length ?? DEFAULT_PERMISSIONS[u.role]?.length ?? 0} modules</p>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <button onClick={() => navigate(`/employees/${u._id}`)} title="View Profile" className="p-1.5 text-gray-400 hover:text-violet-600"><UserSquare2 size={15} /></button>
                <button onClick={() => setToggleTarget(u)} title={u.isActive ? 'Deactivate' : 'Activate'} className="p-1.5 text-gray-400 hover:text-violet-600">
                  {u.isActive ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                </button>
                <button onClick={() => { setSelected(u); setShowReset(true); }} title="Reset Password" className="p-1.5 text-gray-400 hover:text-violet-600"><KeyRound size={15} /></button>
                <button onClick={() => setDeleteTarget(u)} title="Delete" className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
          {total > 15 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 15)}</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
                <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add User Modal ── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={isAdmin ? 'Add New Manager' : 'Add New Employee'} size="lg">
        <form onSubmit={handleCreate}>
          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
            {TABS.map(tab => (
              <button key={tab.id} type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                <tab.icon size={13} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ── Tab: Basic Info ── */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-lg px-4 py-3 text-sm text-violet-700">
                <Mail size={15} className="mt-0.5 flex-shrink-0" />
                <span>An invite email will be sent to the user to set their password.</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input required className="input-field" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="label">Work Email *</label>
                  <input required type="email" className="input-field" value={form.email} onChange={e => f('email', e.target.value)} placeholder="jane@company.com" />
                </div>
                <div>
                  <label className="label">Role *</label>
                  {isAdmin ? (
                    <input readOnly className="input-field bg-gray-50 text-gray-500 cursor-not-allowed" value="Manager" />
                  ) : (
                    <select required className="input-field" value={form.role} onChange={e => f('role', e.target.value as Role)}>
                      {CREATABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="label">Department</label>
                  <input className="input-field" value={form.department} onChange={e => f('department', e.target.value)} placeholder="e.g. Sales, Engineering…" />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input-field" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="10-digit number" />
                </div>
                <div>
                  <label className="label">Base Salary (₹)</label>
                  <input type="number" min={0} className="input-field" value={form.baseSalary} onChange={e => f('baseSalary', e.target.value)} placeholder="e.g. 50000" />
                </div>
                <div>
                  <label className="label">Joining Date</label>
                  <input type="date" className="input-field" value={form.joiningDate} onChange={e => f('joiningDate', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Personal Details ── */}
          {activeTab === 'personal' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date of Birth</label>
                  <input type="date" className="input-field" value={form.dateOfBirth} onChange={e => f('dateOfBirth', e.target.value)} />
                </div>
                <div>
                  <label className="label">Gender</label>
                  <select className="input-field" value={form.gender} onChange={e => f('gender', e.target.value)}>
                    <option value="">Select gender</option>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Blood Group</label>
                  <select className="input-field" value={form.bloodGroup} onChange={e => f('bloodGroup', e.target.value)}>
                    <option value="">Select blood group</option>
                    {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Emergency Contact Name</label>
                  <input className="input-field" value={form.emergencyContact} onChange={e => f('emergencyContact', e.target.value)} placeholder="Contact person name" />
                </div>
                <div>
                  <label className="label">Emergency Phone</label>
                  <input className="input-field" value={form.emergencyPhone} onChange={e => f('emergencyPhone', e.target.value)} placeholder="Emergency number" />
                </div>
                <div>
                  <label className="label">Aadhar Number</label>
                  <input className="input-field" value={form.aadharNumber} onChange={e => f('aadharNumber', e.target.value)} placeholder="XXXX XXXX XXXX" maxLength={14} />
                </div>
                <div>
                  <label className="label">PAN Number</label>
                  <input className="input-field" value={form.panNumber} onChange={e => f('panNumber', e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
                </div>
                <div>
                  <label className="label">Bank Account No.</label>
                  <input className="input-field" value={form.bankAccount} onChange={e => f('bankAccount', e.target.value)} placeholder="Account number" />
                </div>
                <div>
                  <label className="label">IFSC Code</label>
                  <input className="input-field" value={form.ifscCode} onChange={e => f('ifscCode', e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" maxLength={11} />
                </div>
              </div>
              <div>
                <label className="label">Residential Address</label>
                <textarea rows={2} className="input-field" value={form.address} onChange={e => f('address', e.target.value)} placeholder="Full residential address" />
              </div>
            </div>
          )}

          {/* ── Tab: Documents ── */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">Upload documents now or later from the employee profile.</p>
              <div className="flex gap-3">
                <select className="input-field flex-1" value={docLabel} onChange={e => setDocLabel(e.target.value)}>
                  {DOC_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <input ref={fileRef} type="file" className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { addPendingDoc(f); e.target.value = ''; } }} />
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="btn-secondary flex items-center gap-2 whitespace-nowrap">
                  <Upload size={14} /> Choose File
                </button>
              </div>

              {pendingDocs.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                  <Upload size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No documents added yet</p>
                  <p className="text-xs mt-1">Select a type above and choose a file</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingDocs.map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText size={15} className="text-violet-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{d.label}</p>
                          <p className="text-xs text-gray-400 truncate">{d.file.name}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setPendingDocs(prev => prev.filter((_, j) => j !== i))}
                        className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Module Access ── */}
          {activeTab === 'access' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Pre-filled based on role. Toggle to customise access.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm(p => ({ ...p, permissions: ALL_MODULES.map(m => m.key) }))}
                    className="text-xs text-violet-600 hover:underline">All</button>
                  <button type="button" onClick={() => setForm(p => ({ ...p, permissions: [] }))}
                    className="text-xs text-gray-400 hover:underline">None</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_MODULES.map(mod => {
                  const active = form.permissions.includes(mod.key);
                  return (
                    <button key={mod.key} type="button" onClick={() => togglePerm(mod.key)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        active
                          ? 'bg-violet-50 border-violet-300 text-violet-800'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                        active ? 'bg-violet-600 border-violet-600' : 'border-gray-300 bg-white'
                      }`}>
                        {active && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      {mod.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            <div className="flex gap-1">
              {TABS.map((tab, i) => (
                <div key={tab.id} className={`w-2 h-2 rounded-full transition-colors ${activeTab === tab.id ? 'bg-violet-600' : 'bg-gray-200'}`} />
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              {activeTab !== 'access' ? (
                <button type="button"
                  onClick={() => {
                    const order: Tab[] = ['basic', 'personal', 'documents', 'access'];
                    const next = order[order.indexOf(activeTab) + 1];
                    if (next) setActiveTab(next);
                  }}
                  className="btn-primary">Next →</button>
              ) : (
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Creating…' : 'Create Employee'}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={showReset} onClose={() => setShowReset(false)} title={`Reset Password — ${selected?.name}`} size="sm">
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="label">New Password *</label>
            <div className="relative">
              <input required type={showResetPwd ? 'text' : 'password'} className="input-field pr-10" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} minLength={8} placeholder="Min 8 characters" />
              <button type="button" onClick={() => setShowResetPwd(v => !v)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                {showResetPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowReset(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Resetting…' : 'Reset Password'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={handleToggle}
        title={toggleTarget?.isActive ? 'Deactivate User' : 'Activate User'}
        message={`Are you sure you want to ${toggleTarget?.isActive ? 'deactivate' : 'activate'} ${toggleTarget?.name}?`}
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'} danger={toggleTarget?.isActive} />

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete User"
        message={`Permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete" danger />
    </div>
  );
}
