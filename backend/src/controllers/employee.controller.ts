import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import User from '../models/User';
import EmployeeDocument from '../models/EmployeeDocument';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';

// GET /api/employees/:id — full employee details
export const getEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await User.findOne({
      _id: req.params.id,
      organizationId: req.user!.organizationId,
    }).select('-password -refreshToken -smtpPass -trustedDevices');
    if (!employee) { sendError(res, 'Employee not found', 404); return; }
    const documents = await EmployeeDocument.find({ employeeId: employee._id })
      .populate('uploadedBy', 'name')
      .sort({ createdAt: -1 });
    sendSuccess(res, { employee, documents });
  } catch { sendError(res, 'Failed to fetch employee', 500); }
};

// PUT /api/employees/:id — update employee profile fields (HR/admin)
export const updateEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowed = ['name', 'phone', 'department', 'baseSalary', 'role', 'isActive'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key];
    }
    // HR cannot change role to admin
    if (req.user!.role === 'hr' && update.role === 'admin') {
      sendError(res, 'HR cannot assign Admin role', 403); return;
    }
    const employee = await User.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user!.organizationId },
      update,
      { new: true, runValidators: true }
    ).select('-password -refreshToken -smtpPass -trustedDevices');
    if (!employee) { sendError(res, 'Employee not found', 404); return; }
    sendSuccess(res, employee, 'Employee updated');
  } catch { sendError(res, 'Failed to update employee', 500); }
};

// POST /api/employees/:id/documents — upload a document for an employee
export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { sendError(res, 'No file uploaded', 400); return; }
    const { label } = req.body;
    if (!label) { sendError(res, 'Document label is required', 400); return; }

    const employee = await User.findOne({ _id: req.params.id, organizationId: req.user!.organizationId });
    if (!employee) { sendError(res, 'Employee not found', 404); return; }

    const fileUrl = `/uploads/employee-docs/${req.file.filename}`;
    const doc = await new EmployeeDocument({
      employeeId:     employee._id,
      organizationId: req.user!.organizationId,
      label,
      fileUrl,
      fileName:   req.file.originalname,
      fileSize:   req.file.size,
      uploadedBy: req.user!.id,
    }).save();

    sendSuccess(res, doc, 'Document uploaded', 201);
  } catch { sendError(res, 'Failed to upload document', 500); }
};

// DELETE /api/employees/:id/documents/:docId — delete a document
export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doc = await EmployeeDocument.findOne({
      _id: req.params.docId,
      organizationId: req.user!.organizationId,
    });
    if (!doc) { sendError(res, 'Document not found', 404); return; }

    // Delete physical file
    const filePath = path.join(process.cwd(), doc.fileUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await doc.deleteOne();
    sendSuccess(res, null, 'Document deleted');
  } catch { sendError(res, 'Failed to delete document', 500); }
};
