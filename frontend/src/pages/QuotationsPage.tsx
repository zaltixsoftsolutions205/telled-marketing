// src/pages/QuotationsPage.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Plus, Search, FileText, Mail, Download, Send, Percent, RefreshCw, Eye, Trash2,
} from 'lucide-react';
import { quotationsApi } from '@/api/quotations';
import { leadsApi } from '@/api/leads';
import { drfApi } from '@/api/drf';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Toast from '@/components/common/Toast';
import ContactEmailPicker from '@/components/common/ContactEmailPicker';
import ExcelImportButton from '@/components/common/ExcelImportButton';
import { formatDate, formatCurrency } from '@/utils/formatters';
import type { Quotation, Lead, QuotationItem } from '@/types';
import { useLogoStore } from '@/store/logoStore';
import { resolveLogoUrl } from '@/api/settings';
import { notify } from '@/store/notificationStore';

const emptyItem: QuotationItem = { description: '', quantity: 1, listPrice: 0, unitPrice: 0, total: 0 };

// Static Telled company info
const TELLED_INFO = {
  gstNo: '36AAKFT2721M1ZV',
  bank: 'ICICI Bank Ltd.',
  accountNo: '279905500216',
  ifsc: 'ICIC0002799',
  branch: 'Bachupally',
  address: 'RR Enclave, 3rd Floor, Plot No 231 Part 232,\nNear HI RISE PVR Meadows, Kranti Nagar Colony,\nMallampet, Hyderabad, Telangana, 500090',
};

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-700',
  Accepted: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-600',
  Final: 'bg-purple-100 text-purple-700',
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([{ ...emptyItem }]);
  const { logoUrl, companyName } = useLogoStore();
  const resolvedLogo = resolveLogoUrl(logoUrl);
  const printRef = useRef<HTMLDivElement>(null);

  const [showItemDiscount, setShowItemDiscount] = useState(false);
  const [form, setForm] = useState({
    leadId: '',
    taxRate: 18,
    gstApplicable: true,
    discountApplicable: false,
    discountType: 'percent' as 'percent' | 'flat',
    discountValue: 0,
    validUntil: '',
    delivery: '2 Weeks',
    terms: '',
    notes: '',
  });
  const [vendorForm, setVendorForm] = useState({
    vendorEmail: '',
    finalAmount: 0,
  });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [sendEmailTarget, setSendEmailTarget] = useState<Quotation | null>(null);
  const [sendEmailSending, setSendEmailSending] = useState(false);
  const [sendToEmail, setSendToEmail] = useState('');
  const [sendCcEmail, setSendCcEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await quotationsApi.getAll(params);
      setQuotations(res.data || []);
      setTotal(res.pagination?.total ?? 0);
    } catch (err) {
      console.error('QuotationsPage load:', err);
      setToast({ message: 'Failed to load quotations', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreateModal = async () => {
    setItems([{ ...emptyItem }]);
    setShowItemDiscount(false);
    setForm({ leadId: '', taxRate: 18, gstApplicable: true, discountApplicable: false, discountType: 'percent', discountValue: 0, validUntil: '', delivery: '2 Weeks', terms: '', notes: '' });
    try {
      const leadsRes = await leadsApi.getAll({ limit: 200, stage: 'OEM Approved' });
      const drfRes = await drfApi.getAll({ status: 'Approved', limit: 200 });
      const approvedLeadIds = new Set((drfRes.data || []).map((d: any) => d.leadId?._id));
      setLeads((leadsRes.data || []).filter((l: Lead) => approvedLeadIds.has(l._id)));
    } catch (err) {
      console.error('openCreateModal:', err);
      setLeads([]);
    }
    setShowCreateModal(true);
  };

  const openEditModal = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setItems(quotation.items || [{ ...emptyItem }]);
    setShowItemDiscount(quotation.items?.some(i => (i.discount ?? 0) > 0) ?? false);
    setForm({
      leadId: (quotation.leadId as Lead)?._id || '',
      taxRate: quotation.taxRate || 18,
      gstApplicable: quotation.gstApplicable ?? true,
      discountApplicable: quotation.discountApplicable ?? false,
      discountType: quotation.discountType ?? 'percent',
      discountValue: quotation.discountValue ?? 0,
      validUntil: quotation.validUntil ? new Date(quotation.validUntil).toISOString().split('T')[0] : '',
      delivery: quotation.delivery || '2 Weeks',
      terms: quotation.terms || '',
      notes: quotation.notes || '',
    });
    setVendorForm({
      vendorEmail: (quotation as any).vendorEmail || (quotation.leadId as any)?.oemEmail || '',
      finalAmount: quotation.finalAmount || quotation.total || 0,
    });
    setShowEditModal(true);
  };

  const openVendorModal = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setVendorForm({
      vendorEmail: (quotation as any).vendorEmail || (quotation.leadId as any)?.oemEmail || '',
      finalAmount: quotation.finalAmount || quotation.total || 0,
    });
    setShowVendorModal(true);
  };

  const openViewModal = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setShowViewModal(true);
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: string | number) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      const { quantity, unitPrice, discount } = next[index];
      const disc = Number(discount ?? 0);
      next[index].total = Number(quantity) * Number(unitPrice) * (1 - disc / 100);
      return next;
    });
  };

  const addItem = () => setItems(prev => [...prev, { ...emptyItem }]);
  const removeItem = (index: number) => {
    if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, i) => sum + (i.total || 0), 0);
  const discountAmount = form.discountApplicable
    ? (form.discountType === 'percent' ? subtotal * (Number(form.discountValue) / 100) : Number(form.discountValue))
    : 0;
  const discountedSubtotal = subtotal - discountAmount;
  const taxAmount = form.gstApplicable ? discountedSubtotal * (Number(form.taxRate) / 100) : 0;
  const totalAmount = discountedSubtotal + taxAmount;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leadId) { setToast({ message: 'Please select a lead', type: 'error' }); return; }
    const validItems = items.filter(i => i.description.trim());
    if (!validItems.length) { setToast({ message: 'Add at least one line item', type: 'error' }); return; }
    setSaving(true);
    try {
      await quotationsApi.create({ ...form, items: validItems, subtotal, discountAmount, taxAmount, total: totalAmount, status: 'Draft' });
      setShowCreateModal(false);
      load();
      notify('Quotation Created', 'New quotation created successfully.', 'quotation', '/quotations');
      setToast({ message: 'Quotation created successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to create quotation', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuotation) return;
    const validItems = items.filter(i => i.description.trim());
    if (!validItems.length) { setToast({ message: 'Add at least one line item', type: 'error' }); return; }
    setSaving(true);
    try {
      await quotationsApi.update(selectedQuotation._id, {
        items: validItems,
        subtotal,
        discountApplicable: form.discountApplicable,
        discountType: form.discountType,
        discountValue: form.discountValue,
        discountAmount,
        taxRate: form.taxRate,
        gstApplicable: form.gstApplicable,
        taxAmount,
        total: totalAmount,
        validUntil: form.validUntil || undefined,
        delivery: form.delivery,
        terms: form.terms,
        notes: form.notes,
      });
      setShowEditModal(false);
      setSelectedQuotation(null);
      load();
      notify('Quotation Updated', 'Quotation updated successfully.', 'quotation', '/quotations');
      setToast({ message: 'Quotation updated successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to update quotation', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await quotationsApi.delete(deleteTarget._id);
      setQuotations(prev => prev.filter(q => q._id !== deleteTarget._id));
      setTotal(prev => prev - 1);
      setDeleteTarget(null);
      setToast({ message: 'Quotation deleted successfully', type: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete quotation';
      setToast({ message: msg, type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleSendToVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuotation) return;
    if (!vendorForm.vendorEmail) { setToast({ message: 'Vendor email is required', type: 'error' }); return; }
    setSaving(true);
    try {
      await quotationsApi.sendToVendor(selectedQuotation._id, {
        vendorEmail: vendorForm.vendorEmail,
        finalAmount: vendorForm.finalAmount,
      });
      setShowVendorModal(false);
      setShowEditModal(false);
      setSelectedQuotation(null);
      load();
      notify('Sent to Vendor', 'Quotation request sent to vendor.', 'quotation', '/quotations');
      setToast({ message: 'Quotation sent to vendor successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to send to vendor', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const downloadAsPDF = async (element: HTMLElement, filename: string) => {
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH);
      heightLeft -= pageH;
    }
    pdf.save(filename);
  };

  const generateQuotationPDF = async (q: Quotation) => {
    const lead = q.leadId as Lead;
    const createdBy = q.createdBy;
    const finalPrice = q.finalAmount || q.total;

    const logoHtml = `<img src="${resolvedLogo}" style="height:50px;object-fit:contain;" />`;

    const itemsRows = q.items.map((item, i) => `
      <tr>
        <td style="border:1px solid #000;padding:4px 8px;text-align:center;">${i + 1}</td>
        <td style="border:1px solid #000;padding:4px 8px;text-align:center;">${item.description}</td>
        <td style="border:1px solid #000;padding:4px 8px;text-align:center;">${item.quantity}</td>
        <td style="border:1px solid #000;padding:4px 8px;text-align:right;">${item.listPrice ? formatCurrency(item.listPrice) : formatCurrency(item.unitPrice)}</td>
        <td style="border:1px solid #000;padding:4px 8px;text-align:right;">${formatCurrency(item.unitPrice)}</td>
        <td style="border:1px solid #000;padding:4px 8px;text-align:right;">${formatCurrency(item.total)}</td>
      </tr>`).join('');

    const hasItemDiscount = q.items.some(i => (i.discount ?? 0) > 0);

    const gstRow = q.gstApplicable && q.taxAmount > 0 ? `
      <tr>
        <td style="border:1px solid #000;padding:4px 8px;"></td>
        <td style="border:1px solid #000;padding:4px 8px;background:#f5f5f5;font-weight:bold;">GST @ ${q.taxRate}%</td>
        <td style="border:1px solid #000;padding:4px 8px;text-align:right;">${formatCurrency(q.taxAmount)}</td>
      </tr>` : '';

    const discountRow = q.discountApplicable && (q.discountAmount ?? 0) > 0 ? `
      <tr>
        <td style="border:1px solid #000;padding:4px 8px;"></td>
        <td style="border:1px solid #000;padding:4px 8px;background:#fff8f8;font-weight:bold;color:#dc2626;">${q.discountType === 'percent' ? `Discount (${q.discountValue}%)` : 'Discount (Flat)'}</td>
        <td style="border:1px solid #000;padding:4px 8px;text-align:right;color:#dc2626;">− ${formatCurrency(q.discountAmount ?? 0)}</td>
      </tr>` : '';

    const defaultTerms = `Order: License Form should be duly filled along with the Purchase Order<br/>
Taxes: Subject to change as per prevailing laws of the Country<br/>
Delivery: Within 2 weeks from the date of receipt of Purchase Order<br/>
Payment: 100% Advance<br/>
Delivery - Electronic Download<br/>
This offer may be subject to errors and changes.`;

    const B = '#000'; // border color
    const H = '#e8e8e8'; // header bg
    const qDate = new Date(q.createdAt).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const td = (style='') => `border:1px solid ${B};padding:5px 8px;${style}`;
    const th = (style='') => `border:1px solid ${B};padding:5px 8px;background:${H};font-weight:bold;${style}`;

    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:820px;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:11px;padding:16px;box-sizing:border-box;';
    document.body.appendChild(container);
    container.innerHTML = `
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        table{width:100%;border-collapse:collapse;}
        td,th{font-family:Arial,sans-serif;font-size:11px;vertical-align:top;}
      </style>

      <!-- outer wrapper border -->
      <div style="border:1.5px solid ${B};padding:0;">

        <!-- ══ HEADER: Logo left | OEM right ══ -->
        <table style="width:100%;border-collapse:collapse;border-bottom:1px solid ${B};">
          <tr>
            <td style="padding:12px 16px;width:50%;vertical-align:middle;">
              <img src="${resolvedLogo}" style="height:52px;object-fit:contain;" />
            </td>
            <td style="padding:12px 16px;width:50%;vertical-align:middle;text-align:right;border-left:1px solid ${B};">
              ${lead?.oemName
                ? `<div style="font-weight:bold;font-size:15px;color:#333;letter-spacing:1px;">${lead.oemName}</div>`
                : ''
              }
            </td>
          </tr>
        </table>

        <!-- ══ "To," line ══ -->
        <div style="padding:6px 16px;border-bottom:1px solid ${B};font-size:11px;">To,</div>

        <!-- ══ Address left | Details right ══ -->
        <table style="width:100%;border-collapse:collapse;border-bottom:1px solid ${B};">
          <tr>
            <td style="width:50%;padding:10px 16px;vertical-align:middle;text-align:center;border-right:1px solid ${B};">
              <div style="font-weight:bold;font-size:13px;">${lead?.companyName || '—'}</div>
              ${lead?.address ? `<div style="color:#333;margin-top:3px;font-size:10px;">${lead.address}</div>` : ''}
              ${(lead?.city || lead?.state) ? `<div style="color:#333;font-size:10px;">${[lead.city, lead.state].filter(Boolean).join(', ')}</div>` : ''}
            </td>
            <td style="width:50%;padding:0;vertical-align:top;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="${th('white-space:nowrap;')}">Date</td><td style="${td()}">${qDate}</td></tr>
                <tr><td style="${th('white-space:nowrap;')}">Quotation No.</td><td style="${td()}">${q.quotationNumber}</td></tr>
                <tr><td style="${th('white-space:nowrap;')}">Customer ID</td><td style="${td()}">${lead?._id?.slice(-6).toUpperCase() || ''}</td></tr>
                <tr><td style="${th('white-space:nowrap;')}">Quote Validity</td><td style="${td()}">${q.validUntil ? formatDate(q.validUntil) : '15 Days'}</td></tr>
                <tr><td style="${th('white-space:nowrap;')}">Prepared By</td><td style="${td()}">${createdBy?.name || '—'}</td></tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- ══ Sub / GST row ══ -->
        <table style="width:100%;border-collapse:collapse;border-bottom:1px solid ${B};">
          <tr>
            <td style="padding:5px 10px;width:60%;border-right:1px solid ${B};">
              <strong>Sub: Proposal for ${lead?.oemName || 'Software'}</strong><br/>
              ${lead?.contactPersonName || lead?.contactName ? `Kind Attn.: ${lead.contactPersonName || lead.contactName}` : ''}
            </td>
            <td style="padding:5px 10px;">
              <strong>Telled GST No.: ${TELLED_INFO.gstNo}</strong>
            </td>
          </tr>
        </table>

        <!-- ══ Sales Person ══ -->
        <table style="width:100%;border-collapse:collapse;border-bottom:1px solid ${B};">
          <thead>
            <tr>
              <th style="${th('text-align:center;')}">Sales Person</th>
              <th style="${th('text-align:center;')}">Contact Number</th>
              <th style="${th('text-align:center;')}">Email ID</th>
              <th style="${th('text-align:center;')}">Delivery</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="${td('text-align:center;')}">${createdBy?.name || '—'}</td>
              <td style="${td('text-align:center;')}">${createdBy?.phone || lead?.phone || '—'}</td>
              <td style="${td('text-align:center;')}">${createdBy?.email || '—'}</td>
              <td style="${td('text-align:center;')}">${q.delivery || '2 Weeks'}</td>
            </tr>
          </tbody>
        </table>

        <!-- ══ Items ══ -->
        <table style="width:100%;border-collapse:collapse;border-bottom:1px solid ${B};">
          <thead>
            <tr>
              <th style="${th('text-align:center;width:5%;')}">Sr. No</th>
              <th style="${th('text-align:center;')}">Product Description</th>
              <th style="${th('text-align:center;width:5%;')}">Qty</th>
              <th style="${th('text-align:center;width:15%;')}">List Price Per Qty</th>
              <th style="${th('text-align:center;width:16%;')}">Strategic Price Per Qty</th>
              ${hasItemDiscount ? `<th style="${th('text-align:center;width:8%;')}">Disc %</th>` : ''}
              <th style="${th('text-align:center;width:14%;')}">Total</th>
            </tr>
          </thead>
          <tbody>
            ${q.items.map((item, i) => `
            <tr>
              <td style="${td('text-align:center;')}">${i + 1}</td>
              <td style="${td('text-align:center;')}">${item.description}</td>
              <td style="${td('text-align:center;')}">${item.quantity}</td>
              <td style="${td('text-align:right;')}">${item.listPrice ? formatCurrency(item.listPrice) : formatCurrency(item.unitPrice)}</td>
              <td style="${td('text-align:right;')}">${formatCurrency(item.unitPrice)}</td>
              ${hasItemDiscount ? `<td style="${td('text-align:center;')}">${(item.discount ?? 0) > 0 ? item.discount + '%' : '—'}</td>` : ''}
              <td style="${td('text-align:right;')}">${formatCurrency(item.total)}</td>
            </tr>`).join('')}
          </tbody>
        </table>

        <!-- ══ Totals (right-aligned block) ══ -->
        <table style="width:100%;border-collapse:collapse;border-bottom:1px solid ${B};">
          <tr>
            <td style="width:55%;border-right:1px solid ${B};padding:0;" rowspan="${1 + (q.discountApplicable && (q.discountAmount ?? 0) > 0 ? 1 : 0) + (q.gstApplicable && q.taxAmount > 0 ? 1 : 0) + 1}"></td>
            <td style="${th('white-space:nowrap;text-align:right;width:20%;')}">Base Price</td>
            <td style="${td('text-align:right;width:25%;')}">${formatCurrency(q.subtotal)}</td>
          </tr>
          ${discountRow}
          ${gstRow}
          <tr>
            <td style="${th('white-space:nowrap;text-align:right;')}">Final Price</td>
            <td style="${td('text-align:right;font-weight:bold;')}">${formatCurrency(finalPrice)}</td>
          </tr>
        </table>

        <!-- ══ Terms + Bank ══ -->
        <table style="width:100%;border-collapse:collapse;border-bottom:1px solid ${B};">
          <tr>
            <td style="width:55%;padding:8px 10px;vertical-align:top;border-right:1px solid ${B};">
              <div style="font-weight:bold;margin-bottom:5px;">General Terms and Conditions</div>
              <div style="font-size:10px;line-height:1.7;">${q.terms ? q.terms.replace(/\n/g, '<br/>') : defaultTerms}</div>
            </td>
            <td style="width:45%;padding:8px 10px;vertical-align:top;">
              <div style="font-weight:bold;margin-bottom:5px;">Bank Details</div>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:2px 0;font-weight:bold;width:38%;">Bank</td><td style="padding:2px 0;">${TELLED_INFO.bank}</td></tr>
                <tr><td style="padding:2px 0;font-weight:bold;">Account No.</td><td style="padding:2px 0;">${TELLED_INFO.accountNo}</td></tr>
                <tr><td style="padding:2px 0;font-weight:bold;">IFSC Code</td><td style="padding:2px 0;">${TELLED_INFO.ifsc}</td></tr>
                <tr><td style="padding:2px 0;font-weight:bold;">Branch</td><td style="padding:2px 0;">${TELLED_INFO.branch}</td></tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- ══ Signature ══ -->
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:35%;padding:40px 16px 10px;vertical-align:bottom;border-right:1px solid ${B};">
              <div style="border-top:1px solid #999;padding-top:4px;font-size:10px;text-align:center;">Authorised Signatory</div>
            </td>
            <td style="padding:12px 16px;vertical-align:middle;text-align:center;">
              <img src="${resolvedLogo}" style="height:40px;object-fit:contain;margin-bottom:6px;" />
              <div style="font-size:10px;margin-top:4px;color:#333;line-height:1.6;">${TELLED_INFO.address.replace(/\n/g, '<br/>')}</div>
            </td>
          </tr>
        </table>

      </div><!-- end outer border -->
    `;
    try {
      await downloadAsPDF(container, `${q.quotationNumber}.pdf`);
    } finally {
      document.body.removeChild(container);
    }
  };

  const handleAction = async (action: string, id: string) => {
    if (action === 'sendEmail') {
      const q = quotations.find(qt => qt._id === id);
      if (q) {
        setSendEmailTarget(q);
        setSendToEmail((q.leadId as any)?.email || '');
        setSendCcEmail('');
        return;
      }
    }
    if (action === 'generatePDF') {
      const q = quotations.find(qt => qt._id === id);
      if (q) { generateQuotationPDF(q); return; }
    }
    setActionLoading(id + action);
    try {
      switch (action) {
        case 'accept': await quotationsApi.accept(id); notify('Quotation Accepted', 'Quotation has been accepted.', 'quotation', '/quotations'); setToast({ message: 'Quotation accepted', type: 'success' }); break;
        case 'reject': await quotationsApi.reject(id); notify('Quotation Rejected', 'Quotation has been rejected.', 'quotation', '/quotations'); setToast({ message: 'Quotation rejected', type: 'success' }); break;
        case 'finalize': await quotationsApi.finalize(id); notify('Quotation Finalized', 'Quotation marked as final.', 'quotation', '/quotations'); setToast({ message: 'Quotation finalized', type: 'success' }); break;
      }
      load();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || `${action} failed`, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmSendEmail = async () => {
    if (!sendEmailTarget) return;
    setSendEmailSending(true);
    try {
      await quotationsApi.sendEmail(sendEmailTarget._id, sendToEmail.trim() || undefined, sendCcEmail.trim() || undefined);
      notify('Quotation Email Sent', 'Quotation email sent to lead successfully.', 'quotation', '/quotations');
      setToast({ message: 'Email sent successfully', type: 'success' });
      setSendEmailTarget(null);
      load();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to send email', type: 'error' });
    } finally {
      setSendEmailSending(false);
    }
  };

  const getActionButtons = (q: Quotation) => {
    const buttons = [];

    // View button always
    buttons.push(
      <button key="view" title="View Details" onClick={() => openViewModal(q)}
        className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
        <Eye size={14} />
      </button>
    );

    // Mail button only if email not yet sent
    if (!q.emailSent) {
      buttons.push(
        <button key="sendEmail" title="Send Email to Customer"
          disabled={actionLoading === q._id + 'sendEmail'}
          onClick={() => handleAction('sendEmail', q._id)}
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50">
          <Mail size={14} />
        </button>
      );
    }

    // PDF button always — generates in browser
    buttons.push(
      <button key="pdf" title="Download PDF"
        onClick={() => generateQuotationPDF(q)}
        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
        <Download size={14} />
      </button>
    );

    // Delete button (admin only)
    buttons.push(
      <button key="delete" title="Delete Quotation"
        onClick={() => setDeleteTarget(q)}
        className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
        <Trash2 size={14} />
      </button>
    );

    return buttons;
  };

  const displayed = quotations;

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Quotations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total quotations</p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelImportButton
            entityName="Quotations"
            columnHint="leadName (company to match), subtotal, taxRate (%), delivery, terms, notes"
            onImport={async (rows) => {
              let imported = 0;
              const leadsRes = await leadsApi.getAll({ limit: 500 });
              const leadList: { _id: string; companyName: string }[] = leadsRes.data || [];
              for (const row of rows) {
                const ln = (row.leadName || row.company || row.companyName || '').toLowerCase();
                const lead = leadList.find(l => l.companyName.toLowerCase().includes(ln));
                if (!lead) continue;
                const subtotal = parseFloat(row.subtotal || row.amount || '0') || 0;
                const taxRate  = parseFloat(row.taxRate  || row.gst   || '18') || 18;
                try {
                  await quotationsApi.create({ leadId: lead._id, items: [{ description: row.description || 'Item', quantity: 1, unitPrice: subtotal, total: subtotal }], subtotal, taxRate, taxAmount: subtotal * taxRate / 100, total: subtotal * (1 + taxRate / 100), delivery: row.delivery || '', terms: row.terms || '', notes: row.notes || '' });
                  imported++;
                } catch { /* skip */ }
              }
              load();
              return { imported };
            }}
          />
          <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Quotation
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by company..." className="input-field pl-9" />
        </div>
        <select className="input-field w-40" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Accepted">Accepted</option>
          <option value="Rejected">Rejected</option>
          <option value="Final">Final</option>
        </select>
        <button onClick={load} className="p-2 text-gray-500 hover:text-violet-600 transition-colors"><RefreshCw size={18} /></button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="h-48" />
        ) : displayed.length === 0 ? (
          <div className="text-center text-gray-400 py-16">No quotations found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Quotation #</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Ver.</th>
                  <th className="table-header">Subtotal</th>
                  <th className="table-header">Tax</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Valid Until</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map((q) => (
                  <tr key={q._id} className="hover:bg-violet-50/20 transition-colors">
                    <td className="table-cell font-mono font-medium text-violet-700">{q.quotationNumber}</td>
                    <td className="table-cell font-medium">{(q.leadId as Lead)?.companyName || '—'}</td>
                    <td className="table-cell text-center">
                      <span className={`badge text-xs ${q.version > 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>v{q.version}</span>
                    </td>
                    <td className="table-cell text-gray-500">{formatCurrency(q.subtotal)}</td>
                    <td className="table-cell text-gray-500">
                      {q.gstApplicable
                        ? <div className="flex items-center gap-1"><Percent size={12} />{q.taxRate}%</div>
                        : <span className="text-gray-400">N/A</span>}
                    </td>
                    <td className="table-cell font-semibold text-violet-700">{formatCurrency(q.total)}</td>
                    <td className="table-cell text-gray-400">{q.validUntil ? formatDate(q.validUntil) : '—'}</td>
                    <td className="table-cell">
                      <span className={`badge text-xs ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-600'}`}>{q.status}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5 flex-wrap">{getActionButtons(q)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 15 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 15)}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 text-sm">Prev</button>
              <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 text-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Quotation Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Quotation" size="xl">
        <form onSubmit={handleCreate} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Lead *</label>
              <select required className="input-field" value={form.leadId}
                onChange={(e) => setForm(f => ({ ...f, leadId: e.target.value }))}>
                <option value="">Select lead</option>
                {leads.map(l => (
                  <option key={l._id} value={l._id}>{l.companyName} ({l.oemName || 'No OEM'})</option>
                ))}
              </select>
              {leads.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No leads with approved DRFs available</p>
              )}
            </div>
            <div>
              <label className="label">Valid Until</label>
              <input type="date" className="input-field" value={form.validUntil}
                onChange={(e) => setForm(f => ({ ...f, validUntil: e.target.value }))} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3 bg-gray-50 rounded-lg">
            {/* GST */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.gstApplicable}
                onChange={(e) => setForm(f => ({ ...f, gstApplicable: e.target.checked }))}
                className="w-4 h-4 accent-violet-600" />
              <span className="text-sm font-medium text-gray-700">GST Applicable</span>
            </label>
            {form.gstApplicable && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Tax Rate:</span>
                <input type="number" className="input-field w-20 text-sm py-1" value={form.taxRate}
                  onChange={(e) => setForm(f => ({ ...f, taxRate: Number(e.target.value) }))} min="0" max="100" />
                <span className="text-sm text-gray-500">%</span>
              </div>
            )}
            {/* Divider */}
            <div className="h-4 w-px bg-gray-300" />
            {/* Discount */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.discountApplicable}
                onChange={(e) => setForm(f => ({ ...f, discountApplicable: e.target.checked, discountValue: 0 }))}
                className="w-4 h-4 accent-violet-600" />
              <span className="text-sm font-medium text-gray-700">Discount</span>
            </label>
            {form.discountApplicable && (
              <div className="flex items-center gap-2">
                <select className="input-field py-1 text-sm w-24"
                  value={form.discountType}
                  onChange={(e) => setForm(f => ({ ...f, discountType: e.target.value as 'percent' | 'flat' }))}>
                  <option value="percent">%</option>
                  <option value="flat">₹ Flat</option>
                </select>
                <input type="number" className="input-field w-24 text-sm py-1" value={form.discountValue}
                  onChange={(e) => setForm(f => ({ ...f, discountValue: Number(e.target.value) }))} min="0" step="0.01" />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label !mb-0">Line Items *</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500">
                  <input type="checkbox" checked={showItemDiscount}
                    onChange={(e) => {
                      setShowItemDiscount(e.target.checked);
                      if (!e.target.checked) setItems(prev => prev.map(it => ({ ...it, discount: 0, total: it.quantity * it.unitPrice })));
                    }}
                    className="w-3.5 h-3.5 accent-violet-600" />
                  Item Discount
                </label>
                <button type="button" onClick={addItem} className="text-xs text-violet-600 hover:text-violet-800 font-medium">+ Add Row</button>
              </div>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-xl bg-gray-50/50 p-3 space-y-2">
                  {/* Row 1 */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-400 mb-0.5 ml-0.5">Description</p>
                      <input className="input-field text-sm py-1.5 w-full bg-white" placeholder="e.g. Ansys RF License" value={item.description}
                        onChange={(e) => updateItem(i, 'description', e.target.value)} required />
                    </div>
                    <div className="w-20 shrink-0">
                      <p className="text-[10px] text-gray-400 mb-0.5 ml-0.5">Qty</p>
                      <input type="number" className="input-field text-sm py-1.5 text-center w-full bg-white" min={1} value={item.quantity}
                        onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} required />
                    </div>
                    <div className="w-32 shrink-0 text-right">
                      <p className="text-[10px] text-gray-400 mb-0.5">Total</p>
                      <p className="text-sm font-bold text-violet-700 py-1.5">{formatCurrency(item.total)}</p>
                    </div>
                    <button type="button" onClick={() => removeItem(i)}
                      className="shrink-0 mt-4 w-6 h-6 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors text-base leading-none">×</button>
                  </div>
                  {/* Row 2 */}
                  <div className={`grid gap-2 ${showItemDiscount ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5 ml-0.5">List Price (₹)</p>
                      <input type="number" className="input-field text-sm py-1.5 text-right w-full bg-white" placeholder="0" min={0} step="0.01"
                        value={item.listPrice ?? ''} onChange={(e) => updateItem(i, 'listPrice', Number(e.target.value))} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5 ml-0.5">Strategic Price (₹)</p>
                      <input type="number" className="input-field text-sm py-1.5 text-right w-full bg-white" placeholder="0" min={0} step="0.01"
                        value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} required />
                    </div>
                    {showItemDiscount && (
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5 ml-0.5">Discount (%)</p>
                        <input type="number" className="input-field text-sm py-1.5 text-center w-full bg-white" placeholder="0" min={0} max={100} step="0.01"
                          value={item.discount ?? ''} onChange={(e) => updateItem(i, 'discount', Number(e.target.value))} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Base Price</span><span>{formatCurrency(subtotal)}</span></div>
            {form.discountApplicable && discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount {form.discountType === 'percent' ? `(${form.discountValue}%)` : '(Flat)'}</span>
                <span>− {formatCurrency(discountAmount)}</span>
              </div>
            )}
            {form.gstApplicable && <div className="flex justify-between"><span className="text-gray-500">GST @ {form.taxRate}%</span><span>{formatCurrency(taxAmount)}</span></div>}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
              <span>Final Price</span><span className="text-violet-700">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Delivery</label>
              <input className="input-field" value={form.delivery}
                onChange={(e) => setForm(f => ({ ...f, delivery: e.target.value }))} placeholder="e.g. 2 Weeks" />
            </div>
          </div>

          <div>
            <label className="label">Terms & Conditions</label>
            <textarea rows={2} className="input-field" value={form.terms}
              onChange={(e) => setForm(f => ({ ...f, terms: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || leads.length === 0} className="btn-primary">
              {saving ? 'Creating...' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Quotation Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedQuotation(null); }} title="Edit Quotation" size="xl">
        <form onSubmit={handleEdit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Lead</label>
              <div className="input-field bg-gray-50 text-gray-600 cursor-not-allowed">
                {(selectedQuotation?.leadId as Lead)?.companyName || '—'}
              </div>
            </div>
            <div>
              <label className="label">Valid Until</label>
              <input type="date" className="input-field" value={form.validUntil}
                onChange={(e) => setForm(f => ({ ...f, validUntil: e.target.value }))} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3 bg-gray-50 rounded-lg">
            {/* GST */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.gstApplicable}
                onChange={(e) => setForm(f => ({ ...f, gstApplicable: e.target.checked }))}
                className="w-4 h-4 accent-violet-600" />
              <span className="text-sm font-medium text-gray-700">GST Applicable</span>
            </label>
            {form.gstApplicable && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Tax Rate:</span>
                <input type="number" className="input-field w-20 text-sm py-1" value={form.taxRate}
                  onChange={(e) => setForm(f => ({ ...f, taxRate: Number(e.target.value) }))} min="0" max="100" />
                <span className="text-sm text-gray-500">%</span>
              </div>
            )}
            {/* Divider */}
            <div className="h-4 w-px bg-gray-300" />
            {/* Discount */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.discountApplicable}
                onChange={(e) => setForm(f => ({ ...f, discountApplicable: e.target.checked, discountValue: 0 }))}
                className="w-4 h-4 accent-violet-600" />
              <span className="text-sm font-medium text-gray-700">Discount</span>
            </label>
            {form.discountApplicable && (
              <div className="flex items-center gap-2">
                <select className="input-field py-1 text-sm w-24"
                  value={form.discountType}
                  onChange={(e) => setForm(f => ({ ...f, discountType: e.target.value as 'percent' | 'flat' }))}>
                  <option value="percent">%</option>
                  <option value="flat">₹ Flat</option>
                </select>
                <input type="number" className="input-field w-24 text-sm py-1" value={form.discountValue}
                  onChange={(e) => setForm(f => ({ ...f, discountValue: Number(e.target.value) }))} min="0" step="0.01" />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label !mb-0">Line Items</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500">
                  <input type="checkbox" checked={showItemDiscount}
                    onChange={(e) => {
                      setShowItemDiscount(e.target.checked);
                      if (!e.target.checked) setItems(prev => prev.map(it => ({ ...it, discount: 0, total: it.quantity * it.unitPrice })));
                    }}
                    className="w-3.5 h-3.5 accent-violet-600" />
                  Item Discount
                </label>
                <button type="button" onClick={addItem} className="text-xs text-violet-600 hover:text-violet-800 font-medium">+ Add Row</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs text-gray-500 font-medium w-1/3">Description</th>
                    <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium w-16">Qty</th>
                    <th className="px-2 py-2 text-right text-xs text-gray-500 font-medium">List Price</th>
                    <th className="px-2 py-2 text-right text-xs text-gray-500 font-medium">Strategic Price</th>
                    {showItemDiscount && <th className="px-2 py-2 text-right text-xs text-gray-500 font-medium w-20">Disc %</th>}
                    <th className="px-2 py-2 text-right text-xs text-gray-500 font-medium w-24">Total</th>
                    <th className="w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-1">
                        <input className="input-field text-sm py-1" placeholder="Description" value={item.description}
                          onChange={(e) => updateItem(i, 'description', e.target.value)} required />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="input-field text-sm py-1 text-center" placeholder="Qty" min={1} value={item.quantity}
                          onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} required />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="input-field text-sm py-1 text-right" placeholder="List Price" min={0} step="0.01"
                          value={item.listPrice ?? ''} onChange={(e) => updateItem(i, 'listPrice', Number(e.target.value))} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="input-field text-sm py-1 text-right" placeholder="Strategic Price" min={0} step="0.01"
                          value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} required />
                      </td>
                      {showItemDiscount && (
                        <td className="px-2 py-1">
                          <input type="number" className="input-field text-sm py-1 text-right" placeholder="0" min={0} max={100} step="0.01"
                            value={item.discount ?? ''} onChange={(e) => updateItem(i, 'discount', Number(e.target.value))} />
                        </td>
                      )}
                      <td className="px-2 py-1 text-right font-medium text-gray-700">{formatCurrency(item.total)}</td>
                      <td className="px-1 py-1">
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overall Discount */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Base Price</span><span>{formatCurrency(subtotal)}</span></div>
            {form.discountApplicable && discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount {form.discountType === 'percent' ? `(${form.discountValue}%)` : '(Flat)'}</span>
                <span>− {formatCurrency(discountAmount)}</span>
              </div>
            )}
            {form.gstApplicable && <div className="flex justify-between"><span className="text-gray-500">GST @ {form.taxRate}%</span><span>{formatCurrency(taxAmount)}</span></div>}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
              <span>Final Price</span><span className="text-violet-700">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Delivery</label>
              <input className="input-field" value={form.delivery}
                onChange={(e) => setForm(f => ({ ...f, delivery: e.target.value }))} placeholder="e.g. 2 Weeks" />
            </div>
          </div>

          <div>
            <label className="label">Terms & Conditions</label>
            <textarea rows={2} className="input-field" value={form.terms}
              onChange={(e) => setForm(f => ({ ...f, terms: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input-field" value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex gap-3 justify-end sticky bottom-0 bg-white pt-2">
            <button type="button" onClick={() => { setShowEditModal(false); setSelectedQuotation(null); }} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Send Email Modal */}
      <Modal isOpen={!!sendEmailTarget} onClose={() => setSendEmailTarget(null)} title="Send Quotation Email" size="md">
        {sendEmailTarget && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
              <p className="font-semibold mb-1">{sendEmailTarget.quotationNumber}</p>
              <p className="text-xs text-blue-600">{(sendEmailTarget.leadId as any)?.companyName}</p>
            </div>
            <div>
              <label className="label">Send To *</label>
              <ContactEmailPicker
                required
                placeholder="Recipient email"
                value={sendToEmail}
                onChange={setSendToEmail}
                defaultContactType="CUSTOMER"
              />
            </div>
            <div>
              <label className="label">CC</label>
              <ContactEmailPicker
                placeholder="CC recipients (optional)"
                value={sendCcEmail}
                onChange={setSendCcEmail}
                defaultContactType="ALL"
                applyLabel="Add to CC"
              />
            </div>
            <p className="text-xs text-gray-500">The quotation PDF will be attached to the email.</p>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setSendEmailTarget(null)} className="btn-secondary py-1.5 text-sm">Cancel</button>
              <button onClick={handleConfirmSendEmail} disabled={sendEmailSending || !sendToEmail.trim()} className="btn-primary py-1.5 text-sm flex items-center gap-2">
                <Send size={13} />
                {sendEmailSending ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Send to Vendor Modal */}
      <Modal isOpen={showVendorModal} onClose={() => { setShowVendorModal(false); setSelectedQuotation(null); }} title="Send to Vendor" size="md">
        <form onSubmit={handleSendToVendor} className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-800 mb-3">Send this quotation request to the vendor for pricing.</p>
            <div className="mb-3">
              <label className="label">Vendor Email *</label>
              <ContactEmailPicker
                required
                placeholder="vendor@example.com"
                value={vendorForm.vendorEmail}
                onChange={(val) => setVendorForm(f => ({ ...f, vendorEmail: val }))}
                defaultContactType="ARK"
              />
              <p className="text-xs text-gray-500 mt-1">Email where the quotation request will be sent</p>
            </div>
            <div>
              <label className="label">Final Amount (₹)</label>
              <input type="number" className="input-field" value={vendorForm.finalAmount}
                onChange={(e) => setVendorForm(f => ({ ...f, finalAmount: Number(e.target.value) }))}
                min="0" step="0.01" />
              <p className="text-xs text-gray-500 mt-1">Original total: {formatCurrency(selectedQuotation?.total || 0)}</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setShowVendorModal(false); setSelectedQuotation(null); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              <Send size={16} /> {saving ? 'Sending...' : 'Send to Vendor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Quotation Modal — PDF-style layout */}
      <Modal isOpen={showViewModal} onClose={() => { setShowViewModal(false); setSelectedQuotation(null); }}
        title={`Quotation — ${selectedQuotation?.quotationNumber}`} size="2xl">
        {selectedQuotation && (() => {
          const lead = selectedQuotation.leadId as Lead;
          const createdBy = selectedQuotation.createdBy;
          const finalPrice = selectedQuotation.finalAmount || selectedQuotation.total;

          const handleDownload = async () => {
            const content = printRef.current;
            if (!content) return;
            await downloadAsPDF(content, `${selectedQuotation.quotationNumber}.pdf`);
          };

          return (
            <div>
              {/* Print action bar */}
              <div className="flex justify-end mb-3 gap-2">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedQuotation.status]}`}>
                  {selectedQuotation.status}
                </span>
                <button onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors">
                  <Download size={14} /> Download PDF
                </button>
                <button onClick={() => setShowViewModal(false)} className="btn-secondary py-1.5 text-sm">Close</button>
              </div>

              {/* Document preview */}
              <div ref={printRef} className="bg-white border border-gray-300 p-6 text-xs font-sans" style={{ fontFamily: 'Arial, sans-serif' }}>

                {/* ── HEADER ── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '50%', verticalAlign: 'middle' }}>
                        <img src={resolvedLogo} alt="logo" style={{ height: 50, objectFit: 'contain' }} />
                      </td>
                      <td style={{ width: '50%', textAlign: 'right', verticalAlign: 'middle' }}>
                        {lead?.oemName && (
                          <div style={{ fontWeight: 'bold', fontSize: 13, color: '#444' }}>{lead.oemName}</div>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* ── TO + INFO TABLE ── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                  <tbody>
                    <tr>
                      {/* Left: To block */}
                      <td style={{ width: '55%', verticalAlign: 'top', paddingRight: 16 }}>
                        <div style={{ marginBottom: 4 }}>To,</div>
                        <div style={{ fontWeight: 'bold', fontSize: 13 }}>{lead?.companyName}</div>
                        {lead?.address && <div style={{ color: '#444', marginTop: 2 }}>{lead.address}</div>}
                        {(lead?.city || lead?.state) && (
                          <div style={{ color: '#444' }}>{[lead.city, lead.state].filter(Boolean).join(', ')}</div>
                        )}
                      </td>
                      {/* Right: Info table */}
                      <td style={{ width: '45%', verticalAlign: 'top' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                          <tbody>
                            {[
                              ['Date', new Date(selectedQuotation.createdAt).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
                              ['Quotation No.', selectedQuotation.quotationNumber],
                              ['Customer ID', lead?._id?.slice(-6).toUpperCase() || '—'],
                              ['Quote Validity', selectedQuotation.validUntil ? formatDate(selectedQuotation.validUntil) : '15 Days'],
                              ['Prepared By', createdBy?.name || '—'],
                            ].map(([label, value]) => (
                              <tr key={label}>
                                <td style={{ border: '1px solid #000', padding: '3px 6px', background: '#f5f5f5', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{label}</td>
                                <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* ── SUBJECT + GST ── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: 0 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '4px 8px', width: '60%', border: '1px solid #000' }}>
                        <strong>Sub: Proposal for {lead?.oemName || 'Software'}</strong><br />
                        {(lead?.contactPersonName || lead?.contactName) && (
                          <span>Kind Attn.: {lead.contactPersonName || lead.contactName}</span>
                        )}
                      </td>
                      <td style={{ padding: '4px 8px', border: '1px solid #000', whiteSpace: 'nowrap' }}>
                        <strong>Telled GST No.: {TELLED_INFO.gstNo}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* ── SALES PERSON TABLE ── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: 0 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      {['Sales Person', 'Contact Number', 'Email ID', 'Delivery'].map(h => (
                        <th key={h} style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center', fontWeight: 'bold' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center' }}>{createdBy?.name || '—'}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center' }}>{createdBy?.phone || lead?.phone || '—'}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center', }}>{createdBy?.email || '—'}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center' }}>{selectedQuotation.delivery || '2 Weeks'}</td>
                    </tr>
                  </tbody>
                </table>

                {/* ── LINE ITEMS TABLE ── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: 0 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      {['Sr. No', 'Product Description', 'Qty', 'List Price Per Qty', 'Strategic Price Per Qty', 'Total'].map(h => (
                        <th key={h} style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center', fontWeight: 'bold' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuotation.items.map((item, i) => (
                      <tr key={i}>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center' }}>{i + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center' }}>{item.description}</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>
                          {item.listPrice ? formatCurrency(item.listPrice) : formatCurrency(item.unitPrice)}
                        </td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* ── PRICING SUMMARY ── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: 0 }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '60%', border: '1px solid #000', padding: '4px 8px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '4px 8px', background: '#f5f5f5', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Base Price</td>
                      <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>{formatCurrency(selectedQuotation.subtotal)}</td>
                    </tr>
                    {selectedQuotation.gstApplicable && (
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 8px' }}></td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', background: '#f5f5f5', fontWeight: 'bold' }}>GST @ {selectedQuotation.taxRate}%</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>{formatCurrency(selectedQuotation.taxAmount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '4px 8px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '4px 8px', background: '#f5f5f5', fontWeight: 'bold' }}>Final Price</td>
                      <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(finalPrice)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* ── TERMS + BANK DETAILS ── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: 0 }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '55%', border: '1px solid #000', padding: '6px 8px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: 4, }}>General Terms and Conditions</div>
                        {selectedQuotation.terms
                          ? <div style={{ whiteSpace: 'pre-line', fontSize: 10 }}>{selectedQuotation.terms}</div>
                          : (
                            <div style={{ fontSize: 10, lineHeight: 1.6 }}>
                              <div>Order: License Form should be duly filled along with the Purchase Order</div>
                              <div>Taxes: Subject to change as per prevailing laws of the Country</div>
                              <div>Delivery: Within 2 weeks from the date of receipt of Purchase Order</div>
                              <div>Payment: 100% Advance</div>
                              <div>Delivery - Electronic Download</div>
                              <div>This offer may be subject to errors and changes.</div>
                            </div>
                          )}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px 8px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: 4, }}>Bank Details</div>
                        {[
                          ['Bank', TELLED_INFO.bank],
                          ['Account No.', TELLED_INFO.accountNo],
                          ['IFSC Code', TELLED_INFO.ifsc],
                          ['Branch', TELLED_INFO.branch],
                        ].map(([label, value]) => (
                          <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
                            <span style={{ fontWeight: 'bold', minWidth: 90 }}>{label}</span>
                            <span>{value}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* ── FOOTER: SIGNATURE + ADDRESS ── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: 0 }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '40%', border: '1px solid #000', padding: '24px 12px 8px', verticalAlign: 'bottom' }}>
                        <div style={{ borderTop: '1px solid #000', paddingTop: 4, marginTop: 24, fontSize: 10 }}>Authorised Signatory</div>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '12px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <img src={resolvedLogo} alt="logo" style={{ height: 40, objectFit: 'contain', marginBottom: 6 }} />
                        <div style={{ fontSize: 10, marginTop: 4, whiteSpace: 'pre-line' }}>{TELLED_INFO.address}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>

              </div>{/* end document */}
            </div>
          );
        })()}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Quotation"
        message={`Are you sure you want to delete quotation ${deleteTarget?.quotationNumber}? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}
