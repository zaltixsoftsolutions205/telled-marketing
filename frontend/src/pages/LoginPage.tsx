import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth';
import { useLogoStore } from '@/store/logoStore';
import { resolveLogoUrl } from '@/api/settings';

export default function LoginPage() {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const companyName = useLogoStore((s) => s.companyName);
  const logoUrl = useLogoStore((s) => s.logoUrl);
  const resolvedLogo = resolveLogoUrl(logoUrl);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authApi.login(email, password);
      if (result.requiresOtp) {
        setUserId(result.userId);
        setStep('otp');
      } else {
        setAuth(result.user, result.accessToken);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.verifyLoginOtp(userId, otp);
      setAuth(data.user, data.accessToken);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError('');
    try { await authApi.login(email, password); } catch { /* silent */ } finally { setResending(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-gold-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={resolvedLogo} alt="Zieos" className="h-20 object-contain mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">{companyName || 'Zieos'}</h1>
          <p className="text-gray-500 mt-1 text-sm">Zaltix Intelligent Engineering Operating System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {step === 'credentials' ? (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Sign in to your account</h2>
              <form onSubmit={handleCredentials} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field pl-9"
                      placeholder="you@company.com"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label">Password</label>
                    <Link to="/forgot-password" className="text-xs text-violet-600 hover:underline font-medium">Forgot password?</Link>
                  </div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field pl-9 pr-10"
                      placeholder="Your email account password"
                      required
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Use your email account password (Gmail, Outlook, Hostinger, etc.)</p>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
                  {loading ? 'Sending OTP…' : 'Continue'}
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-5">
                New organization?{' '}
                <Link to="/register" className="text-violet-600 hover:underline font-medium">Apply to register</Link>
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                  <KeyRound size={18} className="text-violet-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Verify your identity</h2>
                  <p className="text-sm text-gray-500">OTP sent to <strong>{email}</strong></p>
                </div>
              </div>
              <form onSubmit={handleOtp} className="space-y-4">
                <div>
                  <label className="label">Enter OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="input-field text-center text-2xl font-bold tracking-widest"
                    placeholder="000000"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">Check your inbox — the code is valid for 5 minutes.</p>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Verifying…' : 'Sign In'}
                </button>
              </form>
              <div className="flex justify-between items-center mt-4 text-sm">
                <button onClick={() => { setStep('credentials'); setError(''); setOtp(''); }}
                  className="text-gray-500 hover:text-gray-700">← Back</button>
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
