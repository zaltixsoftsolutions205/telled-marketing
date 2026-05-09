import { useRef, useState, useEffect } from 'react';
import {
  Camera, Lock, LogOut, Save, Eye, EyeOff,
  User, Heart, FileText, Shield, Phone, CreditCard,
  Download, Mail, CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { mockUsers, EMPLOYEE_DOCUMENTS } from '@/mock/store';
import api from '@/api/axios';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '@/utils/formatters';

const SMTP_PROVIDERS = [
  { label: 'Gmail',                 host: 'smtp.gmail.com',          port: 465, secure: true  },
  { label: 'Outlook / Hotmail',     host: 'smtp-mail.outlook.com',   port: 587, secure: false },
  { label: 'Yahoo',                 host: 'smtp.mail.yahoo.com',     port: 465, secure: true  },
  { label: 'Hostinger',             host: 'smtp.hostinger.com',      port: 465, secure: true  },
  { label: 'GoDaddy',              host: 'smtpout.secureserver.net', port: 465, secure: true  },
  { label: 'Zoho Workplace',        host: 'smtp.zoho.com',           port: 587, secure: false },
  { label: 'Titan Email',           host: 'smtp.titan.email',        port: 587, secure: false },
  { label: 'Microsoft 365',         host: 'smtp.office365.com',      port: 587, secure: false },
  { label: 'Other / Custom SMTP',   host: '',                        port: 587, secure: false },
];

const AVATAR_KEY = (id: string) => `avatar_${id}`;

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

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', sales: 'Sales',
  engineer: 'Engineer', hr: 'HR', finance: 'Finance', platform_admin: 'Platform Admin',
};
const ROLE_COLOR: Record<string, string> = {
  admin:    'bg-violet-100 text-violet-700',
  manager:  'bg-purple-100 text-purple-700',
  sales:    'bg-blue-100 text-blue-700',
  engineer: 'bg-emerald-100 text-emerald-700',
  hr:       'bg-amber-100 text-amber-700',
  finance:  'bg-orange-100 text-orange-700',
};

type Tab = 'profile' | 'personal' | 'documents' | 'access';

function DetailRow({ label, value }: { label: string; value?: string | number }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const isEmployee = user?.role !== 'admin' && user?.role !== 'manager' && user?.role !== 'platform_admin';

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [documents, setDocuments] = useState<any[]>([]);

  const [avatar, setAvatar] = useState<string | null>(
    user ? localStorage.getItem(AVATAR_KEY(user._id)) : null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  // Basic editable fields
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Password
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // Email config state
  const [emailAppPwd, setEmailAppPwd]     = useState('');
  const [showEmailPwd, setShowEmailPwd]   = useState(false);
  const [smtpHost, setSmtpHost]           = useState('');
  const [smtpPort, setSmtpPort]           = useState(587);
  const [smtpSecure, setSmtpSecure]       = useState(false);
  const [customSmtpHost, setCustomSmtpHost] = useState('');
  const [emailSaving, setEmailSaving]     = useState(false);
  const [emailMsg, setEmailMsg]           = useState('');
  const [emailErr, setEmailErr]           = useState('');

  const handleEmailConfig = async () => {
    if (!emailAppPwd.trim()) { setEmailErr('App password is required'); return; }
    const host = smtpHost || customSmtpHost;
    if (!host) { setEmailErr('Please select your email provider'); return; }
    setEmailSaving(true); setEmailErr(''); setEmailMsg('');
    try {
      await api.put('/users/me/email-config', {
        appPassword: emailAppPwd.trim(),
        smtpHost: host,
        smtpPort,
        smtpSecure,
      });
      setEmailMsg('Email configured! You can now send quotations and DRFs from your account.');
      setEmailAppPwd('');
      setTimeout(() => setEmailMsg(''), 5000);
    } catch (err: any) {
      setEmailErr(err?.response?.data?.message || 'Failed to save email config');
    } finally {
      setEmailSaving(false);
    }
  };

  // Sync latest user data from mock store (so personal details filled by manager appear)
  useEffect(() => {
    if (!user) return;
    mockUsers.getById(user._id).then(latest => {
      if (latest) {
        setUser({ ...user, ...latest });
        setName(latest.name || '');
        setPhone(latest.phone || '');
        setDepartment(latest.department || '');
      }
    });
    if (isEmployee) {
      const docs = EMPLOYEE_DOCUMENTS.filter((d: any) => d.employeeId === user._id);
      setDocuments(docs);
    }
  }, [user?._id]);

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
    if (!mockUsers.verifyPassword(user.email, oldPwd)) { setPwdErr('Current password is incorrect'); return; }
    setPwdErr('');
    setPwdSaving(true);
    try {
      await mockUsers.resetPassword(user._id, newPwd);
      setPwdMsg('Password updated! Use your new password next time you log in.');
      setOldPwd(''); setNewPwd('');
      setTimeout(() => setPwdMsg(''), 4000);
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

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent bg-white';
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

  const perms: string[] = (user as any)?.permissions ?? [];

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = isEmployee ? [
    { id: 'profile',   label: 'My Profile',  icon: User },
    { id: 'personal',  label: 'Personal',    icon: Heart },
    { id: 'documents', label: 'Documents',   icon: FileText },
    { id: 'access',    label: 'My Access',   icon: Shield },
  ] : [
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-5 animate-fade-in">

      {/* Avatar + name card */}
      <div className="card flex flex-col items-center gap-4">
        <div className="relative">
          {avatar ? (
            <img src={avatar} alt="avatar" className="w-24 h-24 rounded-2xl object-cover ring-4 ring-violet-100" />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center ring-4 ring-violet-100">
              <span className="text-white font-bold text-3xl">{initials}</span>
            </div>
          )}
          <button onClick={() => fileRef.current?.click()}
            className="absolute -bottom-2 -right-2 w-8 h-8 bg-violet-600 hover:bg-violet-700 rounded-full flex items-center justify-center shadow text-white transition-colors"
            title="Change photo">
            <Camera size={14} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div className="text-center">
          <p className="font-bold text-gray-900 text-lg">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            <span className={`inline-block px-3 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLOR[user?.role ?? ''] || 'bg-gray-100 text-gray-600'}`}>
              {ROLE_LABEL[user?.role ?? ''] || user?.role}
            </span>
            {user?.department && (
              <span className="inline-block px-3 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                {user.department}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs — only for employees */}
      {isEmployee && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.id ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <tab.icon size={13} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Tab: Profile (edit) ── */}
      {(!isEmployee || activeTab === 'profile') && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm">Edit Profile</h3>

          {/* Read-only work info for employees */}
          {isEmployee && (
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100">
              <DetailRow label="Base Salary" value={`₹${((user as any)?.baseSalary || 0).toLocaleString()} / month`} />
              <DetailRow label="Joining Date" value={(user as any)?.joiningDate ? formatDate((user as any).joiningDate) : undefined} />
              <DetailRow label="Employee Since" value={user?.createdAt ? formatDate(user.createdAt) : undefined} />
            </div>
          )}

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
      )}

      {/* ── Tab: Personal Details ── */}
      {isEmployee && activeTab === 'personal' && (
        <div className="card space-y-6">
          <h3 className="font-semibold text-gray-800 text-sm">Personal Details</h3>

          {/* Health & Identity */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Heart size={12} /> Health & Identity
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <DetailRow label="Date of Birth"  value={(user as any)?.dateOfBirth ? formatDate((user as any).dateOfBirth) : undefined} />
              <DetailRow label="Gender"         value={(user as any)?.gender} />
              <DetailRow label="Blood Group"    value={(user as any)?.bloodGroup} />
            </div>
          </div>

          {/* Emergency */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Phone size={12} /> Emergency Contact
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <DetailRow label="Contact Name"  value={(user as any)?.emergencyContact} />
              <DetailRow label="Contact Phone" value={(user as any)?.emergencyPhone} />
              <DetailRow label="Address"       value={(user as any)?.address} />
            </div>
          </div>

          {/* Financial */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <CreditCard size={12} /> Financial & ID
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <DetailRow label="Aadhar Number" value={(user as any)?.aadharNumber} />
              <DetailRow label="PAN Number"    value={(user as any)?.panNumber} />
              <DetailRow label="Bank Account"  value={(user as any)?.bankAccount} />
              <DetailRow label="IFSC Code"     value={(user as any)?.ifscCode} />
            </div>
          </div>

          {!(user as any)?.bloodGroup && !(user as any)?.dateOfBirth && !(user as any)?.emergencyContact && !(user as any)?.aadharNumber && (
            <div className="text-center py-8 text-gray-400">
              <Heart size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No personal details added yet</p>
              <p className="text-xs mt-1 text-gray-300">Your manager will update these details</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Documents ── */}
      {isEmployee && activeTab === 'documents' && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">My Documents</h3>
          {documents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No documents uploaded yet</p>
              <p className="text-xs mt-1 text-gray-300">Your manager will upload your documents</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc: any) => (
                <div key={doc._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{doc.label}</p>
                      <p className="text-xs text-gray-400 truncate">{doc.fileName}</p>
                      <p className="text-xs text-gray-300">{formatDate(doc.createdAt)}</p>
                    </div>
                  </div>
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-lg text-violet-600 hover:bg-violet-100 transition-colors ml-3" title="Download">
                    <Download size={15} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: My Access ── */}
      {isEmployee && activeTab === 'access' && (
        <div className="card">
          <div className="mb-5">
            <h3 className="font-semibold text-gray-900">My Module Access</h3>
            <p className="text-xs text-gray-400 mt-0.5">Modules you have access to in this system</p>
          </div>
          {perms.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Shield size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No custom permissions set</p>
              <p className="text-xs mt-1">Default role permissions apply</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {ALL_MODULES.map(mod => {
                const has = perms.includes(mod.key);
                return (
                  <div key={mod.key} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm ${
                    has ? 'bg-violet-50 border-violet-200 text-violet-800' : 'bg-gray-50 border-gray-100 text-gray-300'
                  }`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                      has ? 'bg-violet-600 border-violet-600' : 'border-gray-200 bg-white'
                    }`}>
                      {has && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span className={has ? 'font-medium' : ''}>{mod.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Change Password */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2"><Lock size={14} /> Change Password</h3>
        <div>
          <label className={labelCls}>Current Password</label>
          <div className="relative">
            <input className={inputCls + ' pr-9'} type={showOld ? 'text' : 'password'} value={oldPwd}
              onChange={e => setOldPwd(e.target.value)} placeholder="Current password" />
            <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600">
              {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls}>New Password</label>
          <div className="relative">
            <input className={inputCls + ' pr-9'} type={showNew ? 'text' : 'password'} value={newPwd}
              onChange={e => setNewPwd(e.target.value)} placeholder="New password" />
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

      {/* Email Configuration — for sending quotations & DRFs */}
      <div className="card space-y-4">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2"><Mail size={14} /> Email Sending Setup</h3>
          <p className="text-xs text-gray-400 mt-0.5">Configure your email to send DRFs, quotations and other emails from your own account</p>
        </div>

        {/* Provider picker */}
        <div>
          <label className={labelCls}>Email Provider *</label>
          <select className={inputCls} value={smtpHost}
            onChange={e => {
              const found = SMTP_PROVIDERS.find(p => p.host === e.target.value);
              if (found) { setSmtpHost(found.host); setSmtpPort(found.port); setSmtpSecure(found.secure); }
            }}>
            <option value="">— Select your provider —</option>
            {SMTP_PROVIDERS.map(p => <option key={p.label} value={p.host}>{p.label}</option>)}
          </select>
        </div>

        {/* Custom SMTP host (shown for Other) */}
        {smtpHost === '' && (
          <div>
            <label className={labelCls}>SMTP Host</label>
            <input className={inputCls} placeholder="e.g. mail.yourhost.com"
              value={customSmtpHost} onChange={e => setCustomSmtpHost(e.target.value)} />
          </div>
        )}

        {/* App Password */}
        <div>
          <label className={labelCls}>App Password *</label>
          <div className="relative">
            <input className={inputCls + ' pr-9'} type={showEmailPwd ? 'text' : 'password'}
              value={emailAppPwd} onChange={e => setEmailAppPwd(e.target.value)}
              placeholder="Your 16-character app password" />
            <button type="button" onClick={() => setShowEmailPwd(v => !v)}
              className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600">
              {showEmailPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            For Gmail: go to <strong>myaccount.google.com → Security → App passwords</strong> and generate one for "ZIEOS". For others: use your email account password.
          </p>
        </div>

        {emailErr && <p className="text-xs text-red-500">{emailErr}</p>}
        {emailMsg && (
          <p className="text-xs text-green-600 font-medium flex items-center gap-1.5">
            <CheckCircle2 size={13} /> {emailMsg}
          </p>
        )}

        <button onClick={handleEmailConfig} disabled={emailSaving}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Mail size={14} /> {emailSaving ? 'Saving…' : 'Save Email Config'}
        </button>
      </div>

      {/* Logout */}
      <div className="card">
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm transition-colors">
          <LogOut size={15} /> Logout
        </button>
      </div>
    </div>
  );
}
