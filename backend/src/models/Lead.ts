import mongoose, { Document, Schema } from 'mongoose';

export type SalesStatus =
  | 'Uninitiated'
  | 'Sales meeting follow-up'
  | 'Under technical Demo'
  | 'Under Proposal submission Process'
  | 'Under PO-Followup'
  | 'Under payment follow-up'
  | 'Closed, and now a Customer'
  | 'Rejected, at Sales discussion stage'
  | 'Rejected, at Tech Demo Stage'
  | 'Rejected, at PO follow-up stage'
  | 'Rejected, at Payment follow-up stage'
  | 'Rejected, at license generation stage';

export const SALES_STATUS_VALUES: SalesStatus[] = [
  'Uninitiated',
  'Sales meeting follow-up',
  'Under technical Demo',
  'Under Proposal submission Process',
  'Under PO-Followup',
  'Under payment follow-up',
  'Closed, and now a Customer',
  'Rejected, at Sales discussion stage',
  'Rejected, at Tech Demo Stage',
  'Rejected, at PO follow-up stage',
  'Rejected, at Payment follow-up stage',
  'Rejected, at license generation stage',
];

export const STAGE_TO_SALES_STATUS: Partial<Record<string, SalesStatus>> = {
  'New':           'Uninitiated',
  'OEM Submitted': 'Sales meeting follow-up',
  'OEM Approved':  'Sales meeting follow-up',
  'OEM Rejected':  'Rejected, at Sales discussion stage',
  'OEM Expired':   'Rejected, at Sales discussion stage',
  'Technical Done':'Under technical Demo',
  'Quotation Sent':'Under Proposal submission Process',
  'Negotiation':   'Under Proposal submission Process',
  'PO Received':   'Under PO-Followup',
  'Converted':     'Closed, and now a Customer',
};

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
  oemEmail?: string;
  assignedTo?: mongoose.Types.ObjectId;
  status: 'New' | 'Contacted' | 'Qualified' | 'Not Qualified';
  stage: string;
  salesStatus: SalesStatus;
  website?: string;
  annualTurnover?: string;
  designation?: string;
  channelPartner?: string;
  expectedClosure?: string;
  notes?: string;
  isArchived: boolean;
  archivedAt?: Date;
  archivedBy?: mongoose.Types.ObjectId;
  drfNumber?: string;
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
    oemEmail:   { type: String, lowercase: true, trim: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['New', 'Contacted', 'Qualified', 'Not Qualified'],
      default: 'New',
    },
    drfNumber:      { type: String, index: true },
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
    salesStatus: {
      type: String,
      enum: SALES_STATUS_VALUES,
      default: 'Uninitiated',
    },
    website:         { type: String },
    annualTurnover:  { type: String },
    designation:     { type: String },
    channelPartner:  { type: String, default: 'ZIEOS' },
    expectedClosure: { type: String },
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
