import { useEffect, useState, useCallback } from 'react';
import {
  Search, Plus, Pencil, Trash2, Phone, Mail, Building2, User as UserIcon,
} from 'lucide-react';
import { contactsApi } from '@/api/contacts';
import { accountsApi } from '@/api/accounts';
import { useAuthStore } from '@/store/authStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { formatDate } from '@/utils/formatters';
import type { Contact, ContactType, CustomerResponsibility, Account, User } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { key: ContactType | 'ALL'; label: string }[] = [
  { key: 'ALL',      label: 'All Contacts' },
  { key: 'TELLED',   label: 'Telled' },
  { key: 'ARK',      label: 'ARK' },
  { key: 'CUSTOMER', label: 'Customer' },
];

const RESPONSIBILITY_TABS: { key: CustomerResponsibility | 'ALL'; label: string; color: string }[] = [
  { key: 'ALL',         label: 'All',         color: 'bg-gray-100 text-gray-600' },
  { key: 'Technical',   label: 'Technical',   color: 'bg-blue-100 text-blue-700' },
  { key: 'Sales',       label: 'Sales',       color: 'bg-emerald-100 text-emerald-700' },
  { key: 'IT',          label: 'IT',          color: 'bg-indigo-100 text-indigo-700' },
  { key: 'Procurement', label: 'Procurement', color: 'bg-amber-100 text-amber-700' },
];

const RESPONSIBILITIES: CustomerResponsibility[] = ['Technical', 'Sales', 'IT', 'Procurement'];

const TYPE_COLORS: Record<ContactType, string> = {
  TELLED:   'bg-violet-100 text-violet-700',
  ARK:      'bg-blue-100 text-blue-700',
  CUSTOMER: 'bg-emerald-100 text-emerald-700',
};

const RESPONSIBILITY_COLORS: Record<CustomerResponsibility, string> = {
  Technical:   'bg-blue-100 text-blue-700',
  Sales:       'bg-emerald-100 text-emerald-700',
  IT:          'bg-indigo-100 text-indigo-700',
  Procurement: 'bg-amber-100 text-amber-700',
};

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  designation: '',
  companyName: '',
  contactType: 'TELLED' as ContactType,
  customerResponsibility: '' as CustomerResponsibility | '',
  linkedAccountId: '',
  notes: '',
};

// ─── Permission helpers ───────────────────────────────────────────────────────

function canEdit(contact: Contact, user: User | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'hr_finance') return contact.contactType === 'TELLED';
  const createdById = typeof contact.createdBy === 'string'
    ? contact.createdBy
    : (contact.createdBy as User)._id;
  return createdById === user._id;
}

function canDelete(contact: Contact, user: User | null): boolean {
  return canEdit(contact, user);
}

// ─── ContactsPage ─────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const currentUser = useAuthStore((s) => s.user);

  const [contacts, setContacts]               = useState<Contact[]>([]);
  const [total, setTotal]                     = useState(0);
  const [page, setPage]                       = useState(1);
  const [search, setSearch]                   = useState('');
  const [activeTab, setActiveTab]             = useState<ContactType | 'ALL'>('ALL');
  const [activeResponsibility, setActiveResp] = useState<CustomerResponsibility | 'ALL'>('ALL');
  const [loading, setLoading]                 = useState(true);
  const [accounts, setAccounts]               = useState<Account[]>([]);

  const [showForm, setShowForm]       = useState(false);
  const [editTarget, setEditTarget]   = useState<Contact | null>(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      if (activeTab !== 'ALL') params.contactType = activeTab;
      // Responsibility filter only applies when viewing CUSTOMER or ALL
      if (activeResponsibility !== 'ALL' && activeTab !== 'TELLED' && activeTab !== 'ARK') {
        params.customerResponsibility = activeResponsibility;
      }
      const res = await contactsApi.getAll(params);
      setContacts(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) {
      console.error('ContactsPage load:', err);
      setContacts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, activeTab, activeResponsibility]);

  useEffect(() => { load(); }, [load]);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await accountsApi.getAll({ limit: 200 });
      setAccounts(res.data || []);
    } catch {
      setAccounts([]);
    }
  }, []);

  // ── Tab switching ─────────────────────────────────────────────────────────

  const switchTab = (tab: ContactType | 'ALL') => {
    setActiveTab(tab);
    setActiveResp('ALL');
    setPage(1);
    setSearch('');
  };

  // Whether to show responsibility sub-tabs
  const showRespTabs = activeTab === 'CUSTOMER' || activeTab === 'ALL';

  // ── Form helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    const defaultType: ContactType =
      currentUser?.role === 'hr_finance' ? 'TELLED' :
      activeTab !== 'ALL' ? activeTab : 'TELLED';
    setForm({ ...EMPTY_FORM, contactType: defaultType });
    setEditTarget(null);
    setFormError('');
    loadAccounts();
    setShowForm(true);
  };

  const openEdit = (contact: Contact) => {
    setForm({
      name:                   contact.name,
      email:                  contact.email,
      phone:                  contact.phone || '',
      designation:            contact.designation || '',
      companyName:            contact.companyName || '',
      contactType:            contact.contactType,
      customerResponsibility: contact.customerResponsibility || '',
      linkedAccountId:        typeof contact.linkedAccountId === 'string'
        ? contact.linkedAccountId
        : (contact.linkedAccountId as Account)?._id || '',
      notes: contact.notes || '',
    });
    setEditTarget(contact);
    setFormError('');
    loadAccounts();
    setShowForm(true);
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'contactType') {
      setForm((prev) => ({
        ...prev,
        contactType: value as ContactType,
        linkedAccountId: value !== 'CUSTOMER' ? '' : prev.linkedAccountId,
        customerResponsibility: value !== 'CUSTOMER' ? '' : prev.customerResponsibility,
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Name and email are required.');
      return;
    }
    if (currentUser?.role === 'hr_finance' && form.contactType !== 'TELLED') {
      setFormError('HR & Finance can only create Telled internal contacts.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload: Record<string, unknown> = {
        name:        form.name.trim(),
        email:       form.email.trim(),
        phone:       form.phone.trim(),
        designation: form.designation.trim(),
        companyName: form.companyName.trim(),
        contactType: form.contactType,
        notes:       form.notes.trim(),
      };
      if (form.contactType === 'CUSTOMER') {
        if (form.linkedAccountId) payload.linkedAccountId = form.linkedAccountId;
        if (form.customerResponsibility) payload.customerResponsibility = form.customerResponsibility;
      }

      if (editTarget) {
        const updated = await contactsApi.update(editTarget._id, payload);
        setContacts((prev) => prev.map((c) => c._id === editTarget._id ? updated : c));
      } else {
        const created = await contactsApi.create(payload);
        setContacts((prev) => [created as Contact, ...prev]);
        setTotal((prev) => prev + 1);
      }
      setShowForm(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Failed to save contact';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await contactsApi.delete(deleteTarget._id);
      setContacts((prev) => prev.filter((c) => c._id !== deleteTarget._id));
      setTotal((prev) => prev - 1);
      setDeleteTarget(null);
    } catch (err) {
      console.error('delete contact:', err);
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / 15);

  const allowedTypes: ContactType[] =
    currentUser?.role === 'hr_finance'
      ? ['TELLED']
      : ['TELLED', 'ARK', 'CUSTOMER'];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total contact{total !== 1 ? 's' : ''}</p>
        </div>
        {currentUser && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Contact
          </button>
        )}
      </div>

      {/* Primary tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-violet-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Responsibility sub-tabs (Customer / All only) */}
      {showRespTabs && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-400 self-center mr-1">Responsibility:</span>
          {RESPONSIBILITY_TABS.map((rt) => (
            <button
              key={rt.key}
              onClick={() => { setActiveResp(rt.key); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                activeResponsibility === rt.key
                  ? `${rt.color} border-current`
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {rt.label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, email, company…"
          className="input-field pl-9"
        />
      </div>

      {/* Table */}
      <div className="glass-card !p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="h-48" />
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <UserIcon size={40} className="mb-3 text-gray-200" />
            <p className="font-medium">No contacts found</p>
            <p className="text-sm mt-1">
              {search ? 'Try a different search term.' : 'Add your first contact using the button above.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Responsibility</th>
                  <th className="table-header">Company</th>
                  <th className="table-header">Designation</th>
                  <th className="table-header">Contact Info</th>
                  <th className="table-header">Linked Account</th>
                  <th className="table-header">Added By</th>
                  <th className="table-header">Date</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contacts.map((contact) => {
                  const createdByUser = typeof contact.createdBy === 'object'
                    ? (contact.createdBy as User)
                    : null;
                  const linkedAccount = typeof contact.linkedAccountId === 'object'
                    ? (contact.linkedAccountId as Account)
                    : null;

                  return (
                    <tr key={contact._id} className="hover:bg-violet-50/20 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-violet-700 text-xs font-semibold">
                              {contact.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">{contact.name}</span>
                        </div>
                      </td>

                      <td className="table-cell">
                        <span className={`badge text-[11px] ${TYPE_COLORS[contact.contactType]}`}>
                          {contact.contactType}
                        </span>
                      </td>

                      <td className="table-cell">
                        {contact.customerResponsibility ? (
                          <span className={`badge text-[11px] ${RESPONSIBILITY_COLORS[contact.customerResponsibility]}`}>
                            {contact.customerResponsibility}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="table-cell text-gray-600">
                        {contact.companyName || <span className="text-gray-300">—</span>}
                      </td>

                      <td className="table-cell text-gray-500 text-sm">
                        {contact.designation || <span className="text-gray-300">—</span>}
                      </td>

                      <td className="table-cell">
                        <div className="space-y-0.5">
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-violet-600 hover:underline">
                              <Mail size={11} /> {contact.email}
                            </a>
                          )}
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-xs text-gray-500 hover:underline">
                              <Phone size={11} /> {contact.phone}
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="table-cell text-sm text-gray-500">
                        {linkedAccount ? (
                          <span className="flex items-center gap-1">
                            <Building2 size={12} className="text-gray-400" />
                            {linkedAccount.accountName}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="table-cell text-sm text-gray-400">
                        {createdByUser?.name || '—'}
                      </td>

                      <td className="table-cell text-gray-400 text-sm">
                        {formatDate(contact.createdAt)}
                      </td>

                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          {canEdit(contact, currentUser) && (
                            <button
                              onClick={() => openEdit(contact)}
                              className="p-1.5 hover:text-violet-600 text-gray-400 rounded-lg hover:bg-violet-50 transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {canDelete(contact, currentUser) && (
                            <button
                              onClick={() => setDeleteTarget(contact)}
                              className="p-1.5 hover:text-red-600 text-gray-400 rounded-lg hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = totalPages <= 5 ? i + 1 : Math.max(1, page - 2) + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 rounded-lg border transition-colors ${
                    p === page
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editTarget ? 'Edit Contact' : 'Add Contact'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              {formError}
            </div>
          )}

          {/* Contact Type */}
          <div>
            <label className="form-label">Contact Type *</label>
            <select
              name="contactType"
              value={form.contactType}
              onChange={handleFormChange}
              className="input-field"
              disabled={currentUser?.role === 'hr_finance'}
            >
              {allowedTypes.map((t) => (
                <option key={t} value={t}>
                  {t === 'TELLED' ? 'Telled Marketing (Internal)' : t === 'ARK' ? 'ARK (Vendor / OEM)' : 'Customer'}
                </option>
              ))}
            </select>
          </div>

          {/* Responsibility (CUSTOMER only) */}
          {form.contactType === 'CUSTOMER' && (
            <div>
              <label className="form-label">Responsibility</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {RESPONSIBILITIES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, customerResponsibility: f.customerResponsibility === r ? '' : r }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.customerResponsibility === r
                        ? `${RESPONSIBILITY_COLORS[r]} border-current`
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Click to select the customer's functional area (optional)</p>
            </div>
          )}

          {/* Name + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Full Name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleFormChange}
                className="input-field"
                placeholder="e.g. Rahul Sharma"
                required
              />
            </div>
            <div>
              <label className="form-label">Email *</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleFormChange}
                className="input-field"
                placeholder="email@example.com"
                required
              />
            </div>
          </div>

          {/* Phone + Designation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Phone</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleFormChange}
                className="input-field"
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="form-label">Designation</label>
              <input
                name="designation"
                value={form.designation}
                onChange={handleFormChange}
                className="input-field"
                placeholder="e.g. Manager"
              />
            </div>
          </div>

          {/* Company Name */}
          <div>
            <label className="form-label">Company Name</label>
            <input
              name="companyName"
              value={form.companyName}
              onChange={handleFormChange}
              className="input-field"
              placeholder="e.g. Acme Corp"
            />
          </div>

          {/* Linked Account (CUSTOMER only) */}
          {form.contactType === 'CUSTOMER' && (
            <div>
              <label className="form-label">Link to Account</label>
              <select
                name="linkedAccountId"
                value={form.linkedAccountId}
                onChange={handleFormChange}
                className="input-field"
              >
                <option value="">— Select Account (optional) —</option>
                {accounts.map((acc) => (
                  <option key={acc._id} value={acc._id}>{acc.accountName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="form-label">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleFormChange}
              className="input-field resize-none"
              rows={3}
              placeholder="Any additional notes…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        title="Delete Contact"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
