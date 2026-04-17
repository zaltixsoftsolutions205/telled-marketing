import mongoose, { Document, Schema } from 'mongoose';

export interface IPurchaseOrder extends Document {
  leadId: mongoose.Types.ObjectId;
  poNumber: string;
  amount: number;
  product?: string;
  vendorName?: string;
  vendorEmail?: string;
  receivedDate: Date;
  notes?: string;
  vendorEmailSent: boolean;
  vendorEmailSentAt?: Date;
  converted: boolean;
  uploadedBy: mongoose.Types.ObjectId;
  isArchived: boolean;
  // Vendor payment tracking
  paymentStatus: 'Unpaid' | 'Paid';
  paidAmount?: number;
  paidDate?: Date;
  paymentMode?: 'Bank Transfer' | 'Cheque' | 'Cash' | 'UPI' | 'Online';
  paymentReference?: string;
  paymentNotes?: string;
  paidBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const POSchema = new Schema<IPurchaseOrder>(
  {
    leadId:            { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    poNumber:          { type: String, required: true, unique: true },
    amount:            { type: Number, required: true, min: 0 },
    product:           { type: String },
    vendorName:        { type: String },
    vendorEmail:       { type: String },
    receivedDate:      { type: Date, required: true },
    notes:             { type: String },
    vendorEmailSent:   { type: Boolean, default: false },
    vendorEmailSentAt: { type: Date },
    converted:         { type: Boolean, default: false },
    uploadedBy:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived:        { type: Boolean, default: false },
    paymentStatus:     { type: String, enum: ['Unpaid', 'Paid'], default: 'Unpaid' },
    paidAmount:        { type: Number },
    paidDate:          { type: Date },
    paymentMode:       { type: String, enum: ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'Online'] },
    paymentReference:  { type: String },
    paymentNotes:      { type: String },
    paidBy:            { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

POSchema.index({ leadId: 1 });

export default mongoose.model<IPurchaseOrder>('PurchaseOrder', POSchema);
