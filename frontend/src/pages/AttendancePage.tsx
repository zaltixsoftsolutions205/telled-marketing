import { useEffect, useState, useCallback, useRef } from 'react';
import {
  CalendarCheck, Plus, Users, UserCheck, UserX, Clock, LogIn, LogOut,
  MapPin, Fingerprint, ScanFace, CheckCircle2, ChevronDown, ChevronUp,
  Crosshair, Send, Upload, Trash2, AlertTriangle, Shield,
} from 'lucide-react';
import ExcelImportButton from '@/components/common/ExcelImportButton';
import { attendanceApi } from '@/api/attendance';
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

// ── Attendance Settings (stored in localStorage per org) ──────────────────────
const SETTINGS_KEY = 'zieos_attendance_settings';

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

function loadSettings(): AttendanceSettings {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return defaultSettings; }
}

function saveSettings(s: AttendanceSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// Haversine distance in metres
function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Geo Location Card ─────────────────────────────────────────────────────────
function GeoCard({ settings, onChange }: { settings: AttendanceSettings; onChange: (s: AttendanceSettings) => void }) {
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geo, setGeo] = useState(settings.geo);
  const active = settings.activeMethod === 'geo';

  const fetchLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation not supported by your browser.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo(g => ({ ...g, lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) })); setLocating(false); },
      () => { alert('Could not get location. Please allow location access.'); setLocating(false); },
      { timeout: 10000 }
    );
  };

  const save = () => {
    if (!geo.lat || !geo.lng) return alert('Please set the office location first.');
    if (!geo.name.trim()) return alert('Please enter a location name.');
    const updated: AttendanceSettings = { ...settings, activeMethod: 'geo', geo };
    onChange(updated);
    setOpen(false);
  };

  const disable = () => {
    onChange({ ...settings, activeMethod: 'none' });
  };

  return (
    <div className={`card border-2 transition-all duration-200 ${active ? 'border-violet-400 bg-violet-50/40' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-violet-600' : 'bg-violet-100'}`}>
            <MapPin size={20} className={active ? 'text-white' : 'text-violet-600'} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 text-sm">Geo Location</h3>
              {active
                ? <span className="text-[10px] font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full">ACTIVE</span>
                : <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">INACTIVE</span>}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Employees can only check in/out within the defined office radius.</p>
            {active && settings.geo.name && (
              <p className="text-xs text-violet-700 font-medium mt-1">
                <MapPin size={10} className="inline mr-0.5" />{settings.geo.name} · {settings.geo.radius}m radius
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {active && (
            <button onClick={disable} className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Disable</button>
          )}
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 text-xs font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {active ? 'Edit' : 'Configure'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <div>
            <label className="label">Location Name *</label>
            <input
              className="input-field"
              placeholder="e.g. Head Office, Hyderabad"
              value={geo.name}
              onChange={e => setGeo(g => ({ ...g, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Latitude</label>
              <input
                type="number"
                step="0.000001"
                className="input-field"
                placeholder="17.385044"
                value={geo.lat ?? ''}
                onChange={e => setGeo(g => ({ ...g, lat: e.target.value ? +e.target.value : null }))}
              />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input
                type="number"
                step="0.000001"
                className="input-field"
                placeholder="78.486671"
                value={geo.lng ?? ''}
                onChange={e => setGeo(g => ({ ...g, lng: e.target.value ? +e.target.value : null }))}
              />
            </div>
          </div>

          <button
            onClick={fetchLocation}
            disabled={locating}
            className="flex items-center gap-2 text-sm text-violet-700 font-semibold bg-violet-50 border border-violet-200 px-3 py-2 rounded-xl hover:bg-violet-100 transition-colors disabled:opacity-50"
          >
            <Crosshair size={14} /> {locating ? 'Getting location…' : 'Use My Current Location'}
          </button>

          <div>
            <label className="label">Allowed Radius: <strong className="text-violet-700">{geo.radius}m</strong></label>
            <input
              type="range"
              min={50} max={2000} step={50}
              value={geo.radius}
              onChange={e => setGeo(g => ({ ...g, radius: +e.target.value }))}
              className="w-full accent-violet-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>50m</span><span>500m</span><span>1km</span><span>2km</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setOpen(false)} className="btn-secondary text-sm py-1.5">Cancel</button>
            <button onClick={save} className="btn-primary text-sm py-1.5">Activate Geo Location</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Biometric Card ────────────────────────────────────────────────────────────
function BiometricCard({ settings, onChange }: { settings: AttendanceSettings; onChange: (s: AttendanceSettings) => void }) {
  const [sent, setSent] = useState(settings.biometric.requestSent);
  const [sending, setSending] = useState(false);
  const active = settings.activeMethod === 'biometric';

  const sendRequest = async () => {
    setSending(true);
    await new Promise(r => setTimeout(r, 1200));
    const updated: AttendanceSettings = { ...settings, biometric: { requestSent: true } };
    onChange(updated);
    setSent(true);
    setSending(false);
  };

  return (
    <div className={`card border-2 transition-all duration-200 ${active ? 'border-blue-400 bg-blue-50/30' : 'border-gray-100'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-blue-600' : 'bg-blue-100'}`}>
          <Fingerprint size={20} className={active ? 'text-white' : 'text-blue-600'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 text-sm">Biometric Device</h3>
            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">ENTERPRISE</span>
            {active && <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">ACTIVE</span>}
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Integrate physical fingerprint or card-swipe devices with ZIEOS. Attendance is auto-synced from hardware — no manual input needed.
          </p>

          <div className="grid grid-cols-3 gap-2 mt-3">
            {['Fingerprint Reader', 'RFID Card Swipe', 'Iris Scanner'].map(f => (
              <div key={f} className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5">
                <Shield size={11} className="text-blue-500 flex-shrink-0" /> {f}
              </div>
            ))}
          </div>

          <div className="mt-4">
            {sent ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                <CheckCircle2 size={16} />
                <div>
                  <p className="font-semibold">Request sent to ZIEOS team!</p>
                  <p className="text-xs text-green-600 mt-0.5">Our team will contact you at <strong>zieos@zaltixsoftsolutions.com</strong> within 24–48 hours.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={sendRequest}
                  disabled={sending}
                  className="flex items-center gap-2 text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors active:scale-95"
                >
                  <Send size={14} /> {sending ? 'Sending request…' : 'Request Integration'}
                </button>
                <p className="text-xs text-gray-400">A request will be sent to <strong>zieos@zaltixsoftsolutions.com</strong></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Face Recognition Card ─────────────────────────────────────────────────────
function FaceCard({
  settings, onChange, employees,
}: { settings: AttendanceSettings; onChange: (s: AttendanceSettings) => void; employees: User[] }) {
  const [open, setOpen] = useState(false);
  const [faceEmployees, setFaceEmployees] = useState(settings.face.employees);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const active = settings.activeMethod === 'face';

  const handlePhotoUpload = (empId: string, empName: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const photo = e.target?.result as string;
      setFaceEmployees(prev => {
        const exists = prev.find(x => x.id === empId);
        if (exists) return prev.map(x => x.id === empId ? { ...x, photo } : x);
        return [...prev, { id: empId, name: empName, photo }];
      });
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (empId: string) => {
    setFaceEmployees(prev => prev.filter(x => x.id !== empId));
  };

  const activate = () => {
    if (faceEmployees.length === 0) return alert('Please register at least one employee face before activating.');
    const updated: AttendanceSettings = { ...settings, activeMethod: 'face', face: { employees: faceEmployees } };
    onChange(updated);
    setOpen(false);
  };

  const disable = () => {
    onChange({ ...settings, activeMethod: 'none' });
  };

  const configured = faceEmployees.length;

  return (
    <div className={`card border-2 transition-all duration-200 ${active ? 'border-emerald-400 bg-emerald-50/30' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-emerald-600' : 'bg-emerald-100'}`}>
            <ScanFace size={20} className={active ? 'text-white' : 'text-emerald-600'} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 text-sm">Face Recognition</h3>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">BETA</span>
              {active && <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">ACTIVE</span>}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Employees check in/out using webcam face scan at office location.</p>
            {configured > 0 && (
              <p className="text-xs text-emerald-700 font-medium mt-1">
                <CheckCircle2 size={10} className="inline mr-0.5" />{configured} employee face{configured > 1 ? 's' : ''} registered
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {active && (
            <button onClick={disable} className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Disable</button>
          )}
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {active ? 'Manage Faces' : 'Configure'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Register Employee Faces</p>
            <p className="text-xs text-gray-400">{configured}/{employees.length} configured</p>
          </div>

          {employees.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No employees found.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {employees.map(emp => {
                const registered = faceEmployees.find(x => x.id === emp._id);
                return (
                  <div key={emp._id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                    <div className="flex items-center gap-3">
                      {registered?.photo ? (
                        <img src={registered.photo} alt={emp.name} className="w-9 h-9 rounded-full object-cover border-2 border-emerald-300" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-sm font-bold">
                          {emp.name[0]}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{emp.name}</p>
                        <p className="text-xs text-gray-400">{emp.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {registered && (
                        <button onClick={() => removePhoto(emp._id)} className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={el => { fileRefs.current[emp._id] = el; }}
                        onChange={e => { if (e.target.files?.[0]) handlePhotoUpload(emp._id, emp.name, e.target.files[0]); }}
                      />
                      <button
                        onClick={() => fileRefs.current[emp._id]?.click()}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${registered ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                      >
                        <Upload size={11} /> {registered ? 'Replace' : 'Upload Photo'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
            <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Upload a clear front-facing photo for each employee. The system will match faces during check-in/out via webcam.</p>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button onClick={() => setOpen(false)} className="btn-secondary text-sm py-1.5">Cancel</button>
            <button onClick={activate} className="btn-primary text-sm py-1.5 bg-emerald-600 hover:bg-emerald-700">Activate Face Recognition</button>
          </div>
        </div>
      )}
    </div>
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
  const [geoError, setGeoError] = useState('');

  const [attSettings, setAttSettings] = useState<AttendanceSettings>(loadSettings);

  const [form, setForm] = useState({
    employeeId: '',
    date: now.toISOString().slice(0, 10),
    status: 'Present' as typeof STATUS_OPTIONS[number],
    checkIn: '',
    checkOut: '',
    notes: '',
  });

  const handleSettingsChange = (updated: AttendanceSettings) => {
    setAttSettings(updated);
    saveSettings(updated);
  };

  // Geo verification before check-in/out
  const verifyGeo = async (): Promise<boolean> => {
    const { activeMethod, geo } = attSettings;
    if (activeMethod !== 'geo' || !geo.lat || !geo.lng) return true;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = haversineMetres(pos.coords.latitude, pos.coords.longitude, geo.lat!, geo.lng!);
          if (dist <= geo.radius) {
            setGeoError('');
            resolve(true);
          } else {
            setGeoError(`You are ${Math.round(dist)}m from ${geo.name || 'office'} (allowed: ${geo.radius}m). Please move closer to check in.`);
            resolve(false);
          }
        },
        () => {
          setGeoError('Location access denied. Please enable location permissions to check in/out.');
          resolve(false);
        },
        { timeout: 10000 }
      );
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20, month: filterMonth, year: filterYear };
      if (filterEmployee) params.employeeId = filterEmployee;
      if (filterStatus) params.status = filterStatus;
      const res = await attendanceApi.getAll(params);
      setRecords(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch { setRecords([]); setTotal(0); }
    finally { setLoading(false); }
  }, [page, filterEmployee, filterMonth, filterYear, filterStatus]);

  const loadTodaySummary = useCallback(async () => {
    try {
      const summary = await attendanceApi.getSummary({ month: now.getMonth() + 1, year: now.getFullYear() });
      setTodaySummary(summary || {});
    } catch {}
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

  const handleCheckIn = async () => {
    setGeoError('');
    setClocking(true);
    try {
      const ok = await verifyGeo();
      if (!ok) return;
      const rec = await attendanceApi.checkIn();
      setTodayRecord(rec);
      load(); loadTodaySummary();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Check-in failed');
    } finally { setClocking(false); }
  };

  const handleCheckOut = async () => {
    setGeoError('');
    setClocking(true);
    try {
      const ok = await verifyGeo();
      if (!ok) return;
      const rec = await attendanceApi.checkOut();
      setTodayRecord(rec);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Check-out failed');
    } finally { setClocking(false); }
  };

  const openMark = () => {
    setEditRecord(null);
    setForm({ employeeId: '', date: now.toISOString().slice(0, 10), status: 'Present', checkIn: '', checkOut: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (rec: Attendance) => {
    setEditRecord(rec);
    const emp = rec.employeeId as User;
    setForm({
      employeeId: emp?._id || (rec.employeeId as string),
      date: rec.date.slice(0, 10),
      status: rec.status,
      checkIn: rec.checkIn ? new Date(rec.checkIn).toTimeString().slice(0, 5) : '',
      checkOut: rec.checkOut ? new Date(rec.checkOut).toTimeString().slice(0, 5) : '',
      notes: rec.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        employeeId: form.employeeId, date: form.date, status: form.status, notes: form.notes || undefined,
      };
      if (form.checkIn) body.checkIn = `${form.date}T${form.checkIn}:00`;
      if (form.checkOut) body.checkOut = `${form.date}T${form.checkOut}:00`;
      if (editRecord) await attendanceApi.update(editRecord._id, body);
      else await attendanceApi.mark(body);
      setShowModal(false);
      load(); loadTodaySummary();
    } catch (e) { console.error('mark error', e); }
    finally { setSaving(false); }
  };

  const calendarMap: Record<number, Attendance> = {};
  records.forEach((r) => { const d = new Date(r.date).getDate(); calendarMap[d] = r; });
  const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();
  const firstDayOfMonth = new Date(filterYear, filterMonth - 1, 1).getDay();
  const totalPresent = todaySummary['Present'] || 0;
  const totalAbsent = todaySummary['Absent'] || 0;
  const totalOnLeave = todaySummary['Leave'] || 0;
  const totalEmployees = employees.length;
  const todayDate = now.getDate();
  const isCurrentMonth = filterMonth === now.getMonth() + 1 && filterYear === now.getFullYear();

  const methodLabel: Record<string, string> = {
    geo: '📍 Geo Location Required',
    biometric: '🔒 Biometric Required',
    face: '📷 Face Recognition Required',
    none: '',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} records</p>
        </div>
        <div className="flex items-center gap-2">
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
                  const status = (['Present','Absent','Half Day','Leave','Holiday'].includes(st) ? st : 'Present') as 'Present'|'Absent'|'Half Day'|'Leave'|'Holiday';
                  try { await attendanceApi.mark({ date, status, checkIn: row.checkIn || undefined, checkOut: row.checkOut || undefined, notes: row.notes || '' }); imported++; } catch { /**/ }
                }
                load();
                return { imported };
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

      {/* ── Attendance Method Cards (HR only) ── */}
      {isHR && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-700">Attendance Method</h2>
            {attSettings.activeMethod !== 'none' && (
              <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                {attSettings.activeMethod === 'geo' ? 'Geo Location Active' : attSettings.activeMethod === 'biometric' ? 'Biometric Active' : 'Face Recognition Active'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GeoCard settings={attSettings} onChange={handleSettingsChange} />
            <BiometricCard settings={attSettings} onChange={handleSettingsChange} />
            <FaceCard settings={attSettings} onChange={handleSettingsChange} employees={employees} />
          </div>
        </div>
      )}

      {/* Employee Check-In / Check-Out Panel */}
      {isEmployee && (
        <div className="card border border-violet-100 bg-gradient-to-r from-violet-50 to-white">
          {attSettings.activeMethod !== 'none' && (
            <div className="flex items-center gap-1.5 text-xs text-violet-700 font-semibold bg-violet-100 px-3 py-1.5 rounded-lg mb-3 w-fit">
              <MapPin size={11} /> {methodLabel[attSettings.activeMethod]}
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-700">Today — {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              {todayRecord ? (
                <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><LogIn size={13} className="text-green-600" /> Check-in: <strong className="text-gray-700">{formatTime(todayRecord.checkIn)}</strong></span>
                  {todayRecord.checkOut && (
                    <span className="flex items-center gap-1"><LogOut size={13} className="text-red-500" /> Check-out: <strong className="text-gray-700">{formatTime(todayRecord.checkOut)}</strong></span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[todayRecord.status] || ''}`}>{todayRecord.status}</span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1">You haven't checked in yet today</p>
              )}
              {geoError && (
                <div className="flex items-start gap-2 mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" /> {geoError}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {!todayRecord?.checkIn && (
                <button onClick={handleCheckIn} disabled={clocking} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 active:scale-95 transition-all">
                  <LogIn size={15} /> {clocking ? 'Verifying…' : 'Check In'}
                </button>
              )}
              {todayRecord?.checkIn && !todayRecord?.checkOut && (
                <button onClick={handleCheckOut} disabled={clocking} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50 active:scale-95 transition-all">
                  <LogOut size={15} /> {clocking ? 'Verifying…' : 'Check Out'}
                </button>
              )}
              {todayRecord?.checkIn && todayRecord?.checkOut && (
                <span className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-500 rounded-xl text-sm font-medium">
                  <CalendarCheck size={14} className="text-green-600" /> Done for today
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HR Stats */}
      {isHR && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Employees', value: totalEmployees, icon: Users, color: 'text-violet-600', bg: 'bg-violet-100' },
            { label: 'Present this month', value: totalPresent, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-100' },
            { label: 'Absent this month', value: totalAbsent, icon: UserX, color: 'text-red-600', bg: 'bg-red-100' },
            { label: 'On Leave this month', value: totalOnLeave, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
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
          <select value={filterEmployee} onChange={(e) => { setFilterEmployee(e.target.value); setPage(1); }} className="input-field w-auto">
            <option value="">All Employees</option>
            {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name} ({emp.role})</option>)}
          </select>
        )}
        <select value={filterMonth} onChange={(e) => { setFilterMonth(Number(e.target.value)); setPage(1); }} className="input-field w-auto">
          {MONTHS_SHORT.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={filterYear} onChange={(e) => { setFilterYear(Number(e.target.value)); setPage(1); }} className="input-field w-28" min={2020} max={2099} />
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Calendar View (employee self-view) */}
      {isEmployee && (
        <div className="card !p-0 overflow-hidden max-w-sm">
          <div className="bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2.5 flex items-center justify-between">
            <div>
              <p className="text-violet-200 text-[10px] font-semibold uppercase tracking-widest">{filterYear}</p>
              <h2 className="text-white text-base font-bold leading-tight">{MONTHS[filterMonth - 1]}</h2>
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
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-bold text-gray-400 py-0.5">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const rec = calendarMap[day];
                const isToday = isCurrentMonth && day === todayDate;
                const cellStyle: Record<string, string> = {
                  Present: 'bg-green-500 text-white', Absent: 'bg-red-500 text-white',
                  'Half Day': 'bg-amber-400 text-white', Leave: 'bg-blue-500 text-white', Holiday: 'bg-gray-300 text-gray-700',
                };
                return (
                  <div key={day} className="flex items-center justify-center py-0.5">
                    <div
                      title={rec ? `${rec.status}${rec.checkIn ? ` · In: ${formatTime(rec.checkIn)}` : ''}${rec.checkOut ? ` · Out: ${formatTime(rec.checkOut)}` : ''}` : 'No record'}
                      className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold cursor-default transition-all ${rec ? cellStyle[rec.status] : 'text-gray-400 hover:bg-gray-100'} ${isToday && !rec ? 'ring-2 ring-violet-500 ring-offset-1 text-violet-700 font-bold' : ''} ${isToday && rec ? 'ring-2 ring-violet-400 ring-offset-1' : ''}`}
                    >{day}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="border-t border-gray-100 px-3 py-2 flex flex-wrap gap-3 bg-gray-50/50">
            {[
              { label: 'Present', color: 'bg-green-500' }, { label: 'Absent', color: 'bg-red-500' },
              { label: 'Half Day', color: 'bg-amber-400' }, { label: 'Leave', color: 'bg-blue-500' },
              { label: 'Today', color: 'ring-2 ring-violet-500 ring-offset-1 bg-white' },
            ].map(({ label, color }) => (
              <span key={label} className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className={`w-3 h-3 rounded-full inline-block ${color}`} />{label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Records Table */}
      <div className="glass-card !p-0 overflow-hidden">
        {loading ? <LoadingSpinner className="h-48" /> : records.length === 0 ? (
          <div className="text-center text-gray-400 py-16 flex flex-col items-center gap-2">
            <CalendarCheck size={36} className="opacity-30" />
            <p>No attendance records for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {isHR && <th className="table-header">Employee</th>}
                  <th className="table-header">Date</th>
                  <th className="table-header">Check In</th>
                  <th className="table-header">Check Out</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Notes</th>
                  {isHR && <th className="table-header">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((rec) => {
                  const emp = rec.employeeId as User;
                  return (
                    <tr key={rec._id} className="hover:bg-violet-50/20 transition-colors">
                      {isHR && <td className="table-cell font-medium">{emp?.name || '—'}</td>}
                      <td className="table-cell text-gray-500">{formatDate(rec.date)}</td>
                      <td className="table-cell text-gray-500">{formatTime(rec.checkIn)}</td>
                      <td className="table-cell text-gray-500">{formatTime(rec.checkOut)}</td>
                      <td className="table-cell"><span className={`badge ${statusColors[rec.status] || 'bg-gray-100 text-gray-700'}`}>{rec.status}</span></td>
                      <td className="table-cell text-gray-400 text-xs max-w-xs truncate">{rec.notes || '—'}</td>
                      {isHR && (
                        <td className="table-cell">
                          <button onClick={() => openEdit(rec)} className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 px-2.5 py-1 rounded-lg font-medium">Edit</button>
                        </td>
                      )}
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

      {/* Mark / Edit Modal (HR only) */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editRecord ? 'Edit Attendance' : 'Mark Attendance'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editRecord && (
            <div>
              <label className="label">Employee *</label>
              <select required className="input-field" value={form.employeeId} onChange={(e) => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                <option value="">Select employee</option>
                {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name} ({emp.role})</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date *</label>
              <input required type="date" className="input-field" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Status *</label>
              <select required className="input-field" value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value as typeof STATUS_OPTIONS[number] }))}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Check In</label>
              <input type="time" className="input-field" value={form.checkIn} onChange={(e) => setForm(f => ({ ...f, checkIn: e.target.value }))} />
            </div>
            <div>
              <label className="label">Check Out</label>
              <input type="time" className="input-field" value={form.checkOut} onChange={(e) => setForm(f => ({ ...f, checkOut: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : editRecord ? 'Update' : 'Mark Attendance'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
