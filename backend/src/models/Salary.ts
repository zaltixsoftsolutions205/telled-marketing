import mongoose, { Document, Schema } from 'mongoose';

export interface ISalary extends Document {
  employeeId: mongoose.Types.ObjectId;
  month: number;
  year: number;
  baseSalary: number;
  visitChargesTotal: number;
  claimsTotal: number;
  travelAllowance: number;
  incentives: number;
  deductions: number;
  finalSalary: number;
  payslipPdf?: string;
  isPaid: boolean;
  paidAt?: Date;
  paidBy?: mongoose.Types.ObjectId;
  notes?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SalarySchema = new Schema<ISalary>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    baseSalary: { type: Number, required: true, min: 0 },
    visitChargesTotal: { type: Number, default: 0 },
    claimsTotal: { type: Number, default: 0 },
    travelAllowance: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    finalSalary: { type: Number, default: 0 },
    payslipPdf: { type: String },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

SalarySchema.index({ employeeId: 1, year: -1, month: -1 });
SalarySchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

SalarySchema.pre('save', function (next) {
  this.finalSalary = this.baseSalary + this.visitChargesTotal + (this.claimsTotal || 0) + (this.travelAllowance || 0) + this.incentives - this.deductions;
  next();
});

// Virtual: frontend uses "status" ('Calculated' | 'Paid') — derived from isPaid
SalarySchema.virtual('status').get(function () { return this.isPaid ? 'Paid' : 'Calculated'; });
// Virtual: frontend uses "pdfPath" — alias for payslipPdf
SalarySchema.virtual('pdfPath').get(function () { return this.payslipPdf; });
SalarySchema.set('toJSON', { virtuals: true });
SalarySchema.set('toObject', { virtuals: true });

export default mongoose.model<ISalary>('Salary', SalarySchema);
