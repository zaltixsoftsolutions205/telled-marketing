import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader, ShieldAlert, Copy, Check } from 'lucide-react';

const GRAPH_CLIENT_ID = '1d6d506e-40a4-4803-a8eb-328dfa019056';

function getAdminConsentUrl(domain: string) {
  return `https://login.microsoftonline.com/${domain}/adminconsent?client_id=${GRAPH_CLIENT_ID}`;
}

export default function MicrosoftOAuthResultPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'admin_required'>('loading');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [domain, setDomain] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const emailParam = params.get('email');
    const error = params.get('error') || '';

    if (success === 'true') {
      setEmail(emailParam || '');
      setStatus('success');
      if (window.opener) {
        window.opener.postMessage({ type: 'MS_OAUTH_SUCCESS', email: emailParam }, '*');
        setTimeout(() => window.close(), 2000);
      } else {
        setTimeout(() => navigate('/dashboard'), 2500);
      }
    } else {
      // Detect admin consent required errors
      const isAdminRequired =
        error.includes('AADSTS65001') ||
        error.includes('admin') ||
        error.includes('consent_required') ||
        error.includes('access_denied');

      if (isAdminRequired && emailParam) {
        const d = emailParam.split('@')[1] || '';
        setDomain(d);
        setEmail(emailParam);
        setStatus('admin_required');
        if (window.opener) {
          window.opener.postMessage({ type: 'MS_OAUTH_ADMIN_REQUIRED', domain: d, email: emailParam }, '*');
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
    }
  }, [navigate]);

  const adminConsentUrl = domain ? getAdminConsentUrl(domain) : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(adminConsentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-md w-full text-center">

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
              <strong>{email}</strong> is now connected. Emails will be sent and read from your Outlook account.
            </p>
            <p className="text-xs text-gray-400 mt-3">Redirecting…</p>
          </>
        )}

        {status === 'admin_required' && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={36} className="text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Admin Approval Required</h2>
            <p className="text-gray-500 text-sm mb-5">
              Your organization (<strong>{domain}</strong>) requires an IT admin to approve ZIEOS once before you can connect.
            </p>

            {/* Steps */}
            <div className="text-left bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-xs font-bold text-amber-900 uppercase tracking-wide mb-3">How to get approved — 2 minutes</p>
              <ol className="space-y-2">
                {[
                  'Copy the admin consent link below',
                  `Send it to your IT admin / Microsoft 365 admin at ${domain}`,
                  'Admin opens the link, signs in, and clicks Accept',
                  'Come back and click "Connect with Microsoft" again',
                ].map((step, i) => (
                  <li key={i} className="flex gap-2 text-xs text-amber-800">
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Admin consent link */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-left">
              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Admin Consent Link</p>
              <p className="text-[11px] text-gray-700 break-all font-mono mb-2">{adminConsentUrl}</p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>

            <button
              onClick={() => window.opener ? window.close() : navigate('/zieos/login')}
              className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 active:scale-95 transition-all"
            >
              Back to Login
            </button>
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
