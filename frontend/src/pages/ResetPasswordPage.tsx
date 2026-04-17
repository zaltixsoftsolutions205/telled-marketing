import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import api from '@/api/axios';
import { useLogoStore } from '@/store/logoStore';
import { resolveLogoUrl } from '@/api/settings';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const logoUrl = useLogoStore((s) => s.logoUrl);
  const resolvedLogo = resolveLogoUrl(logoUrl);

  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={resolvedLogo} alt="Zieos" className="h-16 object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Zieos</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mx-auto">
                <CheckCircle size={30} className="text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800">Password Reset!</h2>
              <p className="text-gray-500 text-sm">Your password has been changed successfully. Redirecting to login…</p>
              <Link to="/login" className="inline-block mt-2 py-2.5 px-6 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors text-sm">
                Go to Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Set New Password</h2>
              <p className="text-gray-500 text-sm mb-6">Choose a strong password for your account.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">New Password *</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      autoFocus
                      required
                      type={showPwd ? 'text' : 'password'}
                      minLength={8}
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                      {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Confirm Password *</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      required
                      type={showConfirm ? 'text' : 'password'}
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      placeholder="Repeat password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                >
                  {loading ? 'Resetting…' : 'Reset Password'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                <Link to="/forgot-password" className="text-violet-600 hover:underline font-medium">Request new reset link</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
