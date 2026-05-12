import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, KeyRound, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authApi, microsoftOAuthApi } from '@/api/auth';
import { useLogoStore } from '@/store/logoStore';

const PERSONAL_OUTLOOK_DOMAINS = ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'live.in', 'live.co.uk'];

const GRAPH_CLIENT_ID = '1d6d506e-40a4-4803-a8eb-328dfa019056';
const GRAPH_REDIRECT_URI = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api/auth/microsoft/callback'
  : 'https://api.membershipdrive.in/api/auth/microsoft/callback';

function getAdminConsentUrl(domain: string) {
  return `https://login.microsoftonline.com/${domain}/adminconsent?client_id=${GRAPH_CLIENT_ID}&redirect_uri=${encodeURIComponent(GRAPH_REDIRECT_URI)}`;
}

const BUSINESS_SMTP_PROVIDERS = [
  { label: 'Gmail', host: 'smtp.gmail.com', port: 465, secure: true },
  { label: 'Outlook / Hotmail', host: 'smtp-mail.outlook.com', port: 587, secure: false },
  { label: 'Hostinger', host: 'smtp.hostinger.com', port: 465, secure: true },
  { label: 'GoDaddy', host: 'smtpout.secureserver.net', port: 465, secure: true },
  { label: 'Zoho Workplace', host: 'smtp.zoho.com', port: 587, secure: false },
  { label: 'Titan Email', host: 'smtp.titan.email', port: 587, secure: false },
  { label: 'Fastmail (business)', host: 'smtp.fastmail.com', port: 587, secure: false },
  { label: 'Rackspace', host: 'secure.emailsrvr.com', port: 587, secure: false },
  { label: 'Microsoft 365 (business)', host: 'smtp.office365.com', port: 587, secure: false },
  { label: 'Other / Custom', host: '', port: 587, secure: false },
];

const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com',
  'msn.com', 'live.in', 'live.co.uk', 'icloud.com', 'me.com', 'fastmail.com',
];

const APP_PASSWORD_INFO: Record<string, { label: string; steps: string[]; url: string }> = {
  'gmail.com': {
    label: 'Gmail App Password',
    url: 'https://myaccount.google.com/apppasswords',
    steps: [
      'Go to myaccount.google.com → Security',
      'Enable 2-Step Verification if not already on',
      'Go back to Security → click "App passwords"',
      'Select Mail → Other → name it "ZIEOS" → click Generate',
      'Copy the 16-character password shown and paste it below',
    ],
  },
  'yahoo.com': {
    label: 'Yahoo App Password',
    url: 'https://login.yahoo.com/account/security',
    steps: [
      'Go to login.yahoo.com/account/security',
      'Click "Generate app password" or "Manage app passwords"',
      'Select "Other app" → type "ZIEOS" → click Generate',
      'Copy the password shown and paste it below',
    ],
  },
  'outlook.com': {
    label: 'Outlook App Password',
    url: 'https://account.microsoft.com/security',
    steps: [
      'Go to Outlook Settings → Mail → Sync email',
      'Enable "Let devices and apps use POP" — this unlocks SMTP',
      'Go to account.microsoft.com → Security → Advanced security options',
      'Under "App passwords" click "Create a new app password"',
      'Copy the generated password and paste it below',
    ],
  },
  'hotmail.com': {
    label: 'Outlook App Password',
    url: 'https://account.microsoft.com/security',
    steps: [
      'Go to Outlook Settings → Mail → Sync email',
      'Enable "Let devices and apps use POP" — this unlocks SMTP',
      'Go to account.microsoft.com → Security → Advanced security options',
      'Under "App passwords" click "Create a new app password"',
      'Copy the generated password and paste it below',
    ],
  },
  'live.com': {
    label: 'Outlook App Password',
    url: 'https://account.microsoft.com/security',
    steps: [
      'Go to account.microsoft.com → Security → Advanced security options',
      'Under "App passwords" click "Create a new app password"',
      'Copy the generated password and paste it below',
    ],
  },
  'icloud.com': {
    label: 'iCloud App-Specific Password',
    url: 'https://appleid.apple.com/',
    steps: [
      'Go to appleid.apple.com and sign in',
      'Under "Sign-In and Security" click "App-Specific Passwords"',
      'Click "+" → name it "ZIEOS" → click Create',
      'Copy the app-specific password and paste it below',
    ],
  },
  'me.com': {
    label: 'iCloud App-Specific Password',
    url: 'https://appleid.apple.com/',
    steps: [
      'Go to appleid.apple.com and sign in',
      'Under "Sign-In and Security" click "App-Specific Passwords"',
      'Click "+" → name it "ZIEOS" → click Create',
      'Copy the app-specific password and paste it below',
    ],
  },
  'fastmail.com': {
    label: 'Fastmail App Password',
    url: 'https://app.fastmail.com/settings/security/devicekeys/',
    steps: [
      'Go to Fastmail → Settings → Privacy & Security',
      'Under "Integrations" click "New App Password"',
      'Name it "ZIEOS" → click Generate Password',
      'Copy the password and paste it below',
    ],
  },
};

function isPersonalOutlook(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return PERSONAL_OUTLOOK_DOMAINS.includes(domain);
}

function isPersonalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return PERSONAL_EMAIL_DOMAINS.includes(domain);
}

function getAppPasswordInfo(email: string) {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return APP_PASSWORD_INFO[domain] || {
    label: 'App Password',
    url: '',
    steps: [
      "Go to your email provider's security settings",
      'Find "App passwords" or "Third-party app access"',
      'Generate a new app password for "ZIEOS"',
      'Copy and paste it below',
    ],
  };
}

type Step = 'credentials' | 'otp';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('credentials');

  // Credentials step state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // App password / email setup (shown on credentials step for personal emails)
  const [useAppPassword, setUseAppPassword] = useState(false);
  const [appPassword, setAppPassword] = useState('');
  const [showAppPwd, setShowAppPwd] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);

  // OTP step state
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState('');
  const [deviceToken, setDeviceToken] = useState('');

  // Provider-only setup state (business email, first login — only need provider, not password)
  const [providerOnly, setProviderOnly] = useState(false);
  const [needsProviderSetup, setNeedsProviderSetup] = useState(false);

  // MS OAuth
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState('');
  const [isM365Business, setIsM365Business] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const { setAuth } = useAuthStore();
  const saveNameForOrg = useLogoStore((s) => s.saveNameForOrg);
  const navigate = useNavigate();

  const applyOrgName = (orgName: string | undefined, user: any) => {
    if (orgName && user?.organizationId) saveNameForOrg(user.organizationId, orgName);
  };

  const emailDomain = email.split('@')[1]?.toLowerCase() || '';
  const isPersonal = isPersonalEmail(email);
  const isOutlook = isPersonalOutlook(email);
  const appPwdInfo = getAppPasswordInfo(email);

  // When email changes, reset app password toggle/value
  const handleEmailChange = (val: string) => {
    setEmail(val);
    setUseAppPassword(false);
    setAppPassword('');
    setSmtpHost('');
    setError('');
    setIsM365Business(false);
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // If user chose to provide app password, include it in the login call
      const result = await authApi.login(
        email,
        password,
        isPersonal && !isOutlook && appPassword ? appPassword : undefined,
        !isPersonal && smtpHost ? smtpHost : undefined,
        !isPersonal && smtpHost ? smtpPort : undefined,
        !isPersonal && smtpHost ? smtpSecure : undefined,
      );

      if (result.requiresOtp) {
        setUserId(result.userId);
        setDeviceToken(result.deviceToken || '');
        setStep('otp');
      } else {
        setAuth(result.user, result.accessToken, result.refreshToken);
        applyOrgName(result.organizationName, result.user);
        navigate('/dashboard');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || '';
      if (msg.includes('Invalid credentials') || err?.response?.status === 401) {
        setError('Incorrect password. Use the password you set when you first logged in. Click "Forgot password?" to reset it.');
      } else {
        setError(msg || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftOAuth = async () => {
    if (!userId) {
      setOauthError('Please complete sign in first.');
      return;
    }
    setOauthLoading(true);
    setOauthError('');
    try {
      const authUrl = await microsoftOAuthApi.getAuthUrl(userId);
      const popup = window.open(authUrl, 'ms-oauth', 'width=500,height=650,scrollbars=yes');
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'MS_OAUTH_SUCCESS') {
          window.removeEventListener('message', handler);
          setOauthLoading(false);
          navigate('/dashboard');
        } else if (event.data?.type === 'MS_OAUTH_ERROR') {
          window.removeEventListener('message', handler);
          setOauthLoading(false);
          setOauthError('Microsoft authorization failed: ' + (event.data.error || 'Unknown error'));
          if (popup) popup.close();
        }
      };
      window.addEventListener('message', handler);
      const pollClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollClosed);
          window.removeEventListener('message', handler);
          setOauthLoading(false);
        }
      }, 500);
    } catch (err: any) {
      setOauthLoading(false);
      setOauthError(err?.response?.data?.message || 'Failed to start Microsoft authorization');
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!userId) {
      setStep('credentials');
      setOtp('');
      setError('Session expired. Please sign in again.');
      return;
    }
    if (!otp || otp.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    setLoading(true);
    try {
      const data = await authApi.verifyLoginOtp(userId, otp, email, deviceToken);

      if (data.requiresAppPassword) {
        const dt = data.deviceToken || deviceToken;
        setUserId(data.userId);
        setDeviceToken(dt);

        // Outlook personal OR M365 business — needs MS OAuth
        if (isOutlook || data.isPersonal) {
          setIsM365Business(!isOutlook && !!data.isPersonal);
          // Don't auto-launch popup — just show the Connect button in the OTP step
          return;
        }

        // Business email (providerOnly) — already has password, just need provider selection
        if (data.providerOnly) {
          // If user already picked a provider on credentials screen, save immediately
          if (smtpHost) {
            const saved = await authApi.saveAppPassword(
              data.userId, password, email, dt,
              smtpHost, smtpPort, smtpSecure,
            );
            setAuth(saved.user, saved.accessToken, saved.refreshToken);
            applyOrgName(saved.organizationName, saved.user);
            navigate('/dashboard');
            return;
          }
          setProviderOnly(true);
          setNeedsProviderSetup(true);
          return;
        }

        // Personal email with app password already entered on credentials step — save it now
        if (useAppPassword && appPassword) {
          const saved = await authApi.saveAppPassword(
            data.userId, appPassword, email, dt,
            !isPersonal ? smtpHost : undefined,
            !isPersonal ? smtpPort : undefined,
            !isPersonal ? smtpSecure : undefined,
          );
          setAuth(saved.user, saved.accessToken, saved.refreshToken);
          applyOrgName(saved.organizationName, saved.user);
          navigate('/dashboard');
          return;
        }

        // Fallback: show provider setup in OTP step
        setProviderOnly(false);
        setNeedsProviderSetup(true);
        return;
      }

      setAuth(data.user, data.accessToken, data.refreshToken);
      applyOrgName(data.organizationName, data.user);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || '';
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
        setError('Invalid or expired code. Please try again or resend.');
      } else {
        setError(msg || 'Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError('');
    try { await authApi.login(email, password); } catch { /* silent */ } finally { setResending(false); }
  };

  const handleProviderSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpHost) { setError('Please select your email provider'); return; }
    setError('');
    setLoading(true);
    try {
      const saved = await authApi.saveAppPassword(
        userId, password, email, deviceToken,
        smtpHost, smtpPort, smtpSecure,
      );
      setAuth(saved.user, saved.accessToken, saved.refreshToken);
      applyOrgName(saved.organizationName, saved.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-violet-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-5">
          <h1 className="text-2xl font-bold text-gray-900">ZIEOS</h1>
          <p className="text-gray-400 mt-0.5 text-xs">Zaltix Intelligent Engineering Operating System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">

          {/* ── Step 1: Credentials + optional App Password / Microsoft ── */}
          {step === 'credentials' && (
            <>
              <h2 className="text-sm font-bold text-gray-800 mb-4">Sign in to your account</h2>
              <form onSubmit={handleCredentials} className="space-y-3">

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email address</label>
                  <div className="relative">
                    <Mail size={13} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="email" value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      className="input-field pl-8 text-sm py-2" placeholder="you@company.com"
                      required autoFocus
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-600">Password</label>
                    <Link to="/forgot-password" className="text-[11px] text-violet-600 hover:underline font-medium">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type={showPwd ? 'text' : 'password'} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field pl-8 pr-9 text-sm py-2" placeholder="Your email account password" required
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">Use your own email account password</p>
                </div>

                {/* App Password — always visible for personal emails (non-Outlook) */}
                {isPersonal && !isOutlook && emailDomain && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                        <KeyRound size={12} className="text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-900">App Password Required</p>
                        <p className="text-[10px] text-amber-700">Gmail / Yahoo need an app password to send emails</p>
                      </div>
                    </div>

                    {/* Steps — always visible */}
                    <div className="bg-white rounded-lg border border-amber-100 px-3 py-2.5">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">How to get your {appPwdInfo.label}</p>
                      <ol className="space-y-1.5">
                        {appPwdInfo.steps.map((s, i) => (
                          <li key={i} className="flex gap-2 text-[11px] text-gray-700">
                            <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[9px]">{i + 1}</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ol>
                      {appPwdInfo.url && (
                        <a href={appPwdInfo.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-semibold mt-2">
                          <ExternalLink size={10} /> Open Security Settings →
                        </a>
                      )}
                    </div>

                    {/* Input — always visible */}
                    <div>
                      <label className="block text-xs font-semibold text-amber-900 mb-1">{appPwdInfo.label} *</label>
                      <div className="relative">
                        <input
                          type={showAppPwd ? 'text' : 'password'} value={appPassword}
                          onChange={e => { setAppPassword(e.target.value); setUseAppPassword(true); }}
                          className="input-field pr-9 text-sm py-2 border-amber-300 focus:ring-amber-400"
                          placeholder="Paste your 16-character app password"
                        />
                        <button type="button" onClick={() => setShowAppPwd(v => !v)}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                          {showAppPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <p className="text-[10px] text-amber-700 mt-1">🔒 Stored encrypted — only used to send emails from your account</p>
                    </div>
                  </div>
                )}

                {/* Business email — provider + password */}
                {!isPersonal && emailDomain && (
                  <div className="rounded-lg border border-blue-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => { setUseAppPassword(v => !v); }}
                      className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                    >
                      <span className="text-xs font-medium text-blue-800">
                        Set up email sending
                        <span className="ml-1 text-[10px] text-blue-500 font-normal">(optional)</span>
                      </span>
                      {useAppPassword ? <ChevronUp size={13} className="text-blue-600" /> : <ChevronDown size={13} className="text-blue-600" />}
                    </button>

                    {useAppPassword && (
                      <div className="px-3 pb-3 pt-2 space-y-2 border-t border-blue-100 bg-blue-50/30">
                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">Email Provider</label>
                          <select className="input-field text-xs py-2"
                            onChange={e => {
                              const found = BUSINESS_SMTP_PROVIDERS.find(p => p.host === e.target.value);
                              if (found) { setSmtpHost(found.host); setSmtpPort(found.port); setSmtpSecure(found.secure); }
                            }}>
                            <option value="">-- Select provider --</option>
                            {BUSINESS_SMTP_PROVIDERS.map(p => (
                              <option key={p.label} value={p.host}>{p.label}</option>
                            ))}
                          </select>
                        </div>
                        {smtpHost === '' && useAppPassword && (
                          <div>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">SMTP Host</label>
                            <input type="text" className="input-field text-xs py-2" placeholder="e.g. mail.yourhost.com"
                              onChange={e => setSmtpHost(e.target.value)} />
                          </div>
                        )}
                        <div>
                          <label className="block text-[11px] font-medium text-gray-600 mb-1">Email Password</label>
                          <div className="relative">
                            <input
                              type={showAppPwd ? 'text' : 'password'} value={appPassword}
                              onChange={e => setAppPassword(e.target.value)}
                              className="input-field pr-9 text-xs py-2" placeholder="Your email account password"
                            />
                            <button type="button" onClick={() => setShowAppPwd(v => !v)}
                              className="absolute right-3 top-2 text-gray-400 hover:text-gray-600">
                              {showAppPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">🔒 Encrypted — used only to send emails</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Microsoft OAuth — inline for Outlook/Hotmail and M365 business */}
                {(isOutlook || isM365Business) && emailDomain && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 space-y-2">
                    <p className="text-[11px] text-blue-800 font-medium">
                      {isM365Business ? 'Microsoft 365 account — connect Microsoft to enable email sending & reading.' : 'Personal Outlook/Hotmail — connect Microsoft to enable email sending.'}
                    </p>
                    {isM365Business && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-[10px] text-amber-800">
                        <p className="font-bold mb-1">⚠ Your IT admin may need to approve ZIEOS once</p>
                        <p>If you see "Need admin approval", share this link with your admin:</p>
                        <p className="font-mono mt-1 break-all text-[9px] text-amber-700 select-all">
                          {getAdminConsentUrl(emailDomain)}
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleMicrosoftOAuth}
                      disabled={oauthLoading || !userId}
                      className="w-full py-2 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-xs"
                      style={{ background: '#0078D4' }}
                    >
                      {oauthLoading ? <span>Opening Microsoft…</span> : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 21 21" fill="none">
                            <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                            <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                            <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                          </svg>
                          Connect with Microsoft
                        </>
                      )}
                    </button>
                    {oauthError && <p className="text-[10px] text-red-600">{oauthError}</p>}
                    <p className="text-[10px] text-blue-500">You can also skip and connect later from your profile.</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg space-y-1">
                    <p>{error}</p>
                    {(error.includes('password') || error.includes('credentials')) && (
                      <Link to="/forgot-password" className="text-violet-600 font-semibold hover:underline block">
                        → Reset your password
                      </Link>
                    )}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm mt-1">
                  {loading ? 'Signing in…' : 'Continue'}
                </button>
              </form>

              <p className="text-center text-xs text-gray-400 mt-4">
                New organization?{' '}
                <Link to="/register" className="text-violet-600 hover:underline font-medium">Apply to register</Link>
              </p>
            </>
          )}

          {/* ── Step 2a: Provider setup (business email, first login only) ── */}
          {step === 'otp' && needsProviderSetup && (
            <>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Mail size={15} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Select your email provider</h2>
                  <p className="text-[11px] text-gray-400">One-time setup for sending emails from <strong>{email}</strong></p>
                </div>
              </div>

              <form onSubmit={handleProviderSetup} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email Provider</label>
                  <select
                    className="input-field text-sm py-2" autoFocus
                    value={smtpHost}
                    onChange={e => {
                      const found = BUSINESS_SMTP_PROVIDERS.find(p => p.host === e.target.value);
                      if (found) { setSmtpHost(found.host); setSmtpPort(found.port); setSmtpSecure(found.secure); }
                      else setSmtpHost(e.target.value);
                    }}
                  >
                    <option value="">-- Select your provider --</option>
                    {BUSINESS_SMTP_PROVIDERS.map(p => (
                      <option key={p.label} value={p.host}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {smtpHost === '' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">SMTP Host</label>
                    <input type="text" className="input-field text-sm py-2" placeholder="e.g. mail.yourhost.com"
                      onChange={e => setSmtpHost(e.target.value)} />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email Password</label>
                  <input
                    type="password" className="input-field text-sm py-2"
                    placeholder="Your email account password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>

                <p className="text-[11px] text-gray-400">This is only asked once. You won't see this again after setup.</p>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">{error}</div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm">
                  {loading ? 'Saving…' : 'Save & Continue'}
                </button>
              </form>
            </>
          )}

          {/* ── Step 2b: OTP ── */}
          {step === 'otp' && !needsProviderSetup && (
            <>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                  <KeyRound size={15} className="text-violet-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Verify your identity</h2>
                  <p className="text-[11px] text-gray-400">OTP sent to <strong>{email}</strong></p>
                </div>
              </div>

              <form onSubmit={handleOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Enter OTP</label>
                  <input
                    type="text" inputMode="numeric" maxLength={6} value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="input-field text-center text-xl font-bold tracking-widest py-2"
                    placeholder="000000" required autoFocus
                  />
                  <p className="text-[11px] text-gray-400 mt-0.5">Check your inbox — valid for 5 minutes.</p>
                </div>

                {(isOutlook || isM365Business) && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 space-y-2">
                    <p className="text-[11px] text-blue-800 font-medium">
                      {isM365Business ? 'Microsoft 365 account — connect to enable email sending & reading' : 'Connect Microsoft to enable email sending'}
                    </p>
                    {isM365Business && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-[10px] text-amber-800">
                        <p className="font-bold mb-1">⚠ Your IT admin may need to approve ZIEOS once</p>
                        <p>If you see "Need admin approval", share this link with your admin:</p>
                        <p className="font-mono mt-1 break-all text-[9px] text-amber-700 select-all">
                          {getAdminConsentUrl(emailDomain)}
                        </p>
                      </div>
                    )}
                    <button
                      type="button" onClick={handleMicrosoftOAuth} disabled={oauthLoading}
                      className="w-full py-2 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-xs"
                      style={{ background: '#0078D4' }}
                    >
                      {oauthLoading ? <span>Opening Microsoft…</span> : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 21 21" fill="none">
                            <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                            <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                            <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                          </svg>
                          Connect with Microsoft
                        </>
                      )}
                    </button>
                    {oauthError && <p className="text-[10px] text-red-600">{oauthError}</p>}
                    <p className="text-[10px] text-blue-500">You can skip and connect later from Settings.</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">{error}</div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm">
                  {loading ? 'Verifying…' : 'Sign In'}
                </button>
              </form>

              <div className="flex justify-between items-center mt-3 text-xs">
                <button onClick={() => { setStep('credentials'); setError(''); setOtp(''); }}
                  className="text-gray-400 hover:text-gray-600">← Back</button>
                <button onClick={handleResendOtp} disabled={resending}
                  className="text-violet-600 hover:underline font-medium disabled:opacity-50">
                  {resending ? 'Resending…' : 'Resend OTP'}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
