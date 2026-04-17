import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { upload } from '../middleware/upload.middleware';
import { sendSuccess, sendError } from '../utils/response';
import fs from 'fs';
import path from 'path';

const router = Router();
router.use(authenticate);

const SETTINGS_FILE = path.join(process.cwd(), 'uploads', 'settings.json');

function readSettings(): Record<string, string> {
  try {
    if (fs.existsSync(SETTINGS_FILE)) return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {}
  return {};
}

function writeSettings(data: Record<string, string>) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

// GET logo URL
router.get('/logo', (_req: AuthRequest, res: Response) => {
  const settings = readSettings();
  sendSuccess(res, { logoUrl: settings.logoUrl || null });
});

// Upload logo — admin only
router.post('/logo', authorize('admin'), upload.single('logo'), (req: AuthRequest, res: Response) => {
  if (!req.file) { sendError(res, 'No file uploaded', 400); return; }
  const allowed = /\.(jpeg|jpg|png|gif|webp|svg)$/i;
  if (!allowed.test(req.file.originalname)) { sendError(res, 'Only image files allowed', 400); return; }
  const logoUrl = `/uploads/${req.file.filename}`;
  const settings = readSettings();
  // Delete old logo file if exists
  if (settings.logoUrl) {
    const oldPath = path.join(process.cwd(), settings.logoUrl);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  settings.logoUrl = logoUrl;
  writeSettings(settings);
  sendSuccess(res, { logoUrl }, 'Logo uploaded successfully');
});

// Delete logo — admin only
router.delete('/logo', authorize('admin'), (req: AuthRequest, res: Response) => {
  const settings = readSettings();
  if (settings.logoUrl) {
    const oldPath = path.join(process.cwd(), settings.logoUrl);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  delete settings.logoUrl;
  writeSettings(settings);
  sendSuccess(res, { logoUrl: null }, 'Logo removed');
});

export default router;
