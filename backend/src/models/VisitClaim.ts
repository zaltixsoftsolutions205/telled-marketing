import mongoose, { Document, Schema } from 'mongoose';

export interface IVisitClaim extends Document {
  visitId: mongoose.Types.ObjectId;
  engineerId: mongoose.Types.ObjectId;
  accountId?: mongoose.Types.ObjectId;
  claimDate: Date;
  claimNumber: string;
  expenses: {
    type: 'travel' | 'food' | 'accommodation' | 'materials' | 'other';
    description: string;
    amount: number;
    receipt?: string;
    date: Date;
  }[];
  totalAmount: number;
  currency: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
  submittedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  approvalNotes?: string;
  paidAt?: Date;
  paymentReference?: string;
  notes?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema({
  type: {
    type: String,
    enum: ['travel', 'food', 'accommodation', 'materials', 'other'],
    required: true
  },
  description: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  receipt: { type: String },
  date: { type: Date, required: true, default: Date.now }
});

const VisitClaimSchema = new Schema<IVisitClaim>(
  {
    visitId: { type: Schema.Types.ObjectId, ref: 'EngineerVisit', required: true },
    engineerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
    claimDate: { type: Date, required: true, default: Date.now },
    claimNumber: { type: String, required: true, unique: true },
    expenses: [ExpenseSchema],
    totalAmount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'paid'],
      default: 'draft'
    },
    submittedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
    approvalNotes: { type: String },
    paidAt: { type: Date },
    paymentReference: { type: String },
    notes: { type: String },
    isArchived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Generate claim number before saving
VisitClaimSchema.pre('save', async function() {
  console.log('VisitClaim pre-save hook fired. Current claimNumber:', this.claimNumber);

  if (!this.claimNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const VisitClaim = mongoose.model('VisitClaim');

    // Count existing claims for the current month to generate sequential claim number
    const count = await VisitClaim.countDocuments({
      createdAt: {
        $gte: new Date(year, new Date().getMonth(), 1),
        $lt: new Date(year, new Date().getMonth() + 1, 1)
      }
    });

    this.claimNumber = `CLM/${year}/${month}/${String(count + 1).padStart(4, '0')}`;
  }

  // Calculate total amount
  this.totalAmount = this.expenses.reduce((sum, exp) => sum + exp.amount, 0);
});

VisitClaimSchema.index({ engineerId: 1, status: 1 });
VisitClaimSchema.index({ visitId: 1 });
VisitClaimSchema.index({ status: 1, submittedAt: -1 });

export default mongoose.model<IVisitClaim>('VisitClaim', VisitClaimSchema);