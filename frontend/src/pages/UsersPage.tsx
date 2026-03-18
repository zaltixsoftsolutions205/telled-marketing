import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, ToggleLeft, ToggleRight, KeyRound, Eye, EyeOff } from 'lucide-react';
import { usersApi } from '@/api/users';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { formatDate } from '@/utils/formatters';
import type { User, Role } from '@/types';

const ROLES: Role[] = ['admin', 'sales', 'engineer', 'hr_finance'];

const ROLE_LABEL: Record<Role, string> = {
  admin:      'Admin',
  sales:      'Sales',
  engineer:   'Engineer',
  hr_finance: 'HR & Finance',
};

const ROLE_COLOR: Record<Role, string> = {
  admin:      'bg-violet-100 text-violet-800',
  sales:      'bg-blue-100   text-blue-800',
  engineer:   'bg-emerald-100 text-emerald-800',
  hr_finance: 'bg-amber-100  text-amber-800',
};

type CreateForm = {
  name: string;
  email: string;
  password: string;
  role: Role;
  department: string;
  phone: string;
  baseSalary: string;
};

export default function UsersPage() {
  const [users, setUsers]           = useState<User[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset]   = useState(false);
  const [selected, setSelected]     = useState<User | null>(null);
  const [toggleTarget, setToggleTarget] = useState<User | null>(null);
  const [form, setForm] = useState<CreateForm>({
    name: '', email: '', password: '', role: 'sales',
    department: '', phone: '', baseSalary: '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [showCreatePwd, setShowCreatePwd] = useState(false);
  const [showResetPwd, setShowResetPwd]   = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search)     params.search = search;
      if (roleFilter) params.role   = roleFilter;
      const res = await usersApi.getAll(params);
      setUsers(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) { console.error('UsersPage load:', err); setUsers([]); setTotal(0); } finally { setLoading(false); }
  }, [page, search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await usersApi.create({
        ...form,
        baseSalary: form.baseSalary ? Number(form.baseSalary) : 0,
      });
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'sales', department: '', phone: '', baseSalary: '' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Failed to create user');
    } finally { setSaving(false); }
  };

  const handleToggle = async () => {
    if (!toggleTarget) return;
    await usersApi.toggleStatus(toggleTarget._id);
    setToggleTarget(null);
    load();
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await usersApi.resetPassword(selected._id, newPassword);
      setShowReset(false);
      setNewPassword('');
    } finally { setSaving(false); }
  };

  const f = (k: keyof CreateForm, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} users in your organization</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search users…" className="input-field pl-9" />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card !p-0 overflow-hidden">
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
                  <th className="table-header">Status</th>
                  <th className="table-header">Created</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
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
                    <td className="table-cell"><StatusBadge status={u.isActive ? 'Active' : 'Inactive'} /></td>
                    <td className="table-cell text-gray-400">{formatDate(u.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setToggleTarget(u)}
                          title={u.isActive ? 'Deactivate' : 'Activate'}
                          className="p-1 text-gray-400 hover:text-violet-600">
                          {u.isActive
                            ? <ToggleRight size={18} className="text-green-500" />
                            : <ToggleLeft  size={18} />}
                        </button>
                        <button onClick={() => { setSelected(u); setShowReset(true); }}
                          title="Reset Password" className="p-1 text-gray-400 hover:text-violet-600">
                          <KeyRound size={15} />
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

      {/* Create User Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add New User">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input required className="input-field" value={form.name}
                onChange={(e) => f('name', e.target.value)} placeholder="Jane Doe" />
            </div>
            <div>
              <label className="label">Work Email *</label>
              <input required type="email" className="input-field" value={form.email}
                onChange={(e) => f('email', e.target.value)} placeholder="jane@company.com" />
            </div>
            <div>
              <label className="label">Password *</label>
              <div className="relative">
                <input required type={showCreatePwd ? 'text' : 'password'} className="input-field pr-10" value={form.password}
                  onChange={(e) => f('password', e.target.value)} placeholder="Min 8 characters" minLength={8} />
                <button type="button" onClick={() => setShowCreatePwd(v => !v)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  {showCreatePwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Role *</label>
              <select required className="input-field" value={form.role}
                onChange={(e) => f('role', e.target.value as Role)}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input-field" value={form.department}
                onChange={(e) => f('department', e.target.value)}
                placeholder="e.g. Sales, Engineering…" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input-field" value={form.phone}
                onChange={(e) => f('phone', e.target.value)} placeholder="10-digit number" />
            </div>
            <div>
              <label className="label">Base Salary (₹)</label>
              <input type="number" min={0} className="input-field" value={form.baseSalary}
                onChange={(e) => f('baseSalary', e.target.value)} placeholder="e.g. 50000" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Creating…' : 'Create User'}
            </button>
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
                onChange={(e) => setNewPassword(e.target.value)} minLength={8} placeholder="Min 8 characters" />
              <button type="button" onClick={() => setShowResetPwd(v => !v)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                {showResetPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowReset(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Activate / Deactivate confirmation */}
      <ConfirmDialog
        isOpen={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        title={toggleTarget?.isActive ? 'Deactivate User' : 'Activate User'}
        message={`Are you sure you want to ${toggleTarget?.isActive ? 'deactivate' : 'activate'} ${toggleTarget?.name}?`}
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
        danger={toggleTarget?.isActive}
      />
    </div>
  );
}
