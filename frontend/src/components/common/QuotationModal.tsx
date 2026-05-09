import { useState, useRef } from 'react';
import {
  FileText, Upload, X, ChevronRight, Plus, Trash2,
  GripVertical, AlertCircle, Eye, Edit3, Send, Palette,
} from 'lucide-react';
import { quotationsApi } from '@/api/quotations';
import { notify } from '@/store/notificationStore';
import Modal from '@/components/common/Modal';
import ContactEmailPicker from '@/components/common/ContactEmailPicker';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  qty: number;
  listPrice: number;
  unitPrice: number;
  total: number;
}

interface QuotationModalProps {
  drf: any;
  onClose: () => void;
  onSuccess: (drfId: string) => void;
}

const uid    = () => Math.random().toString(36).slice(2, 9);
const fmtINR = (n: number) => `INR ${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const today  = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

// ── Template layouts ──────────────────────────────────────────────────────────
// Each layout defines where logo(s) appear in the PDF header

const LAYOUTS = [
  {
    id: 'classic',
    label: 'Classic',
    desc: 'Your logo top-left, OEM logo top-right',
    // thumbnail sketch
    thumb: (c: string) => (
      <div style={{ width: '100%', height: '100%', background: '#fff', border: `2px solid ${c}`, borderRadius: 4, padding: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1.5px solid ${c}`, paddingBottom: 3 }}>
          <div style={{ width: 28, height: 14, background: c, borderRadius: 2, opacity: 0.8 }} />
          <div style={{ width: 20, height: 14, background: '#ddd', borderRadius: 2 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1,1,1].map((_, i) => <div key={i} style={{ height: 4, background: '#eee', borderRadius: 2 }} />)}
        </div>
      </div>
    ),
  },
  {
    id: 'split',
    label: 'Split Header',
    desc: 'Both logos in top corners, bold colour strip',
    thumb: (c: string) => (
      <div style={{ width: '100%', height: '100%', background: '#fff', border: `2px solid ${c}`, borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: c, padding: '4px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: 24, height: 12, background: 'rgba(255,255,255,0.8)', borderRadius: 2 }} />
          <div style={{ width: 18, height: 12, background: 'rgba(255,255,255,0.6)', borderRadius: 2 }} />
        </div>
        <div style={{ flex: 1, padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1,1,1].map((_, i) => <div key={i} style={{ height: 4, background: '#eee', borderRadius: 2 }} />)}
        </div>
      </div>
    ),
  },
  {
    id: 'centered',
    label: 'Centered',
    desc: 'Centered logo with full-width colour header',
    thumb: (c: string) => (
      <div style={{ width: '100%', height: '100%', background: '#fff', border: `2px solid ${c}`, borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: c, padding: '6px 4px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: 32, height: 14, background: 'rgba(255,255,255,0.85)', borderRadius: 3 }} />
        </div>
        <div style={{ flex: 1, padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1,1,1].map((_, i) => <div key={i} style={{ height: 4, background: '#eee', borderRadius: 2 }} />)}
        </div>
      </div>
    ),
  },
  {
    id: 'footer',
    label: 'Footer Brand',
    desc: 'Minimal header, both logos in footer',
    thumb: (c: string) => (
      <div style={{ width: '100%', height: '100%', background: '#fff', border: `2px solid ${c}`, borderRadius: 4, display: 'flex', flexDirection: 'column' }}>
        <div style={{ borderBottom: `1.5px solid ${c}`, padding: '3px 5px' }}>
          <div style={{ fontSize: 8, fontWeight: 'bold', color: c }}>QUOTATION</div>
        </div>
        <div style={{ flex: 1, padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1,1,1].map((_, i) => <div key={i} style={{ height: 4, background: '#eee', borderRadius: 2 }} />)}
        </div>
        <div style={{ borderTop: `1.5px solid ${c}`, padding: '3px 5px', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ width: 22, height: 10, background: c, borderRadius: 2, opacity: 0.7 }} />
          <div style={{ width: 18, height: 10, background: '#ddd', borderRadius: 2 }} />
        </div>
      </div>
    ),
  },
];

// ── Color presets ─────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { label: 'Violet',    value: '#4f2d7f' },
  { label: 'Navy',      value: '#1e3a5f' },
  { label: 'Teal',      value: '#0f766e' },
  { label: 'Red',       value: '#b91c1c' },
  { label: 'Orange',    value: '#c2410c' },
  { label: 'Indigo',    value: '#3730a3' },
  { label: 'Gray',      value: '#374151' },
  { label: 'Black',     value: '#111111' },
];

// ── Live PDF Preview ──────────────────────────────────────────────────────────

interface PreviewProps {
  layout: string;
  color: string;
  logo: string;
  seller: { company: string; address: string; email: string; phone: string; gst: string };
  toCompany: string; toContact: string; toAddress: string;
  validUntil: string;
  salesName: string; salesPhone: string; salesEmail: string; deliveryWeeks: string;
  oemName: string;
  items: LineItem[];
  gstApplicable: boolean; taxRate: number;
  subtotal: number; taxAmt: number; grandTotal: number;
  notes: string; terms: string;
  bank: { name: string; account: string; ifsc: string; branch: string };
  discountAmt: number; discountApplicable: boolean; discountType: string; discount: number;
  secondLogo: string; secondLogoLabel: string;
  customFields: { label: string; value: string }[];
}

function QuotationPreview(p: PreviewProps) {
  const c = p.color;
  const logoBox = (side: 'left' | 'right' | 'center', size: { w: number; h: number } = { w: 120, h: 36 }) => {
    const align = side === 'left' ? 'flex-start' : side === 'right' ? 'flex-end' : 'center';
    return p.logo ? (
      <div style={{ display: 'flex', justifyContent: align, alignItems: 'center' }}>
        <img src={p.logo} alt="logo" style={{ height: size.h, maxWidth: size.w, objectFit: 'contain' }} />
      </div>
    ) : (
      <div style={{ display: 'flex', justifyContent: align, alignItems: 'center' }}>
        <div style={{ color: c, fontWeight: 'bold', fontSize: side === 'center' ? 16 : 14 }}>
          {p.seller.company || 'YOUR COMPANY'}
        </div>
      </div>
    );
  };

  const secondLogoBlock = (align: 'left' | 'right', invert = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start', gap: 2 }}>
      {p.secondLogo ? (
        <img src={p.secondLogo} alt="second logo"
          style={{ height: 28, maxWidth: 90, objectFit: 'contain', filter: invert ? 'brightness(10)' : 'none' }} />
      ) : (
        <div style={{ fontWeight: 'bold', fontSize: 10, color: invert ? '#fff' : '#111' }}>
          {p.oemName || 'OEM'}
        </div>
      )}
      <div style={{ color: invert ? 'rgba(255,255,255,0.8)' : '#777', fontSize: 7 }}>
        {p.secondLogoLabel || 'CERTIFIED CHANNEL PARTNER'}
      </div>
    </div>
  );

  // Header varies by layout
  const renderHeader = () => {
    if (p.layout === 'classic') return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: `2px solid ${c}` }}>
        {logoBox('left')}
        {secondLogoBlock('right')}
      </div>
    );
    if (p.layout === 'split') return (
      <div style={{ background: c, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}>
        <div>
          {p.logo ? <img src={p.logo} alt="logo" style={{ height: 32, maxWidth: 120, objectFit: 'contain', filter: 'brightness(10)' }} />
            : <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{p.seller.company || 'YOUR COMPANY'}</div>}
        </div>
        {secondLogoBlock('right', true)}
      </div>
    );
    if (p.layout === 'centered') return (
      <div>
        <div style={{ background: c, padding: '10px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {p.logo ? <img src={p.logo} alt="logo" style={{ height: 36, maxWidth: 160, objectFit: 'contain', filter: 'brightness(10)' }} />
            : <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{p.seller.company || 'YOUR COMPANY'}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 12px', borderBottom: `1px solid ${c}` }}>
          {secondLogoBlock('right')}
        </div>
      </div>
    );
    // footer layout — minimal header
    return (
      <div style={{ padding: '6px 12px', borderBottom: `2px solid ${c}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: c, fontWeight: 'bold', fontSize: 16, letterSpacing: 1 }}>QUOTATION</div>
        {secondLogoBlock('right')}
      </div>
    );
  };

  const renderFooter = () => {
    if (p.layout !== 'footer') return (
      <div style={{ borderTop: `1px solid #ccc`, padding: '5px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#555' }}>
        <span>{p.notes}</span>
        <span style={{ fontWeight: 'bold', color: '#111' }}>For {p.seller.company || 'TELLED MARKETING'}</span>
      </div>
    );
    return (
      <div>
        <div style={{ padding: '4px 12px', fontSize: 7, color: '#555', borderTop: '1px solid #eee' }}>{p.notes}</div>
        <div style={{ background: c, padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {p.logo ? <img src={p.logo} alt="logo" style={{ height: 24, maxWidth: 100, objectFit: 'contain', filter: 'brightness(10)' }} />
            : <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>{p.seller.company || 'YOUR COMPANY'}</div>}
          <div style={{ color: '#fff', fontSize: 7, textAlign: 'right' }}>{p.seller.address}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '8.5px', color: '#111', border: `1px solid ${c}`, width: '100%', background: '#fff' }}>
      {renderHeader()}

      {/* To + Info table */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ccc' }}>
        <div style={{ flex: 1, padding: '6px 10px', borderRight: '1px solid #ccc' }}>
          <div style={{ color: '#555', fontSize: '7.5px' }}>To,</div>
          <div style={{ fontWeight: 'bold', fontSize: '10px', marginTop: 2, color: c }}>{p.toCompany || 'Customer Company'}</div>
          {p.toContact && <div style={{ color: '#555', marginTop: 1 }}>Attn: {p.toContact}</div>}
          {p.toAddress && <div style={{ color: '#777', marginTop: 1, fontSize: '7.5px' }}>{p.toAddress}</div>}
        </div>
        <table style={{ fontSize: '7.5px', borderCollapse: 'collapse', minWidth: 190 }}>
          <tbody>
            {[
              ['Date', today()],
              ['Quotation No.', 'QT-PREVIEW'],
              ['Quote Validity', p.validUntil || '15 Days'],
              ['Prepared By', p.salesName || 'Sales Rep'],
              // Custom fields appended after fixed rows
              ...p.customFields.filter(f => f.label).map(f => [f.label, f.value]),
            ].map(([l, v]) => (
              <tr key={l}>
                <td style={{ background: p.color + '22', padding: '3px 6px', fontWeight: 'bold', borderBottom: '1px solid #ddd', borderRight: '1px solid #ddd', color: c }}>{l}</td>
                <td style={{ padding: '3px 6px', borderBottom: '1px solid #ddd' }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Subject */}
      <div style={{ padding: '5px 10px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', background: p.color + '11' }}>
        <span style={{ fontWeight: 'bold', fontSize: '8.5px', color: c }}>Sub: Proposal for {p.oemName || 'Software'}</span>
        {p.seller.gst && <span style={{ fontWeight: 'bold', fontSize: '8.5px' }}>GST No.: {p.seller.gst}</span>}
      </div>

      {/* Sales person row */}
      <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #ccc', fontSize: '7.5px' }}>
        <thead><tr>
          {['Sales Person', 'Contact Number', 'Email ID', 'Delivery'].map(h => (
            <th key={h} style={{ background: p.color + '22', padding: '3px 6px', borderRight: '1px solid #ddd', fontWeight: 'bold', color: c, textAlign: 'center' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody><tr>
          <td style={{ padding: '3px 6px', borderRight: '1px solid #ddd', textAlign: 'center' }}>{p.salesName || '—'}</td>
          <td style={{ padding: '3px 6px', borderRight: '1px solid #ddd', textAlign: 'center' }}>{p.salesPhone || '—'}</td>
          <td style={{ padding: '3px 6px', borderRight: '1px solid #ddd', textAlign: 'center', color: c }}>{p.salesEmail || '—'}</td>
          <td style={{ padding: '3px 6px', textAlign: 'center' }}>{p.deliveryWeeks || '2 Weeks'}</td>
        </tr></tbody>
      </table>

      {/* Items */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5px' }}>
        <thead><tr>
          {['Sr.', 'Product Description', 'Qty', 'List Price', 'Strategic Price', 'Total'].map(h => (
            <th key={h} style={{ background: p.color + '22', padding: '3px 4px', borderRight: '1px solid #ddd', borderBottom: '1px solid #ccc', fontWeight: 'bold', color: c, textAlign: 'center' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {p.items.filter(i => i.description).map((item, idx) => (
            <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={{ padding: '3px 4px', borderRight: '1px solid #ddd', borderBottom: '1px solid #eee', textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #ddd', borderBottom: '1px solid #eee' }}>{item.description}</td>
              <td style={{ padding: '3px 4px', borderRight: '1px solid #ddd', borderBottom: '1px solid #eee', textAlign: 'center' }}>{item.qty}</td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #ddd', borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmtINR(item.listPrice)}</td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #ddd', borderBottom: '1px solid #eee', textAlign: 'right' }}>{fmtINR(item.unitPrice)}</td>
              <td style={{ padding: '3px 6px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>{fmtINR(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid #ccc' }}>
        <table style={{ fontSize: '7.5px', borderCollapse: 'collapse', minWidth: 210 }}>
          <tbody>
            <tr><td style={{ padding: '3px 8px', fontWeight: 'bold', background: p.color + '18', borderBottom: '1px solid #ddd', borderRight: '1px solid #ddd', color: c }}>Base Price</td><td style={{ padding: '3px 8px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>{fmtINR(p.subtotal)}</td></tr>
            {p.discountApplicable && p.discountAmt > 0 && <tr><td style={{ padding: '3px 8px', fontWeight: 'bold', background: p.color + '18', borderBottom: '1px solid #ddd', borderRight: '1px solid #ddd', color: '#dc2626' }}>Discount</td><td style={{ padding: '3px 8px', textAlign: 'right', borderBottom: '1px solid #ddd', color: '#dc2626' }}>- {fmtINR(p.discountAmt)}</td></tr>}
            {p.gstApplicable && <tr><td style={{ padding: '3px 8px', fontWeight: 'bold', background: p.color + '18', borderBottom: '1px solid #ddd', borderRight: '1px solid #ddd', color: c }}>GST @ {p.taxRate}%</td><td style={{ padding: '3px 8px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>{fmtINR(p.taxAmt)}</td></tr>}
            <tr><td style={{ padding: '4px 8px', fontWeight: 'bold', background: p.color + '33', borderRight: '1px solid #ddd', color: c }}>Final Price</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: '9px' }}>{fmtINR(p.grandTotal)}</td></tr>
          </tbody>
        </table>
      </div>

      {/* Terms + Bank */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ccc' }}>
        <div style={{ flex: 1, padding: '5px 8px', borderRight: '1px solid #ccc', fontSize: '7px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 2, fontSize: '7.5px', color: c }}>General Terms and Conditions</div>
          {(p.terms || 'Payment due within 30 days.').split('\n').map((t, i) => <div key={i}>{t}</div>)}
        </div>
        <div style={{ minWidth: 190, padding: '5px 8px', fontSize: '7px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 2, fontSize: '7.5px', color: c }}>Bank Details</div>
          {[['Bank', p.bank.name || '—'], ['Account No.', p.bank.account || '—'], ['IFSC Code', p.bank.ifsc || '—'], ['Branch', p.bank.branch || '—']].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', gap: 4, marginBottom: 1 }}>
              <span style={{ fontWeight: 'bold', minWidth: 65 }}>{l}</span><span>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {renderFooter()}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function QuotationModal({ drf, onClose, onSuccess }: QuotationModalProps) {
  const [mode, setMode] = useState<'template' | 'upload' | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  // Template / design
  const [layout, setLayout]   = useState('classic');
  const [color, setColor]     = useState('#4f2d7f');
  const [customColor, setCustomColor] = useState('#4f2d7f');

  // Logo
  const [logoFile, setLogoFile]           = useState<File | null>(null);
  const [logoPreview, setLogoPreview]     = useState('');
  const [secondLogoFile, setSecondLogoFile]     = useState<File | null>(null);
  const [secondLogoPreview, setSecondLogoPreview] = useState('');
  const [secondLogoLabel, setSecondLogoLabel]     = useState('Channel Partner');

  // Seller
  const [sellerCompany, setSellerCompany] = useState('');
  const [sellerAddress, setSellerAddress] = useState('');
  const [sellerEmail, setSellerEmail]     = useState('');
  const [sellerPhone, setSellerPhone]     = useState('');
  const [sellerGST, setSellerGST]         = useState('');
  const [deliveryWeeks, setDeliveryWeeks] = useState('2 Weeks');

  // Bank
  const [bankName, setBankName]       = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIFSC, setBankIFSC]       = useState('');
  const [bankBranch, setBankBranch]   = useState('');

  // Customer
  const [toCompany, setToCompany] = useState(drf?.leadId?.companyName || '');
  const [toContact, setToContact] = useState(drf?.leadId?.contactPersonName || drf?.leadId?.contactName || '');
  const [toAddress, setToAddress] = useState('');
  const [validUntil, setValidUntil] = useState('');

  // Items
  const [items, setItems] = useState<LineItem[]>([
    { id: uid(), description: '', qty: 1, listPrice: 0, unitPrice: 0, total: 0 },
  ]);
  const [dragIdx, setDragIdx]   = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Pricing
  const [gstApplicable, setGstApplicable]           = useState(false);
  const [taxRate, setTaxRate]                       = useState('18');
  const [discountApplicable, setDiscountApplicable] = useState(false);
  const [discountType, setDiscountType]             = useState<'percent' | 'flat'>('percent');
  const [discountValue, setDiscountValue]           = useState('');

  // Notes / terms
  // Custom fields
  const [customFields, setCustomFields] = useState<{ id: string; label: string; value: string }[]>([]);
  const addCustomField    = () => setCustomFields(p => [...p, { id: uid(), label: '', value: '' }]);
  const removeCustomField = (id: string) => setCustomFields(p => p.filter(f => f.id !== id));
  const updateCustomField = (id: string, key: 'label' | 'value', val: string) =>
    setCustomFields(p => p.map(f => f.id === id ? { ...f, [key]: val } : f));

  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(
    'Order: License Form should be duly filled along with the Purchase Order\n' +
    'Taxes: Subject to change as per prevailing laws of the Country\n' +
    'Delivery: Within 2 weeks from the date of receipt of Purchase Order\n' +
    'Payment: 100% Advance\n' +
    'Delivery - Electronic Download\n' +
    'This offer may be subject to errors and changes.'
  );

  // Upload mode
  const [uploadFile, setUploadFile]         = useState<File | null>(null);
  const [uploadStep, setUploadStep]         = useState<'drop' | 'review'>('drop');
  const [uploadParsing, setUploadParsing]   = useState(false);
  const [uploadFilePath, setUploadFilePath] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadAmount, setUploadAmount]     = useState('');

  // Send
  const [toEmail, setToEmail] = useState(drf?.leadId?.email || '');
  const [ccEmail, setCcEmail] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const logoInputRef       = useRef<HTMLInputElement>(null);
  const secondLogoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef       = useRef<HTMLInputElement>(null);

  // Computed
  const subtotal    = items.reduce((s, i) => s + i.total, 0);
  const discountAmt = discountApplicable
    ? (discountType === 'percent' ? subtotal * Number(discountValue) / 100 : Number(discountValue))
    : 0;
  const afterDiscount = subtotal - discountAmt;
  const taxAmt        = gstApplicable ? afterDiscount * Number(taxRate) / 100 : 0;
  const grandTotal    = afterDiscount + taxAmt;

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setLogoFile(f);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleSecondLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setSecondLogoFile(f);
    const reader = new FileReader();
    reader.onload = () => setSecondLogoPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const updateItem = (id: string, field: keyof LineItem, val: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const u = { ...item, [field]: val };
      if (field === 'qty' || field === 'unitPrice') u.total = Number(u.qty) * Number(u.unitPrice);
      return u;
    }));
  };

  const addItem    = () => setItems(p => [...p, { id: uid(), description: '', qty: 1, listPrice: 0, unitPrice: 0, total: 0 }]);
  const removeItem = (id: string) => setItems(p => p.length > 1 ? p.filter(i => i.id !== id) : p);

  const handleDrop = () => {
    if (dragIdx === null || dragOver === null || dragIdx === dragOver) { setDragIdx(null); setDragOver(null); return; }
    const arr = [...items]; const [m] = arr.splice(dragIdx, 1); arr.splice(dragOver, 0, m);
    setItems(arr); setDragIdx(null); setDragOver(null);
  };

  const handleFileSelect = async (file: File) => {
    setUploadFile(file); setUploadParsing(true);
    try {
      const r = await quotationsApi.parsePdf(file);
      setUploadFilePath(r.filePath); setUploadFileName(r.fileName);
      setUploadAmount(r.suggestedAmount ? String(r.suggestedAmount) : '');
      setUploadStep('review');
    } catch { setUploadFilePath(''); setUploadFileName(file.name); setUploadAmount(''); setUploadStep('review'); }
    finally { setUploadParsing(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail.trim()) { setError('Recipient email is required'); return; }
    setSaving(true); setError('');
    try {
      const leadId = drf.leadId?._id || drf.leadId;
      let created: any;

      if (mode === 'template') {
        if (!grandTotal) { setError('Please add at least one item with a price'); setSaving(false); return; }
        const fd = new FormData();
        fd.append('leadId', leadId);
        if (logoFile) fd.append('sellerLogo', logoFile);
        if (secondLogoFile) fd.append('secondLogo', secondLogoFile);
        fd.append('secondLogoLabel', secondLogoLabel);
        fd.append('fromCompany', sellerCompany);
        fd.append('fromAddress', sellerAddress);
        fd.append('fromEmail', sellerEmail);
        fd.append('fromPhone', sellerPhone);
        fd.append('fromGST', sellerGST);
        fd.append('toCompany', toCompany);
        fd.append('toContact', toContact);
        fd.append('toAddress', toAddress);
        fd.append('deliveryWeeks', deliveryWeeks);
        fd.append('bankName', bankName);
        fd.append('bankAccount', bankAccount);
        fd.append('bankIFSC', bankIFSC);
        fd.append('bankBranch', bankBranch);
        fd.append('validUntil', validUntil);
        fd.append('notes', notes);
        fd.append('terms', terms);
        fd.append('gstApplicable', String(gstApplicable));
        fd.append('taxRate', taxRate);
        fd.append('discountApplicable', String(discountApplicable));
        fd.append('discountType', discountType);
        fd.append('discountValue', discountValue || '0');
        fd.append('discountAmount', String(discountAmt));
        fd.append('subtotal', String(subtotal));
        fd.append('taxAmount', String(taxAmt));
        fd.append('total', String(grandTotal));
        fd.append('finalAmount', String(grandTotal));
        fd.append('templateId', layout);
        fd.append('templateColor', color);
        // Custom fields as JSON string
        const cleanFields = customFields.filter(f => f.label.trim());
        if (cleanFields.length) fd.append('customFields', JSON.stringify(cleanFields.map(f => ({ label: f.label, value: f.value }))));
        items.forEach((item, i) => {
          fd.append(`items[${i}][description]`, item.description || 'Item');
          fd.append(`items[${i}][quantity]`, String(item.qty));
          fd.append(`items[${i}][listPrice]`, String(item.listPrice || item.unitPrice));
          fd.append(`items[${i}][unitPrice]`, String(item.unitPrice));
          fd.append(`items[${i}][discount]`, '0');
          fd.append(`items[${i}][total]`, String(item.total));
        });
        created = await quotationsApi.createFromUpload(fd);
      } else {
        if (!uploadAmount || Number(uploadAmount) <= 0) { setError('Please enter the quotation amount'); setSaving(false); return; }
        if (uploadFilePath) {
          created = await quotationsApi.create({ leadId, uploadedFile: uploadFilePath, uploadedFileName: uploadFileName, totalAmount: Number(uploadAmount), validUntil: validUntil || undefined, notes: notes || undefined });
        } else if (uploadFile) {
          const fd = new FormData();
          fd.append('quotationFile', uploadFile);
          fd.append('leadId', leadId);
          fd.append('totalAmount', uploadAmount);
          if (validUntil) fd.append('validUntil', validUntil);
          if (notes) fd.append('notes', notes);
          created = await quotationsApi.createFromUpload(fd);
        }
      }

      if (created?._id) {
        try {
          await quotationsApi.sendEmail(created._id, toEmail.trim(), ccEmail.trim() || undefined);
        } catch (mailErr: any) {
          notify('Quotation Created', `Created for "${drf.leadId?.companyName}".`, 'quotation', '/quotations');
          alert(`✅ Quotation created.\n\n⚠️ Email failed: ${mailErr?.response?.data?.message || 'Email sending failed. Please try again.'}`);
          onSuccess(drf._id); return;
        }
        notify('Quotation Sent', `Sent to ${toEmail}.`, 'quotation', '/quotations');
        onSuccess(drf._id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create quotation');
    } finally { setSaving(false); }
  };

  const DRFBanner = () => (
    <div className="flex items-start gap-2.5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex-shrink-0">
      <FileText size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs font-bold text-emerald-800">{drf.drfNumber} — {drf.leadId?.companyName}</p>
        <p className="text-xs text-emerald-700">{drf.leadId?.oemName}</p>
      </div>
    </div>
  );

  // ── Mode selector ─────────────────────────────────────────────────────────
  if (!mode) return (
    <Modal isOpen onClose={onClose} title="Send Quotation" size="md">
      <div className="space-y-4">
        <DRFBanner />
        <p className="text-sm font-medium text-gray-700">How would you like to create the quotation?</p>
        <div className="space-y-3">
          <button onClick={() => setMode('template')}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-violet-200 bg-violet-50 hover:border-violet-500 hover:bg-violet-100 transition-all text-left group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center flex-shrink-0 shadow-md">
              <FileText size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm">Use Template</p>
              <p className="text-xs text-gray-500 mt-0.5">Choose layout, pick colors, add logo — live preview before sending</p>
            </div>
            <ChevronRight size={18} className="text-violet-400 group-hover:text-violet-600" />
          </button>
          <button onClick={() => setMode('upload')}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 bg-gray-50 hover:border-gray-400 transition-all text-left group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center flex-shrink-0 shadow-md">
              <Upload size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm">Upload Your Quotation</p>
              <p className="text-xs text-gray-500 mt-0.5">Upload your own PDF/DOC — sent exactly as-is</p>
            </div>
            <ChevronRight size={18} className="text-gray-400 group-hover:text-gray-600" />
          </button>
        </div>
      </div>
    </Modal>
  );

  // ── Upload mode ───────────────────────────────────────────────────────────
  if (mode === 'upload') return (
    <Modal isOpen onClose={onClose} title="Send Quotation — Upload" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <DRFBanner />
        <button type="button" onClick={() => { setMode(null); setUploadStep('drop'); }} className="text-xs text-violet-600 hover:underline">← Back</button>
        {uploadStep === 'drop' ? (
          <>
            <div onClick={() => fileInputRef.current?.click()} onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
              className="border-2 border-dashed border-violet-300 rounded-2xl p-12 text-center cursor-pointer hover:border-violet-500 hover:bg-violet-50/40 transition-all">
              {uploadParsing ? (
                <div className="space-y-2"><div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-sm text-violet-600 font-medium">Reading document…</p></div>
              ) : (<><Upload size={40} className="mx-auto text-violet-400 mb-3" /><p className="text-sm font-bold text-gray-700">Drag & drop your quotation here</p><p className="text-xs text-gray-400 mt-1">or click to browse · PDF, DOC, DOCX</p></>)}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <FileText size={20} className="text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-emerald-800 truncate">{uploadFileName}</p><p className="text-xs text-emerald-600">Will be sent exactly as-is</p></div>
              <button type="button" onClick={() => { setUploadStep('drop'); setUploadFile(null); }} className="text-gray-400 hover:text-red-500"><X size={16} /></button>
            </div>
            <div><label className="label">Total Amount (₹) *</label>
              <div className="relative"><span className="absolute left-3 top-2.5 text-gray-500 font-semibold">₹</span>
                <input type="number" step="0.01" min="0" required className="input-field pl-7 text-lg font-bold text-violet-700" placeholder="0.00" value={uploadAmount} onChange={e => setUploadAmount(e.target.value)} /></div>
            </div>
            <div><label className="label">Valid Until</label><input type="date" className="input-field" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
            <div><label className="label">Send To *</label><ContactEmailPicker required placeholder="customer@company.com" value={toEmail} onChange={setToEmail} defaultContactType="CUSTOMER" defaultResponsibility="Procurement" /></div>
            <div><label className="label">CC</label><ContactEmailPicker placeholder="cc@example.com" value={ccEmail} onChange={setCcEmail} defaultContactType="CUSTOMER" defaultResponsibility="Technical" applyLabel="Add to CC" /></div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg flex items-center gap-2"><AlertCircle size={14} />{error}</div>}
            <div className="flex gap-3 justify-end pt-1 border-t border-gray-100">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2"><Send size={14} />{saving ? 'Sending…' : 'Send Quotation'}</button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );

  // ── Template mode ─────────────────────────────────────────────────────────
  const previewProps: PreviewProps = {
    layout, color, logo: logoPreview,
    seller: { company: sellerCompany, address: sellerAddress, email: sellerEmail, phone: sellerPhone, gst: sellerGST },
    toCompany, toContact, toAddress, validUntil,
    salesName: sellerCompany || '', salesPhone: sellerPhone, salesEmail: sellerEmail, deliveryWeeks,
    oemName: drf.leadId?.oemName || '',
    items, gstApplicable, taxRate: Number(taxRate),
    subtotal, taxAmt, grandTotal,
    notes, terms,
    bank: { name: bankName, account: bankAccount, ifsc: bankIFSC, branch: bankBranch },
    discountAmt, discountApplicable, discountType, discount: Number(discountValue),
    secondLogo: secondLogoPreview, secondLogoLabel,
    customFields: customFields.map(f => ({ label: f.label, value: f.value })),
  };

  return (
    <Modal isOpen onClose={onClose} title="Quotation Template Builder" size="xl">
      <div className="flex flex-col" style={{ height: '85vh' }}>
        {/* Top bar */}
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100 flex-shrink-0 flex-wrap">
          <DRFBanner />
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setMode(null)} className="text-xs text-violet-600 hover:underline">← Back</button>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              <button type="button" onClick={() => setActiveTab('edit')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'edit' ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><Edit3 size={12} /> Edit</button>
              <button type="button" onClick={() => setActiveTab('preview')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'preview' ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><Eye size={12} /> Preview</button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'preview' ? (
            <div className="flex-1 overflow-y-auto p-3 bg-gray-100">
              <div className="max-w-3xl mx-auto shadow-xl rounded-lg overflow-hidden">
                <QuotationPreview {...previewProps} />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 p-1 pr-2">

              {/* Layout + Color — THE NEW SECTION */}
              <div className="card !p-4 space-y-4">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5"><Palette size={12} /> Template Design</p>

                {/* Layout picker */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Layout</p>
                  <div className="grid grid-cols-4 gap-2">
                    {LAYOUTS.map(t => (
                      <button key={t.id} type="button" onClick={() => setLayout(t.id)}
                        className={`rounded-xl border-2 p-2 text-left transition-all ${layout === t.id ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="w-full" style={{ height: 54 }}>{t.thumb(color)}</div>
                        <p className="text-[10px] font-bold text-gray-700 mt-1.5 leading-tight">{t.label}</p>
                        <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Accent Color</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLOR_PRESETS.map(p => (
                      <button key={p.value} type="button" onClick={() => { setColor(p.value); setCustomColor(p.value); }}
                        title={p.label}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${color === p.value ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                        style={{ background: p.value }}
                      />
                    ))}
                    {/* Custom color */}
                    <div className="flex items-center gap-1.5 ml-1">
                      <input type="color" value={customColor}
                        onChange={e => { setCustomColor(e.target.value); setColor(e.target.value); }}
                        className="w-7 h-7 rounded-full border-2 border-gray-200 cursor-pointer p-0 overflow-hidden"
                        title="Custom color" />
                      <span className="text-[10px] text-gray-400">Custom</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logo + Seller */}
              <div className="card !p-4 space-y-3">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Your Company (From)</p>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {logoPreview ? (
                      <div className="relative">
                        <img src={logoPreview} alt="logo" className="h-14 w-32 object-contain border border-gray-200 rounded-xl bg-gray-50" />
                        <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(''); }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow">
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => logoInputRef.current?.click()}
                        className="h-14 w-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-violet-400 hover:text-violet-500 hover:bg-violet-50 transition-all">
                        <Upload size={18} className="mb-1" />
                        <span className="text-[10px] font-medium">Upload Logo</span>
                        <span className="text-[9px] text-gray-300">PNG, JPG, SVG</span>
                      </button>
                    )}
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input className="input-field text-xs col-span-2" placeholder="Company Name *" value={sellerCompany} onChange={e => setSellerCompany(e.target.value)} />
                    <textarea rows={2} className="input-field text-xs col-span-2" placeholder="Full Address" value={sellerAddress} onChange={e => setSellerAddress(e.target.value)} />
                    <input className="input-field text-xs" placeholder="Email" type="email" value={sellerEmail} onChange={e => setSellerEmail(e.target.value)} />
                    <input className="input-field text-xs" placeholder="Phone" value={sellerPhone} onChange={e => setSellerPhone(e.target.value)} />
                    <input className="input-field text-xs" placeholder="GSTIN" value={sellerGST} onChange={e => setSellerGST(e.target.value)} />
                    <input className="input-field text-xs" placeholder="Delivery (e.g. 2 Weeks)" value={deliveryWeeks} onChange={e => setDeliveryWeeks(e.target.value)} />
                  </div>
                </div>

                {/* Second logo — channel partner / customer */}
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Second Logo (shown top-right in PDF)</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Label selector */}
                    <select className="input-field !py-1.5 text-xs w-40" value={secondLogoLabel} onChange={e => setSecondLogoLabel(e.target.value)}>
                      <option value="Channel Partner">Channel Partner</option>
                      <option value="Customer">Customer</option>
                      <option value="OEM Partner">OEM Partner</option>
                      <option value="Certified Partner">Certified Partner</option>
                      <option value="Distributor">Distributor</option>
                    </select>
                    {/* Upload / preview */}
                    {secondLogoPreview ? (
                      <div className="relative">
                        <img src={secondLogoPreview} alt="second logo" className="h-12 w-28 object-contain border border-gray-200 rounded-xl bg-gray-50" />
                        <button type="button" onClick={() => { setSecondLogoFile(null); setSecondLogoPreview(''); }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow">
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => secondLogoInputRef.current?.click()}
                        className="h-12 w-28 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-violet-400 hover:text-violet-500 hover:bg-violet-50 transition-all">
                        <Upload size={15} className="mb-0.5" />
                        <span className="text-[10px] font-medium">Upload Logo</span>
                      </button>
                    )}
                    <input ref={secondLogoInputRef} type="file" accept="image/*" className="hidden" onChange={handleSecondLogoChange} />
                    <p className="text-[10px] text-gray-400">This logo appears in the top-right corner of the PDF</p>
                  </div>
                </div>
              </div>

              {/* Customer */}
              <div className="card !p-4 space-y-2">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Bill To (Customer)</p>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input-field text-xs" placeholder="Company name" value={toCompany} onChange={e => setToCompany(e.target.value)} />
                  <input className="input-field text-xs" placeholder="Contact person" value={toContact} onChange={e => setToContact(e.target.value)} />
                  <textarea rows={2} className="input-field text-xs col-span-2" placeholder="Address" value={toAddress} onChange={e => setToAddress(e.target.value)} />
                  <div><label className="text-[10px] text-gray-400">Valid Until</label><input type="date" className="input-field text-xs mt-0.5" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
                </div>

                {/* Custom fields builder */}
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500">
                      Custom Fields <span className="font-normal text-gray-400">— added to the info table in PDF</span>
                    </p>
                    <button type="button" onClick={addCustomField}
                      className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800">
                      <Plus size={12} /> Add Field
                    </button>
                  </div>

                  {customFields.length === 0 ? (
                    <p className="text-[11px] text-gray-300 italic">
                      e.g. PO Number, Project Name, Payment Terms, Reference No…
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {customFields.map(field => (
                        <div key={field.id} className="flex items-center gap-2">
                          <input
                            className="input-field text-xs w-36 flex-shrink-0"
                            placeholder="Field name"
                            value={field.label}
                            onChange={e => updateCustomField(field.id, 'label', e.target.value)}
                          />
                          <span className="text-gray-300 text-xs">:</span>
                          <input
                            className="input-field text-xs flex-1"
                            placeholder="Value"
                            value={field.value}
                            onChange={e => updateCustomField(field.id, 'value', e.target.value)}
                          />
                          <button type="button" onClick={() => removeCustomField(field.id)}
                            className="text-gray-300 hover:text-red-500 flex-shrink-0 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Line items */}
              <div className="card !p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Line Items <span className="text-gray-400 font-normal normal-case text-[10px]">— drag rows to reorder</span></p>
                  <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800"><Plus size={13} /> Add Item</button>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[20px_1fr_55px_85px_85px_75px_26px] gap-0 bg-gray-50 border-b border-gray-200 px-2 py-1.5">
                    {['', 'Description', 'Qty', 'List Price', 'Unit Price', 'Total', ''].map((h, i) => (
                      <span key={i} className="text-[9px] font-bold text-gray-400 uppercase">{h}</span>
                    ))}
                  </div>
                  {items.map((item, idx) => (
                    <div key={item.id} draggable onDragStart={() => setDragIdx(idx)} onDragEnter={() => setDragOver(idx)} onDragEnd={handleDrop} onDragOver={e => e.preventDefault()}
                      className={`grid grid-cols-[20px_1fr_55px_85px_85px_75px_26px] gap-1 items-center px-2 py-1.5 border-b border-gray-100 transition-colors ${dragOver === idx ? 'bg-violet-50' : ''}`}>
                      <GripVertical size={12} className="text-gray-300 cursor-grab" />
                      <input className="input-field !py-1 text-xs" placeholder="Item description" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} />
                      <input type="number" min="1" className="input-field !py-1 text-xs text-center" value={item.qty} onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} />
                      <div className="relative"><span className="absolute left-1.5 top-1.5 text-gray-400 text-[10px]">₹</span><input type="number" min="0" step="0.01" className="input-field !py-1 text-xs pl-4" value={item.listPrice} onChange={e => updateItem(item.id, 'listPrice', Number(e.target.value))} /></div>
                      <div className="relative"><span className="absolute left-1.5 top-1.5 text-gray-400 text-[10px]">₹</span><input type="number" min="0" step="0.01" className="input-field !py-1 text-xs pl-4" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))} /></div>
                      <span className="text-xs font-semibold text-gray-700 text-right pr-1">₹{item.total.toLocaleString('en-IN')}</span>
                      <button type="button" onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-500 flex items-center justify-center"><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col items-end gap-1.5 mt-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={discountApplicable} onChange={e => setDiscountApplicable(e.target.checked)} className="w-3.5 h-3.5 accent-violet-600" /> Discount</label>
                    {discountApplicable && (<div className="flex items-center gap-1"><select className="input-field !py-1 !px-2 text-xs w-20" value={discountType} onChange={e => setDiscountType(e.target.value as 'percent' | 'flat')}><option value="percent">%</option><option value="flat">₹ Flat</option></select><input type="number" min="0" className="input-field !py-1 text-xs w-20" placeholder="0" value={discountValue} onChange={e => setDiscountValue(e.target.value)} /></div>)}
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={gstApplicable} onChange={e => setGstApplicable(e.target.checked)} className="w-3.5 h-3.5 accent-violet-600" /> GST</label>
                    {gstApplicable && <select className="input-field !py-1 !px-2 text-xs w-20" value={taxRate} onChange={e => setTaxRate(e.target.value)}>{['5','12','18','28'].map(r => <option key={r} value={r}>{r}%</option>)}</select>}
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-2 space-y-1 min-w-52">
                    <div className="flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span></div>
                    {discountApplicable && discountAmt > 0 && <div className="flex justify-between text-xs text-red-500"><span>Discount</span><span>- ₹{discountAmt.toLocaleString('en-IN')}</span></div>}
                    {gstApplicable && <div className="flex justify-between text-xs text-gray-500"><span>GST ({taxRate}%)</span><span>₹{taxAmt.toLocaleString('en-IN')}</span></div>}
                    <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-200"><span>Grand Total</span><span>₹{grandTotal.toLocaleString('en-IN')}</span></div>
                  </div>
                </div>
              </div>

              {/* Bank + Terms */}
              <div className="grid grid-cols-2 gap-4">
                <div className="card !p-4 space-y-2">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Bank Details</p>
                  <input className="input-field text-xs" placeholder="Bank Name" value={bankName} onChange={e => setBankName(e.target.value)} />
                  <input className="input-field text-xs" placeholder="Account Number" value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
                  <input className="input-field text-xs" placeholder="IFSC Code" value={bankIFSC} onChange={e => setBankIFSC(e.target.value.toUpperCase())} />
                  <input className="input-field text-xs" placeholder="Branch" value={bankBranch} onChange={e => setBankBranch(e.target.value)} />
                </div>
                <div className="card !p-4 space-y-2">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Terms & Notes</p>
                  <textarea rows={4} className="input-field text-xs" placeholder="Terms & Conditions" value={terms} onChange={e => setTerms(e.target.value)} />
                  <textarea rows={2} className="input-field text-xs" placeholder="Notes to customer" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>

              {/* Send */}
              <div className="card !p-4 space-y-2">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Send Email</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Send To *</label><ContactEmailPicker required placeholder="customer@company.com" value={toEmail} onChange={setToEmail} defaultContactType="CUSTOMER" defaultResponsibility="Procurement" /></div>
                  <div><label className="label">CC</label><ContactEmailPicker placeholder="cc@example.com" value={ccEmail} onChange={setCcEmail} defaultContactType="CUSTOMER" defaultResponsibility="Technical" applyLabel="Add to CC" /></div>
                </div>
              </div>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg flex items-center gap-2 flex-shrink-0 mt-2"><AlertCircle size={14} />{error}</div>}
          <div className="flex gap-3 justify-between items-center pt-3 border-t border-gray-100 flex-shrink-0">
            <button type="button" onClick={() => setActiveTab(activeTab === 'edit' ? 'preview' : 'edit')} className="btn-secondary flex items-center gap-1.5 text-sm">
              {activeTab === 'edit' ? <><Eye size={14} /> Preview PDF</> : <><Edit3 size={14} /> Back to Edit</>}
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2" style={{ background: color }}>
                <Send size={14} />{saving ? 'Generating & Sending…' : 'Generate PDF & Send'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
