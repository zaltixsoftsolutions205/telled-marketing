import mongoose, { Document, Schema } from 'mongoose';

export interface IInternalNote { note: string; addedBy: mongoose.Types.ObjectId; addedAt: Date; }

export interface ISupportTicket extends Document {
  accountId: mongoose.Types.ObjectId;
  ticketId: string;
  subject: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed' | 'Reopened';
  assignedEngineer?: mongoose.Types.ObjectId;
  internalNotes: IInternalNote[];
  lastResponseAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  closedBy?: mongoose.Types.ObjectId;
  autoClosedAt?: Date;
  reopenedAt?: Date;
  reopenCount: number;
  parentTicketId?: mongoose.Types.ObjectId;
  customerFeedback?: string;
  customerFeedbackAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<IInternalNote>(
  { note: { type: String, required: true }, addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, addedAt: { type: Date, default: Date.now } },
  { _id: false }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    ticketId: { type: String, required: true, unique: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed', 'Reopened'], default: 'Open' },
    assignedEngineer: { type: Schema.Types.ObjectId, ref: 'User' },
    internalNotes: { type: [NoteSchema], default: [] },
    lastResponseAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    autoClosedAt: { type: Date },
    reopenedAt: { type: Date },
    reopenCount: { type: Number, default: 0 },
    parentTicketId: { type: Schema.Types.ObjectId, ref: 'SupportTicket' },
    customerFeedback: { type: String },
    customerFeedbackAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ accountId: 1, status: 1 });
SupportTicketSchema.index({ assignedEngineer: 1, status: 1 });
SupportTicketSchema.index({ lastResponseAt: 1, status: 1 });

export default mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);
