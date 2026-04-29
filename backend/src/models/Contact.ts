// import mongoose, { Document, Schema } from 'mongoose';

// export type ContactType = 'TELLED' | 'ARK' | 'CUSTOMER';

// export interface IContact extends Document {
//   name: string;
//   email: string;
//   phone: string;
//   designation?: string;
//   companyName?: string;
//   contactType: ContactType;
//   linkedAccountId?: mongoose.Types.ObjectId;
//   notes?: string;
//   organizationId: mongoose.Types.ObjectId;
//   createdBy: mongoose.Types.ObjectId;
//   createdAt: Date;
//   updatedAt: Date;
// }

// const ContactSchema = new Schema<IContact>(
//   {
//     name:        { type: String, required: true, trim: true },
//     email:       { type: String, required: true, lowercase: true, trim: true },
//     phone:       { type: String, trim: true, default: '' },
//     designation: { type: String, trim: true },
//     companyName: { type: String, trim: true },
//     contactType: {
//       type: String,
//       enum: ['TELLED', 'ARK', 'CUSTOMER'],
//       required: true,
//     },
//     linkedAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
//     notes:           { type: String },
//     organizationId:  { type: Schema.Types.ObjectId, required: true },
//     createdBy:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
//   },
//   { timestamps: true }
// );

// ContactSchema.index({ organizationId: 1, contactType: 1 });
// ContactSchema.index({ organizationId: 1, linkedAccountId: 1 });
// ContactSchema.index({ name: 'text', email: 'text', companyName: 'text' });

// export default mongoose.model<IContact>('Contact', ContactSchema);
import mongoose, { Document, Schema } from 'mongoose';

export type ContactType = 'TELLED' | 'ARK' | 'ANSYS' | 'CUSTOMER';
export type CustomerResponsibility = 'Technical' | 'Sales' | 'IT' | 'Procurement';

export interface IContact extends Document {
  name: string;
  email: string;
  phone: string;
  designation?: string;
  companyName?: string;
  contactType: ContactType;
  customerResponsibility?: CustomerResponsibility;
  linkedAccountId?: mongoose.Types.ObjectId;
  notes?: string;
  organizationId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    name:        { type: String, required: true, trim: true },
    email:       { type: String, required: true, lowercase: true, trim: true },
    phone:       { type: String, trim: true, default: '' },
    designation: { type: String, trim: true },
    companyName: { type: String, trim: true },
    contactType: {
      type: String,
      enum: ['TELLED', 'ARK', 'ANSYS', 'CUSTOMER'],
      required: true,
    },
    customerResponsibility: {
      type: String,
      enum: ['Technical', 'Sales', 'IT', 'Procurement'],
      validate: {
        validator: function(this: IContact, value: CustomerResponsibility) {
          // Only CUSTOMER contacts can have customerResponsibility
          if (value && this.contactType !== 'CUSTOMER') {
            return false;
          }
          return true;
        },
        message: 'customerResponsibility is only allowed for CUSTOMER contacts'
      }
    },
    linkedAccountId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Account',
      validate: {
        validator: function(this: IContact, value: mongoose.Types.ObjectId) {
          // Only CUSTOMER contacts can have linkedAccountId
          if (value && this.contactType !== 'CUSTOMER') {
            return false;
          }
          return true;
        },
        message: 'linkedAccountId is only allowed for CUSTOMER contacts'
      }
    },
    notes:           { type: String },
    organizationId:  { type: Schema.Types.ObjectId, required: true },
    createdBy:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Add middleware to clear incompatible fields based on contactType
ContactSchema.pre('save', function(next) {
  if (this.contactType !== 'CUSTOMER') {
    this.customerResponsibility = undefined;
    this.linkedAccountId = undefined;
  }
  next();
});

ContactSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() as any;
  if (update.contactType && update.contactType !== 'CUSTOMER') {
    update.customerResponsibility = undefined;
    update.linkedAccountId = undefined;
  }
  next();
});

// Indexes
ContactSchema.index({ organizationId: 1, contactType: 1 });
ContactSchema.index({ organizationId: 1, linkedAccountId: 1 });
ContactSchema.index({ name: 'text', email: 'text', companyName: 'text' });

export default mongoose.model<IContact>('Contact', ContactSchema);