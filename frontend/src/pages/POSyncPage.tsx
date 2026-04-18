import { useState } from 'react';
import { Mail, RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
         Download, Building2, Calendar, CreditCard, Package, Wifi, WifiOff,
         FileText, Eye, X, Check } from 'lucide-react';
import { poSyncApi, DetectedPO } from '@/api/poSync';
import { useAuthStore } from '@/store/authStore';
import axios from '@/api/axios';

export default function POSyncPage() {
  const user = useAuthStore(s => s.user);
  const [scanning, setScanning]     = useState(false);
  const [daysBack, setDaysBack]     = useState(60);
  const [results, setResults]       = useState<DetectedPO[]>([]);
  const [scanned, setScanned]       = useState<number | null>(null);
  const [error, setError]           = useState('');
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({});
  const [importing, setImporting]   = useState<Record<string, boolean>>({});
  const [imported, setImported]     = useState<Record<string, boolean>>({});
  const [importErr, setImportErr]   = useState<Record<string, string>>({});

  // Import form state per PO
  const [forms, setForms] = useState<Record<string, {
    leadId: string; poNumber: string; amount: string; vendorName: string;
    vendorEmail: string; product: string; receivedDate: string;
    paymentTerms: string; notes: string;
  }>>({});

  const [leads, setLeads] = useState<{ _id: string; companyName: string }[]>([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);

  const loadLeads = async () => {
    if (leadsLoaded) return;
    try {
      const res = await axios.get('/leads?limit=500');
      setLeads(res.data.data || []);
      setLeadsLoaded(true);
    } catch { /* ignore */ }
  };

  const handleScan = async () => {
    setScanning(true);
    setError('');
    setResults([]);
    setScanned(null);
    try {
      const data = await poSyncApi.scan(daysBack);
      setResults(data.detected);
      setScanned(data.emailsScanned);
      // Pre-fill forms
      const newForms: typeof forms = {};
      data.detected.forEach((d, i) => {
        const key = `${d.emailUid}-${i}`;
        newForms[key] = {
          leadId:       d.suggestedLeadId || '',
          poNumber:     d.extracted.poNumber || '',
          amount:       d.extracted.amount?.toString() || '',
          vendorName:   d.extracted.vendorName || d.emailFrom || '',
          vendorEmail:  d.extracted.vendorEmail || d.emailFromEmail || '',
          product:      d.extracted.product || '',
          receivedDate: d.extracted.receivedDate || d.emailDate?.split('T')[0] || '',
          paymentTerms: d.extracted.paymentTerms || '',
          notes:        '',
        };
      });
      setForms(newForms);
      await loadLeads();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '';
      setError(msg || 'Network error — make sure the backend is running and restart it if you just added IMAP settings');
    } finally {
      setScanning(false);
    }
  };

  const handleImport = async (key: string) => {
    const f = forms[key];
    if (!f?.leadId) { setImportErr(p => ({ ...p, [key]: 'Please select a lead' })); return; }
    if (!f?.amount || Number(f.amount) <= 0) { setImportErr(p => ({ ...p, [key]: 'Valid amount required' })); return; }
    setImporting(p => ({ ...p, [key]: true }));
    setImportErr(p => ({ ...p, [key]: '' }));
    try {
      await poSyncApi.importPO({
        leadId:       f.leadId,
        poNumber:     f.poNumber || undefined,
        amount:       Number(f.amount),
        vendorName:   f.vendorName || undefined,
        vendorEmail:  f.vendorEmail || undefined,
        product:      f.product || undefined,
        receivedDate: f.receivedDate || undefined,
        paymentTerms: f.paymentTerms || undefined,
        notes:        f.notes || undefined,
      });
      setImported(p => ({ ...p, [key]: true }));
    } catch (e: any) {
      setImportErr(p => ({ ...p, [key]: e?.response?.data?.message || 'Import failed' }));
    } finally {
      setImporting(p => ({ ...p, [key]: false }));
    }
  };

  const confidenceBadge = (c: number) => {
    if (c >= 70) return 'bg-emerald-100 text-emerald-700';
    if (c >= 40) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  const hasSmtp = !!(user as any)?.smtpHost || !!(user as any)?.smtpUser;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="text-blue-600" size={22} />
            PO Intelligence — Email Sync
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Auto-reads Purchase Orders from your inbox. Detects PO number, amount, vendor, payment terms from any format.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasSmtp
            ? <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><Wifi size={14}/> Email configured</span>
            : <span className="flex items-center gap-1 text-xs text-red-500 font-medium"><WifiOff size={14}/> Configure SMTP in Profile first</span>
          }
        </div>
      </div>

      {/* Scan controls */}
      <div className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Scan emails from last</label>
          <select
            value={daysBack}
            onChange={e => setDaysBack(Number(e.target.value))}
            className="input-field w-36 text-sm"
          >
            <option value={7}>7 days</option>
            <option value={15}>15 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning || !hasSmtp}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
          {scanning ? 'Scanning mailbox…' : 'Scan My Inbox'}
        </button>
        {scanned !== null && !scanning && (
          <p className="text-sm text-gray-500">
            Scanned <b>{scanned}</b> emails → found <b>{results.length}</b> PO-related
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="card border-red-200 bg-red-50">
          <p className="text-sm text-red-600 flex items-center gap-2">
            <AlertCircle size={16}/> {error}
          </p>
          {(error.toLowerCase().includes('email') || error.toLowerCase().includes('smtp') || error.toLowerCase().includes('configure')) && (
            <p className="text-xs text-red-500 mt-1">
              Tip: Go to Profile → Email Settings → enter your Hostinger or Outlook email password to enable email sync.
            </p>
          )}
        </div>
      )}

      {/* No results */}
      {scanned !== null && results.length === 0 && !scanning && (
        <div className="card text-center py-12">
          <Mail size={36} className="mx-auto text-gray-300 mb-3"/>
          <p className="text-gray-500 font-medium">No PO-related emails found</p>
          <p className="text-xs text-gray-400 mt-1">Try increasing the scan period or check that POs have subject lines like "Purchase Order", "PO#", etc.</p>
        </div>
      )}

      {/* Results */}
      {results.map((d, i) => {
        const key = `${d.emailUid}-${i}`;
        const isExpanded = expanded[key];
        const f = forms[key] || {};
        const isImported = imported[key] || d.alreadyImported;
        const isImporting = importing[key];

        return (
          <div key={key} className={`card border ${isImported ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200'}`}>
            {/* Row header */}
            <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setExpanded(p => ({ ...p, [key]: !p[key] }))}>
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`mt-0.5 rounded-full p-1.5 ${isImported ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                  {isImported ? <CheckCircle size={16} className="text-emerald-600"/> : <FileText size={16} className="text-blue-600"/>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-800 truncate">{d.emailSubject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    From: <span className="font-medium">{d.emailFrom || d.emailFromEmail}</span>
                    {d.emailFromDomain && <span className="ml-1 text-blue-500">@{d.emailFromDomain}</span>}
                    {' · '}{new Date(d.emailDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {d.extracted.poNumber && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono font-medium">{d.extracted.poNumber}</span>
                    )}
                    {d.extracted.amount && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        ₹ {d.extracted.amount.toLocaleString('en-IN')}
                      </span>
                    )}
                    {d.extracted.paymentTerms && (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                        <CreditCard size={10} className="inline mr-1"/>{d.extracted.paymentTerms.slice(0,40)}
                      </span>
                    )}
                    {d.extracted.vendorName && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        <Building2 size={10} className="inline mr-1"/>{d.extracted.vendorName.slice(0,30)}
                      </span>
                    )}
                    {d.suggestedLeadName && (
                      <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">Lead: {d.suggestedLeadName}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confidenceBadge(d.extracted.confidence)}`}>
                      {d.extracted.confidence}% confidence
                    </span>
                    {d.extracted.isScanned && (
                      <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">Scanned PDF</span>
                    )}
                    {isImported && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        <Check size={10} className="inline mr-0.5"/>Imported
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-400">{d.filename}</span>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
              </div>
            </div>

            {/* Expanded import form */}
            {isExpanded && !isImported && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Review & Import</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Lead selector */}
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Lead / Company *</label>
                    <select
                      value={f.leadId || ''}
                      onChange={e => setForms(p => ({ ...p, [key]: { ...p[key], leadId: e.target.value }}))}
                      className="input-field text-sm w-full"
                    >
                      <option value="">— Select lead —</option>
                      {leads.map(l => (
                        <option key={l._id} value={l._id}>{l.companyName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">PO Number</label>
                    <input className="input-field text-sm w-full" value={f.poNumber || ''} onChange={e => setForms(p => ({ ...p, [key]: { ...p[key], poNumber: e.target.value }}))} placeholder="Auto-generated if blank"/>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹) *</label>
                    <input type="number" className="input-field text-sm w-full" value={f.amount || ''} onChange={e => setForms(p => ({ ...p, [key]: { ...p[key], amount: e.target.value }}))} placeholder="0"/>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Vendor Name</label>
                    <input className="input-field text-sm w-full" value={f.vendorName || ''} onChange={e => setForms(p => ({ ...p, [key]: { ...p[key], vendorName: e.target.value }}))}/>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Vendor Email</label>
                    <input className="input-field text-sm w-full" value={f.vendorEmail || ''} onChange={e => setForms(p => ({ ...p, [key]: { ...p[key], vendorEmail: e.target.value }}))}/>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Received Date</label>
                    <input type="date" className="input-field text-sm w-full" value={f.receivedDate?.split('T')[0] || ''} onChange={e => setForms(p => ({ ...p, [key]: { ...p[key], receivedDate: e.target.value }}))}/>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Product / Description</label>
                    <input className="input-field text-sm w-full" value={f.product || ''} onChange={e => setForms(p => ({ ...p, [key]: { ...p[key], product: e.target.value }}))}/>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><CreditCard size={11}/> Payment Terms</label>
                    <input className="input-field text-sm w-full" value={f.paymentTerms || ''} onChange={e => setForms(p => ({ ...p, [key]: { ...p[key], paymentTerms: e.target.value }}))} placeholder="e.g. Net 30, 100% Advance"/>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                    <textarea rows={2} className="input-field text-sm w-full resize-none" value={f.notes || ''} onChange={e => setForms(p => ({ ...p, [key]: { ...p[key], notes: e.target.value }}))}/>
                  </div>
                </div>

                {/* Raw text toggle */}
                {d.extracted.rawText && (
                  <details className="mt-3">
                    <summary className="text-xs text-blue-600 cursor-pointer flex items-center gap-1"><Eye size={11}/> View extracted text</summary>
                    <pre className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-3 overflow-auto max-h-40 whitespace-pre-wrap">{d.extracted.rawText}</pre>
                  </details>
                )}

                {importErr[key] && (
                  <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12}/>{importErr[key]}</p>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleImport(key)}
                    disabled={isImporting}
                    className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
                  >
                    <Download size={14}/>
                    {isImporting ? 'Importing…' : 'Import as Purchase Order'}
                  </button>
                  <button
                    onClick={() => setExpanded(p => ({ ...p, [key]: false }))}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3"
                  >
                    <X size={14}/>
                  </button>
                </div>
              </div>
            )}

            {isExpanded && isImported && (
              <div className="mt-4 pt-4 border-t border-emerald-100 flex items-center gap-2 text-emerald-600">
                <CheckCircle size={16}/> <span className="text-sm font-medium">Already imported into Purchase Orders</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Instructions card when no scan yet */}
      {scanned === null && !scanning && (
        <div className="card border-dashed border-2 border-blue-200 bg-blue-50/30">
          <h3 className="font-semibold text-blue-800 flex items-center gap-2 mb-3">
            <Mail size={16}/> How PO Intelligence works
          </h3>
          <ul className="text-sm text-blue-700 space-y-2">
            <li className="flex items-start gap-2"><span className="mt-0.5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold w-5 h-5 flex items-center justify-center shrink-0">1</span>Connects to your inbox using the same email & password you configured for sending emails (Hostinger / Outlook)</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold w-5 h-5 flex items-center justify-center shrink-0">2</span>Scans for emails with PO keywords: "Purchase Order", "PO#", "Order Confirmation", "Work Order", etc.</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold w-5 h-5 flex items-center justify-center shrink-0">3</span>Downloads PDF / image / Word attachments and extracts: PO number, amount, vendor, payment terms, delivery terms, GST number</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold w-5 h-5 flex items-center justify-center shrink-0">4</span>Scanned copies are processed with OCR. Vendor domain is matched to existing leads automatically.</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold w-5 h-5 flex items-center justify-center shrink-0">5</span>Review each detected PO, correct any field, select the lead and click <b>Import</b></li>
          </ul>
          <p className="text-xs text-blue-500 mt-3">
            Supported formats: PDF (digital + scanned), JPG/PNG images, Word documents (.docx)
          </p>
        </div>
      )}
    </div>
  );
}
