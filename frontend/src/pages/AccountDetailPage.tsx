import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Headphones, Wrench, ShieldCheck } from 'lucide-react';
import { accountsApi } from '@/api/accounts';
import { installationsApi } from '@/api/installations';
import { supportApi } from '@/api/support';
import { invoicesApi } from '@/api/invoices';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import { formatDate, formatCurrency } from '@/utils/formatters';
import type { Account, Installation, SupportTicket, Invoice, User, Lead } from '@/types';

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [account, setAccount] = useState<Account | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [engineers, setEngineers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [assignEngineer, setAssignEngineer] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [acc, inst, tick, inv] = await Promise.all([
        accountsApi.getById(id),
        installationsApi.getByAccount(id).catch(() => []),
        supportApi.getByAccount(id).catch(() => []),
        invoicesApi.getByAccount(id).catch(() => []),
      ]);
      setAccount(acc);
      setInstallations(inst || []);
      setTickets(tick || []);
      setInvoices(inv || []);
    } catch (err) { console.error('AccountDetailPage load:', err); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (user?.role === 'admin') usersApi.getEngineers().then(setEngineers).catch(() => {});
  }, [user?.role]);

  if (loading) return <LoadingSpinner className="h-64" />;
  if (!account) return <div className="text-center text-gray-500 mt-20">Account not found</div>;

  const handleAssign = async () => {
    await accountsApi.assignEngineer(id!, assignEngineer);
    setShowAssign(false);
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/accounts')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="page-header">{account.accountName}</h1>
          <p className="text-sm text-gray-500">Account Detail</p>
        </div>
        <StatusBadge status={account.status} />
        {user?.role === 'admin' && (
          <button onClick={() => setShowAssign(true)} className="btn-secondary text-sm">Assign Engineer</button>
        )}
      </div>

      {/* Info Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Info */}
        <div className="glass-card space-y-4">
          <div>
            <h2 className="section-title">Account Info</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Contact Person</span>
                <span className="font-medium">{(account.leadId as Lead)?.contactPersonName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Engineer</span>
                <span className="font-medium">{(account.assignedEngineer as User)?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sales</span>
                <span className="font-medium">{(account.assignedSales as User)?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>{formatDate(account.createdAt)}</span>
              </div>
            </div>
            {account.notes && <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{account.notes}</p>}
          </div>

          {/* License Info */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={14} className="text-violet-500" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">License</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Version</span>
                <span className="font-medium text-violet-700">{account.licenseVersion || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">License Date</span>
                <span>{account.licenseDate ? formatDate(account.licenseDate) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expires</span>
                <span className={account.licenseExpiryDate ? 'font-medium' : ''}>
                  {account.licenseExpiryDate ? formatDate(account.licenseExpiryDate) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card text-center">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-2">
              <Wrench size={18} className="text-violet-600" />
            </div>
            <p className="text-2xl font-bold text-violet-700">{installations.length}</p>
            <p className="text-xs text-gray-500 mt-1">Installations</p>
          </div>
          <div className="glass-card text-center">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
              <Headphones size={18} className="text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{tickets.filter(t => ['Open','In Progress'].includes(t.status)).length}</p>
            <p className="text-xs text-gray-500 mt-1">Open Tickets</p>
          </div>
          <div className="glass-card text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
              <Headphones size={18} className="text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-600">{tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length}</p>
            <p className="text-xs text-gray-500 mt-1">Resolved</p>
          </div>
          <div className="glass-card text-center">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-2">
              <Building2 size={18} className="text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{invoices.length}</p>
            <p className="text-xs text-gray-500 mt-1">Invoices</p>
          </div>
        </div>
      </div>

      {/* Installations */}
      {installations.length > 0 && (
        <div className="glass-card">
          <h2 className="section-title">Installations</h2>
          <div className="space-y-2">
            {installations.map((inst) => (
              <div key={inst._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium">{inst.siteAddress}</p>
                  <p className="text-xs text-gray-400">
                    Scheduled: {formatDate(inst.scheduledDate)}
                    {inst.licenseVersion && <span className="ml-2 text-violet-600">· {inst.licenseVersion}</span>}
                  </p>
                </div>
                <StatusBadge status={inst.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Support Tickets */}
      {tickets.length > 0 && (
        <div className="glass-card">
          <h2 className="section-title">Support Tickets</h2>
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <div key={ticket._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium">{ticket.subject}</p>
                  <p className="text-xs text-gray-400">{ticket.ticketId} • {formatDate(ticket.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <StatusBadge status={ticket.priority} />
                  <StatusBadge status={ticket.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="glass-card">
          <h2 className="section-title">Invoices</h2>
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-400">Due: {formatDate(inv.dueDate)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatCurrency(inv.amount)}</span>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title="Assign Engineer" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Engineer</label>
            <select className="input-field" value={assignEngineer} onChange={(e) => setAssignEngineer(e.target.value)}>
              <option value="">Select engineer</option>
              {engineers.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowAssign(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAssign} disabled={!assignEngineer} className="btn-primary">Assign</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
