import mongoose, { Document, Schema } from 'mongoose';

export interface IInstallation extends Document {
  accountId: mongoose.Types.ObjectId;
  engineerId: mongoose.Types.ObjectId;
  scheduledDate: Date;
  completedDate?: Date;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  notes?: string;
  completionReport?: string;
  assignedBy: mongoose.Types.ObjectId;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InstallationSchema = new Schema<IInstallation>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    engineerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledDate: { type: Date, required: true },
    completedDate: { type: Date },
    status: { type: String, enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'], default: 'Scheduled' },
    notes: { type: String },
    completionReport: { type: String },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

InstallationSchema.index({ accountId: 1 });
InstallationSchema.index({ engineerId: 1, status: 1 });

export default mongoose.model<IInstallation>('Installation', InstallationSchema);
