import mongoose, { Document, Schema } from 'mongoose';

export interface IAccount extends Document {
  leadId: mongoose.Types.ObjectId;
  companyName: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  panNumber?: string;
  assignedEngineer?: mongoose.Types.ObjectId;
  assignedSales: mongoose.Types.ObjectId;
  status: 'Active' | 'Inactive' | 'Suspended';
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, unique: true },
    companyName: { type: String, required: true, trim: true },
    contactName: { type: String, default: '', trim: true },
    contactEmail: { type: String, default: '', lowercase: true },
    phone: { type: String, default: '' },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    assignedEngineer: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedSales: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['Active', 'Inactive', 'Suspended'], default: 'Active' },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AccountSchema.index({ assignedEngineer: 1 });
AccountSchema.index({ assignedSales: 1 });
AccountSchema.index({ companyName: 'text', contactName: 'text' });

// Virtual: frontend uses "accountName" — alias for companyName
AccountSchema.virtual('accountName').get(function () { return this.companyName; });
AccountSchema.set('toJSON', { virtuals: true });
AccountSchema.set('toObject', { virtuals: true });

export default mongoose.model<IAccount>('Account', AccountSchema);
