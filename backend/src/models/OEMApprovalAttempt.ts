import mongoose, { Document, Schema } from 'mongoose';

export interface IExtensionHistory {
  extendedAt: Date;
  previousExpiry: Date;
  newExpiry: Date;
  extendedBy: string;
  reason?: string;
}

export interface IOEMApprovalAttempt extends Document {
  leadId: mongoose.Types.ObjectId;
  attemptNumber: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Expired';
  sentDate: Date;
  approvedDate?: Date;
  rejectedDate?: Date;
  rejectionReason?: string;
  expiryDate?: Date;
  approvedBy?: string;
  extensionCount: number;
  extensionHistory: IExtensionHistory[];
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExtHistSchema = new Schema<IExtensionHistory>({
  extendedAt: { type: Date, required: true },
  previousExpiry: { type: Date, required: true },
  newExpiry: { type: Date, required: true },
  extendedBy: { type: String, required: true },
  reason: { type: String },
}, { _id: false });

const OEMSchema = new Schema<IOEMApprovalAttempt>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Expired'], default: 'Pending' },
    sentDate: { type: Date, required: true, default: Date.now },
    approvedDate: { type: Date },
    rejectedDate: { type: Date },
    rejectionReason: { type: String },
    expiryDate: { type: Date },
    approvedBy: { type: String },
    extensionCount: { type: Number, default: 0 },
    extensionHistory: { type: [ExtHistSchema], default: [] },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

OEMSchema.index({ leadId: 1, status: 1 });
OEMSchema.index({ leadId: 1, attemptNumber: 1 }, { unique: true });
OEMSchema.index({ expiryDate: 1, status: 1 });

// Virtuals: frontend DRF type expects "version" and "drfNumber"
OEMSchema.virtual('version').get(function () { return this.attemptNumber; });
OEMSchema.virtual('drfNumber').get(function () {
  const d = this.sentDate || this.createdAt;
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `DRF-${date}-${String(this.attemptNumber).padStart(3, '0')}`;
});
OEMSchema.set('toJSON', { virtuals: true });
OEMSchema.set('toObject', { virtuals: true });

export default mongoose.model<IOEMApprovalAttempt>('OEMApprovalAttempt', OEMSchema);
