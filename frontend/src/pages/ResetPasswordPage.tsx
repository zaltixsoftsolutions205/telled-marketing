import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useLogoStore } from '@/store/logoStore';
import { resolveLogoUrl } from '@/api/settings';

export default function ResetPasswordPage() {
  const logoUrl = useLogoStore((s) => s.logoUrl);
  const resolvedLogo = resolveLogoUrl(logoUrl);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={resolvedLogo} alt="Zieos" className="h-16 object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Zieos</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center space-y-5">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-violet-100 mx-auto">
            <Info size={28} className="text-violet-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800">How to change your password</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            ZIEOS uses your <strong>email account password</strong> to sign you in — no separate password is stored in the app.
          </p>
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-left text-sm text-gray-700 space-y-2">
            <p className="font-medium text-violet-700">To change your password:</p>
            <p>Change it directly in your email provider — <strong>Outlook</strong>, <strong>Gmail</strong>, <strong>Hostinger</strong>, or wherever your email is hosted.</p>
            <p>Your new password will work on ZIEOS automatically — no changes needed here.</p>
          </div>
          <Link to="/login" className="inline-block py-2.5 px-6 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors text-sm">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
