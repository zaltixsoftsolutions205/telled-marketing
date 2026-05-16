// import mongoose, { Document, Schema } from 'mongoose';
// import bcrypt from 'bcryptjs';

// export interface IUser extends Document {
//   name: string;
//   email: string;
//   password: string;
//   role: string;  // free-form: admin | manager | sales | engineer | hr | finance | custom...
//   department?: string;
//   phone?: string;
//   baseSalary: number;
//   isActive: boolean;
//   mustSetPassword: boolean;
//   permissions?: string[];           // module access granted to this user
//   canCreateUsers?: boolean;         // whether this user can create other users
//   assignablePermissions?: string[]; // ceiling of permissions this user can grant to sub-users
//   createdBy?: mongoose.Types.ObjectId; // who created this user
//   organizationId: mongoose.Types.ObjectId;
//   refreshToken?: string;
//   // Per-user outbound SMTP (used when sending DRFs / customer emails)
//   smtpHost?: string;
//   smtpPort?: number;
//   smtpUser?: string;
//   smtpPass?: string;
//   smtpSecure?: boolean;
//   useGraphApi?: boolean;  // true for M365 custom domain users where SMTP AUTH is disabled
//   msRefreshToken?: string; // encrypted OAuth2 refresh token for personal Outlook/Hotmail users
//   trustedDevices?: string[];
//   designation?: string;
//   bloodGroup?: string;
//   createdAt: Date;
//   updatedAt: Date;
//   comparePassword(candidatePassword: string): Promise<boolean>;
// }

// const UserSchema = new Schema<IUser>(
//   {
//     name:            { type: String, required: true, trim: true },
//     email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
//     password:        { type: String, required: true, minlength: 6 },
//     role:                   { type: String, required: true },
//     permissions:            { type: [String], default: [] },
//     canCreateUsers:         { type: Boolean, default: false },
//     assignablePermissions:  { type: [String], default: [] },
//     createdBy:              { type: Schema.Types.ObjectId, ref: 'User' },
//     department:      { type: String, trim: true },
//     phone:           { type: String, trim: true },
//     baseSalary:      { type: Number, default: 0, min: 0 },
//     isActive:        { type: Boolean, default: false },
//     mustSetPassword: { type: Boolean, default: true },
//     organizationId:  { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
//     refreshToken:    { type: String },
//     smtpHost:        { type: String, trim: true },
//     smtpPort:        { type: Number },
//     smtpUser:        { type: String, trim: true },
//     smtpPass:        { type: String },
//     smtpSecure:      { type: Boolean },
//     useGraphApi:      { type: Boolean, default: false },
//     msRefreshToken:   { type: String },
//     trustedDevices:   { type: [String], default: [] },
//     designation:      { type: String, trim: true },
//     bloodGroup:       { type: String, trim: true },
//   },
//   { timestamps: true }
// );

// UserSchema.index({ organizationId: 1, role: 1, isActive: 1 });

// UserSchema.pre('save', async function (next) {
//   if (!this.isModified('password')) return next();
//   this.password = await bcrypt.hash(this.password, 12);
//   next();
// });

// UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
//   return bcrypt.compare(candidate, this.password);
// };

// UserSchema.set('toJSON', {
//   transform: (_doc: unknown, ret: Record<string, any>) => {
//     delete ret['password'];
//     delete ret['refreshToken'];
//     delete ret['smtpPass'];
//     delete ret['msRefreshToken'];
//     return ret;
//   },
// });

// export default mongoose.model<IUser>('User', UserSchema);

import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: string;  // free-form: admin | manager | sales | engineer | hr | finance | custom...
  department?: string;
  phone?: string;
  baseSalary: number;
  isActive: boolean;
  mustSetPassword: boolean;
  permissions?: string[];           // module access granted to this user
  canCreateUsers?: boolean;         // whether this user can create other users
  assignablePermissions?: string[]; // ceiling of permissions this user can grant to sub-users
  createdBy?: mongoose.Types.ObjectId; // who created this user
  organizationId: mongoose.Types.ObjectId;
  refreshToken?: string;
  // Per-user outbound SMTP (used when sending DRFs / customer emails)
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  useGraphApi?: boolean;  // true for M365 custom domain users where SMTP AUTH is disabled
  msRefreshToken?: string; // encrypted OAuth2 refresh token for personal Outlook/Hotmail users
  trustedDevices?: string[];
  designation?: string;
  bloodGroup?: string;
  
  // 🔴 ADD THIS SECTION - TAX DECLARATIONS FOR PAYROLL
  taxDeclarations?: {
    investments80C: number;      // Section 80C (PPF, ELSS, LIC, etc.) - Max ₹1,50,000
    medicalInsurance: number;     // Section 80D (Health insurance) - Max ₹25,000/₹50,000
    hraRentPaid: number;          // House Rent Allowance exemption (monthly rent paid)
    homeLoanInterest: number;     // Section 24(b) - Home loan interest
    npsContribution: number;      // Section 80CCD(1B) - NPS additional - Max ₹50,000
    taxRegime: 'old' | 'new';     // Tax regime preference (default: 'new')
    additionalExemptions?: {
      educationLoan?: number;     // Section 80E - Education loan interest
      donation?: number;          // Section 80G - Donations
      medicalExpenses?: number;   // Section 80DDB - Medical expenses
      savingsInterest?: number;   // Section 80TTA - Savings interest (Max ₹10,000)
    };
  };
  
  // Bank details for salary transfer
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    branchName: string;
    upiId?: string;
  };
  
  // PF/ESI details
  statutoryDetails?: {
    pfNumber?: string;
    esiNumber?: string;
    uanNumber?: string;           // Universal Account Number for PF
    panNumber?: string;
    aadharNumber?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name:            { type: String, required: true, trim: true },
    email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:        { type: String, required: true, minlength: 6 },
    role:            { type: String, required: true },
    permissions:     { type: [String], default: [] },
    canCreateUsers:  { type: Boolean, default: false },
    assignablePermissions: { type: [String], default: [] },
    createdBy:       { type: Schema.Types.ObjectId, ref: 'User' },
    department:      { type: String, trim: true },
    phone:           { type: String, trim: true },
    baseSalary:      { type: Number, default: 0, min: 0 },
    isActive:        { type: Boolean, default: false },
    mustSetPassword: { type: Boolean, default: true },
    organizationId:  { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    refreshToken:    { type: String },
    smtpHost:        { type: String, trim: true },
    smtpPort:        { type: Number },
    smtpUser:        { type: String, trim: true },
    smtpPass:        { type: String },
    smtpSecure:      { type: Boolean },
    useGraphApi:     { type: Boolean, default: false },
    msRefreshToken:  { type: String },
    trustedDevices:  { type: [String], default: [] },
    designation:     { type: String, trim: true },
    bloodGroup:      { type: String, trim: true },
    
    // 🔴 ADD TAX DECLARATIONS HERE
    taxDeclarations: {
      investments80C: { type: Number, default: 0, min: 0, max: 150000 },
      medicalInsurance: { type: Number, default: 0, min: 0, max: 50000 },
      hraRentPaid: { type: Number, default: 0, min: 0 },
      homeLoanInterest: { type: Number, default: 0, min: 0 },
      npsContribution: { type: Number, default: 0, min: 0, max: 50000 },
      taxRegime: { type: String, enum: ['old', 'new'], default: 'new' },
      additionalExemptions: {
        educationLoan: { type: Number, default: 0 },
        donation: { type: Number, default: 0 },
        medicalExpenses: { type: Number, default: 0 },
        savingsInterest: { type: Number, default: 0, max: 10000 },
      },
    },
    
    // Bank details
    bankDetails: {
      accountName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true, uppercase: true },
      bankName: { type: String, trim: true },
      branchName: { type: String, trim: true },
      upiId: { type: String, trim: true },
    },
    
    // PF/ESI details
    statutoryDetails: {
      pfNumber: { type: String, trim: true },
      esiNumber: { type: String, trim: true },
      uanNumber: { type: String, trim: true },
      panNumber: { type: String, trim: true, uppercase: true },
      aadharNumber: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

// Indexes
UserSchema.index({ organizationId: 1, role: 1, isActive: 1 });
UserSchema.index({ organizationId: 1, 'statutoryDetails.pfNumber': 1 });
UserSchema.index({ organizationId: 1, 'statutoryDetails.uanNumber': 1 });

// Pre-save middleware
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Methods
UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Helper method to calculate annual tax saving declarations
UserSchema.methods.getTotalTaxDeclarations = function(): number {
  const decl = this.taxDeclarations || {};
  let total = 0;
  
  total += Math.min(decl.investments80C || 0, 150000);
  total += Math.min(decl.medicalInsurance || 0, 50000);
  total += Math.min(decl.npsContribution || 0, 50000);
  
  // Additional exemptions
  const additional = decl.additionalExemptions || {};
  total += additional.educationLoan || 0;
  total += additional.donation || 0;
  total += additional.medicalExpenses || 0;
  total += Math.min(additional.savingsInterest || 0, 10000);
  
  return total;
};

// Helper method to calculate HRA exemption
UserSchema.methods.getHRAExemption = function(basicSalary: number, hraReceived: number): number {
  const rentPaid = this.taxDeclarations?.hraRentPaid || 0;
  const rentPaidAnnual = rentPaid * 12;
  
  const calculations = [
    hraReceived,
    rentPaidAnnual - (basicSalary * 0.1),
    0.5 * basicSalary // 0.5 for metro, 0.4 for non-metro (simplified)
  ];
  
  return Math.max(0, Math.min(...calculations));
};

// To JSON transform
UserSchema.set('toJSON', {
  transform: (_doc: unknown, ret: Record<string, any>) => {
    delete ret['password'];
    delete ret['refreshToken'];
    delete ret['smtpPass'];
    delete ret['msRefreshToken'];
    // Remove sensitive bank details (keep only necessary)
    if (ret.bankDetails) {
      // Keep account info but remove sensitive transforms if needed
    }
    return ret;
  },
});

export default mongoose.model<IUser>('User', UserSchema);
