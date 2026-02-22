import mongoose, { Document, Schema } from 'mongoose';

export interface IPurchaseOrder extends Document {
  accountId: mongoose.Types.ObjectId;
  quotationId?: mongoose.Types.ObjectId;
  poNumber: string;
  poDocument?: string;
  receivedDate: Date;
  amount: number;
  notes?: string;
  uploadedBy: mongoose.Types.ObjectId;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const POSchema = new Schema<IPurchaseOrder>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    quotationId: { type: Schema.Types.ObjectId, ref: 'Quotation' },
    poNumber: { type: String, required: true, unique: true },
    poDocument: { type: String },
    receivedDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    notes: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

POSchema.index({ accountId: 1 });

export default mongoose.model<IPurchaseOrder>('PurchaseOrder', POSchema);
