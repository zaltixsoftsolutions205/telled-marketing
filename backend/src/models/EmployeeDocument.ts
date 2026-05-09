import mongoose, { Document, Schema } from 'mongoose';

export interface IEmployeeDocument extends Document {
  employeeId:     mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  label:          string;   // e.g. "Aadhar Card", "Resume", "Offer Letter"
  fileUrl:        string;
  fileName:       string;
  fileSize?:      number;
  uploadedBy:     mongoose.Types.ObjectId;
  createdAt:      Date;
  updatedAt:      Date;
}

const EmployeeDocumentSchema = new Schema<IEmployeeDocument>(
  {
    employeeId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    label:          { type: String, required: true, trim: true },
    fileUrl:        { type: String, required: true },
    fileName:       { type: String, required: true },
    fileSize:       { type: Number },
    uploadedBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

EmployeeDocumentSchema.index({ employeeId: 1 });

export default mongoose.model<IEmployeeDocument>('EmployeeDocument', EmployeeDocumentSchema);
