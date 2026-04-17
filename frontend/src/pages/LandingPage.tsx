// src/pages/LandingPage.tsx
import { useNavigate } from 'react-router-dom';
import {
  BarChart2, Users, FileText, Wrench, ShieldCheck, Zap,
  ArrowRight, CheckCircle, Globe, HeadphonesIcon, TrendingUp, Package
} from 'lucide-react';

const FEATURES = [
  {
    icon: Users,
    title: 'Lead & CRM Management',
    desc: 'Track leads through every stage — from first contact to closed deal.',
    color: 'bg-violet-50 text-violet-600',
  },
  {
    icon: FileText,
    title: 'Quotations & DRF',
    desc: 'Generate professional quotations and manage OEM deal registrations.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Package,
    title: 'Purchase Orders',
    desc: 'Full PO execution workflow from receipt to license delivery.',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: Wrench,
    title: 'Installations & Support',
    desc: 'Schedule site visits, manage installations and support tickets.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: TrendingUp,
    title: 'HR & Payroll',
    desc: 'Attendance, leaves, engineer visits, claims and salary processing.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: BarChart2,
    title: 'Analytics & Reports',
    desc: 'Real-time dashboards and performance metrics across all departments.',
    color: 'bg-rose-50 text-rose-600',
  },
];

const STATS = [
  { value: '360°', label: 'Business Visibility' },
  { value: '10+', label: 'Integrated Modules' },
  { value: '4', label: 'Role-Based Dashboards' },
  { value: '100%', label: 'Web-Based & Secure' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-lg font-bold text-gray-900 leading-none">ZIEOS</span>
              <p className="text-[10px] text-gray-400 leading-none tracking-wide">by Zaltix Soft Solutions</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
          >
            Login <ArrowRight size={15} />
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 flex flex-col items-center text-center gap-6">
          <span className="bg-white/15 text-white text-xs font-semibold px-4 py-1.5 rounded-full tracking-widest uppercase">
            Zaltix Intelligent Engineering Operating System
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight max-w-3xl">
            One Platform.<br />Every Operation.
          </h1>
          <p className="text-violet-100 text-lg md:text-xl max-w-2xl leading-relaxed">
            ZIEOS unifies your sales pipeline, OEM registrations, installations, support,
            HR and finance — giving every team a single source of truth.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-2">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center justify-center gap-2 bg-white text-violet-700 font-bold px-8 py-3.5 rounded-xl hover:bg-violet-50 active:scale-95 transition-all text-base shadow-lg"
            >
              Sign In to ZIEOS <ArrowRight size={17} />
            </button>
          </div>
        </div>

        {/* wave divider */}
        <div className="overflow-hidden leading-none">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-12 fill-white">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,60 L0,60 Z" />
          </svg>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="max-w-6xl mx-auto px-6 -mt-2 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
              <p className="text-3xl font-extrabold text-violet-600">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Everything your team needs</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            Purpose-built modules that cover the full lifecycle of your engineering business.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                <f.icon size={22} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why ZIEOS ── */}
      <section className="bg-[#f4f2ff] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Built for Engineering &amp; IT Businesses</h2>
              <p className="text-gray-500 mb-6 leading-relaxed">
                ZIEOS is designed specifically for companies that sell, install and support
                enterprise software and hardware — giving every role exactly what they need.
              </p>
              <ul className="space-y-3">
                {[
                  'Role-based access for Sales, Engineers, HR & Admins',
                  'OEM deal registration & approval tracking',
                  'Engineer visit claims & salary automation',
                  'End-to-end PO execution with license delivery',
                  'Customer account & support ticket management',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                    <CheckCircle size={17} className="text-violet-600 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/login')}
                className="mt-8 flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-3 rounded-xl transition-all active:scale-95"
              >
                Get Started <ArrowRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: ShieldCheck, label: 'Secure & Role-Gated', color: 'text-violet-600 bg-violet-50' },
                { icon: Globe, label: 'Access from Anywhere', color: 'text-blue-600 bg-blue-50' },
                { icon: Zap, label: 'Fast & Responsive', color: 'text-amber-600 bg-amber-50' },
                { icon: HeadphonesIcon, label: 'Dedicated Support', color: 'text-emerald-600 bg-emerald-50' },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center text-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.color}`}>
                    <item.icon size={24} />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-gradient-to-r from-violet-600 to-indigo-700 text-white py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-3">Ready to streamline your operations?</h2>
          <p className="text-violet-100 mb-8">Sign in to your ZIEOS account and take control.</p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 bg-white text-violet-700 font-bold px-10 py-3.5 rounded-xl hover:bg-violet-50 active:scale-95 transition-all shadow-lg"
          >
            Login to ZIEOS <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-400 text-sm py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold">ZIEOS</span>
            <span className="text-gray-500">· Zaltix Intelligent Engineering Operating System</span>
          </div>
          <p>© {new Date().getFullYear()} Zaltix Soft Solutions. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
