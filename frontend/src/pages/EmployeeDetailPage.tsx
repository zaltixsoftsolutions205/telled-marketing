import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Mail, Phone, Building2, DollarSign,
  Upload, Trash2, FileText, Download, Plus, Save,
  Heart, CreditCard, Shield, Calendar,
} from 'lucide-react';
import { employeesApi } from '@/api/employees';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate } from '@/utils/formatters';
import type { Role } from '@/types';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', sales: 'Sales',
  engineer: 'Engineer', hr: 'HR', finance: 'Finance',
};
const ROLE_COLOR: Record<string, string> = {
  admin:    'bg-violet-100 text-violet-800',
  manager:  'bg-purple-100 text-purple-800',
  sales:    'bg-blue-100 text-blue-800',
  engineer: 'bg-emerald-100 text-emerald-800',
  hr:       'bg-amber-100 text-amber-800',
  finance:  'bg-orange-100 text-orange-800',
};

const ALL_MODULES = [
  { key: 'leads',         label: 'Leads & DRFs' },
  { key: 'quotations',    label: 'Quotations' },
  { key: 'purchases',     label: 'Purchase Orders' },
  { key: 'accounts',      label: 'Accounts' },
  { key: 'support',       label: 'Support Tickets' },
  { key: 'installations', label: 'Installations' },
  { key: 'invoices',      label: 'Invoices' },
  { key: 'payments',      label: 'Payments' },
  { key: 'salary',        label: 'Salary & Payroll' },
  { key: 'attendance',    label: 'Attendance' },
  { key: 'leaves',        label: 'Leave Management' },
  { key: 'visits',        label: 'Visits & Claims' },
  { key: 'contacts',      label: 'Contacts' },
  { key: 'timesheet',     label: 'Timesheet' },
];

const DOC_LABELS = [
  'Aadhar Card', 'PAN Card', 'Resume / CV', 'Offer Letter',
  'Appointment Letter', 'Experience Certificate', 'Education Certificate',
  'Bank Account Details', 'Passport', 'Other',
];

type Tab = 'profile' | 'personal' | 'documents' | 'access';

function DetailRow({ label, value }: { label: string; value?: string | number }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const isHR = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'hr';

  const [employee, setEmployee] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Edit form (profile tab)
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  // Edit personal details
  const [editPersonal, setEditPersonal] = useState<Record<string, string>>({});
  const [editingPersonal, setEditingPersonal] = useState(false);

  // Edit permissions
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [editingPerms, setEditingPerms] = useState(false);

  // Document upload
  const [showUpload, setShowUpload] = useState(false);
  const [docLabel, setDocLabel] = useState('Aadhar Card');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { employee: emp, documents: docs } = await employeesApi.getDetail(id);
      setEmployee(emp);
      setDocuments(docs);
      setEditForm({
        name: emp.name || '', phone: emp.phone || '',
        department: emp.department || '',
        baseSalary: String(emp.baseSalary || ''),
        role: emp.role || '',
        joiningDate: emp.joiningDate || '',
      });
      setEditPersonal({
        bloodGroup: emp.bloodGroup || '', dateOfBirth: emp.dateOfBirth || '',
        gender: emp.gender || '', address: emp.address || '',
        emergencyContact: emp.emergencyContact || '', emergencyPhone: emp.emergencyPhone || '',
        aadharNumber: emp.aadharNumber || '', panNumber: emp.panNumber || '',
        bankAccount: emp.bankAccount || '', ifscCode: emp.ifscCode || '',
      });
      setEditPerms(emp.permissions ?? []);
    } catch { navigate('/users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleSaveProfile = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await employeesApi.update(id, {
        name: editForm.name, phone: editForm.phone,
        department: editForm.department,
        baseSalary: Number(editForm.baseSalary) || 0,
        role: editForm.role, joiningDate: editForm.joiningDate,
      });
      setEmployee(updated);
      setEditing(false);
    } catch { alert('Failed to save changes'); }
    finally { setSaving(false); }
  };

  const handleSavePersonal = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await employeesApi.update(id, { ...editPersonal });
      setEmployee(updated);
      setEditingPersonal(false);
    } catch { alert('Failed to save personal details'); }
    finally { setSaving(false); }
  };

  const handleSavePerms = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await employeesApi.update(id, { permissions: editPerms });
      setEmployee(updated);
      setEditingPerms(false);
    } catch { alert('Failed to save permissions'); }
    finally { setSaving(false); }
  };

  const handleUpload = async () => {
    if (!id || !docFile) return;
    setUploading(true);
    try {
      const doc = await employeesApi.uploadDocument(id, docFile, docLabel);
      setDocuments(prev => [doc, ...prev]);
      setShowUpload(false); setDocFile(null); setDocLabel('Aadhar Card');
    } catch { alert('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!id || !confirm('Delete this document?')) return;
    try {
      await employeesApi.deleteDocument(id, docId);
      setDocuments(prev => prev.filter(d => d._id !== docId));
    } catch { alert('Delete failed'); }
  };

  const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '');

  if (loading) return <LoadingSpinner className="h-64" />;
  if (!employee) return null;

  const availableRoles: Role[] = currentUser?.role === 'admin'
    ? ['admin', 'manager', 'sales', 'engineer', 'hr', 'finance']
    : ['sales', 'engineer', 'hr', 'finance'];

  const perms: string[] = employee.permissions ?? [];

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'profile',   label: 'Profile',    icon: User },
    { id: 'personal',  label: 'Personal',   icon: Heart },
    { id: 'documents', label: 'Documents',  icon: FileText },
    { id: 'access',    label: 'Access',     icon: Shield },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/users')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="page-header">{employee.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Employee Profile</p>
        </div>
      </div>

      {/* Avatar card */}
      <div className="card !p-5 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-200 flex-shrink-0">
          <span className="text-white font-bold text-2xl leading-none">
            {employee.name?.charAt(0)?.toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-gray-900 text-lg">{employee.name}</h2>
            <span className={`badge ${ROLE_COLOR[employee.role] || 'bg-gray-100 text-gray-700'}`}>
              {ROLE_LABEL[employee.role] || employee.role}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${employee.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {employee.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">{employee.email}</p>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 flex-wrap">
            {employee.department && <span>{employee.department}</span>}
            {employee.phone && <span>{employee.phone}</span>}
            {employee.joiningDate && <span>Joined {formatDate(employee.joiningDate)}</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <tab.icon size={13} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab: Profile ── */}
      {activeTab === 'profile' && (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-gray-900">Work Information</h3>
            {isHR && (
              editing ? (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
                  <button onClick={handleSaveProfile} disabled={saving} className="btn-primary flex items-center gap-2">
                    <Save size={14} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditing(true)} className="btn-secondary">Edit</button>
              )
            )}
          </div>

          {editing ? (
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Full Name</label>
                <input className="input-field" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div><label className="label">Phone</label>
                <input className="input-field" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div><label className="label">Department</label>
                <input className="input-field" value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} />
              </div>
              <div><label className="label">Base Salary (₹)</label>
                <input type="number" className="input-field" value={editForm.baseSalary} onChange={e => setEditForm(f => ({ ...f, baseSalary: e.target.value }))} />
              </div>
              <div><label className="label">Role</label>
                <select className="input-field" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                  {availableRoles.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
              <div><label className="label">Joining Date</label>
                <input type="date" className="input-field" value={editForm.joiningDate} onChange={e => setEditForm(f => ({ ...f, joiningDate: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <DetailRow label="Email"       value={employee.email} />
              <DetailRow label="Phone"       value={employee.phone} />
              <DetailRow label="Department"  value={employee.department} />
              <DetailRow label="Base Salary" value={`₹${(employee.baseSalary || 0).toLocaleString()} / month`} />
              <DetailRow label="Role"        value={ROLE_LABEL[employee.role] || employee.role} />
              <DetailRow label="Joining Date" value={employee.joiningDate ? formatDate(employee.joiningDate) : undefined} />
              <DetailRow label="Created"     value={formatDate(employee.createdAt)} />
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Personal Details ── */}
      {activeTab === 'personal' && (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-gray-900">Personal Details</h3>
            {isHR && (
              editingPersonal ? (
                <div className="flex gap-2">
                  <button onClick={() => setEditingPersonal(false)} className="btn-secondary">Cancel</button>
                  <button onClick={handleSavePersonal} disabled={saving} className="btn-primary flex items-center gap-2">
                    <Save size={14} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditingPersonal(true)} className="btn-secondary">Edit</button>
              )
            )}
          </div>

          {editingPersonal ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Date of Birth</label>
                  <input type="date" className="input-field" value={editPersonal.dateOfBirth}
                    onChange={e => setEditPersonal(p => ({ ...p, dateOfBirth: e.target.value }))} />
                </div>
                <div><label className="label">Gender</label>
                  <select className="input-field" value={editPersonal.gender}
                    onChange={e => setEditPersonal(p => ({ ...p, gender: e.target.value }))}>
                    <option value="">Select gender</option>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <div><label className="label">Blood Group</label>
                  <select className="input-field" value={editPersonal.bloodGroup}
                    onChange={e => setEditPersonal(p => ({ ...p, bloodGroup: e.target.value }))}>
                    <option value="">Select</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div><label className="label">Emergency Contact</label>
                  <input className="input-field" value={editPersonal.emergencyContact}
                    onChange={e => setEditPersonal(p => ({ ...p, emergencyContact: e.target.value }))} />
                </div>
                <div><label className="label">Emergency Phone</label>
                  <input className="input-field" value={editPersonal.emergencyPhone}
                    onChange={e => setEditPersonal(p => ({ ...p, emergencyPhone: e.target.value }))} />
                </div>
                <div><label className="label">Aadhar Number</label>
                  <input className="input-field" value={editPersonal.aadharNumber} maxLength={14}
                    onChange={e => setEditPersonal(p => ({ ...p, aadharNumber: e.target.value }))} placeholder="XXXX XXXX XXXX" />
                </div>
                <div><label className="label">PAN Number</label>
                  <input className="input-field" value={editPersonal.panNumber} maxLength={10}
                    onChange={e => setEditPersonal(p => ({ ...p, panNumber: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" />
                </div>
                <div><label className="label">Bank Account No.</label>
                  <input className="input-field" value={editPersonal.bankAccount}
                    onChange={e => setEditPersonal(p => ({ ...p, bankAccount: e.target.value }))} />
                </div>
                <div><label className="label">IFSC Code</label>
                  <input className="input-field" value={editPersonal.ifscCode} maxLength={11}
                    onChange={e => setEditPersonal(p => ({ ...p, ifscCode: e.target.value.toUpperCase() }))} placeholder="SBIN0001234" />
                </div>
              </div>
              <div><label className="label">Residential Address</label>
                <textarea rows={2} className="input-field" value={editPersonal.address}
                  onChange={e => setEditPersonal(p => ({ ...p, address: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Health & Identity */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Heart size={12} /> Health & Identity
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  <DetailRow label="Date of Birth"  value={employee.dateOfBirth ? formatDate(employee.dateOfBirth) : undefined} />
                  <DetailRow label="Gender"         value={employee.gender} />
                  <DetailRow label="Blood Group"    value={employee.bloodGroup} />
                </div>
              </div>

              {/* Emergency */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Phone size={12} /> Emergency Contact
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  <DetailRow label="Contact Name"  value={employee.emergencyContact} />
                  <DetailRow label="Contact Phone" value={employee.emergencyPhone} />
                  <DetailRow label="Address"       value={employee.address} />
                </div>
              </div>

              {/* Financial */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <CreditCard size={12} /> Financial & ID
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  <DetailRow label="Aadhar Number"   value={employee.aadharNumber} />
                  <DetailRow label="PAN Number"      value={employee.panNumber} />
                  <DetailRow label="Bank Account"    value={employee.bankAccount} />
                  <DetailRow label="IFSC Code"       value={employee.ifscCode} />
                </div>
              </div>

              {!employee.bloodGroup && !employee.dateOfBirth && !employee.emergencyContact && !employee.aadharNumber && (
                <div className="text-center py-8 text-gray-400">
                  <Heart size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No personal details added yet</p>
                  {isHR && <button onClick={() => setEditingPersonal(true)} className="btn-secondary mt-3 text-sm">Add Details</button>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Documents ── */}
      {activeTab === 'documents' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Employee Documents</h3>
            {isHR && (
              <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-2 py-2 px-3 text-sm">
                <Plus size={14} /> Upload
              </button>
            )}
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No documents uploaded yet</p>
              {isHR && (
                <button onClick={() => setShowUpload(true)} className="btn-secondary mt-3 text-sm flex items-center gap-2 mx-auto">
                  <Upload size={14} /> Upload First Document
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-violet-50/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{doc.label}</p>
                      <p className="text-xs text-gray-400 truncate">{doc.fileName}</p>
                      <p className="text-xs text-gray-300">
                        {formatDate(doc.createdAt)}{doc.uploadedBy?.name ? ` · ${doc.uploadedBy.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <a href={`${backendBase}${doc.fileUrl}`} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-lg text-violet-600 hover:bg-violet-100 transition-colors" title="Download">
                      <Download size={15} />
                    </a>
                    {isHR && (
                      <button onClick={() => handleDeleteDoc(doc._id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Access / Permissions ── */}
      {activeTab === 'access' && (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-gray-900">Module Access</h3>
              <p className="text-xs text-gray-400 mt-0.5">Controls which pages this employee can access</p>
            </div>
            {isHR && (
              editingPerms ? (
                <div className="flex gap-2">
                  <button onClick={() => setEditingPerms(false)} className="btn-secondary">Cancel</button>
                  <button onClick={handleSavePerms} disabled={saving} className="btn-primary flex items-center gap-2">
                    <Save size={14} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditingPerms(true)} className="btn-secondary">Edit Access</button>
              )
            )}
          </div>

          {editingPerms ? (
            <div className="space-y-3">
              <div className="flex gap-3 mb-1">
                <button type="button" onClick={() => setEditPerms(ALL_MODULES.map(m => m.key))}
                  className="text-xs text-violet-600 hover:underline">Select All</button>
                <button type="button" onClick={() => setEditPerms([])}
                  className="text-xs text-gray-400 hover:underline">Clear All</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_MODULES.map(mod => {
                  const active = editPerms.includes(mod.key);
                  return (
                    <button key={mod.key} type="button"
                      onClick={() => setEditPerms(prev => prev.includes(mod.key) ? prev.filter(p => p !== mod.key) : [...prev, mod.key])}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                        active ? 'bg-violet-50 border-violet-300 text-violet-800' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                        active ? 'bg-violet-600 border-violet-600' : 'border-gray-300 bg-white'
                      }`}>
                        {active && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      {mod.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              {perms.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Shield size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No custom permissions set</p>
                  <p className="text-xs mt-1">Default role permissions apply</p>
                  {isHR && <button onClick={() => setEditingPerms(true)} className="btn-secondary mt-3 text-sm">Configure Access</button>}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {ALL_MODULES.map(mod => {
                    const has = perms.includes(mod.key);
                    return (
                      <div key={mod.key} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm ${
                        has ? 'bg-violet-50 border-violet-200 text-violet-800' : 'bg-gray-50 border-gray-100 text-gray-300'
                      }`}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                          has ? 'bg-violet-600 border-violet-600' : 'border-gray-200 bg-white'
                        }`}>
                          {has && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <span className={has ? 'font-medium' : ''}>{mod.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upload Document Modal */}
      <Modal isOpen={showUpload} onClose={() => { setShowUpload(false); setDocFile(null); }} title="Upload Document" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Document Type *</label>
            <select className="input-field" value={docLabel} onChange={e => setDocLabel(e.target.value)}>
              {DOC_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">File *</label>
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={e => setDocFile(e.target.files?.[0] || null)} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-violet-400 hover:bg-violet-50/30 transition-colors">
              {docFile ? (
                <div>
                  <FileText size={24} className="mx-auto text-violet-500 mb-1" />
                  <p className="text-sm font-medium text-gray-700">{docFile.name}</p>
                  <p className="text-xs text-gray-400">{(docFile.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <Upload size={24} className="mx-auto text-gray-400 mb-1" />
                  <p className="text-sm text-gray-500">Click to select file</p>
                  <p className="text-xs text-gray-400">PDF, JPG, PNG, DOC — max 10MB</p>
                </div>
              )}
            </button>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setShowUpload(false); setDocFile(null); }} className="btn-secondary">Cancel</button>
            <button onClick={handleUpload} disabled={!docFile || uploading} className="btn-primary flex items-center gap-2">
              <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
