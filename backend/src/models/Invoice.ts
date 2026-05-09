import mongoose, { Document, Schema } from 'mongoose';

export interface IInvoice extends Document {
  organizationId: mongoose.Types.ObjectId;
  accountId?: mongoose.Types.ObjectId;
  leadId?: mongoose.Types.ObjectId;
  purchaseOrderId?: mongoose.Types.ObjectId;
  invoiceType: 'customer' | 'vendor';
  vendorName?: string;
  vendorEmail?: string;
  invoiceNumber: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueDate: Date;
  status: 'Draft' | 'Sent' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Cancelled';
  remindersSent: number;
  lastReminderAt?: Date;
  pdfUrl?: string;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    organizationId:  { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    accountId:       { type: Schema.Types.ObjectId, ref: 'Account' },
    leadId:          { type: Schema.Types.ObjectId, ref: 'Lead' },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    invoiceType:     { type: String, enum: ['customer', 'vendor'], default: 'customer' },
    vendorName:      { type: String },
    vendorEmail:     { type: String },
    invoiceNumber:   { type: String, required: true, unique: true },
    amount:          { type: Number, required: true, min: 0 },
    taxAmount:       { type: Number, default: 0 },
    totalAmount:     { type: Number, required: true },
    paidAmount:      { type: Number, default: 0 },
    dueDate:         { type: Date, required: true },
    status:          { type: String, enum: ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'], default: 'Sent' },
    remindersSent:   { type: Number, default: 0 },
    lastReminderAt:  { type: Date },
    pdfUrl:          { type: String },
    notes:           { type: String },
    createdBy:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

InvoiceSchema.index({ accountId: 1, status: 1 });
InvoiceSchema.index({ leadId: 1 });
InvoiceSchema.index({ purchaseOrderId: 1 });
InvoiceSchema.index({ invoiceType: 1, status: 1 });
InvoiceSchema.index({ dueDate: 1, status: 1 });

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema);
