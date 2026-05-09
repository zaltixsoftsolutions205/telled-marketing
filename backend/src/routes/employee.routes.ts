import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { getEmployee, updateEmployee, uploadDocument, deleteDocument } from '../controllers/employee.controller';

const uploadDir = path.join(process.cwd(), 'uploads', 'employee-docs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename:    (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();
router.use(authenticate);

router.get('/:id',                    authorize('admin', 'manager', 'hr'),                    getEmployee);
router.put('/:id',                    authorize('admin', 'manager', 'hr'),                    updateEmployee);
router.post('/:id/documents',         authorize('admin', 'manager', 'hr'), upload.single('file'), uploadDocument);
router.delete('/:id/documents/:docId', authorize('admin', 'manager', 'hr'),                   deleteDocument);

export default router;
