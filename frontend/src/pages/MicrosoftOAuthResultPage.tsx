import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

export default function MicrosoftOAuthResultPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const emailParam = params.get('email');
    const error = params.get('error');

    if (success === 'true') {
      setEmail(emailParam || '');
      setStatus('success');
      // Notify the opener window if this was opened as a popup
      if (window.opener) {
        window.opener.postMessage({ type: 'MS_OAUTH_SUCCESS', email: emailParam }, '*');
        setTimeout(() => window.close(), 2000);
      } else {
        setTimeout(() => navigate('/dashboard'), 2500);
      }
    } else {
      setErrorMsg(error || 'Authorization failed');
      setStatus('error');
      if (window.opener) {
        window.opener.postMessage({ type: 'MS_OAUTH_ERROR', error }, '*');
        setTimeout(() => window.close(), 3000);
      } else {
        setTimeout(() => navigate('/dashboard'), 3000);
      }
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10 max-w-sm w-full text-center">
        {status === 'loading' && (
          <>
            <Loader size={40} className="text-violet-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Connecting your Microsoft account…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={36} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Connected!</h2>
            <p className="text-gray-500 text-sm">
              <strong>{email}</strong> is now connected. Emails will be sent from your Outlook account.
            </p>
            <p className="text-xs text-gray-400 mt-3">Redirecting…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle size={36} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Connection Failed</h2>
            <p className="text-gray-500 text-sm">{decodeURIComponent(errorMsg)}</p>
            <p className="text-xs text-gray-400 mt-3">Redirecting back…</p>
          </>
        )}
      </div>
    </div>
  );
}
