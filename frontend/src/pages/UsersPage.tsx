import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Search, ToggleLeft, ToggleRight, KeyRound, Eye, EyeOff,
  Trash2, UserSquare2, Shield, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usersApi } from '@/api/users';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useAuthStore } from '@/store/authStore';
import type { User as UserType } from '@/types';

const PRESET_ROLES = ['manager', 'sales', 'engineer', 'hr', 'finance', 'operations'];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const ROLE_COLOR: Record<string, string> = {
  admin:          'bg-violet-100  text-violet-800',
  manager:        'bg-purple-100  text-purple-800',
  sales:          'bg-blue-100    text-blue-800',
  engineer:       'bg-emerald-100 text-emerald-800',
  hr:             'bg-amber-100   text-amber-800',
  finance:        'bg-orange-100  text-orange-800',
  operations:     'bg-teal-100    text-teal-800',
  platform_admin: 'bg-rose-100    text-rose-800',
};

const ALL_MODULES = [
  { key: 'leads',         label: 'Leads & DRF Management' },
  { key: 'prospects',     label: 'Prospects' },
  { key: 'quotations',    label: 'Quotations' },
  { key: 'purchases',     label: 'Purchase Orders' },
  { key: 'accounts',      label: 'Accounts' },
  { key: 'installations', label: 'Installations' },
  { key: 'support',       label: 'Support' },
  { key: 'training',      label: 'Training' },
  { key: 'visits',        label: 'Visits & Claims' },
  { key: 'invoices',      label: 'Invoices' },
  { key: 'payments',      label: 'Payments' },
  { key: 'salary',        label: 'Salary & Payroll' },
  { key: 'attendance',    label: 'Attendance' },
  { key: 'leaves',        label: 'Leave Management' },
  { key: 'timesheet',     label: 'Timesheet' },
  { key: 'contacts',      label: 'Contacts' },
];

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  manager:    ALL_MODULES.map(m => m.key),
  sales:      ['leads', 'prospects', 'quotations', 'purchases', 'accounts', 'contacts', 'timesheet', 'attendance', 'leaves'],
  engineer:   ['prospects', 'accounts', 'support', 'installations', 'training', 'visits', 'contacts', 'timesheet', 'attendance', 'leaves'],
  hr:         ['salary', 'attendance', 'leaves', 'visits', 'contacts', 'timesheet'],
  finance:    ['invoices', 'payments', 'accounts', 'contacts', 'timesheet'],
  operations: ['accounts', 'support', 'installations', 'visits', 'contacts', 'timesheet', 'attendance', 'leaves'],
  admin:      ALL_MODULES.map(m => m.key),
};

type CreateForm = {
  name: string;
  phone: string;
  email: string;
  role: string;
  customRole: string;
  useCustomRole: boolean;
  designation: string;
  status: 'active' | 'inactive';
  bloodGroup: string;
};

const emptyForm = (): CreateForm => ({
  name: '',
  phone: '',
  email: '',
  role: 'manager',
  customRole: '',
  useCustomRole: false,
  designation: '',
  status: 'inactive',
  bloodGroup: '',
});

// Checkbox tile used in both step-2 and grant-access modals
function ModuleTile({
  label, active, color = 'violet', onClick,
}: { label: string; active: boolean; color?: 'violet' | 'emerald'; onClick: () => void }) {
  const on  = color === 'emerald'
    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
    : 'bg-violet-50  border-violet-300  text-violet-800';
  const off = 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300';
  const box = color === 'emerald'
    ? 'bg-emerald-600 border-emerald-600'
    : 'bg-violet-600  border-violet-600';
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${active ? on : off}`}>
      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${active ? box : 'border-gray-300 bg-white'}`}>
        {active && (
          <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white">
            <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {label}
    </button>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin';

  const permCeiling: string[] = isAdmin
    ? ALL_MODULES.map(m => m.key)
    : (currentUser?.assignablePermissions ?? []);

  const canCreate = isAdmin || currentUser?.canCreateUsers === true;

  const [users, setUsers]   = useState<UserType[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Create wizard ──────────────────────────────────────────────
  const [showCreate, setShowCreate]   = useState(false);
  const [wizardStep, setWizardStep]   = useState<1 | 2>(1);
  const [form, setForm]               = useState<CreateForm>(emptyForm);
  const [wizardPerms, setWizardPerms] = useState<string[]>([]);
  const [wizardCanCreate, setWizardCanCreate] = useState(false);
  const [wizardAssignable, setWizardAssignable] = useState<string[]>([]);
  const [saving, setSaving]           = useState(false);

  // ── Reset password ─────────────────────────────────────────────
  const [showReset, setShowReset]       = useState(false);
  const [selected, setSelected]         = useState<UserType | null>(null);
  const [newPassword, setNewPassword]   = useState('');
  const [showResetPwd, setShowResetPwd] = useState(false);

  // ── Confirm dialogs ────────────────────────────────────────────
  const [toggleTarget, setToggleTarget] = useState<UserType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserType | null>(null);

  // ── Grant Access modal (for existing inactive users) ───────────
  const [grantTarget, setGrantTarget]         = useState<{ _id: string; name: string; email: string; role: string; isActive?: boolean } | null>(null);
  const [grantPerms, setGrantPerms]           = useState<string[]>([]);
  const [grantCanCreate, setGrantCanCreate]   = useState(false);
  const [grantAssignable, setGrantAssignable] = useState<string[]>([]);
  const [activating, setActivating]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      const res = await usersApi.getAll(params);
      setUsers(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch { setUsers([]); setTotal(0); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const effectiveRole = form.useCustomRole ? form.customRole.trim() : form.role;
  const setField = (k: keyof CreateForm, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  // Always show all modules — backend enforces the ceiling on save
  const availableModules = ALL_MODULES;

  // Step 1 → Step 2: seed default permissions then advance
  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveRole) { alert('Please enter a designation'); return; }
    const defaults = DEFAULT_PERMISSIONS[effectiveRole] ?? [];
    setWizardPerms(defaults);
    setWizardCanCreate(false);
    setWizardAssignable([]);
    setWizardStep(2);
  };

  // Final submit from step 2
  const handleCreate = async () => {
    const roleToSubmit = effectiveRole;
    if (!roleToSubmit) return;
    setSaving(true);
    try {
      const created = await usersApi.create({
        name:                  form.name,
        email:                 form.email,
        phone:                 form.phone,
        role:                  roleToSubmit,
        designation:           form.designation,
        bloodGroup:            form.bloodGroup || undefined,
        permissions:           wizardPerms,
        canCreateUsers:        wizardCanCreate,
        assignablePermissions: wizardAssignable,
      });

      // If status = active, auto-activate immediately
      if (form.status === 'active') {
        try {
          const result = await usersApi.activate(created._id || created.id, {
            permissions:           wizardPerms,
            canCreateUsers:        wizardCanCreate,
            assignablePermissions: wizardAssignable,
          });
          if (result?.emailSent === false) {
            alert(`✅ "${form.name}" created and activated.\n\n⚠️ Welcome email could not be sent. Please inform them manually:\n→ https://zaltixsoftsolutions.com/zieos/login`);
          }
        } catch {
          // activation failed silently — user still created; admin can activate manually
        }
      }

      setShowCreate(false);
      setForm(emptyForm());
      setWizardStep(1);
      load();
    } catch (err: unknown) {
      alert((err as any)?.response?.data?.message || 'Failed to create user');
    } finally { setSaving(false); }
  };

  const handleActivate = async () => {
    if (!grantTarget) return;
    setActivating(true);
    try {
      const wasActive = grantTarget.isActive;
      const result = await usersApi.activate(grantTarget._id, {
        permissions:           grantPerms,
        canCreateUsers:        grantCanCreate,
        assignablePermissions: grantAssignable,
      });
      setGrantTarget(null);
      load();
      if (!wasActive && result?.emailSent === false) {
        alert(`✅ "${grantTarget.name}" is now active.\n\n⚠️ Welcome email could not be sent. Please inform them manually:\n→ https://zaltixsoftsolutions.com/zieos/login`);
      }
    } catch (err: unknown) {
      alert((err as any)?.response?.data?.message || 'Failed to activate user');
    } finally { setActivating(false); }
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

  const openCreate = () => {
    setForm(emptyForm());
    setWizardStep(1);
    setWizardPerms([]);
    setWizardCanCreate(false);
    setWizardAssignable([]);
    setShowCreate(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {isAdmin && (
        <div className="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-sm text-violet-700">
          <Shield size={15} className="mt-0.5 flex-shrink-0" />
          <span>As admin, you can create users with any role, define their module access, and decide whether they can create sub-users.</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Users & Access</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} user{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canCreate && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search users…" className="input-field pl-9" />
        </div>
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
                  <th className="table-header">Access</th>
                  <th className="table-header">Can Create Users</th>
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
                      <span className={`badge capitalize ${ROLE_COLOR[u.role] || 'bg-gray-100 text-gray-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="table-cell text-gray-400">{u.department || '—'}</td>
                    <td className="table-cell">
                      <span className="text-xs text-gray-400">{u.permissions?.length ?? 0} modules</span>
                    </td>
                    <td className="table-cell">
                      {u.canCreateUsers
                        ? <span className="badge bg-green-100 text-green-700">Yes</span>
                        : <span className="text-xs text-gray-400">No</span>}
                    </td>
                    <td className="table-cell"><StatusBadge status={u.isActive ? 'Active' : 'Inactive'} /></td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/employees/${u._id}`)} title="View Profile"
                          className="p-1 text-gray-400 hover:text-violet-600"><UserSquare2 size={15} /></button>
                        {(isAdmin || currentUser?.canCreateUsers) && (
                          <button onClick={() => {
                            setGrantPerms(u.permissions ?? []);
                            setGrantCanCreate(u.canCreateUsers ?? false);
                            setGrantAssignable(u.assignablePermissions ?? []);
                            setGrantTarget({ _id: u._id, name: u.name, email: u.email, role: u.role, isActive: u.isActive });
                          }} title={u.isActive ? 'Edit Access' : 'Grant Access'}
                            className={`p-1 ${u.isActive ? 'text-violet-500 hover:text-violet-700' : 'text-amber-500 hover:text-amber-700'}`}>
                            <Shield size={15} />
                          </button>
                        )}
                        {(isAdmin || currentUser?.canCreateUsers) && (
                          <>
                            <button onClick={() => setToggleTarget(u)} title={u.isActive ? 'Deactivate' : 'Activate'}
                              className="p-1 text-gray-400 hover:text-violet-600">
                              {u.isActive ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                            </button>
                            <button onClick={() => { setSelected(u); setShowReset(true); }} title="Reset Password"
                              className="p-1 text-gray-400 hover:text-violet-600"><KeyRound size={15} /></button>
                            <button onClick={() => setDeleteTarget(u)} title="Delete User"
                              className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                          </>
                        )}
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
                  <span className={`badge text-xs capitalize ${ROLE_COLOR[u.role] || 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                  <StatusBadge status={u.isActive ? 'Active' : 'Inactive'} />
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                {u.department && <p><span className="text-gray-400">Dept:</span> {u.department}</p>}
                <p><span className="text-gray-400">Access:</span> {u.permissions?.length ?? 0} modules</p>
                <p><span className="text-gray-400">Can create users:</span> {u.canCreateUsers ? 'Yes' : 'No'}</p>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <button onClick={() => navigate(`/employees/${u._id}`)} className="p-1.5 text-gray-400 hover:text-violet-600"><UserSquare2 size={15} /></button>
                {(isAdmin || currentUser?.canCreateUsers) && (
                  <>
                    <button onClick={() => {
                      setGrantPerms(u.permissions ?? []);
                      setGrantCanCreate(u.canCreateUsers ?? false);
                      setGrantAssignable(u.assignablePermissions ?? []);
                      setGrantTarget({ _id: u._id, name: u.name, email: u.email, role: u.role, isActive: u.isActive });
                    }} className={`p-1.5 ${u.isActive ? 'text-violet-500 hover:text-violet-700' : 'text-amber-500 hover:text-amber-700'}`}>
                      <Shield size={15} />
                    </button>
                    <button onClick={() => setToggleTarget(u)} className="p-1.5 text-gray-400 hover:text-violet-600">
                      {u.isActive ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                    </button>
                    <button onClick={() => { setSelected(u); setShowReset(true); }} className="p-1.5 text-gray-400 hover:text-violet-600"><KeyRound size={15} /></button>
                    <button onClick={() => setDeleteTarget(u)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                  </>
                )}
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

      {/* ══════════════════════════════════════════════════════════
          Add User — 2-step wizard modal
      ══════════════════════════════════════════════════════════ */}
      {canCreate && (
        <Modal
          isOpen={showCreate}
          onClose={() => { setShowCreate(false); setWizardStep(1); }}
          title={wizardStep === 1 ? 'Add New User — Step 1 of 2' : 'Add New User — Step 2 of 2'}
          size={wizardStep === 2 ? 'lg' : 'md'}
        >
          {/* ── Step indicator ── */}
          <div className="flex items-center gap-2 mb-5">
            {[1, 2].map(s => (
              <div key={s} className={`flex items-center gap-2 ${s < 2 ? 'flex-1' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  wizardStep === s ? 'bg-violet-600 text-white' :
                  wizardStep > s  ? 'bg-violet-200 text-violet-700' : 'bg-gray-100 text-gray-400'
                }`}>{s}</div>
                <span className={`text-xs font-medium ${wizardStep === s ? 'text-violet-700' : 'text-gray-400'}`}>
                  {s === 1 ? 'User Details' : 'Module Access'}
                </span>
                {s < 2 && <div className="flex-1 h-px bg-gray-200 mx-1" />}
              </div>
            ))}
          </div>

          {/* ── Step 1: User info form ── */}
          {wizardStep === 1 && (
            <form onSubmit={handleStep1Next} className="space-y-4">
              {/* Row: Name + Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input required className="input-field" value={form.name}
                    onChange={e => setField('name', e.target.value)} placeholder="e.g. Jane Doe" />
                </div>
                <div>
                  <label className="label">Mobile Number *</label>
                  <input required className="input-field" value={form.phone}
                    onChange={e => setField('phone', e.target.value)} placeholder="10-digit number" maxLength={15} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="label">Email ID *</label>
                <input required type="email" className="input-field" value={form.email}
                  onChange={e => setField('email', e.target.value)} placeholder="jane@company.com" />
              </div>

              {/* Row: Designation + Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Designation</label>
                  <input className="input-field" value={form.designation}
                    onChange={e => setField('designation', e.target.value)}
                    placeholder="e.g. Senior Engineer" />
                </div>
                <div>
                  <label className="label">Role *</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      {form.useCustomRole ? (
                        <input required className="input-field" value={form.customRole}
                          onChange={e => setField('customRole', e.target.value)}
                          placeholder="e.g. Operations, Marketing…" />
                      ) : (
                        <select className="input-field" value={form.role} onChange={e => setField('role', e.target.value)}>
                          {PRESET_ROLES.map(r => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <button type="button" onClick={() => setField('useCustomRole', !form.useCustomRole)}
                      className="btn-secondary text-xs whitespace-nowrap">
                      {form.useCustomRole ? 'Use preset' : '+ Custom'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Row: Status + Blood Group */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Account Status</label>
                  <select className="input-field" value={form.status} onChange={e => setField('status', e.target.value as 'active' | 'inactive')}>
                    <option value="inactive">Inactive (activate after access setup)</option>
                    <option value="active">Active</option>
                  </select>
                </div>
                <div>
                  <label className="label">Blood Group</label>
                  <select className="input-field" value={form.bloodGroup} onChange={e => setField('bloodGroup', e.target.value)}>
                    <option value="">— Select —</option>
                    {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary flex items-center gap-2">
                  Next: Module Access <ChevronRight size={15} />
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2: Module access ── */}
          {wizardStep === 2 && (
            <div className="space-y-5">
              {/* User summary banner */}
              <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm flex-shrink-0">
                  {form.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-violet-800 truncate">{form.name}</p>
                  <p className="text-xs text-violet-500 truncate">{form.email} · <span className="capitalize">{effectiveRole}</span></p>
                </div>
              </div>

              {/* Module Access */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Module Access</p>
                    <p className="text-xs text-gray-400 mt-0.5">Select which modules this user can access.</p>
                  </div>
                  <div className="flex gap-3">
                    <button type="button"
                      onClick={() => setWizardPerms(availableModules.map(m => m.key))}
                      className="text-xs text-violet-600 hover:underline">Select All</button>
                    <button type="button"
                      onClick={() => { setWizardPerms([]); setWizardAssignable([]); }}
                      className="text-xs text-gray-400 hover:underline">Clear</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {availableModules.map(mod => (
                    <ModuleTile
                      key={mod.key}
                      label={mod.label}
                      active={wizardPerms.includes(mod.key)}
                      onClick={() => {
                        const active = wizardPerms.includes(mod.key);
                        const next = active ? wizardPerms.filter(p => p !== mod.key) : [...wizardPerms, mod.key];
                        setWizardPerms(next);
                        if (active) setWizardAssignable(prev => prev.filter(p => p !== mod.key));
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Allow User Creation */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Allow User Creation</p>
                    <p className="text-xs text-gray-400 mt-0.5">This user can create other users in the system.</p>
                  </div>
                  <button type="button"
                    onClick={() => { setWizardCanCreate(v => !v); if (wizardCanCreate) setWizardAssignable([]); }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${wizardCanCreate ? 'bg-violet-600' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${wizardCanCreate ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {wizardCanCreate && (
                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">Permissions they can assign to sub-users</p>
                      <button type="button" onClick={() => setWizardAssignable(wizardPerms)}
                        className="text-xs text-violet-600 hover:underline">Same as above</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {wizardPerms.length === 0
                        ? <p className="col-span-2 text-xs text-gray-400 italic">Grant module access above first.</p>
                        : wizardPerms.map(key => {
                            const mod = ALL_MODULES.find(m => m.key === key);
                            if (!mod) return null;
                            return (
                              <ModuleTile
                                key={key}
                                label={mod.label}
                                color="emerald"
                                active={wizardAssignable.includes(key)}
                                onClick={() => setWizardAssignable(prev =>
                                  prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
                                )}
                              />
                            );
                          })
                      }
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setWizardStep(1)}
                  className="btn-secondary flex items-center gap-1.5">
                  <ChevronLeft size={15} /> Back
                </button>
                <button type="button" onClick={handleCreate} disabled={saving}
                  className="btn-primary flex items-center gap-2">
                  <Shield size={14} />
                  {saving ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Reset Password Modal */}
      <Modal isOpen={showReset} onClose={() => setShowReset(false)} title={`Reset Password — ${selected?.name}`} size="sm">
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="label">New Password *</label>
            <div className="relative">
              <input required type={showResetPwd ? 'text' : 'password'} className="input-field pr-10"
                value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} placeholder="Min 8 characters" />
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

      {/* ── Grant Access & Activate Modal (for existing inactive users) ── */}
      <Modal isOpen={!!grantTarget} onClose={() => setGrantTarget(null)}
        title={grantTarget?.isActive ? 'Edit Access' : 'Grant Access & Activate User'} size="lg">
        {grantTarget && (
          <div className="space-y-5">
            <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${grantTarget.isActive ? 'bg-violet-50 border border-violet-200' : 'bg-amber-50 border border-amber-200'}`}>
              <Shield size={16} className={`flex-shrink-0 ${grantTarget.isActive ? 'text-violet-600' : 'text-amber-600'}`} />
              <div>
                <p className={`text-sm font-semibold ${grantTarget.isActive ? 'text-violet-800' : 'text-amber-800'}`}>
                  {grantTarget.name} <span className={`font-normal ${grantTarget.isActive ? 'text-violet-600' : 'text-amber-600'}`}>({grantTarget.email})</span>
                </p>
                <p className={`text-xs mt-0.5 ${grantTarget.isActive ? 'text-violet-600' : 'text-amber-600'}`}>
                  {grantTarget.isActive
                    ? 'Update the module access for this active user. Changes take effect on their next login.'
                    : <>This user is <strong>inactive</strong>. Assign permissions below and click <strong>"Save & Activate"</strong>.</>}
                </p>
              </div>
            </div>

            {/* Module Access */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">Module Access</p>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setGrantPerms(availableModules.map(m => m.key))}
                    className="text-xs text-violet-600 hover:underline">All</button>
                  <button type="button" onClick={() => { setGrantPerms([]); setGrantAssignable([]); }}
                    className="text-xs text-gray-400 hover:underline">None</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {availableModules.map(mod => (
                  <ModuleTile
                    key={mod.key}
                    label={mod.label}
                    active={grantPerms.includes(mod.key)}
                    onClick={() => {
                      const active = grantPerms.includes(mod.key);
                      const next = active ? grantPerms.filter(p => p !== mod.key) : [...grantPerms, mod.key];
                      setGrantPerms(next);
                      if (active) setGrantAssignable(prev => prev.filter(p => p !== mod.key));
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Can Create Users */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Allow User Creation</p>
                  <p className="text-xs text-gray-400 mt-0.5">This user can create other users in the system.</p>
                </div>
                <button type="button"
                  onClick={() => { setGrantCanCreate(v => !v); if (grantCanCreate) setGrantAssignable([]); }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${grantCanCreate ? 'bg-violet-600' : 'bg-gray-200'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${grantCanCreate ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {grantCanCreate && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">Permissions they can assign to sub-users</p>
                    <button type="button" onClick={() => setGrantAssignable(grantPerms)}
                      className="text-xs text-violet-600 hover:underline">Same as above</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {grantPerms.length === 0
                      ? <p className="col-span-2 text-xs text-gray-400 italic">Grant module access above first.</p>
                      : grantPerms.map(key => {
                          const mod = ALL_MODULES.find(m => m.key === key);
                          if (!mod) return null;
                          return (
                            <ModuleTile
                              key={key}
                              label={mod.label}
                              color="emerald"
                              active={grantAssignable.includes(key)}
                              onClick={() => setGrantAssignable(prev =>
                                prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
                              )}
                            />
                          );
                        })
                    }
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setGrantTarget(null)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleActivate} disabled={activating}
                className="btn-primary flex items-center gap-2">
                <Shield size={14} />
                {activating ? 'Saving…' : grantTarget?.isActive ? 'Save Changes' : 'Save & Activate'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
