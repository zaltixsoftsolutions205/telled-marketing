import { useEffect, useState, useCallback } from 'react';
import { drfApi } from '@/api/drf';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import QuotationModal from '@/components/common/QuotationModal';
import { formatDate } from '@/utils/formatters';
import { useAuthStore } from '@/store/authStore';
import { Building2, Users, TrendingUp, CheckCircle2, FileText } from 'lucide-react';

export const PROSPECT_DEAL_STATUSES = [
  'DRF Approved',
  'Sales meeting follow-up',
  'Sales meeting done requested technical demo',
  'Under technical Demo',
  'Technical demo done',
  'Under Proposal submission Process',
  'Under PO-Followup',
  'Under payment follow-up',
  'Closed, and now a Customer',
  'Rejected, at Sales discussion stage',
  'Rejected, at Tech Demo Stage',
  'Rejected, at PO follow-up stage',
  'Rejected, at Payment follow-up stage',
  'Rejected, at license generation stage',
] as const;

export type ProspectDealStatus = typeof PROSPECT_DEAL_STATUSES[number];

const DEAL_STATUS_STYLE: Record<string, string> = {
  'DRF Approved':                        'bg-gray-100 text-gray-700 border-gray-200',
  'Sales meeting follow-up':             'bg-blue-100 text-blue-700 border-blue-200',
  'Sales meeting done requested technical demo': 'bg-sky-100 text-sky-700 border-sky-200',
  'Technical demo done':                 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Under technical Demo':                'bg-violet-100 text-violet-700 border-violet-200',
  'Under Proposal submission Process':   'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Under PO-Followup':                   'bg-orange-100 text-orange-700 border-orange-200',
  'Under payment follow-up':             'bg-amber-100 text-amber-700 border-amber-200',
  'Closed, and now a Customer':          'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Rejected, at Sales discussion stage': 'bg-red-100 text-red-700 border-red-200',
  'Rejected, at Tech Demo Stage':        'bg-red-100 text-red-700 border-red-200',
  'Rejected, at PO follow-up stage':     'bg-red-100 text-red-700 border-red-200',
  'Rejected, at Payment follow-up stage':'bg-red-100 text-red-700 border-red-200',
  'Rejected, at license generation stage':'bg-red-100 text-red-700 border-red-200',
};

function StatCard({ title, value, icon: Icon, color, bg }: {
  title: string; value: number; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="card !p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={color} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{title}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

export default function ProspectsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isSales = ['admin', 'manager', 'sales'].includes(currentUser?.role || '');

  const [prospects, setProspects]       = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [updating, setUpdating]         = useState<string | null>(null);
  const [quotationDRF, setQuotationDRF] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, { quotationsApi }] = await Promise.all([
        drfApi.getAll({ status: 'Approved', limit: 200 }),
        import('@/api/quotations'),
      ]);
      const quotRes = await quotationsApi.getAll({ limit: 500 });
      const leadIdsWithQuotation = new Set(
        (quotRes.data || []).map((q: any) => q.leadId?._id || q.leadId)
      );
      setProspects((res.data || []).map((d: any) => ({
        ...d,
        quotationSent: d.quotationSent || leadIdsWithQuotation.has(d.leadId?._id || d.leadId),
      })));
    } catch { setProspects([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (drf: any, newStatus: string) => {
    setUpdating(drf._id);
    try {
      await drfApi.updateProspectStatus(drf._id, newStatus);
      setProspects(prev => prev.map(p => p._id === drf._id ? { ...p, prospectStatus: newStatus } : p));
    } catch { alert('Failed to update status'); }
    finally { setUpdating(null); }
  };

  const filtered = prospects.filter(p => {
    const company = p.leadId?.companyName?.toLowerCase() || '';
    const oem     = p.leadId?.oemName?.toLowerCase() || '';
    const owner   = p.createdBy?.name?.toLowerCase() || '';
    const q       = search.toLowerCase();
    return (!q || company.includes(q) || oem.includes(q) || owner.includes(q))
      && (!statusFilter || (p.prospectStatus || 'DRF Approved') === statusFilter);
  });

  const total  = prospects.length;
  const won    = prospects.filter(p => p.prospectStatus === 'Deal Closed - Won').length;
  const lost   = prospects.filter(p => p.prospectStatus === 'Deal Closed - Lost').length;
  const active = total - won - lost;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Prospects</h1>
        <p className="text-sm text-gray-500 mt-0.5">All approved DRFs — track deal progress and send quotations</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Prospects" value={total}  icon={Users}        color="text-violet-700" bg="bg-violet-100" />
        <StatCard title="Active"          value={active} icon={TrendingUp}   color="text-blue-700"   bg="bg-blue-100" />
        <StatCard title="Won"             value={won}    icon={CheckCircle2} color="text-green-700"  bg="bg-green-100" />
        <StatCard title="Lost"            value={lost}   icon={Building2}    color="text-red-700"    bg="bg-red-100" />
      </div>

      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search company, OEM, owner…" className="input-field flex-1 min-w-48" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field w-auto">
          <option value="">All Deal Status</option>
          {PROSPECT_DEAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <LoadingSpinner className="h-48" /> : filtered.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No prospects found</p>
          <p className="text-xs mt-1">Approved DRFs will appear here</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="glass-card !p-0 overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="table-header">Company</th>
                    <th className="table-header">OEM</th>
                    <th className="table-header">DRF No.</th>
                    <th className="table-header">Owner</th>
                    <th className="table-header">Approved On</th>
                    <th className="table-header">Expiry</th>
                    <th className="table-header min-w-[200px]">Deal Status</th>
                    <th className="table-header">Quotation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(p => {
                    const currentStatus: string = p.prospectStatus || 'DRF Approved';
                    return (
                      <tr key={p._id} className="hover:bg-violet-50/20 transition-colors">
                        <td className="table-cell font-semibold text-gray-800">{p.leadId?.companyName || '—'}</td>
                        <td className="table-cell text-gray-500">{p.leadId?.oemName || '—'}</td>
                        <td className="table-cell"><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{p.drfNumber || '—'}</span></td>
                        <td className="table-cell text-gray-500">{p.createdBy?.name || '—'}</td>
                        <td className="table-cell text-gray-500 text-xs">{p.approvedDate ? formatDate(p.approvedDate) : '—'}</td>
                        <td className="table-cell text-xs">
                          {p.expiryDate ? (
                            <span className={new Date(p.expiryDate) < new Date() ? 'text-red-500 font-medium' : 'text-gray-500'}>
                              {formatDate(p.expiryDate)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="table-cell">
                          {updating === p._id ? (
                            <span className="badge bg-violet-100 text-violet-600 animate-pulse text-xs">Updating…</span>
                          ) : (
                            <select value={currentStatus} onChange={e => handleStatusChange(p, e.target.value)}
                              className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400 w-full ${DEAL_STATUS_STYLE[currentStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {PROSPECT_DEAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="table-cell">
                          {isSales && (
                            p.quotationSent ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium bg-emerald-100 text-emerald-700">
                                <CheckCircle2 size={11} /> Sent
                              </span>
                            ) : (
                              <button onClick={() => setQuotationDRF(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
                                <FileText size={12} /> Send Quotation
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(p => {
              const currentStatus: string = p.prospectStatus || 'DRF Approved';
              return (
                <div key={p._id} className="glass-card !p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">{p.leadId?.companyName || '—'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.leadId?.oemName || '—'}</p>
                    </div>
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">{p.drfNumber || '—'}</span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    {p.createdBy?.name && <p><span className="text-gray-400">Owner:</span> {p.createdBy.name}</p>}
                    {p.approvedDate && <p><span className="text-gray-400">Approved:</span> {formatDate(p.approvedDate)}</p>}
                    {p.expiryDate && <p><span className="text-gray-400">Expires:</span> {formatDate(p.expiryDate)}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Deal Status</label>
                    {updating === p._id ? (
                      <span className="badge bg-violet-100 text-violet-600 animate-pulse text-xs">Updating…</span>
                    ) : (
                      <select value={currentStatus} onChange={e => handleStatusChange(p, e.target.value)}
                        className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400 w-full ${DEAL_STATUS_STYLE[currentStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {PROSPECT_DEAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </div>
                  {isSales && (
                    p.quotationSent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium bg-emerald-100 text-emerald-700">
                        <CheckCircle2 size={11} /> Quotation Sent
                      </span>
                    ) : (
                      <button onClick={() => setQuotationDRF(p)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
                        <FileText size={13} /> Send Quotation
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Quotation Modal */}
      {quotationDRF && (
        <QuotationModal
          drf={quotationDRF}
          onClose={() => setQuotationDRF(null)}
          onSuccess={(drfId) => {
            setProspects(prev => prev.map(p => p._id === drfId ? { ...p, quotationSent: true } : p));
            setQuotationDRF(null);
          }}
        />
      )}
    </div>
  );
}
