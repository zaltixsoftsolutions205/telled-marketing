import mongoose, { Document, Schema } from 'mongoose';

export interface IEngineerVisit extends Document {
  engineerId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  visitDate: Date;
  workDone: string;
  visitCharges: number;
  travelAllowance: number;
  additionalExpense: number;
  totalAmount: number;
  approvedByHR: boolean;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VisitSchema = new Schema<IEngineerVisit>(
  {
    engineerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    visitDate: { type: Date, required: true },
    workDone: { type: String, required: true },
    visitCharges: { type: Number, default: 0, min: 0 },
    travelAllowance: { type: Number, default: 0, min: 0 },
    additionalExpense: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0 },
    approvedByHR: { type: Boolean, default: false },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

VisitSchema.index({ engineerId: 1, visitDate: -1 });
VisitSchema.index({ accountId: 1 });
VisitSchema.index({ approvedByHR: 1 });

VisitSchema.pre('save', function (next) {
  this.totalAmount = this.visitCharges + this.travelAllowance + this.additionalExpense;
  next();
});

export default mongoose.model<IEngineerVisit>('EngineerVisit', VisitSchema);
