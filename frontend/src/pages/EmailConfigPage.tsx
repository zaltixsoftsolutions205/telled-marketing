import { useState, useEffect } from 'react';
import { Mail, Server, Lock, Eye, EyeOff, CheckCircle, Info } from 'lucide-react';
import api from '@/api/axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

const PROVIDER_PRESETS: Record<string, { host: string; port: number; secure: boolean; label: string }> = {
  gmail:    { host: 'smtp.gmail.com',       port: 587, secure: false, label: 'Gmail' },
  outlook:  { host: 'smtp.office365.com',   port: 587, secure: false, label: 'Outlook / Office 365' },
  hostinger:{ host: 'smtp.hostinger.com',   port: 465, secure: true,  label: 'Hostinger' },
  yahoo:    { host: 'smtp.mail.yahoo.com',  port: 465, secure: true,  label: 'Yahoo Mail' },
  zoho:     { host: 'smtp.zoho.com',        port: 465, secure: true,  label: 'Zoho Mail' },
  custom:   { host: '',                     port: 587, secure: false,  label: 'Custom / Other' },
};

const PROVIDER_HELP: Record<string, string> = {
  gmail:   'Use an App Password (not your regular password). Enable 2FA → Google Account → Security → App Passwords.',
  outlook: 'Use your regular Outlook password. If MFA is on, create an App Password in account settings.',
  hostinger:'Use your Hostinger email password or create one in hPanel → Email → Manage.',
};

export default function EmailConfigPage() {
  const user = useAuthStore(s => s.user);
  const [provider, setProvider] = useState('custom');
  const [form, setForm] = useState({ smtpHost: '', smtpPort: '465', smtpUser: '', smtpPass: '', smtpSecure: true });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  // Pre-fill smtp user with logged-in email
  useEffect(() => {
    if (user?.email && !form.smtpUser) {
      setForm(f => ({ ...f, smtpUser: user.email! }));
      // Auto-detect provider from email domain
      const domain = user.email.split('@')[1] || '';
      if (domain.includes('gmail'))   setProvider('gmail');
      else if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('office365')) setProvider('outlook');
      else if (domain.includes('yahoo'))    setProvider('yahoo');
      else if (domain.includes('zoho'))     setProvider('zoho');
      else if (domain.includes('hostinger') || domain.includes('zaltixsoftsolutions')) setProvider('hostinger');
    }
  }, [user?.email]);

  // When provider changes, apply preset
  useEffect(() => {
    const p = PROVIDER_PRESETS[provider];
    if (p) {
      setForm(f => ({
        ...f,
        smtpHost: p.host,
        smtpPort: String(p.port),
        smtpSecure: p.secure,
      }));
    }
  }, [provider]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.smtpHost || !form.smtpUser || !form.smtpPass) {
      toast.error('Host, email and password are required');
      return;
    }
    setLoading(true);
    try {
      await api.put('/users/me/email-config', {
        smtpHost: form.smtpHost,
        smtpPort: Number(form.smtpPort),
        smtpUser: form.smtpUser,
        smtpPass: form.smtpPass,
        smtpSecure: form.smtpSecure,
      });
      setSaved(true);
      toast.success('Email configuration saved!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400';

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Email Configuration</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure your outgoing email so DRFs and customer emails are sent from <strong>{user?.email}</strong>
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-5 text-sm">
          <CheckCircle size={15} /> Email configuration is active. DRFs will now be sent from your email.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        {/* Provider selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Email Provider</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Object.entries(PROVIDER_PRESETS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => setProvider(key)}
                className={`border rounded-lg px-2 py-2 text-xs font-medium text-center transition-colors ${
                  provider === key
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Help text for known providers */}
        {PROVIDER_HELP[provider] && (
          <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>{PROVIDER_HELP[provider]}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">SMTP Host *</label>
              <div className="relative">
                <Server size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  required type="text" className={`${inputCls} pl-8`}
                  placeholder="smtp.gmail.com"
                  value={form.smtpHost}
                  onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Port *</label>
              <input
                required type="number" className={inputCls}
                value={form.smtpPort}
                onChange={e => setForm(f => ({ ...f, smtpPort: e.target.value }))}
              />
            </div>

            <div className="flex items-end gap-3 pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" className="w-4 h-4 accent-violet-600"
                  checked={form.smtpSecure}
                  onChange={e => setForm(f => ({ ...f, smtpSecure: e.target.checked }))}
                />
                <span className="text-sm text-gray-700">SSL / TLS (port 465)</span>
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Your Email Address *</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  required type="email" className={`${inputCls} pl-8`}
                  placeholder="you@company.com"
                  value={form.smtpUser}
                  onChange={e => setForm(f => ({ ...f, smtpUser: e.target.value }))}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Email Password / App Password *
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  required type={showPass ? 'text' : 'password'}
                  className={`${inputCls} pl-8 pr-10`}
                  placeholder="Your email password or app password"
                  value={form.smtpPass}
                  onChange={e => setForm(f => ({ ...f, smtpPass: e.target.value }))}
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
            <strong>Security note:</strong> Your password is stored encrypted and only used to send emails on your behalf. It is never shown to other users.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Save Email Configuration'}
          </button>
        </form>
      </div>
    </div>
  );
}
