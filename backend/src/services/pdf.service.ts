import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

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
