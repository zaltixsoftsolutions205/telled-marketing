import mongoose, { Document, Schema } from 'mongoose';

export interface ILead extends Document {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  source?: string;
  oemName?: string;
  assignedTo?: mongoose.Types.ObjectId;
  stage: string;
  notes?: string;
  isArchived: boolean;
  archivedAt?: Date;
  archivedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    companyName:  { type: String, required: true, trim: true },
    contactName:  { type: String, required: true, trim: true },
    email:        { type: String, required: true, lowercase: true, trim: true },
    phone:        { type: String, required: true },
    address:      { type: String },
    city:         { type: String },
    state:        { type: String },
    source: {
      type: String,
      enum: ['Website', 'Referral', 'Cold Call', 'Exhibition', 'LinkedIn', 'Email', 'Other'],
    },
    oemName:    { type: String, trim: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    stage: {
      type: String,
      enum: [
        'New', 'OEM Submitted', 'OEM Approved', 'OEM Rejected', 'OEM Expired',
        'Technical Done', 'Quotation Sent', 'Negotiation', 'PO Received', 'Converted', 'Lost',
      ],
      default: 'New',
    },
    notes:      { type: String },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    archivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

LeadSchema.index({ assignedTo: 1, stage: 1 });
LeadSchema.index({ isArchived: 1 });
LeadSchema.index({ companyName: 'text', contactName: 'text', email: 'text' });

export default mongoose.model<ILead>('Lead', LeadSchema);
