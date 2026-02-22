import mongoose, { Document, Schema } from 'mongoose';

export interface IProductItem { description: string; quantity: number; unitPrice: number; total: number; }

export interface IQuotation extends Document {
  accountId: mongoose.Types.ObjectId;
  quotationNumber: string;
  productList: IProductItem[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  pdfUrl?: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';
  validUntil?: Date;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProductItem>(
  { description: { type: String, required: true }, quantity: { type: Number, required: true }, unitPrice: { type: Number, required: true }, total: { type: Number, required: true } },
  { _id: false }
);

const QuotationSchema = new Schema<IQuotation>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    quotationNumber: { type: String, required: true, unique: true },
    productList: { type: [ProductSchema], required: true },
    subtotal: { type: Number, required: true },
    taxPercent: { type: Number, default: 18 },
    taxAmount: { type: Number, required: true },
    total: { type: Number, required: true },
    pdfUrl: { type: String },
    status: { type: String, enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'], default: 'Draft' },
    validUntil: { type: Date },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

QuotationSchema.index({ accountId: 1, status: 1 });

export default mongoose.model<IQuotation>('Quotation', QuotationSchema);
