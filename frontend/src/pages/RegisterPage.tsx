import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail, FileText,
  Upload, CheckCircle, ChevronRight, ChevronLeft, ChevronDown,
  ExternalLink, Shield
} from 'lucide-react';
import api from '@/api/axios';

// Steps: 1=Provider, 2=EmailSetup(password+OTP), 3=Organization, 4=Documents, 5=Success
type Step = 1 | 2 | 3 | 4 | 5;
type AccountType = 'personal' | 'business' | null;

const BUSINESS_TYPES = [
  'Private Limited Company', 'Public Limited Company', 'Partnership Firm',
  'Sole Proprietorship', 'LLP (Limited Liability Partnership)', 'NGO / Non-Profit', 'Other',
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Delhi', 'Lakshadweep',
  'Puducherry', 'Jammu and Kashmir', 'Ladakh',
];

interface EmailProvider {
  id: string;
  name: string;
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  color: string;
  bgColor: string;
  logo: string;
  hasAccountTypeToggle?: boolean; // Gmail, Outlook, Yahoo
  appPasswordUrl?: string;
  appPasswordSteps?: string[];
  alwaysDirect?: boolean;         // Zoho, GoDaddy, Hostinger, etc.
  directNote?: string;
  needsTestConnection?: boolean;  // Zoho, GMX, Proton, custom
}

const FEATURED_PROVIDERS: EmailProvider[] = [
  {
    id: 'gmail', name: 'Gmail', smtpHost: 'smtp.gmail.com', smtpPort: 587, secure: false,
    color: '#EA4335', bgColor: '#FEF2F2', logo: 'G',
    hasAccountTypeToggle: true,
    appPasswordUrl: 'https://myaccount.google.com/apppasswords',
    appPasswordSteps: [
      'Go to myaccount.google.com and sign in',
      'Click "Security" in the left sidebar',
      'Enable "2-Step Verification" if not already on',
      'Go back to Security → click "App passwords"',
      'Select app: "Mail" → device: "Other" → name it "Zieos"',
      'Click "Generate" → copy the 16-character password shown',
      'Paste it in the password field below',
    ],
  },
  {
    id: 'outlook', name: 'Outlook / 365', smtpHost: 'smtp.office365.com', smtpPort: 587, secure: false,
    color: '#0078D4', bgColor: '#EFF6FF', logo: 'O',
    hasAccountTypeToggle: true,
    appPasswordUrl: 'https://account.microsoft.com/security',
    appPasswordSteps: [
      'Go to outlook.live.com/mail → Settings (gear icon) → Mail → Sync email',
      'Enable "Let devices and apps use POP" — this unlocks SMTP on your account',
      'Now go to account.microsoft.com → Security → Advanced security options',
      'Under "App passwords", click "Create a new app password"',
      'If "App passwords" is not visible, your account may not support SMTP — use Gmail or a business email instead',
      'Copy the generated app password and paste it in the field below',
    ],
  },
  {
    id: 'yahoo', name: 'Yahoo Mail', smtpHost: 'smtp.mail.yahoo.com', smtpPort: 587, secure: false,
    color: '#6001D2', bgColor: '#F5F3FF', logo: 'Y!',
    hasAccountTypeToggle: true,
    appPasswordUrl: 'https://login.yahoo.com/account/security',
    appPasswordSteps: [
      'Go to login.yahoo.com/account/security',
      'Click "Generate app password" or "Manage app passwords"',
      'Select "Other app" → type "Zieos" → click Generate',
      'Copy the password shown',
      'Paste it in the password field below',
    ],
  },
  {
    id: 'zoho', name: 'Zoho Mail', smtpHost: 'smtp.zoho.com', smtpPort: 587, secure: false,
    color: '#E42527', bgColor: '#FEF2F2', logo: 'Z',
    alwaysDirect: true, directNote: 'Use your regular Zoho Mail password.',
    needsTestConnection: true,
  },
  {
    id: 'proton', name: 'ProtonMail', smtpHost: '', smtpPort: 587, secure: false,
    color: '#6D4AFF', bgColor: '#F5F3FF', logo: 'P',
    alwaysDirect: true,
    directNote: 'ProtonMail does not support server-side SMTP — it requires the Proton Bridge app running on your local machine, which is not compatible with cloud-based sending. Please use a different email provider (Gmail, Zoho, Hostinger, etc.).',
  },
  {
    id: 'icloud', name: 'iCloud Mail', smtpHost: 'smtp.mail.me.com', smtpPort: 587, secure: false,
    color: '#555555', bgColor: '#F9FAFB', logo: '☁',
    appPasswordUrl: 'https://appleid.apple.com/',
    appPasswordSteps: [
      'Go to appleid.apple.com and sign in',
      'Under "Sign-In and Security", click "App-Specific Passwords"',
      'Click "+" → name it "Zieos" → click Create',
      'Copy the app-specific password shown',
      'Paste it in the password field below',
    ],
  },
];

const DROPDOWN_PROVIDERS: EmailProvider[] = [
  {
    id: 'godaddy', name: 'GoDaddy Email', smtpHost: 'smtpout.secureserver.net', smtpPort: 465, secure: true,
    color: '#1BDBDB', bgColor: '#F0FDFD', logo: 'GD',
    alwaysDirect: true, directNote: 'Use your GoDaddy email password (not your GoDaddy account login).',
  },
  {
    id: 'hostinger', name: 'Hostinger Email', smtpHost: 'smtp.hostinger.com', smtpPort: 587, secure: false,
    color: '#673DE6', bgColor: '#F5F3FF', logo: 'H',
    alwaysDirect: true, directNote: 'Use the password you set when creating your email in Hostinger hPanel.',
  },
  {
    id: 'zoho-work', name: 'Zoho Workplace', smtpHost: 'smtp.zoho.com', smtpPort: 587, secure: false,
    color: '#E42527', bgColor: '#FEF2F2', logo: 'ZW',
    alwaysDirect: true, directNote: 'Use your Zoho Workplace email password.',
    needsTestConnection: true,
  },
  {
    id: 'titan', name: 'Titan Email', smtpHost: 'smtp.titan.email', smtpPort: 587, secure: false,
    color: '#FF6B35', bgColor: '#FFF7ED', logo: 'T',
    alwaysDirect: true, directNote: 'Use your Titan Email account password.',
  },
  {
    id: 'fastmail', name: 'Fastmail', smtpHost: 'smtp.fastmail.com', smtpPort: 587, secure: false,
    color: '#2563EB', bgColor: '#EFF6FF', logo: 'FM',
    appPasswordUrl: 'https://app.fastmail.com/settings/security/devicekeys/',
    appPasswordSteps: [
      'Go to Fastmail → Settings → Privacy & Security',
      'Under "Integrations", click "New App Password"',
      'Name it "Zieos" → click Generate Password',
      'Copy and paste it below',
    ],
  },
  {
    id: 'rackspace', name: 'Rackspace Email', smtpHost: 'secure.emailsrvr.com', smtpPort: 587, secure: false,
    color: '#E4002B', bgColor: '#FEF2F2', logo: 'RS',
    alwaysDirect: true, directNote: 'Use your Rackspace Email account password.',
  },
  {
    id: 'gmx', name: 'GMX Mail', smtpHost: 'mail.gmx.com', smtpPort: 587, secure: false,
    color: '#004F9F', bgColor: '#EFF6FF', logo: 'GMX',
    alwaysDirect: true, directNote: 'First enable SMTP in GMX: Settings → Email → POP3 & IMAP → enable "IMAP and SMTP". Then use your GMX password here.',
    needsTestConnection: true,
  },
  {
    id: 'tuta', name: 'Tuta Mail', smtpHost: '', smtpPort: 587, secure: false,
    color: '#840010', bgColor: '#FEF2F2', logo: 'TT',
    alwaysDirect: true, directNote: 'Tuta Mail does not support SMTP. Please use a different provider.',
  },
  {
    id: 'custom', name: 'Other / Custom SMTP', smtpHost: '', smtpPort: 587, secure: false,
    color: '#6B7280', bgColor: '#F9FAFB', logo: '⚙',
    alwaysDirect: true, directNote: 'Enter your email password or app-specific password as required by your provider.',
    needsTestConnection: true,
  },
];

const ALL_PROVIDERS = [...FEATURED_PROVIDERS, ...DROPDOWN_PROVIDERS];

const STEP_LABELS = ['Provider', 'Email Setup', 'Details', 'Verify', 'Documents'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Provider
  const [selectedProvider, setSelectedProvider] = useState<EmailProvider | null>(null);
  const [dropdownValue, setDropdownValue] = useState('');

  // Step 2 — Email Setup (password + OTP verify combined)
  const [smtpEmail, setSmtpEmail] = useState('');
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [customSmtpHost, setCustomSmtpHost] = useState('');
  const [customSmtpPort, setCustomSmtpPort] = useState('587');
  const [showSteps, setShowSteps] = useState(true);
  const [smtpPassword, setSmtpPassword] = useState('');
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  // OTP sub-state within step 2
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otp, setOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Step 3 — Org details
  const [form, setForm] = useState({
    orgName: '', contactName: '', phone: '',
    address: '', city: '', state: '', businessType: '', gstNumber: '',
  });

  // Step 4 — Documents
  const CERT_OPTIONS = [
    { field: 'incorporation_certificate', label: 'Incorporation Certificate' },
    { field: 'gst_certificate', label: 'GST Certificate' },
    { field: 'pan_certificate', label: 'PAN Certificate' },
  ];
  const [selectedCertType, setSelectedCertType] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const needsAppPassword = (p: EmailProvider, at: AccountType) => {
    if (p.alwaysDirect) return false;
    if (!p.hasAccountTypeToggle) return true;
    return at === 'personal';
  };

  const showAppPasswordSteps = selectedProvider ? needsAppPassword(selectedProvider, accountType) : false;

  const handleSelectProvider = (provider: EmailProvider) => {
    setSelectedProvider(provider);
    setDropdownValue('');
    setError('');
  };

  const handleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setDropdownValue(val);
    if (!val) { setSelectedProvider(null); return; }
    const found = ALL_PROVIDERS.find(p => p.id === val);
    if (found) { setSelectedProvider(found); setError(''); }
  };

  // Step 1 → 2
  const handleProviderNext = () => {
    if (!selectedProvider) { setError('Please select your email provider'); return; }
    if (selectedProvider.id === 'tuta') { setError('Tuta Mail does not support SMTP. Please choose a different provider.'); return; }
    if (selectedProvider.id === 'proton') { setError('ProtonMail is not supported. Please use Gmail, Zoho, or a business email.'); return; }
    setError(''); setAccountType(null); setSmtpPassword('');
    setEmailVerified(false); setOtpSent(false); setOtp('');
    setStep(2);
  };

  // Validate password fields then send OTP
  const handleSendOtp = async (isResend = false) => {
    if (!isResend) {
      if (!smtpEmail.trim()) { setError('Please enter your email address'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpEmail)) { setError('Please enter a valid email address'); return; }
      if (selectedProvider?.id === 'custom' && !customSmtpHost.trim()) { setError('Please enter your SMTP host'); return; }
      if (selectedProvider?.hasAccountTypeToggle && !accountType) { setError('Please select Personal or Business account type'); return; }
      if (!smtpPassword.trim()) { setError('Please enter your password'); return; }
      if (showAppPasswordSteps && smtpPassword.replace(/\s/g, '').length < 12) {
        setError('App Password looks too short — it should be 16 characters from your email provider.'); return;
      }
    }
    try {
      setSendingOtp(true); setError('');
      await api.post('/register/send-otp', { email: smtpEmail });
      setOtpSent(true); setOtp('');
      setOtpTimer(60);
      const interval = setInterval(() => {
        setOtpTimer(prev => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
      }, 1000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send OTP. Check your email address.');
    } finally { setSendingOtp(false); }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) { setError('Enter the 6-digit code'); return; }
    try {
      setVerifyingOtp(true); setError('');
      await api.post('/register/verify-otp', { email: smtpEmail, otp });
      setEmailVerified(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid or expired code. Try again.');
    } finally { setVerifyingOtp(false); }
  };

  // Step 2 → 3 (only after email verified)
  const handleEmailSetupNext = () => {
    if (!emailVerified) { setError('Please verify your email first'); return; }
    setError(''); setStep(3);
  };

  // Step 3 → 4
  const handleOrgNext = () => {
    if (!form.orgName || !form.contactName || !form.phone || !form.address || !form.city || !form.state || !form.businessType) {
      setError('Please fill all required fields'); return;
    }
    setError(''); setStep(4);
  };

  // Step 4 → Submit
  const handleDocSubmit = async () => {
    if (!selectedCertType) { setError('Please select a certificate type'); return; }
    if (!certFile) { setError('Please upload the selected certificate'); return; }
    setLoading(true); setError('');
    const smtpHost = selectedProvider?.id === 'custom' ? customSmtpHost : (selectedProvider?.smtpHost ?? '');
    const smtpPort = selectedProvider?.id === 'custom' ? Number(customSmtpPort) : (selectedProvider?.smtpPort ?? 587);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append('email', smtpEmail);
    fd.append('cert_type', selectedCertType);
    fd.append(selectedCertType, certFile);
    fd.append('smtpHost', smtpHost);
    fd.append('smtpPort', String(smtpPort));
    fd.append('smtpSecure', String(selectedProvider?.secure ?? false));
    fd.append('smtpProvider', selectedProvider?.id ?? '');
    fd.append('smtpPassword', smtpPassword);
    fd.append('accountType', accountType ?? 'business');
    try {
      await api.post('/register/submit', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setStep(5);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Submission failed. Please try again.');
    } finally { setLoading(false); }
  };

  const goBack = (to: Step) => { setStep(to); setError(''); };

  const blue = '#3b5bdb';
  const inp = 'w-full border border-gray-300 bg-white text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-400 transition-all';
  const lbl = 'block text-xs font-medium text-gray-600 mb-1';
  const alertWarn = 'flex gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 text-xs text-orange-800';
  const alertRed = 'flex gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700';
  const alertGreen = 'flex gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700';
  const alertBlue = 'flex gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs text-blue-700';

  const STEPS = [
    { label: 'Choose provider' },
    { label: 'Email setup' },
    { label: 'Organization' },
    { label: 'Documents' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Top header */}
      <div className="text-center pt-6 pb-4">
        <div className="inline-flex items-center gap-1.5 mb-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: blue }}>
            <Mail size={12} className="text-white" />
          </div>
          <span className="text-sm font-bold text-gray-900">Zieos</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Create your account</h1>
        <p className="text-gray-500 text-xs mt-1">Set up your email account to get started</p>
      </div>

      {step !== 5 ? (
        <div className="flex-1 flex justify-center px-4 pb-6">
          <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex min-h-0">

              {/* ── Left Sidebar ── */}
              <div className="w-48 shrink-0 border-r border-gray-100 p-4 flex flex-col">
                <div className="mb-4">
                  {STEPS.map((s, i) => {
                    const n = i + 1;
                    const active = step === n;
                    const done = step > n;
                    return (
                      <div key={n} className="flex items-start gap-2">
                        <div className="flex flex-col items-center">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border-2 transition-all"
                            style={done || active ? { backgroundColor: blue, borderColor: blue, color: '#fff' } : { backgroundColor: '#fff', borderColor: '#d1d5db', color: '#9ca3af' }}>
                            {done ? '✓' : n}
                          </div>
                          {n < 4 && <div className="w-px h-6 my-0.5" style={{ backgroundColor: done ? blue : '#e5e7eb' }} />}
                        </div>
                        <div className="pt-0.5 pb-6">
                          <p className="text-xs font-medium leading-tight" style={{ color: active ? blue : done ? '#374151' : '#9ca3af' }}>{s.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(step === 1 || step === 2) && (
                  <div className="flex-1 flex flex-col">
                    <p className="text-xs font-semibold text-gray-700 mb-0.5">Select your mail provider</p>
                    <p className="text-[11px] text-gray-400 mb-2">Choose the email provider you use</p>
                    <div className="space-y-0.5 flex-1">
                      {[...FEATURED_PROVIDERS, ...DROPDOWN_PROVIDERS]
                        .filter(p => !['tuta','proton','rackspace','gmx','zoho-work'].includes(p.id))
                        .map(p => {
                          const isSelected = selectedProvider?.id === p.id;
                          return (
                            <button key={p.id} type="button" onClick={() => handleSelectProvider(p)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all border"
                              style={isSelected ? { backgroundColor: '#eff6ff', borderColor: '#93c5fd' } : { backgroundColor: 'transparent', borderColor: 'transparent' }}
                              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#f9fafb'; }}
                              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
                              <div className="w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] shrink-0" style={{ backgroundColor: p.bgColor, color: p.color }}>{p.logo}</div>
                              <span className="text-xs font-medium flex-1 truncate" style={{ color: isSelected ? blue : '#374151' }}>{p.name}</span>
                              <ChevronRight size={11} style={{ color: isSelected ? blue : '#d1d5db' }} />
                            </button>
                          );
                        })}
                    </div>
                    <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-green-50 border border-green-200 px-2 py-2">
                      <Shield size={11} className="text-green-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold text-green-700">We never store your password</p>
                        <p className="text-[10px] text-green-600/80 mt-0.5 leading-tight">Encrypted and used securely.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right Content ── */}
              <div className="flex-1 flex flex-col">
                <div className="flex-1 p-5 overflow-y-auto space-y-3">

                  {/* ── STEP 1: Choose Provider ── */}
                  {step === 1 && (
                    <div className="space-y-3">
                      <div>
                        <h2 className="text-sm font-bold text-gray-900">Choose your email provider</h2>
                        <p className="text-gray-500 text-xs mt-0.5">We'll send all operations from this email account</p>
                      </div>
                      {!selectedProvider
                        ? <p className="text-gray-400 text-xs">← Select a provider from the left panel</p>
                        : <>
                            <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2" style={{ borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }}>
                              <div className="w-6 h-6 rounded flex items-center justify-center font-bold text-xs shrink-0" style={{ backgroundColor: selectedProvider.bgColor, color: selectedProvider.color }}>{selectedProvider.logo}</div>
                              <div>
                                <p className="text-xs font-semibold text-gray-800">{selectedProvider.name}</p>
                                <p className="text-[11px] text-gray-500">{selectedProvider.smtpHost || 'Custom SMTP'}</p>
                              </div>
                              <CheckCircle size={13} className="ml-auto shrink-0" style={{ color: blue }} />
                            </div>
                            {(selectedProvider.id === 'tuta' || selectedProvider.id === 'proton') && (
                              <div className={alertRed}><span>⚠</span><p>{selectedProvider.id === 'tuta' ? 'Tuta Mail does not support SMTP.' : 'ProtonMail requires a local Bridge. Use Gmail or Zoho instead.'}</p></div>
                            )}
                          </>
                      }
                      {error && <div className={alertRed}><span>⚠</span><p>{error}</p></div>}
                    </div>
                  )}

                  {/* ── STEP 2: Email Setup + Verify ── */}
                  {step === 2 && selectedProvider && (
                    <div className="space-y-3">
                      <div>
                        <h2 className="text-sm font-bold text-gray-900">Email Setup & Verification</h2>
                        <p className="text-gray-500 text-xs mt-0.5">Enter credentials and verify your email with OTP</p>
                      </div>

                      {/* Account type cards */}
                      {selectedProvider.hasAccountTypeToggle && (
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { value: 'personal' as AccountType, label: 'Personal Mail', sub: '@gmail.com · @outlook.com', icon: <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="11" r="6" fill="#c7d2fe"/><path d="M4 28c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="#c7d2fe" strokeWidth="2.5" strokeLinecap="round" fill="none"/></svg> },
                            { value: 'business' as AccountType, label: 'Business Mail', sub: '@yourcompany.com', icon: <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><rect x="4" y="10" width="24" height="18" rx="2" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1.5"/><rect x="11" y="4" width="10" height="8" rx="1.5" fill="#d1d5db"/><rect x="13" y="18" width="6" height="10" rx="1" fill="#9ca3af"/></svg> },
                          ] as const).map(opt => (
                            <button key={opt.value} type="button"
                              onClick={() => { setAccountType(opt.value); setShowSteps(true); setEmailVerified(false); setOtpSent(false); setOtp(''); }}
                              disabled={emailVerified}
                              className="relative flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all disabled:opacity-60"
                              style={accountType === opt.value ? { borderColor: blue, backgroundColor: '#eff6ff' } : { borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accountType === opt.value ? '#dbeafe' : '#f3f4f6' }}>{opt.icon}</div>
                              <div>
                                <p className="text-xs font-semibold text-gray-900">{opt.label}</p>
                                <p className="text-[10px] text-gray-400">{opt.sub}</p>
                              </div>
                              {accountType === opt.value && <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ backgroundColor: blue }}><span className="text-white text-[7px] font-bold">✓</span></div>}
                            </button>
                          ))}
                        </div>
                      )}

                      {(!selectedProvider.hasAccountTypeToggle || accountType) && (
                        <>
                          {/* Alerts */}
                          {selectedProvider.id === 'outlook' && accountType === 'personal' && <div className={alertRed}><span className="shrink-0">⚠</span><p>Personal Outlook SMTP is disabled by default — follow the steps below first.</p></div>}
                          {(selectedProvider.id === 'gmail' || selectedProvider.id === 'yahoo') && accountType === 'personal' && <div className={alertWarn}><span className="shrink-0">⚠</span><p>{selectedProvider.id === 'gmail' ? 'Gmail' : 'Yahoo'} blocks regular passwords — you must use an App Password.</p></div>}
                          {selectedProvider.id === 'icloud' && <div className={alertWarn}><span className="shrink-0">⚠</span><p>iCloud requires an App-Specific Password.</p></div>}
                          {selectedProvider.id === 'fastmail' && <div className={alertWarn}><span className="shrink-0">⚠</span><p>Fastmail requires an App Password.</p></div>}
                          {selectedProvider.hasAccountTypeToggle && accountType === 'business' && <div className={alertGreen}><CheckCircle size={12} className="shrink-0 mt-px text-green-600"/><p>Business accounts use your regular email password.</p></div>}
                          {selectedProvider.alwaysDirect && selectedProvider.directNote && <div className={alertBlue}><span className="shrink-0">ℹ</span><p>{selectedProvider.directNote}</p></div>}

                          {/* Email */}
                          <div>
                            <label className={lbl}>Email Address *</label>
                            <input type="email" className={inp} disabled={emailVerified}
                              placeholder={selectedProvider.hasAccountTypeToggle ? 'you@gmail.com or you@company.com' : 'you@yourdomain.com'}
                              value={smtpEmail} onChange={e => { setSmtpEmail(e.target.value); setEmailVerified(false); setOtpSent(false); setOtp(''); }} />
                          </div>

                          {/* Custom SMTP */}
                          {selectedProvider.id === 'custom' && (
                            <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom SMTP</p>
                              <div><label className={lbl}>SMTP Host *</label>
                                <input type="text" className={inp} placeholder="mail.yourhost.com" value={customSmtpHost} onChange={e => setCustomSmtpHost(e.target.value)} /></div>
                              <div><label className={lbl}>SMTP Port</label>
                                <input type="number" className={inp} placeholder="587" value={customSmtpPort} onChange={e => setCustomSmtpPort(e.target.value)} /></div>
                            </div>
                          )}

                          {/* Password */}
                          <div>
                            <label className={lbl}>{showAppPasswordSteps ? 'App Password' : 'Email Password'} *</label>
                            <div className="relative">
                              <input type={showSmtpPassword ? 'text' : 'password'} className={`${inp} pr-14`} disabled={emailVerified}
                                placeholder={showAppPasswordSteps ? '················' : 'Enter your email password'}
                                value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} />
                              <button type="button" onClick={() => setShowSmtpPassword(s => !s)}
                                className="absolute right-3 top-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium">
                                {showSmtpPassword ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>Hide</>
                                  : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Show</>}
                              </button>
                            </div>
                            {showAppPasswordSteps && <p className="text-[11px] text-gray-400 mt-1">16 characters, generated by your email provider.</p>}
                          </div>

                          {/* App password steps accordion */}
                          {(showAppPasswordSteps || (!selectedProvider.hasAccountTypeToggle && !selectedProvider.alwaysDirect && selectedProvider.appPasswordSteps)) && selectedProvider.appPasswordSteps && (
                            <div className="rounded-lg border border-gray-200 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                                <p className="text-xs font-semibold text-gray-700">
                                  {selectedProvider.id === 'outlook' && accountType === 'personal' ? `How to enable SMTP & get App Password (${selectedProvider.name})` : `How to get an App Password (${selectedProvider.name})`}
                                </p>
                                <ChevronDown size={13} className="text-gray-400 rotate-180" />
                              </div>
                              <div className="px-3 py-3 space-y-2">
                                {selectedProvider.appPasswordSteps.map((s, i) => (
                                  <div key={i} className="flex gap-2">
                                    <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-[9px] font-bold mt-0.5" style={{ borderColor: blue, color: blue }}>{i + 1}</span>
                                    <div className="text-xs text-gray-600 leading-relaxed">{s}</div>
                                  </div>
                                ))}
                                {selectedProvider.appPasswordUrl && (
                                  <div className="flex gap-2 pt-1 border-t border-gray-100">
                                    <span className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center shrink-0 text-[9px] font-semibold text-gray-400 mt-0.5">i</span>
                                    <a href={selectedProvider.appPasswordUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1"><ExternalLink size={10}/> Open {selectedProvider.name} Security Settings</a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* ── OTP Section ── */}
                          <div className="border-t border-gray-100 pt-3">
                            {!emailVerified ? (
                              !otpSent ? (
                                <button type="button" onClick={() => handleSendOtp(false)} disabled={sendingOtp}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-60"
                                  style={{ backgroundColor: blue }}>
                                  {sendingOtp ? 'Sending…' : 'Send OTP to verify email'}
                                </button>
                              ) : (
                                <div className="space-y-2">
                                  <label className={lbl}>Enter OTP sent to <span style={{ color: blue }}>{smtpEmail}</span> *</label>
                                  <div className="flex gap-2">
                                    <input type="text" inputMode="numeric" maxLength={6}
                                      className={`${inp} text-center text-base tracking-[0.4em] font-bold flex-1`}
                                      placeholder="——————" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} />
                                    <button type="button" onClick={handleVerifyOtp} disabled={verifyingOtp || otp.length !== 6}
                                      className="px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-60 shrink-0"
                                      style={{ backgroundColor: blue }}>
                                      {verifyingOtp ? 'Verifying…' : 'Verify'}
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-gray-400">
                                    {otpTimer > 0 ? `Resend in ${otpTimer}s` : (
                                      <button type="button" onClick={() => handleSendOtp(true)} disabled={sendingOtp} className="font-medium" style={{ color: blue }}>
                                        {sendingOtp ? 'Sending…' : 'Resend OTP'}
                                      </button>
                                    )}
                                  </p>
                                </div>
                              )
                            ) : (
                              <div className={alertGreen}>
                                <CheckCircle size={13} className="text-green-600 shrink-0 mt-px" />
                                <p><strong>{smtpEmail}</strong> verified successfully</p>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {error && <div className={alertRed}><span>⚠</span><p>{error}</p></div>}
                    </div>
                  )}

                  {/* ── STEP 3: Organization ── */}
                  {step === 3 && (
                    <div className="space-y-3">
                      <div>
                        <h2 className="text-sm font-bold text-gray-900">Organization & Contact Details</h2>
                        <p className="text-gray-500 text-xs mt-0.5">Tell us about your organization</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className={lbl}>Organization Name *</label><input required type="text" className={inp} placeholder="Acme Pvt Ltd" value={form.orgName} onChange={setField('orgName')} /></div>
                        <div><label className={lbl}>Contact Name *</label><input required type="text" className={inp} placeholder="Full Name" value={form.contactName} onChange={setField('contactName')} /></div>
                        <div><label className={lbl}>Email Address</label><input type="email" readOnly className={`${inp} bg-gray-50 cursor-not-allowed text-gray-500`} value={smtpEmail} /></div>
                        <div><label className={lbl}>Phone Number *</label><input required type="tel" className={inp} placeholder="+91 9XXXXXXXXX" value={form.phone} onChange={setField('phone')} /></div>
                        <div className="col-span-2"><label className={lbl}>Business Address *</label><input required type="text" className={inp} placeholder="Street address" value={form.address} onChange={setField('address')} /></div>
                        <div><label className={lbl}>City *</label><input required type="text" className={inp} placeholder="City" value={form.city} onChange={setField('city')} /></div>
                        <div><label className={lbl}>State *</label>
                          <select required className={inp} value={form.state} onChange={setField('state')}>
                            <option value="">Select state</option>
                            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select></div>
                        <div><label className={lbl}>Business Type *</label>
                          <select required className={inp} value={form.businessType} onChange={setField('businessType')}>
                            <option value="">Select type</option>
                            {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select></div>
                        <div><label className={lbl}>GST Number <span className="text-gray-400 font-normal">(optional)</span></label>
                          <input type="text" className={inp} placeholder="22AAAAA0000A1Z5" value={form.gstNumber} onChange={setField('gstNumber')} maxLength={15} /></div>
                      </div>
                      {error && <div className={alertRed}><span>⚠</span><p>{error}</p></div>}
                    </div>
                  )}

                  {/* ── STEP 4: Documents ── */}
                  {step === 4 && (
                    <div className="space-y-3">
                      <div>
                        <h2 className="text-sm font-bold text-gray-900">Upload Document</h2>
                        <p className="text-gray-500 text-xs mt-0.5">Upload one certificate for verification. PDF, JPG, PNG accepted (max 10 MB).</p>
                      </div>
                      <div>
                        <label className={lbl}>Certificate Type *</label>
                        <select className={inp} value={selectedCertType} onChange={e => { setSelectedCertType(e.target.value); setCertFile(null); if (fileRefs.current[0]) fileRefs.current[0]!.value = ''; }}>
                          <option value="">Select certificate</option>
                          {CERT_OPTIONS.map(opt => <option key={opt.field} value={opt.field}>{opt.label}</option>)}
                        </select>
                      </div>
                      {selectedCertType && (
                        <div className="border border-gray-200 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText size={14} className="text-gray-400" />
                            <span className="text-xs font-medium text-gray-700">{CERT_OPTIONS.find(o => o.field === selectedCertType)?.label}</span>
                            {certFile && <CheckCircle size={13} className="text-green-500 ml-auto" />}
                          </div>
                          {certFile ? (
                            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                              <span className="text-xs text-green-700 truncate max-w-[220px]">{certFile.name}</span>
                              <button type="button" onClick={() => { setCertFile(null); if (fileRefs.current[0]) fileRefs.current[0]!.value = ''; }} className="text-xs text-red-500 hover:text-red-700 ml-2 font-medium">Remove</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => fileRefs.current[0]?.click()}
                              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-6 text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all">
                              <Upload size={14} /> Click to upload
                            </button>
                          )}
                          <input ref={el => { fileRefs.current[0] = el; }} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCertFile(e.target.files?.[0] || null)} />
                        </div>
                      )}
                      {error && <div className={alertRed}><span>⚠</span><p>{error}</p></div>}
                    </div>
                  )}

                </div>

                {/* ── Bottom bar ── */}
                <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Already have an account?{' '}<Link to="/login" className="font-semibold" style={{ color: blue }}>Sign in</Link></p>
                  <div className="flex items-center gap-1.5">
                    {step > 1 && (
                      <button type="button" onClick={() => goBack((step - 1) as Step)} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-900">
                        <ChevronLeft size={14} /> Back
                      </button>
                    )}
                    {step === 1 && (
                      <button type="button" onClick={handleProviderNext} className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: blue }}>
                        Continue <ChevronRight size={14} />
                      </button>
                    )}
                    {step === 2 && (
                      <button type="button" onClick={handleEmailSetupNext} disabled={!emailVerified}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40"
                        style={{ backgroundColor: blue }}>
                        Continue <ChevronRight size={14} />
                      </button>
                    )}
                    {step === 3 && (
                      <button type="button" onClick={handleOrgNext} className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: blue }}>
                        Continue <ChevronRight size={14} />
                      </button>
                    )}
                    {step === 4 && (
                      <button type="button" disabled={loading} onClick={handleDocSubmit}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-60"
                        style={{ backgroundColor: blue }}>
                        {loading ? 'Submitting…' : 'Submit Application'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 5: Success */
        <div className="flex-1 flex items-center justify-center px-4 pb-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 max-w-sm w-full text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Application Submitted!</h2>
            <p className="text-gray-500 text-xs leading-relaxed">
              Your registration for <span className="font-semibold text-gray-800">{form.orgName}</span> has been submitted.
              Login credentials will be sent to <span className="font-medium" style={{ color: blue }}>{smtpEmail}</span> upon approval.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600">
              This process typically takes <strong>1–2 business days</strong>.
            </div>
            <button onClick={() => navigate('/login')} className="w-full py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: blue }}>
              Back to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
