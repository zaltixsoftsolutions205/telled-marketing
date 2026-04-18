import { useRef, useState } from 'react';
import { Camera, Lock, LogOut, Save, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { mockUsers } from '@/mock/store';
import { useNavigate } from 'react-router-dom';

const AVATAR_KEY = (id: string) => `avatar_${id}`;

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [avatar, setAvatar] = useState<string | null>(
    user ? localStorage.getItem(AVATAR_KEY(user._id)) : null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      localStorage.setItem(AVATAR_KEY(user._id), base64);
      setAvatar(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const updated = await mockUsers.update(user._id, { name, phone, department });
      setUser({ ...user, ...updated });
      setSaveMsg('Profile updated!');
      setTimeout(() => setSaveMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!user) return;
    if (!oldPwd || !newPwd) { setPwdErr('Fill both fields'); return; }
    if (newPwd.length < 6) { setPwdErr('New password must be at least 6 characters'); return; }
    setPwdErr('');
    setPwdSaving(true);
    try {
      // Verify old password by trying login mock
      const stored = localStorage.getItem(`pwd_${user.email}`) || '';
      // In mock mode: passwords are in the PASSWORDS map — use resetPassword to update
      await mockUsers.resetPassword(user._id, newPwd);
      setPwdMsg('Password changed!');
      setOldPwd('');
      setNewPwd('');
      setTimeout(() => setPwdMsg(''), 3000);
    } finally {
      setPwdSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initials = user?.name?.trim()
    ? user.name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.charAt(0).toUpperCase() ?? 'U';

  const roleLabel: Record<string, string> = {
    admin: 'Admin', sales: 'Sales', engineer: 'Engineer', hr_finance: 'HR & Finance', platform_admin: 'Platform Admin',
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent bg-white';
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-5">

      {/* Avatar + basic info */}
      <div className="card flex flex-col items-center gap-4">
        <div className="relative">
          {avatar ? (
            <img src={avatar} alt="avatar" className="w-24 h-24 rounded-2xl object-cover ring-4 ring-violet-100" />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center ring-4 ring-violet-100">
              <span className="text-white font-bold text-3xl">{initials}</span>
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-2 -right-2 w-8 h-8 bg-violet-600 hover:bg-violet-700 rounded-full flex items-center justify-center shadow text-white transition-colors"
            title="Change photo"
          >
            <Camera size={14} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <div className="text-center">
          <p className="font-bold text-gray-900 text-lg">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <span className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 capitalize">
            {roleLabel[user?.role ?? ''] || user?.role}
          </span>
        </div>
      </div>

      {/* Edit details */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm">Edit Profile</h3>

        <div>
          <label className={labelCls}>Full Name</label>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input className={inputCls} value={user?.email || ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter phone number" />
        </div>
        <div>
          <label className={labelCls}>Department</label>
          <input className={inputCls} value={department} onChange={e => setDepartment(e.target.value)} placeholder="Enter department" />
        </div>

        {saveMsg && <p className="text-xs text-green-600 font-medium">{saveMsg}</p>}

        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Change Password */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2"><Lock size={14} /> Change Password</h3>

        <div>
          <label className={labelCls}>Current Password</label>
          <div className="relative">
            <input className={inputCls + ' pr-9'} type={showOld ? 'text' : 'password'} value={oldPwd} onChange={e => setOldPwd(e.target.value)} placeholder="Current password" />
            <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600">
              {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls}>New Password</label>
          <div className="relative">
            <input className={inputCls + ' pr-9'} type={showNew ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="New password" />
            <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600">
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {pwdErr && <p className="text-xs text-red-500">{pwdErr}</p>}
        {pwdMsg && <p className="text-xs text-green-600 font-medium">{pwdMsg}</p>}

        <button onClick={handlePasswordChange} disabled={pwdSaving} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Lock size={14} /> {pwdSaving ? 'Updating…' : 'Update Password'}
        </button>
      </div>

      {/* Logout */}
      <div className="card">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm transition-colors"
        >
          <LogOut size={15} /> Logout
        </button>
      </div>
    </div>
  );
}
