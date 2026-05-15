// import mongoose, { Document, Schema } from 'mongoose';

// export interface IAccount extends Document {
//   organizationId: mongoose.Types.ObjectId;
//   leadId: mongoose.Types.ObjectId;
//   companyName: string;
//   contactName: string;
//   contactEmail: string;
//   phone: string;
//   address?: string;
//   city?: string;
//   state?: string;
//   pincode?: string;
//   gstNumber?: string;
//   panNumber?: string;
//   asc?: string;
//   licenseProductDetails?: string;
//   licenseVersion?: string;
//   licenseStartDate?: Date;
//   licenseExpiryDate?: Date;
//   assignedEngineer?: mongoose.Types.ObjectId;
//   assignedSales: mongoose.Types.ObjectId;
//   status: 'Active' | 'Inactive' | 'Suspended';
//   salesStatus?: string;
//   isArchived: boolean;
//   createdAt: Date;
//   updatedAt: Date;
// }

// const AccountSchema = new Schema<IAccount>(
//   {
//     organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
//     leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, unique: true },
//     accountNumber: { type: String, unique: true, sparse: true }, // Add this field
//     companyName: { type: String, required: true, trim: true },
//     contactName: { type: String, default: '', trim: true },
//     contactEmail: { type: String, default: '', lowercase: true },
//     phone: { type: String, default: '' },
//     address: { type: String },
//     city: { type: String },
//     state: { type: String },
//     pincode: { type: String },
//     gstNumber: { type: String },
//     panNumber: { type: String },
//     asc: { type: String, default: '', trim: true },
//     licenseProductDetails: { type: String, default: '', trim: true },
//     licenseVersion: { type: String, default: '', trim: true },
//     licenseStartDate: { type: Date },
//     licenseExpiryDate: { type: Date },
//     assignedEngineer: { type: Schema.Types.ObjectId, ref: 'User' },
//     assignedSales: { type: Schema.Types.ObjectId, ref: 'User' },
//     status: { type: String, enum: ['Active', 'Inactive', 'Suspended'], default: 'Active' },
//     salesStatus: { type: String, default: 'Closed, and now a Customer' },
//     isArchived: { type: Boolean, default: false },
//   },
//   { timestamps: true }
// );

// // Add index for accountNumber
// AccountSchema.index({ accountNumber: 1 });

// AccountSchema.index({ organizationId: 1 });
// AccountSchema.index({ assignedEngineer: 1 });
// AccountSchema.index({ assignedSales: 1 });
// AccountSchema.index({ contactEmail: 1 });
// AccountSchema.index({ companyName: 'text', contactName: 'text' });

// // Virtual: frontend uses "accountName" — alias for companyName
// AccountSchema.virtual('accountName').get(function () { return this.companyName; });
// AccountSchema.set('toJSON', { virtuals: true });
// AccountSchema.set('toObject', { virtuals: true });

// export default mongoose.model<IAccount>('Account', AccountSchema);

import mongoose, { Document, Schema } from 'mongoose';

export interface IAccount extends Document {
  organizationId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  accountNumber?: string; // Added account number field
  companyName: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  panNumber?: string;
  asc?: string;
  licenseProductDetails?: string;
  licenseVersion?: string;
  licenseStartDate?: Date;
  licenseExpiryDate?: Date;
  assignedEngineer?: mongoose.Types.ObjectId;
  assignedSales: mongoose.Types.ObjectId;
  status: 'Active' | 'Inactive' | 'Suspended';
  salesStatus?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, unique: true },
    accountNumber: { 
      type: String, 
      unique: true, 
      sparse: true,
      trim: true,
      index: true 
    },
    companyName: { type: String, required: true, trim: true },
    contactName: { type: String, default: '', trim: true },
    contactEmail: { type: String, default: '', lowercase: true },
    phone: { type: String, default: '' },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    asc: { type: String, default: '', trim: true },
    licenseProductDetails: { type: String, default: '', trim: true },
    licenseVersion: { type: String, default: '', trim: true },
    licenseStartDate: { type: Date },
    licenseExpiryDate: { type: Date },
    assignedEngineer: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedSales: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['Active', 'Inactive', 'Suspended'], default: 'Active' },
    salesStatus: { type: String, default: 'Closed, and now a Customer' },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes
AccountSchema.index({ accountNumber: 1 });
AccountSchema.index({ organizationId: 1 });
AccountSchema.index({ assignedEngineer: 1 });
AccountSchema.index({ assignedSales: 1 });
AccountSchema.index({ contactEmail: 1 });
AccountSchema.index({ companyName: 'text', contactName: 'text' });

// Virtual: frontend uses "accountName" — alias for companyName
AccountSchema.virtual('accountName').get(function() { 
  return this.companyName; 
});

// Transform toJSON to include virtuals and handle accountNumber
AccountSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete (ret as any).__v;
    return ret;
  }
});
AccountSchema.set('toObject', { virtuals: true });

// Pre-save middleware to ensure accountNumber is unique if provided
AccountSchema.pre('save', async function(next) {
  if (this.accountNumber) {
    const existingAccount = await mongoose.model('Account').findOne({
      accountNumber: this.accountNumber,
      _id: { $ne: this._id }
    });
    if (existingAccount) {
      next(new Error('Account number already exists'));
    }
  }
  next();
});

export default mongoose.model<IAccount>('Account', AccountSchema);