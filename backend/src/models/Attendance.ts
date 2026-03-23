import mongoose, { Schema, Document } from 'mongoose';
export interface IAttendance extends Document {
  employeeId: mongoose.Types.ObjectId;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  status: 'Present' | 'Absent' | 'Half Day' | 'Leave' | 'Holiday';
  notes?: string;
  markedBy?: mongoose.Types.ObjectId;
}
const AttendanceSchema = new Schema<IAttendance>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  checkIn: Date,
  checkOut: Date,
  status: { type: String, enum: ['Present','Absent','Half Day','Leave','Holiday'], default: 'Present' },
  notes: String,
  markedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
export default mongoose.model<IAttendance>('Attendance', AttendanceSchema);
