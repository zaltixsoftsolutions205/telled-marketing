import mongoose, { Document, Schema } from 'mongoose';

export type ContactType = 'TELLED' | 'ARK' | 'CUSTOMER';

export interface IContact extends Document {
  name: string;
  email: string;
  phone: string;
  designation?: string;
  companyName?: string;
  contactType: ContactType;
  linkedAccountId?: mongoose.Types.ObjectId;
  notes?: string;
  organizationId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    name:        { type: String, required: true, trim: true },
    email:       { type: String, required: true, lowercase: true, trim: true },
    phone:       { type: String, trim: true, default: '' },
    designation: { type: String, trim: true },
    companyName: { type: String, trim: true },
    contactType: {
      type: String,
      enum: ['TELLED', 'ARK', 'CUSTOMER'],
      required: true,
    },
    linkedAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
    notes:           { type: String },
    organizationId:  { type: Schema.Types.ObjectId, required: true },
    createdBy:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

ContactSchema.index({ organizationId: 1, contactType: 1 });
ContactSchema.index({ organizationId: 1, linkedAccountId: 1 });
ContactSchema.index({ name: 'text', email: 'text', companyName: 'text' });

export default mongoose.model<IContact>('Contact', ContactSchema);
