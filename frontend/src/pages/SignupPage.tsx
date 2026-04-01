import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi, otpApi } from '@/api/auth';
import { Building2, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [orgName, setOrgName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) { setError('Organization name is required'); return; }
    setError('');
    setStep(2);
  };
  const handleSendOtp = async () => {
    if (!email) {
      setError('Enter email first');
      return;
    }

    try {
      setSendingOtp(true);
      await otpApi.send(email.trim());
      setOtpSent(true);
      setOtpTimer(30); // 30 sec cooldown
      setError('');

      // countdown
      const interval = setInterval(() => {
        setOtpTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      if (!otpSent) {
        setError('Please send OTP first');
        return;
      }

      if (otp.length !== 6) {
        setError('Enter valid 6-digit OTP');
        return;
      }

      const data = await authApi.signup(
        orgName.trim(),
        name.trim(),
        email.trim(),
        password,
        otp // ✅ IMPORTANT
      );
      setAuth(data.user, data.accessToken);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">T</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{orgName || 'CRM Platform'}</h1>
          <p className="text-gray-500 mt-1 text-sm">Create your organization</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${step >= 1 ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-400'}`}>1</div>
            <div className={`flex-1 h-0.5 ${step >= 2 ? 'bg-violet-400' : 'bg-gray-100'}`} />
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${step >= 2 ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-400'}`}>2</div>
          </div>

          {step === 1 ? (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Organization details</h2>
              <p className="text-sm text-gray-500 mb-6">You'll be the owner and admin of this workspace.</p>
              <form onSubmit={handleStep1} className="space-y-4">
                <div>
                  <label className="label">Organization Name *</label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      autoFocus required
                      type="text"
                      className="input-field pl-9"
                      placeholder="e.g. Acme Pvt Ltd"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                    />
                  </div>
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
                <button type="submit" className="btn-primary w-full py-3">Continue →</button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Admin account</h2>
              <p className="text-sm text-gray-500 mb-6">Setting up <span className="font-semibold text-violet-700">{orgName}</span></p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Full Name *</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      autoFocus required
                      type="text"
                      className="input-field pl-9"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Work Email *</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      required type="email"
                      className="input-field pl-9"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || otpTimer > 0}
                    className="btn-secondary w-full"
                  >
                    {sendingOtp
                      ? 'Sending...'
                      : otpTimer > 0
                        ? `Resend in ${otpTimer}s`
                        : 'Send OTP'}
                  </button>
                </div>
                <div>
                  <label className="label">Password *</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      required type={showPwd ? 'text' : 'password'}
                      className="input-field pl-9 pr-10"
                      placeholder="Min 8 characters"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {otpSent && (
                  <div>
                    <label className="label">Enter OTP *</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                    />
                  </div>
                )}
                <div>
                  <label className="label">Confirm Password *</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      required type={showConfirm ? 'text' : 'password'}
                      className="input-field pl-9 pr-10"
                      placeholder="Repeat password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
                  <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">
                    {loading ? 'Creating…' : 'Create Account'}
                  </button>
                </div>
              </form>
            </>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-violet-600 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
