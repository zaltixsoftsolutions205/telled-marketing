import mongoose, { Document, Schema } from 'mongoose';

export interface ILead extends Document {
  companyName: string;
  contactName: string;
  contactPersonName?: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  source?: string;
  oemName?: string;
  assignedTo?: mongoose.Types.ObjectId;
  status: 'New' | 'Contacted' | 'Qualified' | 'Not Qualified';
  stage: string;
  notes?: string;
  isArchived: boolean;
  archivedAt?: Date;
  archivedBy?: mongoose.Types.ObjectId;
  drfEmailSent?: boolean;
  drfEmailSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    companyName:       { type: String, required: true, trim: true },
    contactName:       { type: String, required: true, trim: true },
    contactPersonName: { type: String, trim: true },
    email:             { type: String, required: true, lowercase: true, trim: true },
    phone:        { type: String, required: true },
    address:      { type: String },
    city:         { type: String },
    state:        { type: String },
    source: { type: String },
    oemName:    { type: String, trim: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['New', 'Contacted', 'Qualified', 'Not Qualified'],
      default: 'New',
    },
    drfEmailSent:   { type: Boolean, default: false },
    drfEmailSentAt: { type: Date },
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
