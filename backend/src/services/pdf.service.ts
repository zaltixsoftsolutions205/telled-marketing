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
  companyName?: string;
  companyAddress?: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  oemName?: string;
  salesPersonName?: string;
  salesPersonEmail?: string;
  salesPersonPhone?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number; taxRate: number; taxAmount: number; total: number;
  validUntil?: Date; notes?: string; terms?: string;
}): Promise<string> => new Promise((resolve, reject) => {
  const fileName = `quotation-${data.quotationNumber}-${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const W = 595, M = 30, inner = W - M * 2;
  const VIOLET  = '#4f2d7f';
  const LVIO    = '#e8e0f0';
  const BORDER  = '#cccccc';
  const DARK    = '#111111';
  const GRAY    = '#555555';
  const now     = new Date();
  const fmtDate = (d?: Date) => d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const fmtINR  = (n: number) => `INR ${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const drawBorder = (x: number, y: number, w: number, h: number) =>
    doc.rect(x, y, w, h).stroke(BORDER);
  const fillCell = (x: number, y: number, w: number, h: number, color: string) =>
    doc.rect(x, y, w, h).fill(color);

  // ── OUTER BORDER ──────────────────────────────────────────────────────────
  doc.rect(M, 20, inner, 800).stroke(BORDER);

  // ── 1. LOGOS ROW ──────────────────────────────────────────────────────────
  let y = 20;
  // Telled logo text (left)
  doc.fillColor(VIOLET).fontSize(18).font('Helvetica-Bold')
     .text('TELLED', M + 8, y + 8);
  doc.fillColor(GRAY).fontSize(9).font('Helvetica')
     .text('MARKETING', M + 8, y + 28);
  // OEM badge (right)
  const oemLabel = data.oemName || 'OEM';
  doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold')
     .text(oemLabel, W - M - 120, y + 12, { width: 110, align: 'right' });
  doc.fillColor(GRAY).fontSize(7.5).font('Helvetica')
     .text('CERTIFIED CHANNEL PARTNER', W - M - 120, y + 26, { width: 110, align: 'right' });
  y += 52;
  doc.moveTo(M, y).lineTo(W - M, y).stroke(BORDER);

  // ── 2. TO SECTION + RIGHT TABLE ───────────────────────────────────────────
  y += 6;
  doc.fillColor(DARK).fontSize(8).font('Helvetica').text('To,', M + 6, y);
  y += 12;

  const toW = 270, rightX = M + toW + 10, rightW = inner - toW - 10;
  // Company name bold
  doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold')
     .text(data.companyName || data.contactName, M + 6, y, { width: toW - 10 });
  y += 14;
  if (data.companyAddress || data.contactAddress) {
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
       .text(data.companyAddress || data.contactAddress || '', M + 6, y, { width: toW - 10 });
    y += 28;
  } else { y += 4; }

  // Right info table
  const rightStartY = y - 54;
  const infoRows = [
    ['Date', fmtDate(now)],
    ['Quotation No.', data.quotationNumber],
    ['Customer ID', ''],
    ['Quote Validity', data.validUntil ? fmtDate(data.validUntil) : '15 Days'],
    ['Prepared By', data.salesPersonName || 'Telled Marketing'],
  ];
  const rLW = 90, rVW = rightW - rLW, rH = 16;
  let ry = rightStartY;
  infoRows.forEach(([lbl, val]) => {
    fillCell(rightX, ry, rLW, rH, LVIO);
    drawBorder(rightX, ry, rightW, rH);
    doc.moveTo(rightX + rLW, ry).lineTo(rightX + rLW, ry + rH).stroke(BORDER);
    doc.fillColor(DARK).fontSize(7.5).font('Helvetica-Bold').text(lbl, rightX + 3, ry + 4, { width: rLW - 6, lineBreak: false });
    doc.fillColor(DARK).fontSize(7.5).font('Helvetica').text(val, rightX + rLW + 3, ry + 4, { width: rVW - 6, lineBreak: false });
    ry += rH;
  });
  y = Math.max(y, ry) + 6;

  // ── 3. SUBJECT LINE ───────────────────────────────────────────────────────
  doc.moveTo(M, y).lineTo(W - M, y).stroke(BORDER);
  y += 6;
  doc.fillColor(DARK).fontSize(8.5).font('Helvetica-Bold')
     .text(`Sub:  Proposal for ${data.oemName || 'Software'}`, M + 6, y);
  doc.fillColor(DARK).fontSize(8.5).font('Helvetica-Bold')
     .text(`Telled GST No.: 36AAKFT2721M1ZV`, W / 2, y, { width: W / 2 - M - 6, align: 'right' });
  y += 14;
  doc.fillColor(DARK).fontSize(8).font('Helvetica')
     .text(`Kind Attn.: ${data.contactName}`, M + 6, y);
  y += 14;
  doc.moveTo(M, y).lineTo(W - M, y).stroke(BORDER);

  // ── 4. SALES PERSON TABLE ─────────────────────────────────────────────────
  y += 0;
  const spCols = [inner / 4, inner / 4, inner / 4, inner / 4];
  const spHeaders = ['Sales Person', 'Contact Number', 'Email ID', 'Delivery'];
  const spValues  = [
    data.salesPersonName || 'Telled Marketing',
    data.salesPersonPhone || '',
    data.salesPersonEmail || '',
    '2 Weeks',
  ];
  // Header
  let sx = M;
  spHeaders.forEach((h, i) => {
    fillCell(sx, y, spCols[i], 18, LVIO);
    drawBorder(sx, y, spCols[i], 18);
    doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
       .text(h, sx + 4, y + 5, { width: spCols[i] - 8, align: 'center', lineBreak: false });
    sx += spCols[i];
  });
  y += 18;
  sx = M;
  spValues.forEach((v, i) => {
    drawBorder(sx, y, spCols[i], 18);
    doc.fillColor(i === 2 ? VIOLET : DARK).fontSize(8).font('Helvetica')
       .text(v, sx + 4, y + 5, { width: spCols[i] - 8, align: 'center', lineBreak: false });
    sx += spCols[i];
  });
  y += 18;

  // ── 5. ITEMS TABLE ────────────────────────────────────────────────────────
  const iCols = [
    { lbl: 'Sr. No',               w: 35,  al: 'center' as const },
    { lbl: 'Product Description',  w: 155, al: 'center' as const },
    { lbl: 'Qty',                  w: 30,  al: 'center' as const },
    { lbl: 'List Price Per Qty',   w: 95,  al: 'center' as const },
    { lbl: 'Strategic Price Per Qty', w: 95, al: 'center' as const },
    { lbl: 'Total',                w: 125, al: 'center' as const },
  ];
  let ix = M;
  iCols.forEach(c => {
    fillCell(ix, y, c.w, 18, LVIO);
    drawBorder(ix, y, c.w, 18);
    doc.fillColor(DARK).fontSize(7.5).font('Helvetica-Bold')
       .text(c.lbl, ix + 2, y + 4, { width: c.w - 4, align: c.al, lineBreak: false });
    ix += c.w;
  });
  y += 18;

  data.items.forEach((item, idx) => {
    const rh = 20;
    ix = M;
    const vals = [
      String(idx + 1),
      item.description,
      String(item.quantity),
      fmtINR(item.unitPrice),
      fmtINR(item.unitPrice),
      fmtINR(item.total),
    ];
    iCols.forEach((c, ci) => {
      drawBorder(ix, y, c.w, rh);
      doc.fillColor(DARK).fontSize(8).font('Helvetica')
         .text(vals[ci], ix + 2, y + 6, { width: c.w - 4, align: c.al, lineBreak: false, ellipsis: true });
      ix += c.w;
    });
    y += rh;
  });
  y += 4;

  // ── 6. PRICING SUMMARY (right-aligned) ────────────────────────────────────
  const sumW = 220, sumLW = 100, sumVW = 120, sumH = 18;
  const sumX = W - M - sumW;
  const pricingRows = [
    { lbl: 'Base Price',  val: fmtINR(data.subtotal), bold: false, bg: '#fff' },
    { lbl: `GST @ ${data.taxRate}%`, val: fmtINR(data.taxAmount), bold: false, bg: '#fff' },
    { lbl: 'Final Price', val: fmtINR(data.total),    bold: true,  bg: LVIO   },
  ];
  pricingRows.forEach(r => {
    fillCell(sumX, y, sumW, sumH, r.bg);
    drawBorder(sumX, y, sumW, sumH);
    doc.moveTo(sumX + sumLW, y).lineTo(sumX + sumLW, y + sumH).stroke(BORDER);
    doc.fillColor(DARK).fontSize(8).font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(r.lbl, sumX + 4, y + 5, { width: sumLW - 8, align: 'right', lineBreak: false });
    doc.fillColor(DARK).fontSize(8).font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(r.val, sumX + sumLW + 4, y + 5, { width: sumVW - 8, align: 'right', lineBreak: false });
    y += sumH;
  });
  y += 8;

  // ── 7. TERMS + BANK DETAILS ───────────────────────────────────────────────
  const termsW = inner / 2 - 5, bankW = inner / 2 - 5, bankX = M + inner / 2 + 5;
  const termsText = [
    'Order: License Form should be duly filled along with the Purchase Order',
    'Taxes: Subject to change as per prevailing laws of the Country',
    'Delivery: Within 2 weeks from the date of receipt of Purchase Order',
    'Payment: 100% Advance',
    'Delivery - Electronic Download',
    'This offer may be subject to errors and changes.',
  ];
  const termsH = 14 * termsText.length + 12;

  // Terms box
  drawBorder(M, y, termsW, termsH);
  doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold').text('General Terms and Conditions', M + 4, y + 5);
  termsText.forEach((t, i) => {
    doc.fillColor(DARK).fontSize(7).font('Helvetica').text(t, M + 4, y + 16 + i * 11, { width: termsW - 8, lineBreak: false, ellipsis: true });
  });

  // Bank details box
  drawBorder(bankX, y, bankW, termsH);
  doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold').text('Bank Details', bankX + 4, y + 5);
  const bankRows = [
    ['Bank', 'ICICI Bank Ltd.'],
    ['Account No.', '279905500216'],
    ['IFSC Code', 'ICIC0002799'],
    ['Branch', 'Bachupally'],
  ];
  bankRows.forEach(([lbl, val], i) => {
    doc.fillColor(DARK).fontSize(7.5).font('Helvetica-Bold').text(lbl, bankX + 4, y + 18 + i * 14, { width: 70, lineBreak: false });
    doc.fillColor(DARK).fontSize(7.5).font('Helvetica').text(val, bankX + 76, y + 18 + i * 14, { width: bankW - 80, lineBreak: false });
  });
  y += termsH + 10;

  // ── 8. SIGNATURE + COMPANY ADDRESS ────────────────────────────────────────
  const sigH = 70;
  drawBorder(M, y, inner / 2 - 5, sigH);
  drawBorder(W - M - inner / 2 + 5, y, inner / 2 - 5, sigH);
  doc.fillColor(GRAY).fontSize(8).font('Helvetica')
     .text('Authorised Signatory', M + 6, y + sigH - 16, { width: inner / 2 - 14 });
  doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
     .text('TELLED MARKETING,', W - M - inner / 2 + 10, y + 8, { width: inner / 2 - 18, align: 'center' });
  doc.fillColor(GRAY).fontSize(7.5).font('Helvetica')
     .text('RR Enclave, 3rd Floor, Plot No 231 Part 232,\nNear HI RISE PVR Meadows, Kranti Nagar Colony,\nMallampet, Hyderabad, Telangana, 500090',
           W - M - inner / 2 + 10, y + 22, { width: inner / 2 - 18, align: 'center' });

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
  invoiceDate?: Date; paidAmount?: number;
}): Promise<string> => new Promise((resolve, reject) => {
  const fileName = `invoice-${data.invoiceNumber}-${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const L = 40;   // left margin
  const R = 555;  // right edge
  const W = R - L; // content width
  const PURPLE = '#4f2d7f';
  const LIGHT_PURPLE = '#f3f0fa';
  const DARK = '#1a1a2e';
  const GREY = '#6b7280';
  const fmt = (n: number) => `\u20b9${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Header band ──────────────────────────────────────────────────────────
  doc.rect(0, 0, 595, 130).fill(PURPLE);

  // Company name + tagline (top-left)
  doc.fillColor('#fff').fontSize(22).font('Helvetica-Bold')
     .text('TELLED', L, 30);
  doc.fontSize(9).font('Helvetica').fillColor('#d8c8f8')
     .text('Technology Solutions & Services', L, 56);
  doc.fontSize(8).fillColor('#b89edc')
     .text('123, Business Park, Sector 5\nMumbai, Maharashtra 400001\nGST: 27AABCT1234D1Z5  |  info@telled.com', L, 72);

  // Large INVOICE text (top-right)
  doc.fillColor('#fff').fontSize(40).font('Helvetica-Bold')
     .text('INVOICE', 0, 38, { align: 'right', width: R + 5 });
  doc.fontSize(10).font('Helvetica').fillColor('#d8c8f8')
     .text(data.invoiceNumber, 0, 82, { align: 'right', width: R + 5 });

  // ── Invoice details row ──────────────────────────────────────────────────
  const detY = 148;
  const colW = W / 4;
  const details = [
    { label: 'Invoice #',    value: data.invoiceNumber },
    { label: 'Invoice Date', value: fmtDate(data.invoiceDate || new Date()) },
    { label: 'Terms',        value: 'Due on Receipt' },
    { label: 'Due Date',     value: fmtDate(data.dueDate) },
  ];
  details.forEach((d, i) => {
    const x = L + i * colW;
    doc.rect(x, detY - 4, colW - 2, 44).fill(i % 2 === 0 ? LIGHT_PURPLE : '#ede9f8');
    doc.fillColor(GREY).fontSize(7).font('Helvetica-Bold')
       .text(d.label.toUpperCase(), x + 8, detY + 2);
    doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold')
       .text(d.value, x + 8, detY + 14, { width: colW - 16 });
  });

  // ── Bill To / Ship To ────────────────────────────────────────────────────
  const billY = 212;
  doc.fillColor(GREY).fontSize(7).font('Helvetica-Bold')
     .text('BILL TO', L, billY);
  doc.rect(L, billY + 10, (W / 2) - 10, 70).fill('#fafafa').stroke('#e5e7eb');
  doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold')
     .text(data.companyName, L + 10, billY + 18);
  doc.fontSize(9).font('Helvetica').fillColor(GREY)
     .text(data.contactName || '', L + 10, billY + 34)
     .text('', L + 10, billY + 48);

  doc.fillColor(GREY).fontSize(7).font('Helvetica-Bold')
     .text('SHIP TO', L + W / 2 + 10, billY);
  doc.rect(L + W / 2 + 10, billY + 10, (W / 2) - 10, 70).fill('#fafafa').stroke('#e5e7eb');
  doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold')
     .text(data.companyName, L + W / 2 + 20, billY + 18);
  doc.fontSize(9).font('Helvetica').fillColor(GREY)
     .text('Same as Billing Address', L + W / 2 + 20, billY + 34);

  // ── Line Items Table ─────────────────────────────────────────────────────
  const tableY = 305;
  const cols = { num: L, desc: L + 28, qty: 340, rate: 400, amt: 470 };

  // Table header
  doc.rect(L, tableY, W, 24).fill(PURPLE);
  doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
  doc.text('#',            cols.num  + 2, tableY + 8, { width: 20, align: 'center' });
  doc.text('ITEM & DESCRIPTION', cols.desc, tableY + 8, { width: 270 });
  doc.text('QTY',          cols.qty,  tableY + 8, { width: 55, align: 'center' });
  doc.text('RATE',         cols.rate, tableY + 8, { width: 65, align: 'right' });
  doc.text('AMOUNT',       cols.amt,  tableY + 8, { width: 80, align: 'right' });

  // Single line item row
  const rowY = tableY + 28;
  doc.rect(L, rowY, W, 34).fill(LIGHT_PURPLE);
  doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold');
  doc.text('1', cols.num + 2, rowY + 4, { width: 20, align: 'center' });
  doc.text('Services / Products', cols.desc, rowY + 4, { width: 270 });
  doc.font('Helvetica').fillColor(GREY).fontSize(8)
     .text('Professional services as agreed', cols.desc, rowY + 18, { width: 270 });
  doc.fillColor(DARK).fontSize(9).font('Helvetica')
     .text('1',                  cols.qty,  rowY + 12, { width: 55, align: 'center' })
     .text(fmt(data.amount),     cols.rate, rowY + 12, { width: 65, align: 'right' })
     .text(fmt(data.amount),     cols.amt,  rowY + 12, { width: 80, align: 'right' });

  // Row separator
  doc.moveTo(L, rowY + 34).lineTo(R, rowY + 34).stroke('#e5e7eb');

  // ── Summary / Totals ─────────────────────────────────────────────────────
  const sumX = 360;
  const sumW = R - sumX;
  let sumY = rowY + 50;
  const sumRow = (label: string, val: string, bold = false, highlight = false) => {
    if (highlight) {
      doc.rect(sumX - 8, sumY - 4, sumW + 8, 28).fill(PURPLE);
      doc.fillColor('#fff').fontSize(11).font('Helvetica-Bold');
    } else {
      doc.fillColor(bold ? DARK : GREY).fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica');
    }
    doc.text(label, sumX, sumY, { width: sumW * 0.5 });
    doc.text(val,   sumX + sumW * 0.5, sumY, { width: sumW * 0.48, align: 'right' });
    sumY += highlight ? 32 : 22;
  };
  const taxRate = data.amount > 0 ? ((data.taxAmount / data.amount) * 100).toFixed(0) : '0';
  sumRow('Sub Total',       fmt(data.amount));
  sumRow(`Tax Rate (${taxRate}%)`, fmt(data.taxAmount));
  doc.moveTo(sumX - 8, sumY - 6).lineTo(R, sumY - 6).stroke('#e5e7eb');
  sumRow('Total',           fmt(data.totalAmount), true);
  const paid = data.paidAmount ?? 0;
  const balance = data.totalAmount - paid;
  if (paid > 0) sumRow('Amount Paid', fmt(paid));
  sumRow('Balance Due',     fmt(balance), true, true);

  // ── Notes / Terms ────────────────────────────────────────────────────────
  const notesY = Math.max(sumY + 20, rowY + 180);
  doc.moveTo(L, notesY).lineTo(R, notesY).stroke('#e5e7eb');
  doc.fillColor(GREY).fontSize(7).font('Helvetica-Bold')
     .text('TERMS & CONDITIONS', L, notesY + 10);
  doc.fillColor(GREY).fontSize(8).font('Helvetica')
     .text(data.notes || 'Payment is due within the stated due date. Late payments may be subject to a 1.5% monthly finance charge. Please include invoice number on your payment. Thank you for your business!',
           L, notesY + 22, { width: W });

  // ── Footer band ──────────────────────────────────────────────────────────
  doc.rect(0, 780, 595, 62).fill(PURPLE);
  doc.fillColor('#d8c8f8').fontSize(8).font('Helvetica')
     .text('Thank you for your business!', 0, 792, { align: 'center', width: 595 });
  doc.fillColor('#b89edc').fontSize(7)
     .text('TELLED  ·  123, Business Park, Sector 5, Mumbai 400001  ·  info@telled.com  ·  +91 98765 43210', 0, 808, { align: 'center', width: 595 });

  doc.end();
  stream.on('finish', () => resolve(fileName));
  stream.on('error', reject);
});

// ─── PURCHASE ORDER PDF ──────────────────────────────────────────────────────
export const generatePurchaseOrderPDF = (data: {
  poNumber: string;
  poDate: string;
  vendorName: string;
  vendorEmail?: string;
  product?: string;
  amount: number;
  customerCompany: string;
  customerContact?: string;
  customerEmail?: string;
}): Promise<string> => new Promise((resolve, reject) => {
  const fileName = `po-${data.poNumber}-${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const W = 595, M = 36;
  const inner = W - M * 2;
  const BLUE = '#1a56a0';
  const BLUE_LIGHT = '#dbeafe';
  const MID = '#4a5568';
  const DARK = '#1a1a2e';
  const half = inner / 2;

  const fillRect = (x: number, y: number, w: number, h: number, color: string) => {
    doc.fillColor(color).rect(x, y, w, h).fill();
  };

  // ── HEADER ────────────────────────────────────────────────────────────────
  fillRect(0, 0, W, 58, '#ffffff');
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(20)
    .text('PURCHASE  ORDER', 0, 18, { align: 'center', width: W, characterSpacing: 3 });
  fillRect(0, 58, W, 4, BLUE);

  // Company block
  fillRect(0, 62, W, 78, '#f9fafb');
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(14)
    .text('TELLED MARKETING', 0, 74, { align: 'center', width: W });
  doc.fillColor(MID).font('Helvetica').fontSize(8)
    .text('Flat No.302, Sri Maruthi Nilayam, Beside HDFC Bank, Bharat Nagar, Hyderabad - 500018', 0, 93, { align: 'center', width: W });
  doc.fillColor(MID).font('Helvetica').fontSize(8)
    .text('GST: 36AAKFT2721M1ZV  |  guruashok@zaltixsoftsolutions.com', 0, 107, { align: 'center', width: W });

  // ── SUPPLIER + PO META BOX ────────────────────────────────────────────────
  let y = 152;
  doc.rect(M, y, inner, 110).strokeColor('#cbd5e0').lineWidth(1).stroke();
  doc.rect(M, y, half, 110).strokeColor('#cbd5e0').lineWidth(1).stroke();

  const sRow = (label: string, val: string, rowY: number) => {
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(8).text(label + ':', M + 8, rowY, { width: 92 });
    doc.fillColor(DARK).font('Helvetica').fontSize(8).text(val || '—', M + 102, rowY, { width: half - 110 });
  };
  sRow('Supplier Name',  data.vendorName,           y + 10);
  sRow('Email',          data.vendorEmail || '—',   y + 26);
  sRow('Customer',       data.customerCompany,       y + 42);
  sRow('Contact Person', data.customerContact || '—', y + 58);
  sRow('Contact Email',  data.customerEmail || '—', y + 74);

  const rx = M + half + 8;
  const metaRows: [string, string][] = [
    ['PO No.',        data.poNumber],
    ['PO Date',       data.poDate],
    ['Payment Terms', '100% against invoice'],
    ['Delivery',      'As agreed'],
    ['Valid For',     '7 days'],
  ];
  metaRows.forEach(([label, val], i) => {
    const ry = y + 10 + i * 20;
    fillRect(M + half + 1, ry - 2, 86, 14, BLUE_LIGHT);
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(8).text(label, rx, ry, { width: 82 });
    doc.fillColor(DARK).font('Helvetica').fontSize(8).text(val, rx + 88, ry, { width: half - 100 });
  });

  // ── BILL TO / SHIP TO ─────────────────────────────────────────────────────
  y = 272;
  fillRect(M, y, half, 18, BLUE);
  fillRect(M + half, y, half, 18, BLUE);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
    .text('Bill To:', M + 10, y + 4, { width: half - 20 });
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
    .text('Ship To:', M + half + 10, y + 4, { width: half - 20 });

  y = 290;
  const addrH = 70;
  doc.rect(M, y, half, addrH).strokeColor('#cbd5e0').lineWidth(1).stroke();
  doc.rect(M + half, y, half, addrH).strokeColor('#cbd5e0').lineWidth(1).stroke();

  const addrBlock = (x: number, sy: number) => {
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text('TELLED MARKETING', x + 8, sy + 6, { width: half - 16 });
    doc.fillColor(MID).font('Helvetica').fontSize(7.5)
      .text('Flat No.302, Sri Maruthi Nilayam, Bharat Nagar', x + 8, sy + 20, { width: half - 16 })
      .text('Hyderabad - 500018', x + 8, sy + 32, { width: half - 16 })
      .text('GST: 36AAKFT2721M1ZV', x + 8, sy + 44, { width: half - 16 })
      .text('guruashok@zaltixsoftsolutions.com', x + 8, sy + 56, { width: half - 16 });
  };
  addrBlock(M, y);
  addrBlock(M + half, y);

  // ── PAYMENT LINE ──────────────────────────────────────────────────────────
  y = 362 + 8;
  doc.fillColor(MID).font('Helvetica-Bold').fontSize(8)
    .text('Payment Date: 7 days from date of delivery', M, y, { width: half });
  doc.fillColor(MID).font('Helvetica-Bold').fontSize(8)
    .text('Payment Terms: 100% against invoice', M + half, y, { width: half, align: 'right' });

  // ── ITEMS TABLE ───────────────────────────────────────────────────────────
  y = 384;
  const cols = [32, 88, 180, 48, 42, 66, 40, 27];
  const headers = ['S.No', 'Product Code', 'Product Name', 'Quantity', 'Units', 'Rate', 'Tax', 'Amount'];
  let cx = M;
  cols.forEach((cw, i) => {
    fillRect(cx, y, cw, 22, BLUE);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5)
      .text(headers[i], cx + 2, y + 6, { width: cw - 4, align: 'center' });
    cx += cw;
  });

  y += 22;
  const gst = 18;
  const baseAmt = Math.round(data.amount / (1 + gst / 100));
  const rowData = ['1', '—', data.product || 'As per order', '1', 'nos',
    `Rs.${baseAmt.toLocaleString('en-IN')}`, `${gst}%`, `Rs.${data.amount.toLocaleString('en-IN')}`];
  cx = M;
  rowData.forEach((val, i) => {
    fillRect(cx, y, cols[i], 24, i % 2 === 0 ? '#f9fafb' : '#ffffff');
    doc.rect(cx, y, cols[i], 24).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fillColor(DARK).font('Helvetica').fontSize(8)
      .text(val, cx + 2, y + 7, { width: cols[i] - 4, align: 'center' });
    cx += cols[i];
  });

  // ── TOTALS ────────────────────────────────────────────────────────────────
  y += 24 + 10;
  const totW = 190, totX = M + inner - totW;
  const totRow = (label: string, val: string, bold = false, bg = '#ffffff') => {
    fillRect(totX, y, totW, 20, bg);
    doc.rect(totX, y, totW, 20).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fillColor(bold ? BLUE : MID).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
      .text(label, totX + 8, y + 5, { width: 94 });
    doc.fillColor(bold ? BLUE : DARK).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
      .text(val, totX + 104, y + 5, { width: totW - 112, align: 'right' });
    y += 20;
  };
  totRow('Total',       `Rs.${baseAmt.toLocaleString('en-IN')}`);
  totRow('Discounts',   'Rs.0.00');
  totRow('Grand Total', `Rs.${data.amount.toLocaleString('en-IN')}`, true, BLUE_LIGHT);

  // ── TERMS + AUTHORIZATION ─────────────────────────────────────────────────
  y += 16;
  const termsH = 100;
  doc.rect(M, y, half - 4, termsH).strokeColor('#cbd5e0').lineWidth(1).stroke();
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(8).text('Terms and Conditions:', M + 8, y + 8);
  const terms = [
    '1. We reserve the right to cancel this PO before shipment.',
    '2. Invoice should reference PO number and date.',
    '3. Deviation from agreed specs will result in cancellation.',
    '4. Packing/shipping charges are to be borne by supplier.',
    '5. Delivery must be completed within 7 days of PO date.',
  ];
  doc.fillColor(MID).font('Helvetica').fontSize(7.5);
  terms.forEach((t, i) => doc.text(t, M + 8, y + 22 + i * 13, { width: half - 20 }));

  const authX = M + half + 4;
  fillRect(authX, y, half - 4, termsH, BLUE);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
    .text('For TELLED MARKETING', authX, y + 16, { width: half - 4, align: 'center' });
  doc.fillColor('#a0c4ff').font('Helvetica').fontSize(8)
    .text('Authorised Signatory', authX, y + termsH - 20, { width: half - 4, align: 'center' });

  // ── FOOTER ────────────────────────────────────────────────────────────────
  y += termsH + 12;
  fillRect(0, y, W, 30, BLUE);
  doc.fillColor('#a0c4ff').font('Helvetica').fontSize(8)
    .text('Mark any communications to: guruashok@zaltixsoftsolutions.com', M, y + 7, { width: W * 0.6 });
  doc.fillColor('#cce0ff').font('Helvetica-Bold').fontSize(8)
    .text('Authorised Signatory', 0, y + 7, { width: W - M, align: 'right' });

  doc.end();
  stream.on('finish', () => resolve(fileName));
  stream.on('error', reject);
});
