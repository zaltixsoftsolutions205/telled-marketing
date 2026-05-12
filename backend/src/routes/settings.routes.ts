import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { upload } from '../middleware/upload.middleware';
import { sendSuccess, sendError } from '../utils/response';
import Organization from '../models/Organization';
import fs from 'fs';
import path from 'path';

const router = Router();
router.use(authenticate);

function settingsFile(orgId: string): string {
  return path.join(process.cwd(), 'uploads', `settings_${orgId}.json`);
}

function readSettings(orgId: string): Record<string, string> {
  try {
    const file = settingsFile(orgId);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  return {};
}

function writeSettings(orgId: string, data: Record<string, string>) {
  fs.writeFileSync(settingsFile(orgId), JSON.stringify(data, null, 2));
}

// GET logo URL — scoped to requesting user's organization
router.get('/logo', (req: AuthRequest, res: Response) => {
  const settings = readSettings(req.user!.organizationId);
  sendSuccess(res, { logoUrl: settings.logoUrl || null });
});

// Upload logo — admin only, scoped to org
router.post('/logo', authorize('admin'), upload.single('logo'), (req: AuthRequest, res: Response) => {
  if (!req.file) { sendError(res, 'No file uploaded', 400); return; }
  const allowed = /\.(jpeg|jpg|png|gif|webp|svg)$/i;
  if (!allowed.test(req.file.originalname)) { sendError(res, 'Only image files allowed', 400); return; }
  const logoUrl = `/uploads/${req.file.filename}`;
  const orgId = req.user!.organizationId;
  const settings = readSettings(orgId);
  if (settings.logoUrl) {
    const oldPath = path.join(process.cwd(), settings.logoUrl);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  settings.logoUrl = logoUrl;
  writeSettings(orgId, settings);
  sendSuccess(res, { logoUrl }, 'Logo uploaded successfully');
});

// Delete logo — admin only, scoped to org
router.delete('/logo', authorize('admin'), (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const settings = readSettings(orgId);
  if (settings.logoUrl) {
    const oldPath = path.join(process.cwd(), settings.logoUrl);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  delete settings.logoUrl;
  writeSettings(orgId, settings);
  sendSuccess(res, { logoUrl: null }, 'Logo removed');
});

// ── Attendance settings ──

router.get('/attendance', async (req: AuthRequest, res: Response) => {
  try {
    const org = await Organization.findById(req.user!.organizationId).select('attendanceSettings').lean();
    const defaults = { activeMethod: 'none', geo: { name: '', lat: null, lng: null, radius: 100 }, biometric: { requestSent: false }, face: { employees: [] } };
    sendSuccess(res, (org as any)?.attendanceSettings || defaults);
  } catch { sendError(res, 'Failed to fetch attendance settings', 500); }
});

router.put('/attendance', authorize('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  try {
    const org = await Organization.findByIdAndUpdate(
      req.user!.organizationId,
      { $set: { attendanceSettings: req.body } },
      { new: true }
    );
    if (!org) { sendError(res, 'Organization not found', 404); return; }
    sendSuccess(res, (org as any).attendanceSettings, 'Attendance settings saved');
  } catch { sendError(res, 'Failed to save attendance settings', 500); }
});

// ── Leave policy ──

const DEFAULT_LEAVE_POLICY = { Casual: 12, Sick: 6, Annual: 15, Unpaid: 0 };

router.get('/leave-policy', async (req: AuthRequest, res: Response) => {
  try {
    const org = await Organization.findById(req.user!.organizationId).select('leavePolicy').lean();
    sendSuccess(res, (org as any)?.leavePolicy || DEFAULT_LEAVE_POLICY);
  } catch { sendError(res, 'Failed to fetch leave policy', 500); }
});

router.put('/leave-policy', authorize('admin', 'hr'), async (req: AuthRequest, res: Response) => {
  try {
    const org = await Organization.findByIdAndUpdate(
      req.user!.organizationId,
      { $set: { leavePolicy: req.body } },
      { new: true }
    );
    if (!org) { sendError(res, 'Organization not found', 404); return; }
    sendSuccess(res, (org as any).leavePolicy, 'Leave policy saved');
  } catch { sendError(res, 'Failed to save leave policy', 500); }
});

export default router;
