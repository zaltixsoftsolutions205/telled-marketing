// ContactEmailPicker — wraps an email input with a "pick from contacts" panel
import { useState, useEffect } from 'react';
import { BookUser, Search, X, Check } from 'lucide-react';
import { contactsApi } from '@/api/contacts';
import type { Contact, ContactType, CustomerResponsibility, User } from '@/types';

const TYPE_COLORS: Record<ContactType, string> = {
  TELLED:   'bg-violet-100 text-violet-700',
  ARK:      'bg-blue-100 text-blue-700',
  ANSYS:    'bg-orange-100 text-orange-700',
  CUSTOMER: 'bg-emerald-100 text-emerald-700',
};

const RESPONSIBILITY_COLORS: Record<CustomerResponsibility, string> = {
  Technical:   'bg-blue-100 text-blue-700',
  Sales:       'bg-emerald-100 text-emerald-700',
  IT:          'bg-indigo-100 text-indigo-700',
  Procurement: 'bg-amber-100 text-amber-700',
};

const RESPONSIBILITIES: CustomerResponsibility[] = ['Technical', 'Sales', 'IT', 'Procurement'];

const TYPE_TABS: { key: 'ALL' | ContactType; label: string }[] = [
  { key: 'ALL',      label: 'All' },
  { key: 'TELLED',   label: 'Telled' },
  { key: 'ARK',      label: 'ARK' },
  { key: 'ANSYS',    label: 'ANSYS' },
  { key: 'CUSTOMER', label: 'Customer' },
];

interface Props {
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  defaultContactType?: 'ALL' | ContactType;
  /** Pre-select a responsibility filter when the picker opens (CUSTOMER contacts only) */
  defaultResponsibility?: CustomerResponsibility | 'ALL';
  applyLabel?: string;
}

export default function ContactEmailPicker({
  value,
  onChange,
  required,
  placeholder,
  autoFocus,
  defaultContactType = 'ALL',
  defaultResponsibility = 'ALL',
  applyLabel = 'Add',
}: Props) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ALL' | ContactType>(defaultContactType);
  const [responsibility, setResponsibility] = useState<CustomerResponsibility | 'ALL'>(defaultResponsibility);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Load contacts when picker opens or filters change
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params: Record<string, unknown> = { limit: 500 };
    if (tab !== 'ALL') params.contactType = tab;
    if (responsibility !== 'ALL' && tab !== 'TELLED' && tab !== 'ARK' && tab !== 'ANSYS') {
      params.customerResponsibility = responsibility;
    }
    if (search) params.search = search;
    contactsApi.getAll(params)
      .then((res) => setContacts(res.data || []))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [open, tab, responsibility, search]);

  // Pre-check emails already in the value string
  useEffect(() => {
    if (!open) return;
    const existing = new Set(
      value.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    );
    setChecked((prev) => {
      const next = new Set(prev);
      contacts.forEach((c) => {
        if (existing.has(c.email.toLowerCase())) next.add(c._id);
      });
      return next;
    });
  }, [open, contacts, value]);

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySelection = () => {
    const existing = value
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const newEmails = contacts
      .filter((c) => checked.has(c._id))
      .map((c) => c.email)
      .filter((e) => !existing.includes(e.toLowerCase()));

    const merged = [
      ...value.split(',').map((e) => e.trim()).filter(Boolean),
      ...newEmails,
    ];

    if (merged.length > 0) onChange(merged.join(', '));
    setOpen(false);
  };

  const handleOpen = () => {
    setSearch('');
    setTab(defaultContactType);
    setResponsibility(defaultResponsibility);
    setChecked(new Set());
    setOpen(true);
  };

  // Whether to show responsibility sub-filter
  const showRespFilter = tab === 'CUSTOMER' || tab === 'ALL';

  return (
    <div>
      {/* Email input row */}
      <div className="relative">
        <input
          type="text"
          required={required}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field pr-10"
        />
        <button
          type="button"
          onClick={open ? () => setOpen(false) : handleOpen}
          title="Select from Contacts"
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors rounded ${open ? 'text-violet-600' : 'text-gray-400 hover:text-violet-600'}`}
        >
          <BookUser size={16} />
        </button>
      </div>

      {/* Picker panel */}
      {open && (
        <div className="mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-semibold text-gray-700">Select from Contacts</span>
            <button type="button" onClick={() => setOpen(false)} className="p-0.5 text-gray-400 hover:text-gray-700">
              <X size={14} />
            </button>
          </div>

          {/* Type tabs */}
          <div className="flex gap-0.5 px-2 pt-2">
            {TYPE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setTab(t.key); setResponsibility('ALL'); setChecked(new Set()); }}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  tab === t.key ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Responsibility sub-filter */}
          {showRespFilter && (
            <div className="flex items-center gap-1.5 px-2 pt-1.5 flex-wrap">
              <span className="text-[10px] text-gray-400">Role:</span>
              {(['ALL', ...RESPONSIBILITIES] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setResponsibility(r); setChecked(new Set()); }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                    responsibility === r
                      ? r === 'ALL'
                        ? 'bg-gray-700 text-white border-gray-700'
                        : `${RESPONSIBILITY_COLORS[r as CustomerResponsibility]} border-current`
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="px-2 pt-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, company…"
                className="w-full text-xs border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-300"
              />
            </div>
          </div>

          {/* Contact list */}
          <div className="max-h-52 overflow-y-auto px-2 py-2 space-y-0.5">
            {loading ? (
              <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
            ) : contacts.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No contacts found</p>
            ) : (
              contacts.map((contact) => {
                const isChecked = checked.has(contact._id);
                const createdByName = typeof contact.createdBy === 'object'
                  ? (contact.createdBy as User).name
                  : '';
                return (
                  <label
                    key={contact._id}
                    className={`flex items-start gap-2.5 px-2 py-2 rounded-xl cursor-pointer transition-colors ${
                      isChecked ? 'bg-violet-50 border border-violet-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                        isChecked ? 'bg-violet-600 border-violet-600' : 'border-gray-300 bg-white'
                      }`}
                      onClick={() => toggleCheck(contact._id)}
                    >
                      {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>

                    <div className="flex-1 min-w-0" onClick={() => toggleCheck(contact._id)}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium text-gray-800 truncate">{contact.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[contact.contactType]}`}>
                          {contact.contactType}
                        </span>
                        {contact.customerResponsibility && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RESPONSIBILITY_COLORS[contact.customerResponsibility]}`}>
                            {contact.customerResponsibility}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-violet-600 truncate">{contact.email}</p>
                      {(contact.companyName || contact.designation) && (
                        <p className="text-[11px] text-gray-400 truncate">
                          {[contact.designation, contact.companyName].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {createdByName && (
                        <p className="text-[10px] text-gray-300">Added by {createdByName}</p>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setChecked(new Set())} className="text-xs text-gray-400 hover:text-gray-600">
                Clear
              </button>
              {value && (
                <span className="text-xs text-gray-400">
                  {value.split(',').filter(s => s.trim()).length} already added
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{checked.size} selected</span>
              <button
                type="button"
                onClick={applySelection}
                disabled={checked.size === 0}
                className="px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {applyLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
