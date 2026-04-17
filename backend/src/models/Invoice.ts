import mongoose, { Document, Schema } from 'mongoose';

export interface IInvoice extends Document {
  accountId: mongoose.Types.ObjectId;
  purchaseOrderId?: mongoose.Types.ObjectId;
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
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    invoiceNumber: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'], default: 'Draft' },
    remindersSent: { type: Number, default: 0 },
    lastReminderAt: { type: Date },
    pdfUrl: { type: String },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

InvoiceSchema.index({ accountId: 1, status: 1 });
InvoiceSchema.index({ dueDate: 1, status: 1 });

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema);
