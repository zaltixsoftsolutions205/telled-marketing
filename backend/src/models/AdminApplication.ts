import mongoose, { Document, Schema } from 'mongoose';

export interface IDocument {
  type: 'business_registration' | 'gst_certificate' | 'id_proof' | 'address_proof' | 'pan_certificate' | 'incorporation_certificate' | 'other';
  filename: string;
  originalName: string;
  path: string;
  mimetype: string;
  size: number;
}

export interface IAdminApplication extends Document {
  orgName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  businessType: string;
  gstNumber?: string;
  emailVerified: boolean;
  documents: IDocument[];
  status: 'pending_verification' | 'pending_approval' | 'approved' | 'rejected';
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  createdUserId?: mongoose.Types.ObjectId;
  // SMTP fields collected during registration
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string; // encrypted
  smtpProvider?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>({
  type: {
    type: String,
    enum: ['business_registration', 'gst_certificate', 'id_proof', 'address_proof', 'pan_certificate', 'incorporation_certificate', 'other'],
    required: true
  },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  path: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
}, { _id: false });

const AdminApplicationSchema = new Schema<IAdminApplication>(
  {
    orgName:       { type: String, required: true, trim: true },
    contactName:   { type: String, required: true, trim: true },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:         { type: String, required: true, trim: true },
    address:       { type: String, required: true, trim: true },
    city:          { type: String, required: true, trim: true },
    state:         { type: String, required: true, trim: true },
    businessType:  { type: String, required: true, trim: true },
    gstNumber:     { type: String, trim: true },
    emailVerified: { type: Boolean, default: false },
    documents:     { type: [DocumentSchema], default: [] },
    status: {
      type: String,
      enum: ['pending_verification', 'pending_approval', 'approved', 'rejected'],
      default: 'pending_verification'
    },
    rejectionReason: { type: String },
    approvedBy:      { type: String },
    approvedAt:      { type: Date },
    rejectedAt:      { type: Date },
    createdUserId:   { type: Schema.Types.ObjectId, ref: 'User' },
    smtpHost:        { type: String },
    smtpPort:        { type: Number },
    smtpSecure:      { type: Boolean },
    smtpUser:        { type: String },
    smtpPass:        { type: String },
    smtpProvider:    { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IAdminApplication>('AdminApplication', AdminApplicationSchema);
