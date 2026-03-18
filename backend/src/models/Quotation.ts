import mongoose, { Document, Schema } from 'mongoose';

export interface IQuotationItem { description: string; quantity: number; unitPrice: number; total: number; }

export interface IQuotation extends Document {
  leadId: mongoose.Types.ObjectId;
  quotationNumber: string;
  version: number;
  items: IQuotationItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: 'Sent' | 'Accepted' | 'Rejected';
  validUntil?: Date;
  terms?: string;
  notes?: string;
  pdfPath?: string;
  emailSent: boolean;
  emailSentAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema = new Schema<IQuotationItem>(
  { description: { type: String, required: true }, quantity: { type: Number, required: true }, unitPrice: { type: Number, required: true }, total: { type: Number, required: true } },
  { _id: false }
);

const QuotationSchema = new Schema<IQuotation>(
  {
    leadId:          { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    quotationNumber: { type: String, required: true, unique: true },
    version:         { type: Number, default: 1 },
    items:           { type: [ItemSchema], required: true },
    subtotal:        { type: Number, required: true },
    taxRate:         { type: Number, default: 18 },
    taxAmount:       { type: Number, required: true },
    total:           { type: Number, required: true },
    status:          { type: String, enum: ['Sent', 'Accepted', 'Rejected'], default: 'Sent' },
    validUntil:      { type: Date },
    terms:           { type: String },
    notes:           { type: String },
    pdfPath:         { type: String },
    emailSent:       { type: Boolean, default: false },
    emailSentAt:     { type: Date },
    createdBy:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

QuotationSchema.index({ leadId: 1, status: 1 });

export default mongoose.model<IQuotation>('Quotation', QuotationSchema);
