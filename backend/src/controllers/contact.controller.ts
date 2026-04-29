// import { Response } from 'express';
// import Contact from '../models/Contact';
// import { AuthRequest } from '../middleware/auth.middleware';
// import { sendSuccess, sendError, sendPaginated } from '../utils/response';
// import { getPaginationParams, sanitizeQuery } from '../utils/helpers';

// export const getContacts = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { page, limit, skip } = getPaginationParams(req);
//     const { contactType, search } = req.query;

//     const filter: Record<string, unknown> = {
//       organizationId: req.user!.organizationId,
//     };

//     if (contactType) filter.contactType = contactType;

//     if (search) {
//       const s = sanitizeQuery(search as string);
//       filter.$or = [
//         { name:        { $regex: s, $options: 'i' } },
//         { email:       { $regex: s, $options: 'i' } },
//         { companyName: { $regex: s, $options: 'i' } },
//       ];
//     }

//     const [contacts, total] = await Promise.all([
//       Contact.find(filter)
//         .populate('createdBy', 'name email')
//         .populate('linkedAccountId', 'accountName')
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit),
//       Contact.countDocuments(filter),
//     ]);

//     sendPaginated(res, contacts, total, page, limit);
//   } catch {
//     sendError(res, 'Failed to fetch contacts', 500);
//   }
// };

// export const getContactById = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const contact = await Contact.findOne({
//       _id: req.params.id,
//       organizationId: req.user!.organizationId,
//     })
//       .populate('createdBy', 'name email')
//       .populate('linkedAccountId', 'accountName');

//     if (!contact) { sendError(res, 'Contact not found', 404); return; }
//     sendSuccess(res, contact);
//   } catch {
//     sendError(res, 'Failed to fetch contact', 500);
//   }
// };

// export const getContactsByAccount = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const contacts = await Contact.find({
//       linkedAccountId: req.params.accountId,
//       organizationId: req.user!.organizationId,
//     })
//       .populate('createdBy', 'name email')
//       .sort({ createdAt: -1 });

//     sendSuccess(res, contacts);
//   } catch {
//     sendError(res, 'Failed to fetch contacts for account', 500);
//   }
// };

// export const createContact = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { role } = req.user!;

//     // HR can only create TELLED contacts
//     if (role === 'hr_finance' && req.body.contactType !== 'TELLED') {
//       sendError(res, 'HR & Finance can only create Telled internal contacts', 403);
//       return;
//     }

//     const contact = await new Contact({
//       ...req.body,
//       organizationId: req.user!.organizationId,
//       createdBy: req.user!.id,
//     }).save();

//     const populated = await contact.populate([
//       { path: 'createdBy', select: 'name email' },
//       { path: 'linkedAccountId', select: 'accountName' },
//     ]);

//     sendSuccess(res, populated, 'Contact created', 201);
//   } catch (e: unknown) {
//     const msg = (e as { message?: string })?.message || 'Failed to create contact';
//     sendError(res, msg, 400);
//   }
// };

// export const updateContact = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { role, id } = req.user!;

//     const contact = await Contact.findOne({
//       _id: req.params.id,
//       organizationId: req.user!.organizationId,
//     });

//     if (!contact) { sendError(res, 'Contact not found', 404); return; }

//     if (role === 'admin') {
//       // Admin can edit all contacts
//     } else if (role === 'hr_finance') {
//       // HR can only edit TELLED contacts
//       if (contact.contactType !== 'TELLED') {
//         sendError(res, 'HR & Finance can only edit Telled internal contacts', 403);
//         return;
//       }
//     } else {
//       // Sales and Engineer can only edit contacts they created
//       if (contact.createdBy.toString() !== id) {
//         sendError(res, 'You can only edit contacts you created', 403);
//         return;
//       }
//     }

//     const updated = await Contact.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       { new: true, runValidators: true }
//     )
//       .populate('createdBy', 'name email')
//       .populate('linkedAccountId', 'accountName');

//     sendSuccess(res, updated, 'Contact updated');
//   } catch (e: unknown) {
//     const msg = (e as { message?: string })?.message || 'Failed to update contact';
//     sendError(res, msg, 400);
//   }
// };

// export const deleteContact = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { role, id } = req.user!;

//     const contact = await Contact.findOne({
//       _id: req.params.id,
//       organizationId: req.user!.organizationId,
//     });

//     if (!contact) { sendError(res, 'Contact not found', 404); return; }

//     if (role === 'admin') {
//       // Admin can delete all contacts
//     } else if (role === 'hr_finance') {
//       // HR can only delete TELLED contacts
//       if (contact.contactType !== 'TELLED') {
//         sendError(res, 'HR & Finance can only delete Telled internal contacts', 403);
//         return;
//       }
//     } else {
//       // Sales and Engineer can only delete contacts they created
//       if (contact.createdBy.toString() !== id) {
//         sendError(res, 'You can only delete contacts you created', 403);
//         return;
//       }
//     }

//     await Contact.findByIdAndDelete(req.params.id);
//     sendSuccess(res, null, 'Contact deleted');
//   } catch {
//     sendError(res, 'Failed to delete contact', 500);
//   }
// };
import { Response } from 'express';
import Contact from '../models/Contact';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams, sanitizeQuery } from '../utils/helpers';

export const getContacts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { contactType, search, customerResponsibility } = req.query;

    const filter: Record<string, unknown> = {
      organizationId: req.user!.organizationId,
    };

    if (contactType) filter.contactType = contactType;
    
    // Add responsibility filter for customer contacts
    if (customerResponsibility) {
      filter.customerResponsibility = customerResponsibility;
    }

    if (search) {
      const s = sanitizeQuery(search as string);
      filter.$or = [
        { name:        { $regex: s, $options: 'i' } },
        { email:       { $regex: s, $options: 'i' } },
        { companyName: { $regex: s, $options: 'i' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      Contact.find(filter)
        .populate('createdBy', 'name email')
        .populate('linkedAccountId', 'accountName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Contact.countDocuments(filter),
    ]);

    sendPaginated(res, contacts, total, page, limit);
  } catch {
    sendError(res, 'Failed to fetch contacts', 500);
  }
};

export const getContactById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      organizationId: req.user!.organizationId,
    })
      .populate('createdBy', 'name email')
      .populate('linkedAccountId', 'accountName');

    if (!contact) { sendError(res, 'Contact not found', 404); return; }
    sendSuccess(res, contact);
  } catch {
    sendError(res, 'Failed to fetch contact', 500);
  }
};

export const getContactsByAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const contacts = await Contact.find({
      linkedAccountId: req.params.accountId,
      organizationId: req.user!.organizationId,
    })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    sendSuccess(res, contacts);
  } catch {
    sendError(res, 'Failed to fetch contacts for account', 500);
  }
};

export const createContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.user!;

    // HR can only create TELLED contacts
    if (role === 'hr_finance' && req.body.contactType !== 'TELLED') {
      sendError(res, 'HR & Finance can only create Telled internal contacts', 403);
      return;
    }

    // Validate ANSYS contacts don't have responsibility or linked account
    if (req.body.contactType === 'ANSYS') {
      if (req.body.customerResponsibility) {
        sendError(res, 'ANSYS contacts cannot have a responsibility assigned', 400);
        return;
      }
      if (req.body.linkedAccountId) {
        sendError(res, 'ANSYS contacts cannot be linked to an account', 400);
        return;
      }
    }

    // Validate ARK contacts don't have responsibility or linked account
    if (req.body.contactType === 'ARK') {
      if (req.body.customerResponsibility) {
        sendError(res, 'ARK contacts cannot have a responsibility assigned', 400);
        return;
      }
      if (req.body.linkedAccountId) {
        sendError(res, 'ARK contacts cannot be linked to an account', 400);
        return;
      }
    }

    // Validate TELLED contacts don't have responsibility or linked account
    if (req.body.contactType === 'TELLED') {
      if (req.body.customerResponsibility) {
        sendError(res, 'TELLED contacts cannot have a responsibility assigned', 400);
        return;
      }
      if (req.body.linkedAccountId) {
        sendError(res, 'TELLED contacts cannot be linked to an account', 400);
        return;
      }
    }

    const contact = await new Contact({
      ...req.body,
      organizationId: req.user!.organizationId,
      createdBy: req.user!.id,
    }).save();

    const populated = await contact.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'linkedAccountId', select: 'accountName' },
    ]);

    sendSuccess(res, populated, 'Contact created', 201);
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message || 'Failed to create contact';
    sendError(res, msg, 400);
  }
};

export const updateContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, id } = req.user!;

    const contact = await Contact.findOne({
      _id: req.params.id,
      organizationId: req.user!.organizationId,
    });

    if (!contact) { sendError(res, 'Contact not found', 404); return; }

    // Permission checks
    if (role === 'admin') {
      // Admin can edit all contacts
    } else if (role === 'hr_finance') {
      // HR can only edit TELLED contacts
      if (contact.contactType !== 'TELLED') {
        sendError(res, 'HR & Finance can only edit Telled internal contacts', 403);
        return;
      }
    } else {
      // Sales and Engineer can only edit contacts they created
      if (contact.createdBy.toString() !== id) {
        sendError(res, 'You can only edit contacts you created', 403);
        return;
      }
    }

    // Prevent changing contact type if not allowed
    if (req.body.contactType && req.body.contactType !== contact.contactType) {
      if (role !== 'admin') {
        sendError(res, 'Only admins can change contact type', 403);
        return;
      }
    }

    // Validate field compatibility for the target contact type
    const targetType = req.body.contactType || contact.contactType;
    
    if (targetType === 'ANSYS') {
      if (req.body.customerResponsibility || contact.customerResponsibility) {
        sendError(res, 'ANSYS contacts cannot have a responsibility assigned', 400);
        return;
      }
      if (req.body.linkedAccountId || contact.linkedAccountId) {
        sendError(res, 'ANSYS contacts cannot be linked to an account', 400);
        return;
      }
      // Clear these fields if they exist
      req.body.customerResponsibility = undefined;
      req.body.linkedAccountId = undefined;
    }

    if (targetType === 'ARK') {
      if (req.body.customerResponsibility || contact.customerResponsibility) {
        sendError(res, 'ARK contacts cannot have a responsibility assigned', 400);
        return;
      }
      if (req.body.linkedAccountId || contact.linkedAccountId) {
        sendError(res, 'ARK contacts cannot be linked to an account', 400);
        return;
      }
      req.body.customerResponsibility = undefined;
      req.body.linkedAccountId = undefined;
    }

    if (targetType === 'TELLED') {
      if (req.body.customerResponsibility || contact.customerResponsibility) {
        sendError(res, 'TELLED contacts cannot have a responsibility assigned', 400);
        return;
      }
      if (req.body.linkedAccountId || contact.linkedAccountId) {
        sendError(res, 'TELLED contacts cannot be linked to an account', 400);
        return;
      }
      req.body.customerResponsibility = undefined;
      req.body.linkedAccountId = undefined;
    }

    const updated = await Contact.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name email')
      .populate('linkedAccountId', 'accountName');

    sendSuccess(res, updated, 'Contact updated');
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message || 'Failed to update contact';
    sendError(res, msg, 400);
  }
};

export const deleteContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, id } = req.user!;

    const contact = await Contact.findOne({
      _id: req.params.id,
      organizationId: req.user!.organizationId,
    });

    if (!contact) { sendError(res, 'Contact not found', 404); return; }

    if (role === 'admin') {
      // Admin can delete all contacts
    } else if (role === 'hr_finance') {
      // HR can only delete TELLED contacts
      if (contact.contactType !== 'TELLED') {
        sendError(res, 'HR & Finance can only delete Telled internal contacts', 403);
        return;
      }
    } else {
      // Sales and Engineer can only delete contacts they created
      if (contact.createdBy.toString() !== id) {
        sendError(res, 'You can only delete contacts you created', 403);
        return;
      }
    }

    await Contact.findByIdAndDelete(req.params.id);
    sendSuccess(res, null, 'Contact deleted');
  } catch {
    sendError(res, 'Failed to delete contact', 500);
  }
};