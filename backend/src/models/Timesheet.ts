import mongoose, { Document, Schema } from 'mongoose';

export interface ITimesheet extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  date: Date;
  taskType: string;
  description: string;
  hoursWorked: number;
  project?: string;
  notes?: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  rejectionReason?: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  month: number;
  year: number;
  createdAt: Date;
  updatedAt: Date;
}

const TimesheetSchema = new Schema<ITimesheet>(
  {
    userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId:   { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    date:             { type: Date, required: true },
    taskType:         { type: String, required: true, trim: true },
    description:      { type: String, required: true, trim: true },
    hoursWorked:      { type: Number, required: true, min: 0.5, max: 24 },
    project:          { type: String, trim: true },
    notes:            { type: String, trim: true },
    status:           { type: String, enum: ['Draft', 'Submitted', 'Approved', 'Rejected'], default: 'Draft' },
    rejectionReason:  { type: String },
    approvedBy:       { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt:       { type: Date },
    month:            { type: Number, required: true },
    year:             { type: Number, required: true },
  },
  { timestamps: true }
);

TimesheetSchema.index({ userId: 1, month: 1, year: 1 });
TimesheetSchema.index({ organizationId: 1, month: 1, year: 1 });

export default mongoose.model<ITimesheet>('Timesheet', TimesheetSchema);
