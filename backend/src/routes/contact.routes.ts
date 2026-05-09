import { Router } from 'express';
import {
  getContacts,
  getContactById,
  getContactsByAccount,
  createContact,
  updateContact,
  deleteContact,
} from '../controllers/contact.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = Router();
router.use(authenticate);

const allRoles = authorize('admin', 'manager', 'sales', 'engineer', 'hr', 'finance');

// All roles can view contacts
router.get('/', allRoles, getContacts);
router.get('/account/:accountId', allRoles, getContactsByAccount);
router.get('/:id', allRoles, getContactById);

// Create: all roles (HR restricted to TELLED in controller)
router.post('/', allRoles, createContact);

// Update & Delete: permissions enforced per-record in controller
router.put('/:id', allRoles, updateContact);
router.delete('/:id', allRoles, deleteContact);

export default router;
