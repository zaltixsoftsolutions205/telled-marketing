import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, CheckCircle } from 'lucide-react';
import api from '@/api/axios';
import { useLogoStore } from '@/store/logoStore';
import { resolveLogoUrl } from '@/api/settings';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const logoUrl = useLogoStore((s) => s.logoUrl);
  const resolvedLogo = resolveLogoUrl(logoUrl);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Email is required'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Something went wrong. Please try again.');
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
          {sent ? (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mx-auto">
                <CheckCircle size={30} className="text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800">Check Your Email</h2>
              <p className="text-gray-500 text-sm">
                We've sent an email to <strong className="text-violet-700">{email}</strong> with instructions.
              </p>
              <p className="text-gray-400 text-xs mt-1">
                If you log in with Outlook, Gmail, or a company email — your ZIEOS password is the same as your email account password. Change it there, then log in here with the new one.
              </p>
              <Link to="/login" className="inline-block mt-2 py-2.5 px-6 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors text-sm">
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Forgot Password?</h2>
              <p className="text-gray-500 text-sm mb-6">Enter your email and we'll send you instructions on how to change your password.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      autoFocus
                      required
                      type="email"
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      placeholder="you@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                <Link to="/login" className="text-violet-600 hover:underline font-medium">← Back to Login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
