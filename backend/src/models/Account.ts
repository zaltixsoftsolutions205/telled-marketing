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
    contactName: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    assignedEngineer: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedSales: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['Active', 'Inactive', 'Suspended'], default: 'Active' },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AccountSchema.index({ assignedEngineer: 1 });
AccountSchema.index({ assignedSales: 1 });
AccountSchema.index({ companyName: 'text', contactName: 'text' });

export default mongoose.model<IAccount>('Account', AccountSchema);
