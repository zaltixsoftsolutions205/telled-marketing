import mongoose, { Document, Schema } from 'mongoose';

export interface ITraining extends Document {
  accountId: mongoose.Types.ObjectId;
  customerName: string;
  status: 'Pending' | 'Completed';
  mode: 'Online' | 'Offline' | 'Hybrid';
  trainingDate: Date;
  trainedBy: mongoose.Types.ObjectId;
  notes?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingSchema = new Schema<ITraining>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    customerName: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
    mode: { type: String, enum: ['Online', 'Offline', 'Hybrid'], default: 'Online' },
    trainingDate: { type: Date, required: true },
    trainedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

TrainingSchema.index({ accountId: 1 });
TrainingSchema.index({ trainedBy: 1 });
TrainingSchema.index({ status: 1 });

export default mongoose.model<ITraining>('Training', TrainingSchema);
