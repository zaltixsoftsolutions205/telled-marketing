// import mongoose, { Document, Schema } from 'mongoose';

// export interface ISalary extends Document {
//   organizationId: mongoose.Types.ObjectId;
//   employeeId: mongoose.Types.ObjectId;
//   month: number;
//   year: number;
//   baseSalary: number;
//   visitChargesTotal: number;
//   claimsTotal: number;
//   travelAllowance: number;
//   incentives: number;
//   deductions: number;
//   finalSalary: number;
//   payslipPdf?: string;
//   isPaid: boolean;
//   paidAt?: Date;
//   paidBy?: mongoose.Types.ObjectId;
//   notes?: string;
//   isArchived: boolean;
//   createdAt: Date;
//   updatedAt: Date;
// }

// const SalarySchema = new Schema<ISalary>(
//   {
//     organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
//     employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
//     month: { type: Number, required: true, min: 1, max: 12 },
//     year: { type: Number, required: true },
//     baseSalary: { type: Number, required: true, min: 0 },
//     visitChargesTotal: { type: Number, default: 0 },
//     claimsTotal: { type: Number, default: 0 },
//     travelAllowance: { type: Number, default: 0 },
//     incentives: { type: Number, default: 0 },
//     deductions: { type: Number, default: 0 },
//     finalSalary: { type: Number, default: 0 },
//     payslipPdf: { type: String },
//     isPaid: { type: Boolean, default: false },
//     paidAt: { type: Date },
//     paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
//     notes: { type: String },
//     isArchived: { type: Boolean, default: false },
//   },
//   { timestamps: true }
// );

// SalarySchema.index({ employeeId: 1, year: -1, month: -1 });
// SalarySchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

// SalarySchema.pre('save', function (this: ISalary, next) {
//   this.finalSalary = this.baseSalary + this.visitChargesTotal + (this.claimsTotal || 0) + (this.travelAllowance || 0) + this.incentives - this.deductions;
//   next();
// });

// // Virtual: frontend uses "status" ('Calculated' | 'Paid') — derived from isPaid
// SalarySchema.virtual('status').get(function (this: ISalary) { return this.isPaid ? 'Paid' : 'Calculated'; });
// // Virtual: frontend uses "pdfPath" — alias for payslipPdf
// SalarySchema.virtual('pdfPath').get(function (this: ISalary) { return this.payslipPdf; });
// SalarySchema.set('toJSON', { virtuals: true });
// SalarySchema.set('toObject', { virtuals: true });

// export default mongoose.model<ISalary>('Salary', SalarySchema);
import mongoose, { Document, Schema } from 'mongoose';

export interface ISalary extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  month: number;
  year: number;
  
  // Core Salary Components
  basicSalary: number;
  hra: number;           // House Rent Allowance
  lta: number;           // Leave Travel Allowance
  specialAllowance: number;
  
  // Variable Components
  incentives: number;
  overtimePay: number;
  bonuses: number;
  
  // Reimbursements
  travelAllowance: number;
  medicalReimbursement: number;
  conveyance: number;
  
  // Statutory Deductions
  pfDeduction: number;      // Provident Fund (12% of basic)
  esiDeduction: number;      // Employee State Insurance
  professionalTax: number;    // Professional Tax
  tds: number;               // Tax Deducted at Source
  
  // Other Deductions
  loanRepayment: number;
  advanceDeduction: number;
  otherDeductions: number;
  
  // Perquisites (Taxable)
  perquisites: number;
  
  // Auto-calculated totals
  totalEarnings: number;
  totalDeductions: number;
  finalSalary: number;
  
  // Tax declarations (for TDS calculation)
  taxDeclarations: {
    investments80C: number;      // Max ₹1.5L
    medicalInsurance: number;     // Section 80D
    hraRentPaid: number;          // HRA exemption
    homeLoanInterest: number;     // Section 24
    npsContribution: number;      // Section 80CCD(1B)
  };
  
  // Payment & Status
  isPaid: boolean;
  paidAt?: Date;
  paidBy?: mongoose.Types.ObjectId;
  paymentMode?: 'Bank Transfer' | 'Cheque' | 'Cash';
  bankReference?: string;
  
  // Documents
  payslipPdf?: string;
  salaryRegisterPdf?: string;
  
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
    
    // Core Components
    basicSalary: { type: Number, required: true, min: 0 },
    hra: { type: Number, default: 0 },
    lta: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    
    // Variable
    incentives: { type: Number, default: 0 },
    overtimePay: { type: Number, default: 0 },
    bonuses: { type: Number, default: 0 },
    
    // Reimbursements
    travelAllowance: { type: Number, default: 0 },
    medicalReimbursement: { type: Number, default: 0 },
    conveyance: { type: Number, default: 0 },
    
    // Deductions
    pfDeduction: { type: Number, default: 0 },
    esiDeduction: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    loanRepayment: { type: Number, default: 0 },
    advanceDeduction: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    
    // Perquisites
    perquisites: { type: Number, default: 0 },
    
    // Auto-calculated
    totalEarnings: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    finalSalary: { type: Number, default: 0 },
    
    // Tax declarations
    taxDeclarations: {
      investments80C: { type: Number, default: 0 },
      medicalInsurance: { type: Number, default: 0 },
      hraRentPaid: { type: Number, default: 0 },
      homeLoanInterest: { type: Number, default: 0 },
      npsContribution: { type: Number, default: 0 },
    },
    
    // Payment
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
    paymentMode: { type: String, enum: ['Bank Transfer', 'Cheque', 'Cash'] },
    bankReference: { type: String },
    
    // Documents
    payslipPdf: { type: String },
    salaryRegisterPdf: { type: String },
    
    notes: { type: String },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for performance
SalarySchema.index({ employeeId: 1, year: -1, month: -1 });
SalarySchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });
SalarySchema.index({ organizationId: 1, year: 1, month: 1 });
SalarySchema.index({ isPaid: 1 });

// Pre-save middleware to calculate all totals
SalarySchema.pre('save', function (this: ISalary, next) {
  // Calculate total earnings
  this.totalEarnings = 
    this.basicSalary + 
    this.hra + 
    this.lta + 
    this.specialAllowance + 
    this.incentives + 
    this.overtimePay + 
    this.bonuses + 
    this.travelAllowance + 
    this.medicalReimbursement + 
    this.conveyance + 
    this.perquisites;
  
  // Calculate total deductions
  this.totalDeductions = 
    this.pfDeduction + 
    this.esiDeduction + 
    this.professionalTax + 
    this.tds + 
    this.loanRepayment + 
    this.advanceDeduction + 
    this.otherDeductions;
  
  // Final salary
  this.finalSalary = this.totalEarnings - this.totalDeductions;
  
  next();
});

// Virtual for status (frontend compatibility)
SalarySchema.virtual('status').get(function (this: ISalary) { 
  return this.isPaid ? 'Paid' : 'Calculated'; 
});

SalarySchema.virtual('claimsTotal').get(function (this: ISalary) {
  return (this as any)._claimsTotal || 0;
});

SalarySchema.set('toJSON', { virtuals: true });
SalarySchema.set('toObject', { virtuals: true });

export default mongoose.model<ISalary>('Salary', SalarySchema);