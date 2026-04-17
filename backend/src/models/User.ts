import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'sales' | 'engineer' | 'hr_finance' | 'platform_admin';
  department?: string;
  phone?: string;
  baseSalary: number;
  isActive: boolean;
  mustSetPassword: boolean;   // true until user sets their own password
  organizationId: mongoose.Types.ObjectId;
  refreshToken?: string;
  // Per-user outbound SMTP (used when sending DRFs / customer emails)
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name:            { type: String, required: true, trim: true },
    email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:        { type: String, required: true, minlength: 6 },
    role:            { type: String, enum: ['admin', 'sales', 'engineer', 'hr_finance', 'platform_admin'], required: true },
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
  },
  { timestamps: true }
);

UserSchema.index({ organizationId: 1, role: 1, isActive: 1 });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

UserSchema.set('toJSON', {
  transform: (_doc: unknown, ret: Record<string, any>) => {
    delete ret['password'];
    delete ret['refreshToken'];
    delete ret['smtpPass'];
    return ret;
  },
});

export default mongoose.model<IUser>('User', UserSchema);
