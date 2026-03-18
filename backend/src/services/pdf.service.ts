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

// ─── Quotation PDF ──────────────────────────────────────────────────────────
export const generateQuotationPDF = (data: {
  quotationNumber: string; companyName: string; contactName: string;
  productList: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number; taxPercent: number; taxAmount: number; total: number;
  validUntil?: Date; notes?: string;
}): Promise<string> => new Promise((resolve, reject) => {
  const fileName = `quotation-${data.quotationNumber}-${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(22).fillColor('#4f2d7f').text('QUOTATION', { align: 'right' });
  doc.fontSize(10).fillColor('#666').text('Telled CRM', 50, 80);
  doc.moveTo(50, 100).lineTo(550, 100).stroke('#ddd');
  doc.fontSize(11).fillColor('#333');
  doc.text(`Quotation: ${data.quotationNumber}`, 50, 115);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 50, 132);
  doc.text(`Bill To: ${data.companyName}`, 350, 115);
  doc.text(`Contact: ${data.contactName}`, 350, 132);

  let y = 165;
  doc.rect(50, y, 500, 22).fill('#4f2d7f');
  doc.fillColor('#fff').fontSize(10);
  doc.text('Description', 60, y + 6); doc.text('Qty', 320, y + 6); doc.text('Price', 370, y + 6); doc.text('Total', 470, y + 6);
  y += 26;
  data.productList.forEach((item, i) => {
    if (i % 2 === 0) doc.rect(50, y - 2, 500, 20).fill('#f9f5ff');
    doc.fillColor('#333').fontSize(10);
    doc.text(item.description.substring(0, 40), 60, y); doc.text(String(item.quantity), 320, y);
    doc.text(`₹${item.unitPrice}`, 370, y); doc.text(`₹${item.total}`, 470, y);
    y += 22;
  });
  y += 8;
  doc.moveTo(350, y).lineTo(550, y).stroke('#ddd'); y += 8;
  doc.fillColor('#333').fontSize(11);
  doc.text('Subtotal:', 380, y); doc.text(`₹${data.subtotal}`, 470, y); y += 18;
  doc.text(`Tax (${data.taxPercent}%):`, 380, y); doc.text(`₹${data.taxAmount}`, 470, y); y += 18;
  doc.rect(350, y - 4, 200, 26).fill('#4f2d7f');
  doc.fillColor('#fff').fontSize(13).text('TOTAL:', 380, y + 2); doc.text(`₹${data.total}`, 470, y + 2);
  if (data.notes) { y += 45; doc.fillColor('#666').fontSize(10).text(`Notes: ${data.notes}`, 50, y); }

  doc.end();
  stream.on('finish', () => { logger.info(`PDF: ${filePath}`); resolve(fileName); });
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
