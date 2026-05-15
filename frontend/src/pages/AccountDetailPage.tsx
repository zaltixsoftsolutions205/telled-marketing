// import { useEffect, useState } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import { ArrowLeft, Building2, Headphones, Wrench, ShieldCheck, Mail } from 'lucide-react';
// import { accountsApi } from '@/api/accounts';
// import { installationsApi } from '@/api/installations';
// import { supportApi } from '@/api/support';
// import { invoicesApi } from '@/api/invoices';
// import { usersApi } from '@/api/users';
// import { useAuthStore } from '@/store/authStore';
// import StatusBadge from '@/components/common/StatusBadge';
// import LoadingSpinner from '@/components/common/LoadingSpinner';
// import Modal from '@/components/common/Modal';
// import { formatDate, formatCurrency } from '@/utils/formatters';
// import type { Account, Installation, SupportTicket, Invoice, User, Lead } from '@/types';

// export default function AccountDetailPage() {
//   const { id } = useParams<{ id: string }>();
//   const navigate = useNavigate();
//   const user = useAuthStore((s) => s.user);
//   const [account, setAccount] = useState<Account | null>(null);
//   const [installations, setInstallations] = useState<Installation[]>([]);
//   const [tickets, setTickets] = useState<SupportTicket[]>([]);
//   const [invoices, setInvoices] = useState<Invoice[]>([]);
//   const [engineers, setEngineers] = useState<User[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [showAssign, setShowAssign] = useState(false);
//   const [assignEngineer, setAssignEngineer] = useState('');
//   const [sendingWelcome, setSendingWelcome] = useState(false);
//   const [welcomeSent, setWelcomeSent] = useState(false);

//   const load = async () => {
//     if (!id) return;
//     setLoading(true);
//     try {
//       const [acc, inst, tick, inv] = await Promise.all([
//         accountsApi.getById(id),
//         installationsApi.getByAccount(id).catch(() => []),
//         supportApi.getByAccount(id).catch(() => []),
//         invoicesApi.getByAccount(id).catch(() => []),
//       ]);
//       setAccount(acc);
//       setInstallations(inst || []);
//       setTickets(tick || []);
//       setInvoices(inv || []);
//     } catch (err) { console.error('AccountDetailPage load:', err); } finally { setLoading(false); }
//   };

//   useEffect(() => { load(); }, [id]);
//   useEffect(() => {
//     if (user?.role === 'admin') usersApi.getEngineers().then(setEngineers).catch(() => {});
//   }, [user?.role]);

//   if (loading) return <LoadingSpinner className="h-64" />;
//   if (!account) return <div className="text-center text-gray-500 mt-20">Account not found</div>;

//   const handleAssign = async () => {
//     await accountsApi.assignEngineer(id!, assignEngineer);
//     setShowAssign(false);
//     load();
//   };

//   const handleSendWelcome = async () => {
//     setSendingWelcome(true);
//     try {
//       await accountsApi.sendWelcomeMail(id!);
//       setWelcomeSent(true);
//     } catch (err) {
//       console.error('sendWelcomeMail:', err);
//     } finally {
//       setSendingWelcome(false);
//     }
//   };

//   const isAssignedEngineer = user?.role === 'engineer' && (account?.assignedEngineer as User)?._id === user?._id;

//   return (
//     <div className="space-y-6 animate-fade-in">
//       <div className="flex items-center gap-4">
//         <button onClick={() => navigate('/accounts')} className="p-2 rounded-lg hover:bg-gray-100">
//           <ArrowLeft size={18} className="text-gray-600" />
//         </button>
//         <div className="flex-1">
//           <h1 className="page-header">{account.accountName}</h1>
//           <p className="text-sm text-gray-500">Account Detail</p>
//         </div>
//         <StatusBadge status={account.status} />
//         {user?.role === 'admin' && (
//           <button onClick={() => setShowAssign(true)} className="btn-secondary text-sm">Assign Engineer</button>
//         )}
//         {isAssignedEngineer && (
//           <button
//             onClick={handleSendWelcome}
//             disabled={sendingWelcome || welcomeSent}
//             className="btn-primary text-sm flex items-center gap-2"
//           >
//             <Mail size={14} />
//             {welcomeSent ? 'Welcome Sent' : sendingWelcome ? 'Sending…' : 'Send Welcome Mail'}
//           </button>
//         )}
//       </div>

//       {/* Info Row */}
//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//         {/* Account Info */}
//         <div className="glass-card space-y-4">
//           <div>
//             <h2 className="section-title">Account Info</h2>
//             <div className="space-y-2 text-sm">
//               <div className="flex justify-between">
//                 <span className="text-gray-500">Contact Person</span>
//                 <span className="font-medium">{(account.leadId as Lead)?.contactPersonName || '—'}</span>
//               </div>
//               <div className="flex justify-between">
//                 <span className="text-gray-500">Engineer</span>
//                 <span className="font-medium">{(account.assignedEngineer as User)?.name || '—'}</span>
//               </div>
//               <div className="flex justify-between">
//                 <span className="text-gray-500">Sales</span>
//                 <span className="font-medium">{(account.assignedSales as User)?.name || '—'}</span>
//               </div>
//               <div className="flex justify-between">
//                 <span className="text-gray-500">Created</span>
//                 <span>{formatDate(account.createdAt)}</span>
//               </div>
//             </div>
//             {account.notes && <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{account.notes}</p>}
//           </div>

//           {/* License Info */}
//           <div className="border-t border-gray-100 pt-4">
//             <div className="flex items-center gap-2 mb-2">
//               <ShieldCheck size={14} className="text-violet-500" />
//               <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">License</h3>
//             </div>
//             <div className="space-y-2 text-sm">
//               <div className="flex justify-between">
//                 <span className="text-gray-500">Version</span>
//                 <span className="font-medium text-violet-700">{account.licenseVersion || '—'}</span>
//               </div>
//               <div className="flex justify-between">
//                 <span className="text-gray-500">License Date</span>
//                 <span>{account.licenseDate ? formatDate(account.licenseDate) : '—'}</span>
//               </div>
//               <div className="flex justify-between">
//                 <span className="text-gray-500">Expires</span>
//                 <span className={account.licenseExpiryDate ? 'font-medium' : ''}>
//                   {account.licenseExpiryDate ? formatDate(account.licenseExpiryDate) : '—'}
//                 </span>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Summary Cards */}
//         <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
//           <div className="glass-card text-center">
//             <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-2">
//               <Wrench size={18} className="text-violet-600" />
//             </div>
//             <p className="text-2xl font-bold text-violet-700">{installations.length}</p>
//             <p className="text-xs text-gray-500 mt-1">Installations</p>
//           </div>
//           <div className="glass-card text-center">
//             <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
//               <Headphones size={18} className="text-blue-600" />
//             </div>
//             <p className="text-2xl font-bold text-blue-600">{tickets.filter(t => ['Open','In Progress'].includes(t.status)).length}</p>
//             <p className="text-xs text-gray-500 mt-1">Open Tickets</p>
//           </div>
//           <div className="glass-card text-center">
//             <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
//               <Headphones size={18} className="text-emerald-600" />
//             </div>
//             <p className="text-2xl font-bold text-emerald-600">{tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length}</p>
//             <p className="text-xs text-gray-500 mt-1">Resolved</p>
//           </div>
//           <div className="glass-card text-center">
//             <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-2">
//               <Building2 size={18} className="text-green-600" />
//             </div>
//             <p className="text-2xl font-bold text-green-600">{invoices.length}</p>
//             <p className="text-xs text-gray-500 mt-1">Invoices</p>
//           </div>
//         </div>
//       </div>

//       {/* Installations */}
//       {installations.length > 0 && (
//         <div className="glass-card">
//           <h2 className="section-title">Installations</h2>
//           <div className="space-y-2">
//             {installations.map((inst) => (
//               <div key={inst._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
//                 <div>
//                   <p className="text-sm font-medium">{inst.siteAddress}</p>
//                   <p className="text-xs text-gray-400">
//                     Scheduled: {formatDate(inst.scheduledDate)}
//                     {inst.licenseVersion && <span className="ml-2 text-violet-600">· {inst.licenseVersion}</span>}
//                   </p>
//                 </div>
//                 <StatusBadge status={inst.status} />
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Support Tickets */}
//       {tickets.length > 0 && (
//         <div className="glass-card">
//           <h2 className="section-title">Support Tickets</h2>
//           <div className="space-y-2">
//             {tickets.map((ticket) => (
//               <div key={ticket._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
//                 <div>
//                   <p className="text-sm font-medium">{ticket.subject}</p>
//                   <p className="text-xs text-gray-400">{ticket.ticketId} • {formatDate(ticket.createdAt)}</p>
//                 </div>
//                 <div className="flex gap-2">
//                   <StatusBadge status={ticket.priority} />
//                   <StatusBadge status={ticket.status} />
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Invoices */}
//       {invoices.length > 0 && (
//         <div className="glass-card">
//           <h2 className="section-title">Invoices</h2>
//           <div className="space-y-2">
//             {invoices.map((inv) => (
//               <div key={inv._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
//                 <div>
//                   <p className="text-sm font-medium">{inv.invoiceNumber}</p>
//                   <p className="text-xs text-gray-400">Due: {formatDate(inv.dueDate)}</p>
//                 </div>
//                 <div className="flex items-center gap-3">
//                   <span className="text-sm font-semibold">{formatCurrency(inv.amount)}</span>
//                   <StatusBadge status={inv.status} />
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title="Assign Engineer" size="sm">
//         <div className="space-y-4">
//           <div>
//             <label className="label">Engineer</label>
//             <select className="input-field" value={assignEngineer} onChange={(e) => setAssignEngineer(e.target.value)}>
//               <option value="">Select engineer</option>
//               {engineers.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
//             </select>
//           </div>
//           <div className="flex gap-3 justify-end">
//             <button onClick={() => setShowAssign(false)} className="btn-secondary">Cancel</button>
//             <button onClick={handleAssign} disabled={!assignEngineer} className="btn-primary">Assign</button>
//           </div>
//         </div>
//       </Modal>
//     </div>
//   );
// }



import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Headphones, Wrench, ShieldCheck, Mail, Edit3, Save, X, Hash } from 'lucide-react';
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
  const [sendingWelcome, setSendingWelcome] = useState(false);
  const [asc, setAsc] = useState('');
  const [ascSaving, setAscSaving] = useState(false);
  
  // State for account number editing
  const [isEditingAccountNumber, setIsEditingAccountNumber] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [savingAccountNumber, setSavingAccountNumber] = useState(false);
  const [accountNumberError, setAccountNumberError] = useState('');
  
  const [licenseForm, setLicenseForm] = useState({
    licenseProductDetails: '',
    licenseVersion: '',
    licenseStartDate: '',
    licenseExpiryDate: '',
  });
  const [licenseSaving, setLicenseSaving] = useState(false);
  
  // State for custom email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailError, setEmailError] = useState('');

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
      setAccountNumber(acc?.accountNumber || '');
      setAsc(acc?.asc || '');
      setLicenseForm({
        licenseProductDetails: acc?.licenseProductDetails || '',
        licenseVersion: acc?.licenseVersion || '',
        licenseStartDate: acc?.licenseStartDate?.slice(0, 10) || '',
        licenseExpiryDate: acc?.licenseExpiryDate?.slice(0, 10) || '',
      });
      setInstallations(inst || []);
      setTickets(tick || []);
      setInvoices(inv || []);
      
      // Set default email subject
      if (acc) {
        const orgName = (acc.leadId as Lead)?.companyName || acc.accountName;
        setEmailSubject(`Welcome to ${orgName} — Your Account is Ready`);
      }
    } catch (err) { console.error('AccountDetailPage load:', err); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (user?.role === 'admin') usersApi.getEngineers().then(setEngineers).catch(() => {});
  }, [user?.role]);

  useEffect(() => {
    if (!id || !account || asc === (account.asc || '')) return;

    const timer = window.setTimeout(async () => {
      setAscSaving(true);
      try {
        const updated = await accountsApi.update(id, { asc });
        setAccount(updated);
      } catch (err) {
        console.error('save ASC:', err);
      } finally {
        setAscSaving(false);
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [asc, account, id]);

  useEffect(() => {
    if (!id || !account) return;

    const current = {
      licenseProductDetails: account.licenseProductDetails || '',
      licenseVersion: account.licenseVersion || '',
      licenseStartDate: account.licenseStartDate?.slice(0, 10) || '',
      licenseExpiryDate: account.licenseExpiryDate?.slice(0, 10) || '',
    };

    const hasChanged =
      licenseForm.licenseProductDetails !== current.licenseProductDetails ||
      licenseForm.licenseVersion !== current.licenseVersion ||
      licenseForm.licenseStartDate !== current.licenseStartDate ||
      licenseForm.licenseExpiryDate !== current.licenseExpiryDate;

    if (!hasChanged) return;

    const timer = window.setTimeout(async () => {
      setLicenseSaving(true);
      try {
        const updated = await accountsApi.update(id, licenseForm);
        setAccount(updated);
      } catch (err) {
        console.error('save license entitlements:', err);
      } finally {
        setLicenseSaving(false);
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [licenseForm, account, id]);

  const handleAssign = async () => {
    if (!id || !assignEngineer) return;
    await accountsApi.assignEngineer(id, assignEngineer);
    setShowAssign(false);
    setAssignEngineer('');
    load();
  };

  // Handle account number save
  const handleSaveAccountNumber = async () => {
    if (!id) return;
    
    // Validation
    if (!accountNumber.trim()) {
      setAccountNumberError('Account number cannot be empty');
      return;
    }
    
    setSavingAccountNumber(true);
    setAccountNumberError('');
    
    try {
      const updated = await accountsApi.update(id, { accountNumber: accountNumber.trim() });
      setAccount(updated);
      setIsEditingAccountNumber(false);
      // Show success message
      alert('Account number saved successfully!');
    } catch (err: any) {
      console.error('save account number:', err);
      if (err?.response?.data?.message?.includes('duplicate') || err?.response?.data?.message?.includes('already exists')) {
        setAccountNumberError('Account number already exists. Please use a unique number.');
      } else {
        setAccountNumberError('Failed to save account number. Please try again.');
      }
    } finally {
      setSavingAccountNumber(false);
    }
  };

  const handleCancelEditAccountNumber = () => {
    setAccountNumber(account?.accountNumber || '');
    setIsEditingAccountNumber(false);
    setAccountNumberError('');
  };

  // Reset email modal when opening
  const handleOpenEmailModal = () => {
    setEmailError('');
    if (account) {
      const orgName = (account.leadId as Lead)?.companyName || account.accountName;
      const customerName = (account.leadId as Lead)?.contactPersonName || 'Customer';
      
      // Default welcome email template that engineer can customize
      const defaultTemplate = `Dear ${customerName},

Welcome to ${orgName} — we're excited to have you onboard.

Your account has been successfully activated. Here's what you need to know to get started:

🔑 LOGIN INFORMATION
Login URL: https://zaltixsoftsolutions.com/zieos/login
Your Email: ${(account.leadId as Lead)?.email || 'your-email@example.com'}
Password: Use your own email account password

📋 NEXT STEPS
1. Log in to your dashboard using the credentials above
2. Complete your profile setup
3. Explore the features tailored for your business
4. Set up your team members and permissions

💡 SUPPORT
If you need any assistance, our support team is here to help:
- Email: support@yourcompany.com
- Phone: +91 XXXXXXXXXX

We look forward to being a part of your journey and helping you achieve more with ${orgName}.

Best regards,
${user?.name || 'Support Team'}
${orgName}`;
      
      setEmailBody(defaultTemplate);
    }
    setShowEmailModal(true);
  };

  const handleSendWelcome = async () => {
    if (!emailBody.trim()) {
      setEmailError('Email body cannot be empty');
      return;
    }
    if (!emailSubject.trim()) {
      setEmailError('Email subject cannot be empty');
      return;
    }
    
    setSendingWelcome(true);
    setEmailError('');
    try {
      await accountsApi.sendWelcomeMail(id!, {
        subject: emailSubject,
        body: emailBody
      });
      setShowEmailModal(false);
      alert('Welcome email sent successfully!');
    } catch (err: any) {
      console.error('sendWelcomeMail:', err);
      setEmailError(err?.response?.data?.message || 'Failed to send email. Please try again.');
    } finally {
      setSendingWelcome(false);
    }
  };

  const isAssignedEngineer = user?.role === 'engineer' && (account?.assignedEngineer as User)?._id === user?._id;

  if (loading) return <LoadingSpinner className="h-64" />;
  if (!account) return <div className="text-center text-gray-500 mt-20">Account not found</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Account Number before Account Name */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/accounts')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          {/* Display Account Number before Account Name */}
          <div className="flex items-center gap-3 flex-wrap">
            {account.accountNumber && (
              <div className="flex items-center gap-1 px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium">
                <Hash size={14} />
                <span>{account.accountNumber}</span>
              </div>
            )}
            <h1 className="page-header">{account.accountName}</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">Account Detail</p>
        </div>
        <StatusBadge status={account.status} />
        {user?.role === 'admin' && (
          <button onClick={() => setShowAssign(true)} className="btn-secondary text-sm">Assign Engineer</button>
        )}
        {isAssignedEngineer && (
          <button
            onClick={handleOpenEmailModal}
            disabled={sendingWelcome}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Mail size={14} />
            Send Welcome Mail
          </button>
        )}
      </div>

      {/* Info Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Info */}
        <div className="glass-card space-y-4">
          <div>
            <h2 className="section-title">Account Info</h2>
            <div className="space-y-3 text-sm">
              {/* Account Number Field with Edit - Now with Edit button right next to it */}
              <div className="border-b border-gray-100 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Hash size={14} className="text-gray-400" />
                    <label className="text-gray-500 font-medium">Account Number</label>
                  </div>
                  {!isEditingAccountNumber && (user?.role === 'admin' || isAssignedEngineer) && (
                    <button
                      onClick={() => setIsEditingAccountNumber(true)}
                      className="text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 text-xs"
                    >
                      <Edit3 size={12} />
                      Edit
                    </button>
                  )}
                </div>
                
                {isEditingAccountNumber ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input-field flex-1"
                        value={accountNumber}
                        onChange={(e) => {
                          setAccountNumber(e.target.value);
                          setAccountNumberError('');
                        }}
                        placeholder="Enter account number (e.g., ACC-001)"
                        autoFocus
                        disabled={savingAccountNumber}
                      />
                      <button
                        onClick={handleSaveAccountNumber}
                        disabled={savingAccountNumber}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {savingAccountNumber ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Save size={14} />
                            Save
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleCancelEditAccountNumber}
                        disabled={savingAccountNumber}
                        className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors flex items-center gap-1"
                      >
                        <X size={14} />
                        Cancel
                      </button>
                    </div>
                    {accountNumberError && (
                      <p className="text-red-600 text-xs">{accountNumberError}</p>
                    )}
                    <p className="text-gray-400 text-xs">
                      Enter a unique account number for identification
                    </p>
                  </div>
                ) : (
                  <div className="font-medium text-violet-700 bg-violet-50 px-3 py-2 rounded-lg">
                    {account.accountNumber || '—'}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Contact Person</span>
                <span className="font-medium">{(account.leadId as Lead)?.contactPersonName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="font-medium">{(account.leadId as Lead)?.email || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Engineer</span>
                <span className="font-medium">{(account.assignedEngineer as User)?.name || '—'}</span>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-500">ASC</label>
                  {ascSaving && <span className="text-[11px] text-gray-400">Saving...</span>}
                </div>
                <input
                  className="input-field h-9 text-sm"
                  value={asc}
                  onChange={(e) => setAsc(e.target.value)}
                  placeholder="Enter ASC"
                />
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

          {/* License Entitlements */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={14} className="text-violet-500" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">License Entitlements</h3>
              {licenseSaving && <span className="text-[11px] text-gray-400">Saving...</span>}
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-gray-500 block mb-1">Product Details</label>
                <input
                  className="input-field h-9 text-sm"
                  value={licenseForm.licenseProductDetails}
                  onChange={(e) => setLicenseForm(f => ({ ...f, licenseProductDetails: e.target.value }))}
                  placeholder="Enter product details"
                />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Version</label>
                <input
                  className="input-field h-9 text-sm"
                  value={licenseForm.licenseVersion}
                  onChange={(e) => setLicenseForm(f => ({ ...f, licenseVersion: e.target.value }))}
                  placeholder="Enter version"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-500 block mb-1">Start Date</label>
                  <input
                    type="date"
                    className="input-field h-9 text-sm"
                    value={licenseForm.licenseStartDate}
                    onChange={(e) => setLicenseForm(f => ({ ...f, licenseStartDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-gray-500 block mb-1">Expiry Date</label>
                  <input
                    type="date"
                    className="input-field h-9 text-sm"
                    value={licenseForm.licenseExpiryDate}
                    onChange={(e) => setLicenseForm(f => ({ ...f, licenseExpiryDate: e.target.value }))}
                  />
                </div>
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

      {/* Custom Email Modal */}
      <Modal 
        isOpen={showEmailModal} 
        onClose={() => setShowEmailModal(false)} 
        title="Send Welcome Email" 
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="label text-sm font-semibold text-gray-700">To</label>
            <div className="mt-1 p-2 bg-gray-50 rounded-md text-gray-700">
              {(account?.leadId as Lead)?.email || 'No email available'}
            </div>
          </div>
          
          <div>
            <label className="label text-sm font-semibold text-gray-700">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input-field mt-1"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>
          
          <div>
            <label className="label text-sm font-semibold text-gray-700">
              Email Body <span className="text-red-500">*</span>
            </label>
            <div className="mb-2 text-xs text-gray-500 flex items-center gap-2">
              <Edit3 size={12} />
              <span>You can customize this message. Use plain text or HTML formatting.</span>
            </div>
            <textarea
              className="input-field mt-1 font-mono"
              rows={18}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Write your email content here..."
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
          </div>
          
          {emailError && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
              {emailError}
            </div>
          )}
          
          <div className="flex gap-3 justify-end pt-2">
            <button 
              onClick={() => setShowEmailModal(false)} 
              className="btn-secondary"
              disabled={sendingWelcome}
            >
              Cancel
            </button>
            <button 
              onClick={handleSendWelcome} 
              disabled={sendingWelcome || !emailBody.trim() || !emailSubject.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {sendingWelcome ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail size={14} />
                  Send Email
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

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