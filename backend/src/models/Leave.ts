import mongoose, { Schema, Document } from 'mongoose';
export interface ILeave extends Document {
  employeeId: mongoose.Types.ObjectId;
  type: 'Casual' | 'Sick' | 'Annual' | 'Unpaid';
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
}
const LeaveSchema = new Schema<ILeave>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['Casual','Sick','Annual','Unpaid'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  days: { type: Number, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['Pending','Approved','Rejected'], default: 'Pending' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectionReason: String,
}, { timestamps: true });
export default mongoose.model<ILeave>('Leave', LeaveSchema);
