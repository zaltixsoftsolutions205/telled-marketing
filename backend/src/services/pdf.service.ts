import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ─── DRF PDF ────────────────────────────────────────────────────────────────
export const generateDRFPDF = (data: {
  drfNumber: string;
  version: number;
  date: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  oemName?: string;
  source?: string;
  salesName: string;
  salesEmail: string;
  notes?: string;
}): Promise<string> => new Promise((resolve, reject) => {
  const fileName = `drf-${data.drfNumber}-v${data.version}-${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const W = 595, M = 30;
  const inner = W - M * 2;
  const VIOLET = '#4f2d7f';
  const LIGHT_VIOLET = '#e8e0f0';
  const BORDER = '#4f2d7f';

  // ── Helper: bordered row ──────────────────────────────────────────────────
  const row = (y: number, h: number, label: string, value: string, labelW = 160) => {
    doc.rect(M, y, inner, h).stroke(BORDER);
    doc.rect(M, y, labelW, h).stroke(BORDER);
    doc.fillColor(LIGHT_VIOLET).rect(M, y, labelW, h).fill();
    doc.fillColor(BORDER).fontSize(8).font('Helvetica-Bold')
       .text(label, M + 4, y + h / 2 - 4, { width: labelW - 8 });
    doc.fillColor('#222').font('Helvetica').fontSize(9)
       .text(value || '', M + labelW + 4, y + h / 2 - 5, { width: inner - labelW - 8 });
  };

  // ── Helper: two-column row ────────────────────────────────────────────────
  const row2 = (y: number, h: number,
    l1: string, v1: string, l2: string, v2: string,
    lw = 100) => {
    const half = inner / 2;
    // left cell
    doc.rect(M, y, half, h).stroke(BORDER);
    doc.rect(M, y, lw, h).stroke(BORDER);
    doc.fillColor(LIGHT_VIOLET).rect(M, y, lw, h).fill();
    doc.fillColor(BORDER).fontSize(8).font('Helvetica-Bold')
       .text(l1, M + 4, y + h / 2 - 4, { width: lw - 8 });
    doc.fillColor('#222').font('Helvetica').fontSize(9)
       .text(v1 || '', M + lw + 4, y + h / 2 - 5, { width: half - lw - 8 });
    // right cell
    doc.rect(M + half, y, half, h).stroke(BORDER);
    doc.rect(M + half, y, lw, h).stroke(BORDER);
    doc.fillColor(LIGHT_VIOLET).rect(M + half, y, lw, h).fill();
    doc.fillColor(BORDER).fontSize(8).font('Helvetica-Bold')
       .text(l2, M + half + 4, y + h / 2 - 4, { width: lw - 8 });
    doc.fillColor('#222').font('Helvetica').fontSize(9)
       .text(v2 || '', M + half + lw + 4, y + h / 2 - 5, { width: half - lw - 8 });
  };

  // ── Section heading ───────────────────────────────────────────────────────
  const sectionHead = (y: number, title: string) => {
    doc.fillColor(VIOLET).rect(M, y, inner, 18).fill();
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold')
       .text(title, M + 6, y + 4, { width: inner });
    return y + 18;
  };

  // ════════════════════════════════════════════════════════════════════════
  // HEADER
  // ════════════════════════════════════════════════════════════════════════
  // Top violet bar
  doc.fillColor(VIOLET).rect(0, 0, W, 70).fill();

  // Company name
  doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold')
     .text('TELLED', M, 12, { width: inner });

  doc.fillColor('#d4c5f0').fontSize(9).font('Helvetica')
     .text('Technology Enabled Solutions', M, 32);

  // Form title — centered
  doc.fillColor('#fff').fontSize(13).font('Helvetica-Bold')
     .text('DEALER REGISTRATION FORM  (DRF)', 0, 22, { width: W, align: 'center' });

  // DRF Number box — top right
  doc.fillColor('#fff').rect(W - 130, 8, 100, 28).stroke('#fff');
  doc.fillColor(VIOLET).rect(W - 130, 8, 100, 28).fill();
  doc.fillColor('#fff').rect(W - 130, 8, 100, 28).stroke('#ffd700');
  doc.fillColor('#ffd700').fontSize(7).font('Helvetica-Bold')
     .text('DRF NO.', W - 126, 12);
  doc.fillColor('#fff').fontSize(11).font('Helvetica-Bold')
     .text(data.drfNumber, W - 126, 22);

  // Sub-header bar
  doc.fillColor('#f0eaf9').rect(0, 70, W, 22).fill();
  doc.fillColor(BORDER).fontSize(8).font('Helvetica')
     .text(`Version: v${data.version}   |   Date: ${data.date}   |   Status: Pending Review`, M, 78);

  // ════════════════════════════════════════════════════════════════════════
  // BODY
  // ════════════════════════════════════════════════════════════════════════
  let y = 102;

  // Instruction text
  doc.fillColor('#444').fontSize(8).font('Helvetica-Oblique')
     .text('Please fill all the details in BLOCK LETTERS. This form must be submitted for OEM approval before proceeding with quotation.', M, y, { width: inner });
  y += 18;

  // ── Section 1: Lead / Company Details ────────────────────────────────────
  y = sectionHead(y, '1.  COMPANY / LEAD DETAILS');
  row(y, 22, 'Company Name', data.companyName); y += 22;
  row2(y, 22, 'Contact Person', data.contactName, 'Phone', data.phone); y += 22;
  row2(y, 22, 'Email', data.email, 'Source', data.source || ''); y += 22;
  row2(y, 22, 'City', data.city || '', 'State', data.state || ''); y += 22;

  // ── Section 2: OEM Details ────────────────────────────────────────────────
  y = sectionHead(y, '2.  OEM / PRODUCT DETAILS');
  row(y, 22, 'OEM / Brand Name', data.oemName || ''); y += 22;
  row(y, 22, 'Product Category', ''); y += 22;

  // Type of Business checkboxes (drawn manually)
  doc.rect(M, y, inner, 28).stroke(BORDER);
  doc.fillColor(LIGHT_VIOLET).rect(M, y, 130, 28).fill();
  doc.fillColor(BORDER).fontSize(8).font('Helvetica-Bold').text('Type of Business', M + 4, y + 9, { width: 126 });
  const checks = ['System Integrator', 'OEM Distributor', 'End User', 'Reseller', 'Other'];
  let cx = M + 138;
  checks.forEach(c => {
    doc.rect(cx, y + 8, 9, 9).stroke(BORDER);
    doc.fillColor('#222').fontSize(7.5).font('Helvetica').text(c, cx + 12, y + 9);
    cx += 90;
  });
  y += 28;

  // ── Section 3: Sales Representative ──────────────────────────────────────
  y = sectionHead(y, '3.  SALES REPRESENTATIVE');
  row2(y, 22, 'Sales Executive', data.salesName, 'Email', data.salesEmail); y += 22;
  row(y, 22, 'Notes / Remarks', data.notes || ''); y += 22;

  // ── Section 4: Office Use Only ────────────────────────────────────────────
  y += 6;
  doc.rect(M, y, inner, 14).fill('#f7f7f7').stroke(BORDER);
  doc.fillColor(VIOLET).fontSize(8).font('Helvetica-Bold')
     .text('FOR OFFICE USE ONLY', M + 4, y + 3, { width: inner, align: 'center' });
  y += 14;

  const officeFields = [
    ['DRF Received By', ''],
    ['Review Date', ''],
    ['Approval Status', '  □ Approved   □ Rejected   □ Pending'],
    ['Rejection Reason (if any)', ''],
    ['Approved By', ''],
    ['Expiry Date', ''],
  ];
  officeFields.forEach(([l, v]) => { row(y, 20, l, v); y += 20; });

  // ── Signature block ───────────────────────────────────────────────────────
  y += 10;
  const sigW = inner / 3;
  ['Sales Executive', 'Reporting Manager', 'Authorised Signatory'].forEach((title, i) => {
    const sx = M + i * sigW;
    doc.rect(sx, y, sigW, 50).stroke(BORDER);
    doc.fillColor('#888').fontSize(7).font('Helvetica')
       .text('Signature', sx + 4, y + 4);
    doc.fillColor(VIOLET).fontSize(7.5).font('Helvetica-Bold')
       .text(title, sx + 4, y + 38, { width: sigW - 8 });
  });
  y += 50;

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.fillColor(VIOLET).rect(0, y + 8, W, 22).fill();
  doc.fillColor('#d4c5f0').fontSize(7.5).font('Helvetica')
     .text('This is a system-generated document from Telled CRM  |  Confidential', 0, y + 13, { width: W, align: 'center' });

  doc.end();
  stream.on('finish', () => { logger.info(`DRF PDF generated: ${fileName}`); resolve(fileName); });
  stream.on('error', reject);
});

// ─── Quotation PDF (Vyapar-style) ───────────────────────────────────────────

function amountToWords(n: number): string {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const cvt = (x: number): string => {
    if (x === 0) return '';
    if (x < 20) return ones[x] + ' ';
    if (x < 100) return tens[Math.floor(x/10)] + (x%10 ? ' ' + ones[x%10] : '') + ' ';
    return ones[Math.floor(x/100)] + ' Hundred ' + cvt(x%100);
  };
  if (n === 0) return 'Zero Rupees Only';
  const cr = Math.floor(n/10000000); n %= 10000000;
  const la = Math.floor(n/100000);   n %= 100000;
  const th = Math.floor(n/1000);     n %= 1000;
  let w = '';
  if (cr) w += cvt(cr) + 'Crore ';
  if (la) w += cvt(la) + 'Lakh ';
  if (th) w += cvt(th) + 'Thousand ';
  if (n)  w += cvt(n);
  return w.trim() + ' Rupees Only';
}

export const generateQuotationPDF = (data: {
  quotationNumber: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number; taxRate: number; taxAmount: number; total: number;
  discount?: number;
  validUntil?: Date; notes?: string; terms?: string;
}): Promise<string> => new Promise((resolve, reject) => {
  const fileName = `quotation-${data.quotationNumber}-${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const W = 595, M = 30, inner = W - M * 2;
  const SALMON  = '#CD6B5A';
  const LSALMON = '#F5E0DB';
  const GREEN   = '#2E7D5A';
  const AMBER   = '#D97706';
  const LAMB    = '#FEF3C7';
  const DARK    = '#1a1a1a';
  const GRAY    = '#555555';
  const LGRAY   = '#F7F7F7';
  const BORDER  = '#CCCCCC';
  const now     = new Date();
  const fmt     = (d?: Date) => d ? d.toLocaleDateString('en-IN') : '—';

  // helper: draw text clipped to a cell
  const cell = (txt: string, x: number, y: number, w: number, opts: Record<string,unknown> = {}) => {
    doc.text(String(txt), x + 4, y, { width: w - 8, lineBreak: false, ellipsis: true, ...opts });
  };

  // ── 1. HEADER BAR ─────────────────────────────────────────────────────────
  doc.rect(0, 0, W, 52).fill(SALMON);
  doc.fillColor('#000').fontSize(26).font('Helvetica-Bold')
     .text('QUOTATION', 0, 13, { width: W, align: 'center' });

  // ── 2. DATE / QUOTATION NO. ────────────────────────────────────────────────
  let y = 60;
  doc.fillColor(GRAY).fontSize(9).font('Helvetica')
     .text(`DATE`, W - 180, y);
  doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
     .text(fmt(now), W - 130, y);
  doc.fillColor(GRAY).fontSize(9).font('Helvetica')
     .text(`Quotation No.:`, W - 180, y + 14);
  doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
     .text(data.quotationNumber, W - 110, y + 14);
  y += 38;

  // ── 3. SHIPPER + RECEIVER ─────────────────────────────────────────────────
  const half = inner / 2;
  const rowH = 18;
  const shipFields = [
    ['Company name :', 'Telled CRM'],
    ['Address:',       'Hyderabad, Telangana'],
    ['Contact:',       process.env.SMTP_USER || ''],
    ['CIN:',           ''],
    ['Email:',         process.env.EMAIL_FROM || 'zaltixsoftsolutions@gmail.com'],
    ['GSTIN:',         ''],
  ];
  const recvFields = [
    ['Name:',    data.contactName],
    ['Address:', data.contactAddress || ''],
    ['Cell:',    data.contactPhone || ''],
    ['Email:',   data.contactEmail || ''],
    ['GSTIN:',   ''],
  ];

  // Section header rows
  doc.rect(M, y, half, 18).fill(SALMON);
  doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold')
     .text('SHIPPER', M, y + 4, { width: half, align: 'center' });
  doc.rect(M + half, y, half, 18).fill(GREEN);
  doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold')
     .text('RECEIVER', M + half, y + 4, { width: half, align: 'center' });
  y += 18;

  const maxRows = Math.max(shipFields.length, recvFields.length);
  for (let i = 0; i < maxRows; i++) {
    const sh = shipFields[i] || ['', ''];
    const rv = recvFields[i] || ['', ''];
    const bg = i % 2 === 0 ? '#fff' : LGRAY;
    doc.rect(M, y, half, rowH).fill(bg).stroke(BORDER);
    doc.rect(M + half, y, half, rowH).fill(bg).stroke(BORDER);
    doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold');
    cell(sh[0], M + 2, y + 4, 80);
    doc.fillColor(GRAY).font('Helvetica');
    cell(sh[1], M + 80, y + 4, half - 82);
    doc.fillColor(DARK).font('Helvetica-Bold');
    cell(rv[0], M + half + 2, y + 4, 80);
    doc.fillColor(GRAY).font('Helvetica');
    cell(rv[1], M + half + 80, y + 4, half - 82);
    y += rowH;
  }
  y += 8;

  // ── 4. NOTE / REMARK ──────────────────────────────────────────────────────
  const noteText = data.notes || data.terms || 'Material cost 100% advance. Product warranty 1 year';
  doc.rect(M, y, inner, 24).fill('#fff').stroke(BORDER);
  doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
     .text('NOTE / REMARK : ', M + 6, y + 7, { continued: true });
  doc.fillColor(GRAY).font('Helvetica')
     .text(noteText, { width: inner - 20, lineBreak: false, ellipsis: true });
  y += 32;

  // ── 5. ITEMS TABLE ────────────────────────────────────────────────────────
  // Column defs [label, x, w, align]
  const cols = [
    { lbl: 'S.No.', x: M,        w: 30,  al: 'center' },
    { lbl: 'Description', x: M+30,  w: 155, al: 'left'   },
    { lbl: 'Unit',        x: M+185, w: 50,  al: 'center' },
    { lbl: 'Quantity',    x: M+235, w: 55,  al: 'center' },
    { lbl: 'Price/unit',  x: M+290, w: 65,  al: 'right'  },
    { lbl: 'GST (%)',     x: M+355, w: 55,  al: 'center' },
    { lbl: 'Amount',      x: M+410, w: 125, al: 'right'  },
  ] as const;

  // Header row
  doc.rect(M, y, inner, 22).fill(SALMON);
  doc.fillColor('#fff').fontSize(8.5).font('Helvetica-Bold');
  cols.forEach(c => {
    doc.text(c.lbl, c.x + 2, y + 6, { width: c.w - 4, align: c.al as any, lineBreak: false });
  });
  y += 22;

  // Item rows
  data.items.forEach((item, i) => {
    const bg = i % 2 === 0 ? '#fff' : LSALMON;
    const rowHt = 20;
    doc.rect(M, y, inner, rowHt).fill(bg).stroke(BORDER);
    const gstAmt = item.total * (data.taxRate / 100);
    const lineAmt = item.total + gstAmt;
    const vals = [
      String(i + 1),
      item.description,
      'Nos',
      String(item.quantity),
      `${item.unitPrice.toFixed(2)}`,
      `${data.taxRate}%`,
      `\u20B9 ${lineAmt.toFixed(2)}`,
    ];
    doc.fillColor(DARK).fontSize(8).font('Helvetica');
    cols.forEach((c, ci) => {
      doc.text(vals[ci], c.x + 2, y + 5, { width: c.w - 4, align: c.al as any, lineBreak: false, ellipsis: true });
    });
    y += rowHt;
  });
  y += 4;

  // ── 6. SUMMARY + AMOUNT IN WORDS ─────────────────────────────────────────
  const discount = data.discount || 0;
  const finalAmt = data.total - discount;
  const summaryRows = [
    { lbl: 'Sub Total',    val: `\u20B9  ${data.subtotal.toFixed(2)}`,       bg: '#fff',  bold: false },
    { lbl: 'Discount',     val: `\u20B9  ${discount.toFixed(2)}`,             bg: '#fff',  bold: false },
    { lbl: 'Final Amount', val: `\u20B9  ${finalAmt.toFixed(2)}`,             bg: AMBER,   bold: true  },
    { lbl: 'Amount Paid',  val: `\u20B9  0.00`,                               bg: '#fff',  bold: false },
    { lbl: 'Balance',      val: `\u20B9  ${finalAmt.toFixed(2)}`,             bg: LAMB,    bold: false },
  ];
  const sumX = M + 270, sumLW = 100, sumVW = 165, sumH = 22;
  summaryRows.forEach(r => {
    doc.rect(sumX, y, sumLW + sumVW, sumH).fill(r.bg).stroke(BORDER);
    doc.fillColor(DARK).fontSize(8.5).font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(r.lbl, sumX + 4, y + 6, { width: sumLW - 8, lineBreak: false });
    doc.fillColor(r.bold ? '#fff' : DARK).font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(r.val, sumX + sumLW + 2, y + 6, { width: sumVW - 6, align: 'right', lineBreak: false });
    y += sumH;
  });

  // Amount in words (left side, aligned with first summary row)
  const wordsY = y - summaryRows.length * sumH;
  doc.rect(M, wordsY, 265, sumH * 2).fill('#fff').stroke(BORDER);
  doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
     .text('Amount in Words:', M + 4, wordsY + 4);
  doc.fillColor(GRAY).font('Helvetica').fontSize(7.5)
     .text(amountToWords(Math.round(finalAmt)), M + 4, wordsY + 16, { width: 257, lineBreak: false, ellipsis: true });
  y += 6;

  // ── 7. DECLARATION ────────────────────────────────────────────────────────
  doc.rect(M, y, inner, 50).fill('#fff').stroke(BORDER);
  doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
     .text('Declaration:', M + 6, y + 5);
  doc.fillColor(GRAY).font('Helvetica').fontSize(7.5)
     .text('We declare that this quotation shows the actual price of the goods/services described and that all particulars are true and correct.', M + 6, y + 18, { width: inner - 12 });
  y += 56;

  // ── 8. SIGNATURES ─────────────────────────────────────────────────────────
  doc.rect(M, y, inner / 2, 42).fill('#fff').stroke(BORDER);
  doc.rect(M + inner / 2, y, inner / 2, 42).fill('#fff').stroke(BORDER);
  doc.fillColor(SALMON).fontSize(8).font('Helvetica')
     .text("Client's Signature", M + 6, y + 28, { width: inner / 2 - 12, align: 'center' });
  doc.fillColor(SALMON).fontSize(8).font('Helvetica')
     .text('Business Signature', M + inner / 2 + 6, y + 28, { width: inner / 2 - 12, align: 'center' });
  y += 48;

  // ── 9. FOOTER ─────────────────────────────────────────────────────────────
  doc.rect(0, y, W, 26).fill(LSALMON);
  doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
     .text('Thanks for business with us!!! Please visit us again !!!', 0, y + 8, { width: W, align: 'center' });

  doc.end();
  stream.on('finish', () => { logger.info(`Quotation PDF: ${filePath}`); resolve(fileName); });
  stream.on('error', reject);
});

export const generatePayslipPDF = (data: {
  employeeName: string; email: string; role: string; month: string; year: number;
  baseSalary: number; visitChargesTotal: number; incentives: number; deductions: number; finalSalary: number;
}): Promise<string> => new Promise((resolve, reject) => {
  const fileName = `payslip-${data.employeeName.replace(/\s/g, '-')}-${data.month}-${data.year}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(20).fillColor('#4f2d7f').text('PAYSLIP', { align: 'center' });
  doc.fontSize(12).fillColor('#666').text('Telled CRM', { align: 'center' }); doc.moveDown();
  doc.moveTo(50, 110).lineTo(550, 110).stroke('#ddd');
  doc.fontSize(12).fillColor('#333');
  doc.text(`Employee: ${data.employeeName}`, 50, 125); doc.text(`Role: ${data.role}`, 50, 143);
  doc.text(`Period: ${data.month} ${data.year}`, 350, 125);

  let y = 175;
  doc.rect(50, y, 500, 22).fill('#4f2d7f');
  doc.fillColor('#fff').text('Component', 60, y + 6); doc.text('Amount (₹)', 450, y + 6);
  y += 26;
  [
    { label: 'Base Salary', val: data.baseSalary, earn: true },
    { label: 'Visit Charges', val: data.visitChargesTotal, earn: true },
    { label: 'Incentives', val: data.incentives, earn: true },
    { label: 'Deductions', val: -data.deductions, earn: false },
  ].forEach((row, i) => {
    if (i % 2 === 0) doc.rect(50, y - 2, 500, 20).fill('#f9f5ff');
    doc.fillColor(row.earn ? '#333' : '#dc2626').fontSize(11);
    doc.text(row.label, 60, y); doc.text(`${row.val < 0 ? '-' : ''}₹${Math.abs(row.val)}`, 450, y);
    y += 22;
  });
  y += 12;
  doc.rect(50, y - 4, 500, 32).fill('#4f2d7f');
  doc.fillColor('#fff').fontSize(14).text('NET SALARY', 60, y + 4); doc.text(`₹${data.finalSalary}`, 450, y + 4);

  doc.end();
  stream.on('finish', () => resolve(fileName));
  stream.on('error', reject);
});

export const generateInvoicePDF = (data: {
  invoiceNumber: string; companyName: string; contactName: string;
  amount: number; taxAmount: number; totalAmount: number; dueDate: Date; notes?: string;
}): Promise<string> => new Promise((resolve, reject) => {
  const fileName = `invoice-${data.invoiceNumber}-${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(22).fillColor('#4f2d7f').text('INVOICE', { align: 'right' });
  doc.fontSize(10).fillColor('#666').text('Telled CRM', 50, 80);
  doc.moveTo(50, 100).lineTo(550, 100).stroke('#ddd');
  doc.fontSize(11).fillColor('#333');
  doc.text(`Invoice: ${data.invoiceNumber}`, 50, 115); doc.text(`Due: ${new Date(data.dueDate).toLocaleDateString()}`, 50, 132);
  doc.text(`Bill To: ${data.companyName}`, 350, 115);

  let y = 165;
  doc.rect(50, y, 500, 22).fill('#4f2d7f');
  doc.fillColor('#fff').text('Description', 60, y + 6); doc.text('Amount', 450, y + 6); y += 26;
  doc.rect(50, y - 2, 500, 20).fill('#f9f5ff');
  doc.fillColor('#333').fontSize(11); doc.text('Services / Products', 60, y); doc.text(`₹${data.amount}`, 450, y); y += 22;
  doc.text('Tax / GST', 60, y); doc.text(`₹${data.taxAmount}`, 450, y); y += 26;
  doc.rect(50, y - 4, 500, 32).fill('#4f2d7f');
  doc.fillColor('#fff').fontSize(13).text('TOTAL DUE', 60, y + 4); doc.text(`₹${data.totalAmount}`, 450, y + 4);

  doc.end();
  stream.on('finish', () => resolve(fileName));
  stream.on('error', reject);
});
