import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, Eye, Building2, User, Mail, Phone, MapPin } from 'lucide-react';
import api from '@/api/axios';
import toast from 'react-hot-toast';

interface Application {
  _id: string;
  orgName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  businessType: string;
  gstNumber?: string;
  status: 'pending_verification' | 'pending_approval' | 'approved' | 'rejected';
  rejectionReason?: string;
  documents: Array<{ type: string; originalName: string; filename: string }>;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
}

const STATUS_CONFIG = {
  pending_verification: { label: 'Pending Verification', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  pending_approval:     { label: 'Pending Approval',     color: 'bg-blue-100 text-blue-800',   icon: Clock },
  approved:             { label: 'Approved',              color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected:             { label: 'Rejected',              color: 'bg-red-100 text-red-800',     icon: XCircle },
};

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin-applications');
      setApplications(data.data || []);
    } catch {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApplications(); }, []);

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this application? This will create the organization and send login credentials to the applicant.')) return;
    try {
      setActionLoading(true);
      await api.post(`/admin-applications/${id}/approve`);
      toast.success('Application approved! Credentials sent to applicant.');
      setSelected(null);
      fetchApplications();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) { toast.error('Please provide a rejection reason'); return; }
    try {
      setActionLoading(true);
      await api.post(`/admin-applications/${id}/reject`, { reason: rejectReason });
      toast.success('Application rejected and applicant notified.');
      setSelected(null);
      setRejectReason('');
      fetchApplications();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = filterStatus === 'all'
    ? applications
    : applications.filter(a => a.status === filterStatus);

  const counts = {
    all: applications.length,
    pending_approval: applications.filter(a => a.status === 'pending_approval').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Applications</h1>
        <p className="text-gray-500 text-sm mt-1">Review and approve organization registration requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { key: 'all',              label: 'Total',           color: 'border-gray-200 bg-gray-50' },
          { key: 'pending_approval', label: 'Pending Review',  color: 'border-blue-200 bg-blue-50' },
          { key: 'approved',         label: 'Approved',        color: 'border-green-200 bg-green-50' },
          { key: 'rejected',         label: 'Rejected',        color: 'border-red-200 bg-red-50' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(s.key)}
            className={`border rounded-xl p-4 text-left transition-all ${s.color} ${filterStatus === s.key ? 'ring-2 ring-violet-400' : 'hover:shadow-sm'}`}
          >
            <div className="text-2xl font-bold text-gray-800">{counts[s.key as keyof typeof counts]}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading applications…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No applications found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Organization</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Submitted</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(app => {
                const cfg = STATUS_CONFIG[app.status];
                const Icon = cfg.icon;
                return (
                  <tr key={app._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{app.orgName}</div>
                      <div className="text-xs text-gray-400">{app.businessType}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-gray-700">{app.contactName}</div>
                      <div className="text-xs text-gray-400">{app.email}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-500 text-xs">
                      {new Date(app.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        <Icon size={11} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setSelected(app); setRejectReason(''); }}
                        className="inline-flex items-center gap-1 text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                      >
                        <Eye size={13} /> Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selected.orgName}</h2>
                  <p className="text-violet-200 text-sm">{selected.businessType}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_CONFIG[selected.status].color}`}>
                  {STATUS_CONFIG[selected.status].label}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow icon={<User size={14} />}  label="Contact Person" value={selected.contactName} />
                <InfoRow icon={<Mail size={14} />}  label="Email"          value={selected.email} />
                <InfoRow icon={<Phone size={14} />} label="Phone"          value={selected.phone} />
                <InfoRow icon={<Building2 size={14} />} label="GST Number" value={selected.gstNumber || 'Not provided'} />
                <div className="sm:col-span-2">
                  <InfoRow icon={<MapPin size={14} />} label="Address" value={`${selected.address}, ${selected.city}, ${selected.state}`} />
                </div>
              </div>

              {/* Documents */}
              {selected.documents.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Uploaded Documents</h3>
                  <div className="space-y-2">
                    {selected.documents.map((doc, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-xs font-medium text-violet-700 capitalize">{doc.type.replace(/_/g, ' ')}</span>
                          <p className="text-xs text-gray-500">{doc.originalName}</p>
                        </div>
                        <CheckCircle size={14} className="text-green-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejection info */}
              {selected.status === 'rejected' && selected.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  <strong>Rejection Reason:</strong> {selected.rejectionReason}
                </div>
              )}

              {/* Actions */}
              {selected.status === 'pending_approval' && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Take Action</h3>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Rejection Reason <span className="text-gray-400">(required only for reject)</span>
                    </label>
                    <textarea
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      placeholder="Provide a reason for rejection…"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleReject(selected._id)}
                      disabled={actionLoading}
                      className="flex-1 py-2.5 border-2 border-red-300 text-red-600 hover:bg-red-50 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                    >
                      <XCircle size={15} /> {actionLoading ? 'Processing…' : 'Reject'}
                    </button>
                    <button
                      onClick={() => handleApprove(selected._id)}
                      disabled={actionLoading}
                      className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                    >
                      <CheckCircle size={15} /> {actionLoading ? 'Processing…' : 'Approve & Send Credentials'}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelected(null)}
                className="w-full py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-violet-500 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800">{value}</p>
      </div>
    </div>
  );
}
