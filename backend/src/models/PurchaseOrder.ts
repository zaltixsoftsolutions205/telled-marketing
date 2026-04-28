import mongoose, { Document, Schema } from 'mongoose';

export interface IPOLineItem {
  product: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface IPurchaseOrder extends Document {
  organizationId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  poNumber: string;
  amount: number;
  // Multiple line items
  items: IPOLineItem[];
  // Legacy single-product field (kept for backward compat)
  product?: string;
  vendorName?: string;
  vendorEmail?: string;
  receivedDate: Date;
  notes?: string;
  converted: boolean;
  uploadedBy: mongoose.Types.ObjectId;
  isArchived: boolean;
  // ── 8-step workflow ──
  currentStep: number;
  workflowStatus: 'Draft' | 'In Progress' | 'Completed';
  // Step 2: Forward PO to ARK
  step2ForwardedToArk: boolean;
  step2ForwardedAt?: Date;
  step2PoDocName?: string;
  // Step 3: ARK Response / Price Clearance
  step3PriceClearanceReceived: boolean;
  step3ReceivedAt?: Date;
  step3DocNames: string[];
  // Step 4: Send Documents to Customer
  step4DocsSentToCustomer: boolean;
  step4SentAt?: Date;
  // Step 5: Invoice to ARK
  step5InvoiceToArk: boolean;
  step5InvoiceSentAt?: Date;
  step5InvoiceDocName?: string;
  // Step 6: Send Documents to ARK
  step6DocsSentToArk: boolean;
  step6SentAt?: Date;
  // Step 7: License Generation mail received
  step7LicenseMailReceived: boolean;
  step7LicenseMailReceivedAt?: Date;
  // Step 8: Final Invoice
  step8FinalInvoiceSent: boolean;
  step8FinalInvoiceSentAt?: Date;
  step8FinalInvoiceAmount?: number;
  step8FinalInvoiceNumber?: string;
  // ── Legacy 6-step fields (kept for backward compat) ──
  customerInvoiceSent: boolean;
  customerInvoiceSentAt?: Date;
  poForwardedToArk: boolean;
  poForwardedToArkAt?: Date;
  priceClearanceReceived: boolean;
  priceClearanceReceivedAt?: Date;
  poSentToArk: boolean;
  poSentToArkAt?: Date;
  arkInvoiceReceived: boolean;
  arkInvoiceReceivedAt?: Date;
  arkInvoiceAmount?: number;
  vendorEmailSent: boolean;
  vendorEmailSentAt?: Date;
  // Payment
  paymentStatus: 'Unpaid' | 'Paid';
  paidAmount?: number;
  paidDate?: Date;
  paymentMode?: 'Bank Transfer' | 'Cheque' | 'Cash' | 'UPI' | 'Online';
  paymentReference?: string;
  paymentNotes?: string;
  paidBy?: mongoose.Types.ObjectId;
  // Auto-sync metadata
  paymentTerms?: string;
  currency?: string;
  syncedFromEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LineItemSchema = new Schema<IPOLineItem>(
  {
    product:     { type: String, required: true },
    description: { type: String },
    quantity:    { type: Number, default: 1, min: 0.001 },
    unitPrice:   { type: Number, required: true, min: 0 },
    amount:      { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const POSchema = new Schema<IPurchaseOrder>(
  {
    organizationId:   { type: Schema.Types.ObjectId, ref: 'Organization' },
    leadId:           { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    poNumber:         { type: String, required: true, unique: true },
    amount:           { type: Number, required: true, min: 0 },
    items:            { type: [LineItemSchema], default: [] },
    product:          { type: String },
    vendorName:       { type: String },
    vendorEmail:      { type: String },
    receivedDate:     { type: Date, required: true },
    notes:            { type: String },
    converted:        { type: Boolean, default: false },
    uploadedBy:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived:       { type: Boolean, default: false },
    // 8-step workflow
    currentStep:      { type: Number, default: 1 },
    workflowStatus:   { type: String, enum: ['Draft', 'In Progress', 'Completed'], default: 'Draft' },
    // Step 2
    step2ForwardedToArk: { type: Boolean, default: false },
    step2ForwardedAt:    { type: Date },
    step2PoDocName:      { type: String },
    // Step 3
    step3PriceClearanceReceived: { type: Boolean, default: false },
    step3ReceivedAt:             { type: Date },
    step3DocNames:               { type: [String], default: [] },
    // Step 4
    step4DocsSentToCustomer: { type: Boolean, default: false },
    step4SentAt:             { type: Date },
    // Step 5
    step5InvoiceToArk:   { type: Boolean, default: false },
    step5InvoiceSentAt:  { type: Date },
    step5InvoiceDocName: { type: String },
    // Step 6
    step6DocsSentToArk: { type: Boolean, default: false },
    step6SentAt:        { type: Date },
    // Step 7
    step7LicenseMailReceived:   { type: Boolean, default: false },
    step7LicenseMailReceivedAt: { type: Date },
    // Step 8
    step8FinalInvoiceSent:     { type: Boolean, default: false },
    step8FinalInvoiceSentAt:   { type: Date },
    step8FinalInvoiceAmount:   { type: Number },
    step8FinalInvoiceNumber:   { type: String },
    // Legacy 6-step fields
    customerInvoiceSent:      { type: Boolean, default: false },
    customerInvoiceSentAt:    { type: Date },
    poForwardedToArk:         { type: Boolean, default: false },
    poForwardedToArkAt:       { type: Date },
    priceClearanceReceived:   { type: Boolean, default: false },
    priceClearanceReceivedAt: { type: Date },
    poSentToArk:              { type: Boolean, default: false },
    poSentToArkAt:            { type: Date },
    arkInvoiceReceived:       { type: Boolean, default: false },
    arkInvoiceReceivedAt:     { type: Date },
    arkInvoiceAmount:         { type: Number },
    vendorEmailSent:          { type: Boolean, default: false },
    vendorEmailSentAt:        { type: Date },
    paymentStatus:  { type: String, enum: ['Unpaid', 'Paid'], default: 'Unpaid' },
    paidAmount:     { type: Number },
    paidDate:       { type: Date },
    paymentMode:    { type: String, enum: ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'Online'] },
    paymentReference: { type: String },
    paymentNotes:   { type: String },
    paidBy:         { type: Schema.Types.ObjectId, ref: 'User' },
    paymentTerms:   { type: String },
    currency:       { type: String, default: 'INR' },
    syncedFromEmail: { type: String },
  },
  { timestamps: true }
);

POSchema.index({ organizationId: 1, leadId: 1 });
POSchema.index({ organizationId: 1, currentStep: 1 });

export default mongoose.model<IPurchaseOrder>('PurchaseOrder', POSchema);
