import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  invoiceId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  amountPaid: number;
  paymentDate: Date;
  mode: 'Bank Transfer' | 'Cheque' | 'Cash' | 'UPI' | 'Online';
  referenceNumber?: string;
  notes?: string;
  recordedBy: mongoose.Types.ObjectId;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    amountPaid: { type: Number, required: true, min: 0 },
    paymentDate: { type: Date, required: true },
    mode: { type: String, enum: ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'Online'], required: true },
    referenceNumber: { type: String },
    notes: { type: String },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

PaymentSchema.index({ invoiceId: 1 });
PaymentSchema.index({ accountId: 1, paymentDate: -1 });

export default mongoose.model<IPayment>('Payment', PaymentSchema);
