// src/models/Quotation.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IQuotationItem {
  description: string;
  quantity: number;
  listPrice?: number;
  unitPrice: number;
  discount?: number; // per-item discount %
  total: number;
}

export interface IQuotation extends Document {
  organizationId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  quotationNumber: string;
  version: number;
  items: IQuotationItem[];
  subtotal: number;
  taxRate: number;
  gstApplicable: boolean;
  taxAmount: number;
  discountApplicable: boolean;
  discountType: 'percent' | 'flat';
  discountValue: number;
  discountAmount: number;
  total: number;
  finalAmount?: number;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Final';
  validUntil?: Date;
  terms?: string;
  notes?: string;
  pdfPath?: string;
  uploadedFile?: string;
  uploadedFileName?: string;
  // Seller / from-company info (filled by sales in quotation modal)
  sellerCompany?: string;
  sellerAddress?: string;
  sellerEmail?: string;
  sellerPhone?: string;
  sellerGST?: string;
  sellerLogoPath?: string;
  salesPersonName?: string;
  customerId?: string;
  // Bank details
  bankName?: string;
  bankAccount?: string;
  bankIFSC?: string;
  bankBranch?: string;
  // Extra
  deliveryWeeks?: string;
  templateId?: string;
  templateColor?: string;
  // Customer / Bill-To fields (filled in modal, overrides lead data in PDF)
  toCompany?: string;
  toContact?: string;
  toAddress?: string;
  // Second logo (customer / channel partner)
  secondLogoPath?: string;
  secondLogoLabel?: string;
  // Custom fields added by sales (appear in info table on PDF)
  customFields?: Array<{ label: string; value: string }>;  // 'Channel Partner' | 'Customer' | custom
  emailSent: boolean;
  emailSentAt?: Date;
  vendorSent: boolean;
  vendorSentAt?: Date;
  vendorEmail?: string;
  acceptedAt?: Date;
  acceptedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  createdBy: mongoose.Types.ObjectId;
  isArchived: boolean;
  archivedAt?: Date;
  archivedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema = new Schema<IQuotationItem>({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  listPrice: { type: Number, default: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0, max: 100 },
  total: { type: Number, required: true }
}, { _id: false });

const QuotationSchema = new Schema<IQuotation>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    quotationNumber: { type: String, required: true, unique: true },
    version: { type: Number, default: 1 },
    items: { type: [ItemSchema], required: true },
    subtotal: { type: Number, required: true },
    taxRate: { type: Number, default: 18 },
    gstApplicable: { type: Boolean, default: true },
    taxAmount: { type: Number, required: true },
    discountApplicable: { type: Boolean, default: false },
    discountType: { type: String, enum: ['percent', 'flat'], default: 'percent' },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    finalAmount: { type: Number },
    status: {
      type: String,
      enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Final'],
      default: 'Draft',
      index: true
    },
    validUntil: { type: Date },
    terms: { type: String },
    notes: { type: String },
    pdfPath: { type: String },
    uploadedFile: { type: String },
    uploadedFileName: { type: String },
    sellerCompany:    { type: String },
    sellerAddress:    { type: String },
    sellerEmail:      { type: String },
    sellerPhone:      { type: String },
    sellerGST:        { type: String },
    sellerLogoPath:   { type: String },
    salesPersonName:  { type: String },
    customerId:       { type: String },
    bankName:         { type: String },
    bankAccount:      { type: String },
    bankIFSC:         { type: String },
    bankBranch:       { type: String },
    deliveryWeeks:    { type: String },
    templateId:       { type: String },
    templateColor:    { type: String },
    toCompany:        { type: String },
    toContact:        { type: String },
    toAddress:        { type: String },
    secondLogoPath:   { type: String },
    secondLogoLabel:  { type: String },
    customFields:     { type: [{ label: String, value: String, _id: false }], default: [] },
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date },
    vendorSent: { type: Boolean, default: false },
    vendorSentAt: { type: Date },
    vendorEmail: { type: String },
    acceptedAt: { type: Date },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    archivedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

// Only one index definition - remove duplicate
// QuotationSchema.index({ quotationNumber: 1 }, { unique: true }); // Remove this if it exists

export default mongoose.model<IQuotation>('Quotation', QuotationSchema);