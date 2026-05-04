import { useEffect, useState, useCallback, useRef } from 'react';
import {
  CalendarCheck, Plus, Users, UserCheck, UserX, Clock, LogIn, LogOut,
  MapPin, Fingerprint, ScanFace, CheckCircle2, Crosshair, Send,
  Upload, Trash2, AlertTriangle, Shield, Save,
} from 'lucide-react';
import ExcelImportButton from '@/components/common/ExcelImportButton';
import { attendanceApi } from '@/api/attendance';
import api from '@/api/axios';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate } from '@/utils/formatters';
import type { Attendance, User } from '@/types';

const STATUS_OPTIONS = ['Present', 'Absent', 'Half Day', 'Leave', 'Holiday'] as const;

const statusColors: Record<string, string> = {
  Present:    'bg-green-100 text-green-800',
  Absent:     'bg-red-100 text-red-800',
  'Half Day': 'bg-amber-100 text-amber-800',
  Leave:      'bg-blue-100 text-blue-800',
  Holiday:    'bg-gray-100 text-gray-700',
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatTime(d?: Date | string) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

interface AttendanceSettings {
  activeMethod: 'none' | 'geo' | 'biometric' | 'face';
  geo: { name: string; lat: number | null; lng: number | null; radius: number };
  biometric: { requestSent: boolean };
  face: { employees: Array<{ id: string; name: string; photo: string }> };
}

const defaultSettings: AttendanceSettings = {
  activeMethod: 'none',
  geo: { name: '', lat: null, lng: null, radius: 200 },
  biometric: { requestSent: false },
  face: { employees: [] },
};

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── HR: Attendance Method Selector ────────────────────────────────────────────
function AttendanceMethodSelector({ settings, employees, onSave }: {
  settings: AttendanceSettings;
  employees: User[];
  onSave: (s: AttendanceSettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AttendanceSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [biometricSending, setBiometricSending] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => { setDraft(settings); }, [settings]);

  const selectMethod = (m: AttendanceSettings['activeMethod']) => {
    setDraft(d => ({ ...d, activeMethod: m }));
  };

  const fetchLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation not supported.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft(d => ({ ...d, geo: { ...d.geo, lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) } }));
        setLocating(false);
      },
      () => { alert('Could not get location. Allow location access.'); setLocating(false); },
      { timeout: 10000 }
    );
  };

  const sendBiometricRequest = async () => {
    setBiometricSending(true);
    await new Promise(r => setTimeout(r, 1200));
    setDraft(d => ({ ...d, biometric: { requestSent: true } }));
    setBiometricSending(false);
  };

  const handlePhotoUpload = (empId: string, empName: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const photo = e.target?.result as string;
      setDraft(d => {
        const existing = d.face.employees.find(x => x.id === empId);
        const updated = existing
          ? d.face.employees.map(x => x.id === empId ? { ...x, photo } : x)
          : [...d.face.employees, { id: empId, name: empName, photo }];
        return { ...d, face: { employees: updated } };
      });
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (empId: string) => {
    setDraft(d => ({ ...d, face: { employees: d.face.employees.filter(x => x.id !== empId) } }));
  };

  const handleSave = async () => {
    if (draft.activeMethod === 'geo' && (!draft.geo.lat || !draft.geo.lng)) {
      return alert('Please set the office location (lat/lng) before saving.');
    }
    if (draft.activeMethod === 'geo' && !draft.geo.name.trim()) {
      return alert('Please enter a location name.');
    }
    if (draft.activeMethod === 'face' && draft.face.employees.length === 0) {
      return alert('Please register at least one employee face before activating.');
    }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  const methods = [
    {
      id: 'geo' as const,
      label: 'Geo Location',
      badge: null,
      desc: 'Employees can only check in/out within a defined office radius.',
      features: ['Set office lat/lng', 'Custom radius (50m–2km)', 'Blocks out-of-range check-in'],
      icon: MapPin,
      gradient: 'from-violet-500 to-violet-700',
      ring: 'ring-violet-400',
      check: 'bg-violet-600',
      badgeColor: '',
    },
    {
      id: 'biometric' as const,
      label: 'Biometric Device',
      badge: 'Enterprise',
      desc: 'Hardware fingerprint or RFID card integration with auto-sync.',
      features: ['Fingerprint reader', 'RFID card swipe', 'Iris scanner support'],
      icon: Fingerprint,
      gradient: 'from-blue-500 to-blue-700',
      ring: 'ring-blue-400',
      check: 'bg-blue-600',
      badgeColor: 'bg-blue-100 text-blue-700',
    },
    {
      id: 'face' as const,
      label: 'Face Recognition',
      badge: 'Beta',
      desc: 'Employees verify identity via webcam face scan at check-in/out.',
      features: ['Upload employee photos', 'Live webcam scan', 'Office location matched'],
      icon: ScanFace,
      gradient: 'from-emerald-500 to-emerald-700',
      ring: 'ring-emerald-400',
      check: 'bg-emerald-600',
      badgeColor: 'bg-amber-100 text-amber-700',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-800">Attendance Method</h2>
          <p className="text-xs text-gray-400 mt-0.5">Choose one — applies to all employees in your organisation.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm py-2">
          <Save size={14} /> {saving ? 'Saving…' : 'Save & Apply'}
        </button>
      </div>

      {/* Zoho-style method cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {methods.map(({ id, label, badge, badgeColor, desc, features, icon: Icon, gradient, ring, check }) => {
          const selected = draft.activeMethod === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectMethod(id)}
              className={`relative text-left rounded-2xl border-2 transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md group
                ${selected ? `${ring} ring-2 ring-offset-1 border-transparent` : 'border-gray-100 hover:border-gray-200'}`}
            >
              {/* Top gradient banner */}
              <div className={`bg-gradient-to-br ${gradient} px-5 pt-5 pb-8`}>
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <Icon size={22} className="text-white" />
                  </div>
                  {/* Selected checkmark */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border-2 border-white/60
                    ${selected ? 'bg-white' : 'bg-white/20'}`}>
                    {selected && (
                      <svg viewBox="0 0 12 12" className="w-3.5 h-3.5" fill="none">
                        <path d="M2 6l3 3 5-5" stroke={id === 'geo' ? '#7c3aed' : id === 'biometric' ? '#2563eb' : '#059669'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-bold text-base">{label}</p>
                    {badge && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>}
                  </div>
                  <p className="text-white/80 text-xs mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>

              {/* White body */}
              <div className="bg-white px-5 py-4 -mt-3 rounded-t-2xl relative">
                <ul className="space-y-2">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                      <CheckCircle2 size={13} className={selected ? (id === 'geo' ? 'text-violet-500' : id === 'biometric' ? 'text-blue-500' : 'text-emerald-500') : 'text-gray-300'} />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className={`mt-3 text-xs font-semibold text-center py-1.5 rounded-xl transition-all
                  ${selected
                    ? (id === 'geo' ? 'bg-violet-600 text-white' : id === 'biometric' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white')
                    : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'}`}>
                  {selected ? 'Selected' : 'Select'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Configuration panel for selected method */}
      {draft.activeMethod === 'geo' && (
        <div className="card border border-violet-100 bg-violet-50/40 space-y-3">
          <p className="text-sm font-semibold text-violet-800">Configure Office Location</p>
          <div>
            <label className="label">Location Name *</label>
            <input className="input-field" placeholder="e.g. Head Office, Hyderabad" value={draft.geo.name}
              onChange={e => setDraft(d => ({ ...d, geo: { ...d.geo, name: e.target.value } }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Latitude</label>
              <input type="number" step="0.000001" className="input-field" placeholder="17.385044" value={draft.geo.lat ?? ''}
                onChange={e => setDraft(d => ({ ...d, geo: { ...d.geo, lat: e.target.value ? +e.target.value : null } }))} />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input type="number" step="0.000001" className="input-field" placeholder="78.486671" value={draft.geo.lng ?? ''}
                onChange={e => setDraft(d => ({ ...d, geo: { ...d.geo, lng: e.target.value ? +e.target.value : null } }))} />
            </div>
          </div>
          <button onClick={fetchLocation} disabled={locating}
            className="flex items-center gap-2 text-sm text-violet-700 font-semibold bg-white border border-violet-200 px-3 py-2 rounded-xl hover:bg-violet-100 transition-colors disabled:opacity-50">
            <Crosshair size={14} /> {locating ? 'Getting location…' : 'Use My Current Location'}
          </button>
          <div>
            <label className="label">Allowed Radius: <strong className="text-violet-700">{draft.geo.radius}m</strong></label>
            <input type="range" min={50} max={2000} step={50} value={draft.geo.radius}
              onChange={e => setDraft(d => ({ ...d, geo: { ...d.geo, radius: +e.target.value } }))}
              className="w-full accent-violet-600" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>50m</span><span>500m</span><span>1km</span><span>2km</span></div>
          </div>
        </div>
      )}

      {draft.activeMethod === 'biometric' && (
        <div className="card border border-blue-100 bg-blue-50/40 space-y-3">
          <p className="text-sm font-semibold text-blue-800">Biometric Device Integration</p>
          <div className="grid grid-cols-3 gap-2">
            {['Fingerprint Reader', 'RFID Card Swipe', 'Iris Scanner'].map(f => (
              <div key={f} className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-blue-100 rounded-xl px-2.5 py-2">
                <Shield size={11} className="text-blue-400 flex-shrink-0" /> {f}
              </div>
            ))}
          </div>
          {draft.biometric.requestSent ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
              <CheckCircle2 size={16} />
              <div>
                <p className="font-semibold">Request already sent!</p>
                <p className="text-xs text-green-600 mt-0.5">Our team will contact you at <strong>zieos@zaltixsoftsolutions.com</strong></p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={sendBiometricRequest} disabled={biometricSending}
                className="flex items-center gap-2 text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                <Send size={14} /> {biometricSending ? 'Sending…' : 'Request Integration'}
              </button>
              <p className="text-xs text-gray-400">Sends a request to <strong>zieos@zaltixsoftsolutions.com</strong></p>
            </div>
          )}
        </div>
      )}

      {draft.activeMethod === 'face' && (
        <div className="card border border-emerald-100 bg-emerald-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-emerald-800">Register Employee Faces</p>
            <p className="text-xs text-gray-400">{draft.face.employees.length}/{employees.length} registered</p>
          </div>
          {employees.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No employees found.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {employees.map(emp => {
                const registered = draft.face.employees.find(x => x.id === emp._id);
                return (
                  <div key={emp._id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-emerald-100">
                    <div className="flex items-center gap-3">
                      {registered?.photo
                        ? <img src={registered.photo} alt={emp.name} className="w-9 h-9 rounded-full object-cover border-2 border-emerald-300" />
                        : <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm font-bold">{emp.name[0]}</div>
                      }
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{emp.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{emp.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {registered && (
                        <button onClick={() => removePhoto(emp._id)} className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                      <input type="file" accept="image/*" className="hidden"
                        ref={el => { fileRefs.current[emp._id] = el; }}
                        onChange={e => { if (e.target.files?.[0]) handlePhotoUpload(emp._id, emp.name, e.target.files[0]); }} />
                      <button onClick={() => fileRefs.current[emp._id]?.click()}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${registered ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <Upload size={11} /> {registered ? 'Replace' : 'Upload Photo'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-2.5">
            <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Upload a clear, front-facing photo per employee. Employees will scan their face via webcam to check in/out.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Geo Verify Modal ──────────────────────────────────────────────────────────
function GeoVerifyModal({ isOpen, onClose, onVerified, geo, action }: {
  isOpen: boolean; onClose: () => void; onVerified: (coords: { lat: number; lng: number }) => void;
  geo: AttendanceSettings['geo']; action: 'checkin' | 'checkout';
}) {
  const [status, setStatus] = useState<'checking' | 'ok' | 'fail' | 'denied'>('checking');
  const [distance, setDistance] = useState<number | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!isOpen) { setStatus('checking'); setDistance(null); setUserCoords(null); return; }
    setStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
        const dist = haversineMetres(lat, lng, geo.lat!, geo.lng!);
        setDistance(Math.round(dist));
        setStatus(dist <= geo.radius ? 'ok' : 'fail');
      },
      () => setStatus('denied'),
      { timeout: 15000, enableHighAccuracy: true }
    );
  }, [isOpen]);

  const proceed = () => { onVerified({ lat: userCoords!.lat, lng: userCoords!.lng }); onClose(); };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Location Verification — ${action === 'checkin' ? 'Check In' : 'Check Out'}`}>
      <div className="space-y-4">
        {status === 'checking' && (
          <div className="text-center py-8 space-y-3">
            <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mx-auto animate-pulse">
              <MapPin size={28} className="text-violet-600" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Fetching your location…</p>
            <p className="text-xs text-gray-400">Please allow location access if prompted</p>
          </div>
        )}

        {status === 'denied' && (
          <div className="text-center py-6 space-y-3">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-red-500" />
            </div>
            <p className="text-sm font-semibold text-gray-800">Location Access Denied</p>
            <p className="text-xs text-gray-500">Enable location permissions in your browser settings and try again.</p>
            <button onClick={onClose} className="btn-secondary w-full">Close</button>
          </div>
        )}

        {(status === 'ok' || status === 'fail') && (
          <div className="space-y-4">
            {/* Status banner */}
            <div className={`rounded-2xl p-4 flex items-center gap-4 ${status === 'ok' ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${status === 'ok' ? 'bg-green-100' : 'bg-red-100'}`}>
                {status === 'ok'
                  ? <CheckCircle2 size={24} className="text-green-600" />
                  : <AlertTriangle size={24} className="text-red-500" />}
              </div>
              <div>
                <p className={`font-bold text-sm ${status === 'ok' ? 'text-green-800' : 'text-red-800'}`}>
                  {status === 'ok' ? 'You are within range!' : 'You are out of range'}
                </p>
                <p className={`text-xs mt-0.5 ${status === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                  {status === 'ok'
                    ? `${distance}m from ${geo.name || 'office'} — within ${geo.radius}m limit`
                    : `${distance}m from ${geo.name || 'office'} — must be within ${geo.radius}m`}
                </p>
              </div>
            </div>

            {/* Location details */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex justify-between text-gray-500">
                <span className="font-medium">📍 Your location</span>
                <span className="font-mono">{userCoords?.lat}, {userCoords?.lng}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span className="font-medium">🏢 Office ({geo.name})</span>
                <span className="font-mono">{geo.lat}, {geo.lng}</span>
              </div>
              <div className="flex justify-between font-semibold text-gray-700 border-t border-gray-200 pt-2">
                <span>Distance</span>
                <span className={status === 'ok' ? 'text-green-600' : 'text-red-600'}>{distance}m</span>
              </div>
              <div className="flex justify-between font-semibold text-gray-700">
                <span>Allowed radius</span>
                <span>{geo.radius}m</span>
              </div>
            </div>

            {status === 'ok' ? (
              <button onClick={proceed} className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                {action === 'checkin' ? <LogIn size={16} /> : <LogOut size={16} />}
                Confirm {action === 'checkin' ? 'Check In' : 'Check Out'}
              </button>
            ) : (
              <button onClick={onClose} className="w-full btn-secondary">Close</button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Face Scan Modal ───────────────────────────────────────────────────────────
function FaceScanModal({ isOpen, onClose, onVerified, registeredFaces, action }: {
  isOpen: boolean; onClose: () => void; onVerified: () => void;
  registeredFaces: Array<{ id: string; name: string; photo: string }>;
  action: 'checkin' | 'checkout';
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camState, setCamState] = useState<'starting' | 'ready' | 'captured' | 'error'>('starting');

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  // Start camera after modal is mounted — small delay to ensure video el is in DOM
  useEffect(() => {
    if (!isOpen) { setCamState('starting'); stopStream(); return; }
    setCamState('starting');
    const timer = setTimeout(() => {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
            setCamState('ready');
          }
        })
        .catch(() => setCamState('error'));
    }, 300);
    return () => { clearTimeout(timer); stopStream(); };
  }, [isOpen]);

  const handleClose = () => { stopStream(); onClose(); };

  const capture = () => {
    setCamState('captured');
    setTimeout(() => {
      stopStream();
      onVerified();
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Face Scan — ${action === 'checkin' ? 'Check In' : 'Check Out'}`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-500 text-center">Position your face inside the frame and click Verify.</p>

        {/* Camera viewport */}
        <div className="relative rounded-2xl overflow-hidden bg-gray-900" style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />

          {/* Face guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-44 h-52 border-4 rounded-[60px] transition-all duration-300
              ${camState === 'captured' ? 'border-green-400 scale-105' : 'border-white/60'}`}>
              {/* Corner accents */}
              <div className={`absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 rounded-tl-2xl transition-colors ${camState === 'captured' ? 'border-green-400' : 'border-white'}`} />
              <div className={`absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 rounded-tr-2xl transition-colors ${camState === 'captured' ? 'border-green-400' : 'border-white'}`} />
              <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 rounded-bl-2xl transition-colors ${camState === 'captured' ? 'border-green-400' : 'border-white'}`} />
              <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 rounded-br-2xl transition-colors ${camState === 'captured' ? 'border-green-400' : 'border-white'}`} />
            </div>
          </div>

          {/* States */}
          {camState === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 gap-2">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-white text-xs">Starting camera…</p>
            </div>
          )}
          {camState === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 gap-2">
              <AlertTriangle size={28} className="text-red-400" />
              <p className="text-white text-sm font-semibold">Camera access denied</p>
              <p className="text-white/60 text-xs">Enable camera in browser settings</p>
            </div>
          )}
          {camState === 'captured' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/20 gap-2">
              <CheckCircle2 size={52} className="text-green-400 drop-shadow-lg" />
              <p className="text-white font-bold text-sm">Face Verified!</p>
            </div>
          )}
        </div>

        {/* Registered faces count */}
        <div className="flex items-center justify-between text-xs text-gray-400 px-1">
          <span>{registeredFaces.length} registered face{registeredFaces.length !== 1 ? 's' : ''} in org</span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live
          </span>
        </div>

        {camState === 'ready' && (
          <button onClick={capture} className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 active:scale-95">
            <ScanFace size={18} /> Verify & {action === 'checkin' ? 'Check In' : 'Check Out'}
          </button>
        )}
        {camState === 'error' && (
          <button onClick={handleClose} className="w-full btn-secondary">Close</button>
        )}
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const isHR = user?.role === 'admin' || user?.role === 'hr_finance';
  const isEmployee = !isHR;

  const now = new Date();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<User[]>([]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState<Attendance | null>(null);
  const [saving, setSaving] = useState(false);
  const [todaySummary, setTodaySummary] = useState<Record<string, number>>({});
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [clocking, setClocking] = useState(false);
  const [attSettings, setAttSettings] = useState<AttendanceSettings>(defaultSettings);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<'checkin' | 'checkout' | null>(null);
  const [showFaceScan, setShowFaceScan] = useState(false);
  const [showGeoVerify, setShowGeoVerify] = useState(false);

  const [form, setForm] = useState({
    employeeId: '',
    date: now.toISOString().slice(0, 10),
    status: 'Present' as typeof STATUS_OPTIONS[number],
    checkIn: '',
    checkOut: '',
    notes: '',
  });

  // Load org attendance settings (for all roles)
  useEffect(() => {
    api.get('/settings/attendance')
      .then(r => setAttSettings({ ...defaultSettings, ...r.data.data }))
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, []);

  const handleSaveSettings = async (updated: AttendanceSettings) => {
    await api.put('/settings/attendance', updated);
    setAttSettings(updated);
  };

  const executeCheckIn = async (payload?: { lat?: number; lng?: number; faceVerified?: boolean }) => {
    try { const rec = await attendanceApi.checkIn(payload); setTodayRecord(rec); load(); loadTodaySummary(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Check-in failed'); }
  };

  const executeCheckOut = async (payload?: { lat?: number; lng?: number; faceVerified?: boolean }) => {
    try { const rec = await attendanceApi.checkOut(payload); setTodayRecord(rec); load(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Check-out failed'); }
  };

  const handleCheckIn = () => {
    if (attSettings.activeMethod === 'geo') {
      setPendingAction('checkin'); setShowGeoVerify(true);
    } else if (attSettings.activeMethod === 'face') {
      setPendingAction('checkin'); setShowFaceScan(true);
    } else if (attSettings.activeMethod === 'biometric') {
      alert('Attendance is managed via biometric device. Please use the biometric terminal at your office.');
    } else {
      executeCheckIn();
    }
  };

  const handleCheckOut = () => {
    if (attSettings.activeMethod === 'geo') {
      setPendingAction('checkout'); setShowGeoVerify(true);
    } else if (attSettings.activeMethod === 'face') {
      setPendingAction('checkout'); setShowFaceScan(true);
    } else if (attSettings.activeMethod === 'biometric') {
      alert('Attendance is managed via biometric device. Please use the biometric terminal at your office.');
    } else {
      executeCheckOut();
    }
  };

  const onGeoVerified = (coords: { lat: number; lng: number }) => {
    if (pendingAction === 'checkin') executeCheckIn(coords);
    else if (pendingAction === 'checkout') executeCheckOut(coords);
    setPendingAction(null);
  };

  const onFaceVerified = async () => {
    if (pendingAction === 'checkin') await executeCheckIn({ faceVerified: true });
    else if (pendingAction === 'checkout') await executeCheckOut({ faceVerified: true });
    setPendingAction(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20, month: filterMonth, year: filterYear };
      if (filterEmployee) params.employeeId = filterEmployee;
      if (filterStatus) params.status = filterStatus;
      const res = await attendanceApi.getAll(params);
      setRecords(res.data || []); setTotal(res.pagination?.total ?? 0);
    } catch { setRecords([]); setTotal(0); }
    finally { setLoading(false); }
  }, [page, filterEmployee, filterMonth, filterYear, filterStatus]);

  const loadTodaySummary = useCallback(async () => {
    try { setTodaySummary(await attendanceApi.getSummary({ month: now.getMonth() + 1, year: now.getFullYear() }) || {}); } catch {}
  }, []);

  const loadTodayRecord = useCallback(async () => {
    if (!isEmployee) return;
    try { setTodayRecord(await attendanceApi.getTodayStatus()); } catch {}
  }, [isEmployee]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadTodaySummary(); }, [loadTodaySummary]);
  useEffect(() => { loadTodayRecord(); }, [loadTodayRecord]);
  useEffect(() => {
    if (isHR) usersApi.getAll({ limit: 200 }).then(r => setEmployees((r.data || []).filter((u: User) => u.role !== 'admin'))).catch(() => {});
  }, [isHR]);

  const openMark = () => { setEditRecord(null); setForm({ employeeId: '', date: now.toISOString().slice(0, 10), status: 'Present', checkIn: '', checkOut: '', notes: '' }); setShowModal(true); };

  const openEdit = (rec: Attendance) => {
    setEditRecord(rec);
    const emp = rec.employeeId as User;
    setForm({ employeeId: emp?._id || (rec.employeeId as string), date: rec.date.slice(0, 10), status: rec.status, checkIn: rec.checkIn ? new Date(rec.checkIn).toTimeString().slice(0, 5) : '', checkOut: rec.checkOut ? new Date(rec.checkOut).toTimeString().slice(0, 5) : '', notes: rec.notes || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const body: Record<string, unknown> = { employeeId: form.employeeId, date: form.date, status: form.status, notes: form.notes || undefined };
      if (form.checkIn) body.checkIn = `${form.date}T${form.checkIn}:00`;
      if (form.checkOut) body.checkOut = `${form.date}T${form.checkOut}:00`;
      if (editRecord) await attendanceApi.update(editRecord._id, body);
      else await attendanceApi.mark(body);
      setShowModal(false); load(); loadTodaySummary();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const calendarMap: Record<number, Attendance> = {};
  records.forEach(r => { calendarMap[new Date(r.date).getDate()] = r; });
  const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();
  const firstDayOfMonth = new Date(filterYear, filterMonth - 1, 1).getDay();
  const todayDate = now.getDate();
  const isCurrentMonth = filterMonth === now.getMonth() + 1 && filterYear === now.getFullYear();

  const methodBadge: Record<string, { label: string; color: string }> = {
    geo:       { label: '📍 Geo Location Active', color: 'bg-violet-100 text-violet-700' },
    biometric: { label: '🔒 Biometric Device Active', color: 'bg-blue-100 text-blue-700' },
    face:      { label: '📷 Face Recognition Active', color: 'bg-emerald-100 text-emerald-700' },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-header">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} records</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isHR && (
            <ExcelImportButton
              entityName="Attendance"
              columnHint="date (YYYY-MM-DD), status (Present/Absent/Half Day/Leave/Holiday), checkIn (HH:MM), checkOut (HH:MM), notes"
              onImport={async (rows) => {
                let imported = 0;
                for (const row of rows) {
                  const date = row.date || row.Date || '';
                  if (!date) continue;
                  const st = row.status || row.Status || 'Present';
                  const status = (['Present','Absent','Half Day','Leave','Holiday'].includes(st) ? st : 'Present') as typeof STATUS_OPTIONS[number];
                  try { await attendanceApi.mark({ date, status, checkIn: row.checkIn || undefined, checkOut: row.checkOut || undefined, notes: row.notes || '' }); imported++; } catch { /**/ }
                }
                load(); return { imported };
              }}
            />
          )}
          {isHR && (
            <button onClick={openMark} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Mark Attendance
            </button>
          )}
        </div>
      </div>

      {/* HR: method selector */}
      {isHR && !settingsLoading && (
        <AttendanceMethodSelector settings={attSettings} employees={employees} onSave={handleSaveSettings} />
      )}
      {isHR && settingsLoading && <div className="card animate-pulse h-16" />}

      {/* Employee check-in panel */}
      {isEmployee && (
        <div className="card border border-violet-100 bg-gradient-to-r from-violet-50 to-white">
          {attSettings.activeMethod !== 'none' && methodBadge[attSettings.activeMethod] && (
            <span className={`inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full mb-3 ${methodBadge[attSettings.activeMethod].color}`}>
              {methodBadge[attSettings.activeMethod].label}
            </span>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-700">Today — {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              {todayRecord ? (
                <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><LogIn size={13} className="text-green-600" /> Check-in: <strong className="text-gray-700">{formatTime(todayRecord.checkIn)}</strong></span>
                  {todayRecord.checkOut && <span className="flex items-center gap-1"><LogOut size={13} className="text-red-500" /> Check-out: <strong className="text-gray-700">{formatTime(todayRecord.checkOut)}</strong></span>}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[todayRecord.status] || ''}`}>{todayRecord.status}</span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1">You haven't checked in yet today</p>
              )}
              {attSettings.activeMethod === 'biometric' && (
                <p className="text-xs text-blue-600 font-medium mt-2">Please use the biometric terminal at your office to mark attendance.</p>
              )}
            </div>
            {attSettings.activeMethod !== 'biometric' && (
              <div className="flex gap-3">
                {!todayRecord?.checkIn && (
                  <button onClick={handleCheckIn} disabled={settingsLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 active:scale-95 transition-all">
                    {attSettings.activeMethod === 'face' ? <ScanFace size={15} /> : attSettings.activeMethod === 'geo' ? <MapPin size={15} /> : <LogIn size={15} />}
                    {settingsLoading ? 'Loading…' : attSettings.activeMethod === 'face' ? 'Scan Face & Check In' : attSettings.activeMethod === 'geo' ? 'Verify Location & Check In' : 'Check In'}
                  </button>
                )}
                {todayRecord?.checkIn && !todayRecord?.checkOut && (
                  <button onClick={handleCheckOut} disabled={settingsLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50 active:scale-95 transition-all">
                    {attSettings.activeMethod === 'face' ? <ScanFace size={15} /> : attSettings.activeMethod === 'geo' ? <MapPin size={15} /> : <LogOut size={15} />}
                    {attSettings.activeMethod === 'face' ? 'Scan Face & Check Out' : attSettings.activeMethod === 'geo' ? 'Verify Location & Check Out' : 'Check Out'}
                  </button>
                )}
                {todayRecord?.checkIn && todayRecord?.checkOut && (
                  <span className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-500 rounded-xl text-sm font-medium">
                    <CalendarCheck size={14} className="text-green-600" /> Done for today
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HR Stats */}
      {isHR && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Employees', value: employees.length, icon: Users, color: 'text-violet-600', bg: 'bg-violet-100' },
            { label: 'Present this month', value: todaySummary['Present'] || 0, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-100' },
            { label: 'Absent this month', value: todaySummary['Absent'] || 0, icon: UserX, color: 'text-red-600', bg: 'bg-red-100' },
            { label: 'On Leave this month', value: todaySummary['Leave'] || 0, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="glass-card flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}><Icon size={18} className={color} /></div>
              <div><p className="text-2xl font-bold text-gray-900">{value}</p><p className="text-xs text-gray-400">{label}</p></div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {isHR && (
          <select value={filterEmployee} onChange={e => { setFilterEmployee(e.target.value); setPage(1); }} className="input-field w-auto">
            <option value="">All Employees</option>
            {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name} ({emp.role})</option>)}
          </select>
        )}
        <select value={filterMonth} onChange={e => { setFilterMonth(Number(e.target.value)); setPage(1); }} className="input-field w-auto">
          {MONTHS_SHORT.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={filterYear} onChange={e => { setFilterYear(Number(e.target.value)); setPage(1); }} className="input-field w-28" min={2020} max={2099} />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Calendar (employee) */}
      {isEmployee && (
        <div className="card !p-0 overflow-hidden max-w-sm">
          <div className="bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2.5 flex items-center justify-between">
            <div>
              <p className="text-violet-200 text-[10px] font-semibold uppercase tracking-widest">{filterYear}</p>
              <h2 className="text-white text-base font-bold">{MONTHS[filterMonth - 1]}</h2>
            </div>
            <div className="flex gap-1.5">
              {[
                { label: 'P', count: Object.values(calendarMap).filter(r => r.status === 'Present').length, color: 'bg-green-400/30 text-green-100' },
                { label: 'A', count: Object.values(calendarMap).filter(r => r.status === 'Absent').length, color: 'bg-red-400/30 text-red-100' },
                { label: 'L', count: Object.values(calendarMap).filter(r => r.status === 'Leave' || r.status === 'Half Day').length, color: 'bg-blue-400/30 text-blue-100' },
              ].map(({ label, count, color }) => (
                <div key={label} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{count} {label}</div>
              ))}
            </div>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-7 mb-0.5">
              {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="text-center text-[10px] font-bold text-gray-400 py-0.5">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const rec = calendarMap[day];
                const isToday = isCurrentMonth && day === todayDate;
                const cellStyle: Record<string, string> = { Present: 'bg-green-500 text-white', Absent: 'bg-red-500 text-white', 'Half Day': 'bg-amber-400 text-white', Leave: 'bg-blue-500 text-white', Holiday: 'bg-gray-300 text-gray-700' };
                return (
                  <div key={day} className="flex items-center justify-center py-0.5">
                    <div title={rec ? `${rec.status}${rec.checkIn ? ` · In: ${formatTime(rec.checkIn)}` : ''}${rec.checkOut ? ` · Out: ${formatTime(rec.checkOut)}` : ''}` : 'No record'}
                      className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold cursor-default ${rec ? cellStyle[rec.status] : 'text-gray-400 hover:bg-gray-100'} ${isToday && !rec ? 'ring-2 ring-violet-500 ring-offset-1 text-violet-700 font-bold' : ''} ${isToday && rec ? 'ring-2 ring-violet-400 ring-offset-1' : ''}`}>
                      {day}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="border-t border-gray-100 px-3 py-2 flex flex-wrap gap-3 bg-gray-50/50">
            {[{ label: 'Present', color: 'bg-green-500' }, { label: 'Absent', color: 'bg-red-500' }, { label: 'Half Day', color: 'bg-amber-400' }, { label: 'Leave', color: 'bg-blue-500' }, { label: 'Today', color: 'ring-2 ring-violet-500 bg-white' }].map(({ label, color }) => (
              <span key={label} className="flex items-center gap-1 text-[10px] text-gray-500"><span className={`w-3 h-3 rounded-full inline-block ${color}`} />{label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Records table — desktop */}
      <div className="glass-card !p-0 overflow-hidden hidden md:block">
        {loading ? <LoadingSpinner className="h-48" /> : records.length === 0 ? (
          <div className="text-center text-gray-400 py-16 flex flex-col items-center gap-2">
            <CalendarCheck size={36} className="opacity-30" /><p>No attendance records for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {isHR && <th className="table-header">Employee</th>}
                  <th className="table-header">Date</th><th className="table-header">Check In</th>
                  <th className="table-header">Check Out</th><th className="table-header">Status</th>
                  <th className="table-header">Notes</th>{isHR && <th className="table-header">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map(rec => {
                  const emp = rec.employeeId as User;
                  return (
                    <tr key={rec._id} className="hover:bg-violet-50/20 transition-colors">
                      {isHR && <td className="table-cell font-medium">{emp?.name || '—'}</td>}
                      <td className="table-cell text-gray-500">{formatDate(rec.date)}</td>
                      <td className="table-cell text-gray-500">{formatTime(rec.checkIn)}</td>
                      <td className="table-cell text-gray-500">{formatTime(rec.checkOut)}</td>
                      <td className="table-cell"><span className={`badge ${statusColors[rec.status] || 'bg-gray-100 text-gray-700'}`}>{rec.status}</span></td>
                      <td className="table-cell text-gray-400 text-xs max-w-xs truncate">{rec.notes || '—'}</td>
                      {isHR && <td className="table-cell"><button onClick={() => openEdit(rec)} className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 px-2.5 py-1 rounded-lg font-medium">Edit</button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
              <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Records — mobile cards */}
      {loading ? (
        <LoadingSpinner className="h-48 md:hidden" />
      ) : records.length === 0 ? (
        <div className="md:hidden text-center text-gray-400 py-16 glass-card flex flex-col items-center gap-2">
          <CalendarCheck size={36} className="opacity-30" /><p>No attendance records for this period</p>
        </div>
      ) : (
        <div className="md:hidden space-y-3">
          {records.map(rec => {
            const emp = rec.employeeId as User;
            return (
              <div key={rec._id} className="glass-card !p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {isHR && <p className="font-semibold text-gray-900 text-sm">{emp?.name || '—'}</p>}
                    <p className={`text-xs text-gray-500 ${isHR ? 'mt-0.5' : 'font-semibold text-gray-900'}`}>{formatDate(rec.date)}</p>
                  </div>
                  <span className={`badge flex-shrink-0 ${statusColors[rec.status] || 'bg-gray-100 text-gray-700'}`}>{rec.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                  <div><span className="text-gray-400">Check In</span><p className="font-medium text-gray-700">{formatTime(rec.checkIn) || '—'}</p></div>
                  <div><span className="text-gray-400">Check Out</span><p className="font-medium text-gray-700">{formatTime(rec.checkOut) || '—'}</p></div>
                </div>
                {rec.notes && <p className="text-xs text-gray-400 truncate">{rec.notes}</p>}
                {isHR && (
                  <div className="pt-1 border-t border-gray-100">
                    <button onClick={() => openEdit(rec)} className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 px-2.5 py-1 rounded-lg font-medium">Edit</button>
                  </div>
                )}
              </div>
            );
          })}
          {total > 20 && (
            <div className="flex items-center justify-between py-2">
              <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
                <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Geo verify modal */}
      <GeoVerifyModal
        isOpen={showGeoVerify}
        onClose={() => { setShowGeoVerify(false); setPendingAction(null); }}
        onVerified={onGeoVerified}
        geo={attSettings.geo}
        action={pendingAction || 'checkin'}
      />

      {/* Face scan modal */}
      <FaceScanModal
        isOpen={showFaceScan}
        onClose={() => { setShowFaceScan(false); setPendingAction(null); }}
        onVerified={onFaceVerified}
        registeredFaces={attSettings.face.employees}
        action={pendingAction || 'checkin'}
      />

      {/* Mark / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editRecord ? 'Edit Attendance' : 'Mark Attendance'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editRecord && (
            <div>
              <label className="label">Employee *</label>
              <select required className="input-field" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                <option value="">Select employee</option>
                {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name} ({emp.role})</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Date *</label><input required type="date" className="input-field" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label className="label">Status *</label>
              <select required className="input-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as typeof STATUS_OPTIONS[number] }))}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Check In</label><input type="time" className="input-field" value={form.checkIn} onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))} /></div>
            <div><label className="label">Check Out</label><input type="time" className="input-field" value={form.checkOut} onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))} /></div>
          </div>
          <div><label className="label">Notes</label><textarea rows={2} className="input-field" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : editRecord ? 'Update' : 'Mark Attendance'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
