import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, User, Mail, Phone, MapPin, FileText,
  Upload, CheckCircle, ChevronRight, ChevronLeft
} from 'lucide-react';
import api from '@/api/axios';
import { useLogoStore } from '@/store/logoStore';
import { resolveLogoUrl } from '@/api/settings';

type Step = 1 | 2 | 3 | 4;

interface DocFile {
  file: File | null;
  label: string;
  field: string;
  required: boolean;
}

const BUSINESS_TYPES = [
  'Private Limited Company',
  'Public Limited Company',
  'Partnership Firm',
  'Sole Proprietorship',
  'LLP (Limited Liability Partnership)',
  'NGO / Non-Profit',
  'Other',
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

export default function RegisterPage() {
  const navigate = useNavigate();
  const logoUrl = useLogoStore((s) => s.logoUrl);
  const resolvedLogo = resolveLogoUrl(logoUrl);

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Basic info
  const [form, setForm] = useState({
    orgName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    businessType: '',
    gstNumber: '',
  });

  // Step 2 — OTP
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpVerified, setOtpVerified] = useState(false);

  // Step 3 — Documents
  const [docs, setDocs] = useState<DocFile[]>([
    { field: 'business_registration', label: 'Business Registration Certificate', file: null, required: true },
    { field: 'gst_certificate', label: 'GST Certificate', file: null, required: false },
    { field: 'id_proof', label: 'ID Proof (Aadhar / PAN)', file: null, required: true },
    { field: 'address_proof', label: 'Address Proof', file: null, required: true },
  ]);

  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // ── Step 1 → 2 ──
  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.orgName || !form.contactName || !form.email || !form.phone || !form.address || !form.city || !form.state || !form.businessType) {
      setError('Please fill all required fields');
      return;
    }
    setError('');
    setStep(2);
  };

  // ── Send OTP ──
  const handleSendOtp = async () => {
    try {
      setSendingOtp(true);
      setError('');
      await api.post('/register/send-otp', { email: form.email });
      setOtpSent(true);
      setOtpTimer(60);
      const interval = setInterval(() => {
        setOtpTimer(prev => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  // ── Verify OTP → Step 3 ──
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) { setError('Enter a valid 6-digit OTP'); return; }
    try {
      setLoading(true);
      setError('');
      await api.post('/register/verify-otp', { email: form.email, otp });
      setOtpVerified(true);
      setStep(3);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── Doc file select ──
  const handleFileChange = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setDocs(prev => prev.map((d, i) => i === idx ? { ...d, file } : d));
  };

  // ── Step 3 submit ──
  const handleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = docs.filter(d => d.required && !d.file).map(d => d.label);
    if (missing.length) {
      setError(`Please upload: ${missing.join(', ')}`);
      return;
    }

    setLoading(true);
    setError('');

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    docs.forEach(d => { if (d.file) fd.append(d.field, d.file); });

    try {
      await api.post('/register/submit', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStep(4);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <img src={resolvedLogo} alt="Zieos" className="h-16 object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Register Your Organization</h1>
          <p className="text-gray-500 text-sm mt-1">Submit your details for admin approval</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Step indicator */}
          {step !== 4 && (
            <div className="flex items-center gap-2 mb-7">
              {(['Info', 'Verify Email', 'Documents'] as const).map((label, i) => {
                const s = (i + 1) as 1 | 2 | 3;
                const active = step >= s;
                return (
                  <div key={label} className="flex items-center flex-1 last:flex-none">
                    <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${active ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{s}</div>
                    <span className={`ml-1.5 text-xs font-medium hidden sm:block ${active ? 'text-violet-700' : 'text-gray-400'}`}>{label}</span>
                    {i < 2 && <div className={`flex-1 h-0.5 mx-2 ${step > s ? 'bg-violet-400' : 'bg-gray-100'}`} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── STEP 1: Info ── */}
          {step === 1 && (
            <form onSubmit={handleInfoSubmit} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Organization & Contact Details</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Organization Name *</label>
                  <div className="relative">
                    <Building2 size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input required type="text" className={`${inputCls} pl-8`} placeholder="Acme Pvt Ltd" value={form.orgName} onChange={setField('orgName')} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input required type="text" className={`${inputCls} pl-8`} placeholder="Full Name" value={form.contactName} onChange={setField('contactName')} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Email Address *</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input required type="email" className={`${inputCls} pl-8`} placeholder="you@company.com" value={form.email} onChange={setField('email')} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Phone Number *</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input required type="tel" className={`${inputCls} pl-8`} placeholder="+91 9XXXXXXXXX" value={form.phone} onChange={setField('phone')} />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Business Address *</label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input required type="text" className={`${inputCls} pl-8`} placeholder="Street address" value={form.address} onChange={setField('address')} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>City *</label>
                  <input required type="text" className={inputCls} placeholder="City" value={form.city} onChange={setField('city')} />
                </div>
                <div>
                  <label className={labelCls}>State *</label>
                  <select required className={inputCls} value={form.state} onChange={setField('state')}>
                    <option value="">Select state</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Business Type *</label>
                  <select required className={inputCls} value={form.businessType} onChange={setField('businessType')}>
                    <option value="">Select type</option>
                    {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>GST Number <span className="text-gray-400">(optional)</span></label>
                  <input type="text" className={inputCls} placeholder="22AAAAA0000A1Z5" value={form.gstNumber} onChange={setField('gstNumber')} maxLength={15} />
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

              <button type="submit" className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
                Continue <ChevronRight size={16} />
              </button>
            </form>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Verify Your Email</h2>
                <p className="text-sm text-gray-500 mt-1">
                  We'll send an OTP to <strong className="text-violet-700">{form.email}</strong>
                </p>
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  {sendingOtp ? 'Sending…' : 'Send OTP to Email'}
                </button>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>Enter 6-digit OTP *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                      className={`${inputCls} text-center text-2xl tracking-widest font-bold`}
                      placeholder="------"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {otpTimer > 0
                        ? `Resend in ${otpTimer}s`
                        : <button type="button" onClick={handleSendOtp} disabled={sendingOtp} className="text-violet-600 hover:underline">{sendingOtp ? 'Sending…' : 'Resend OTP'}</button>}
                    </p>
                  </div>

                  {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setStep(1); setError(''); }} className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button type="submit" disabled={loading} className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                      {loading ? 'Verifying…' : <>Verify <ChevronRight size={16} /></>}
                    </button>
                  </div>
                </>
              )}

              {error && !otpSent && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

              <button type="button" onClick={() => { setStep(1); setError(''); }} className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
                <ChevronLeft size={14} /> Back to details
              </button>
            </form>
          )}

          {/* ── STEP 3: Documents ── */}
          {step === 3 && (
            <form onSubmit={handleDocSubmit} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Upload Documents</h2>
                <p className="text-sm text-gray-500 mt-1">Upload supporting documents for verification. PDF, JPG, PNG accepted (max 10 MB each).</p>
              </div>

              <div className="space-y-3">
                {docs.map((doc, idx) => (
                  <div key={doc.field} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText size={15} className="text-violet-500" />
                        <span className="text-sm font-medium text-gray-700">
                          {doc.label} {doc.required && <span className="text-red-500">*</span>}
                        </span>
                      </div>
                      {doc.file && <CheckCircle size={16} className="text-green-500" />}
                    </div>
                    {doc.file ? (
                      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded px-3 py-2">
                        <span className="text-xs text-green-700 truncate max-w-[200px]">{doc.file.name}</span>
                        <button type="button" onClick={() => { setDocs(prev => prev.map((d, i) => i === idx ? { ...d, file: null } : d)); if (fileRefs.current[idx]) fileRefs.current[idx]!.value = ''; }} className="text-xs text-red-500 hover:text-red-700 ml-2">Remove</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileRefs.current[idx]?.click()}
                        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg py-3 text-sm text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors"
                      >
                        <Upload size={14} /> Click to upload
                      </button>
                    )}
                    <input
                      ref={el => { fileRefs.current[idx] = el; }}
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange(idx)}
                    />
                  </div>
                ))}
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep(2); setError(''); }} className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
                  <ChevronLeft size={16} /> Back
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                  {loading ? 'Submitting…' : 'Submit Application'}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 4: Success ── */}
          {step === 4 && (
            <div className="text-center py-6 space-y-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
                <CheckCircle size={36} className="text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800">Application Submitted!</h2>
              <p className="text-gray-600 text-sm max-w-sm mx-auto">
                Your registration application for <strong>{form.orgName}</strong> has been submitted successfully.
                Our team will review your documents and send your login credentials to <strong className="text-violet-700">{form.email}</strong> upon approval.
              </p>
              <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3 text-sm text-violet-700 max-w-sm mx-auto">
                This process typically takes <strong>1–2 business days</strong>.
              </div>
              <button onClick={() => navigate('/login')} className="mt-4 py-2.5 px-6 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors">
                Back to Login
              </button>
            </div>
          )}

          {step !== 4 && (
            <p className="text-center text-sm text-gray-500 mt-6">
              Already registered?{' '}
              <Link to="/login" className="text-violet-600 hover:underline font-medium">Sign in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
