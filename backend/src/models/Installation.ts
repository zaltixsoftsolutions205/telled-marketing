import mongoose, { Document, Schema } from 'mongoose';

export interface IInstallation extends Document {
  accountId: mongoose.Types.ObjectId;
  engineerId: mongoose.Types.ObjectId;
  scheduledDate: Date;
  completedDate?: Date;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  siteAddress?: string;
  licenseVersion?: string;
  notes?: string;
  completionReport?: string;
  assignedBy: mongoose.Types.ObjectId;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InstallationSchema = new Schema<IInstallation>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    engineerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledDate: { type: Date, required: true },
    completedDate: { type: Date },
    status: { type: String, enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'], default: 'Scheduled' },
    siteAddress: { type: String },
    licenseVersion: { type: String },
    notes: { type: String },
    completionReport: { type: String },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

InstallationSchema.index({ accountId: 1 });
InstallationSchema.index({ engineerId: 1, status: 1 });

// Virtual: frontend uses "engineer" — alias for engineerId populated
InstallationSchema.virtual('engineer', {
  ref: 'User',
  localField: 'engineerId',
  foreignField: '_id',
  justOne: true,
});
InstallationSchema.set('toJSON', { virtuals: true });
InstallationSchema.set('toObject', { virtuals: true });

export default mongoose.model<IInstallation>('Installation', InstallationSchema);
