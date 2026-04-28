import mongoose, { Document, Schema } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  slug: string;
  ownerId: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name:     { type: String, required: true, trim: true },
    slug:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    ownerId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
    attendanceSettings: { type: Schema.Types.Mixed },
    leavePolicy: {
      type: {
        Casual:  { type: Number, default: 12 },
        Sick:    { type: Number, default: 6 },
        Annual:  { type: Number, default: 15 },
        Unpaid:  { type: Number, default: 0 },
      },
      default: () => ({ Casual: 12, Sick: 6, Annual: 15, Unpaid: 0 }),
    },
  },
  { timestamps: true }
);

export default mongoose.model<IOrganization>('Organization', OrganizationSchema);
