import { Response } from 'express';
import Attendance from '../models/Attendance';
import Organization from '../models/Organization';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { getPaginationParams } from '../utils/helpers';

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getOrgAttendanceSettings(organizationId: string) {
  const org = await Organization.findById(organizationId).select('attendanceSettings').lean();
  return (org as any)?.attendanceSettings || { activeMethod: 'none' };
}

export const getAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const filter: Record<string, any> = {};

    const role = req.user!.role;
    if (role === 'engineer' || role === 'sales') {
      filter.employeeId = req.user!.id;
    } else if (req.query.employeeId) {
      filter.employeeId = req.query.employeeId;
    }

    if (req.query.month || req.query.year) {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string);
      if (month) {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);
        filter.date = { $gte: start, $lte: end };
      } else {
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31, 23, 59, 59);
        filter.date = { $gte: start, $lte: end };
      }
    }

    if (req.query.status) filter.status = req.query.status;

    const [records, total] = await Promise.all([
      Attendance.find(filter)
        .populate('employeeId', 'name email')
        .populate('markedBy', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      Attendance.countDocuments(filter),
    ]);

    sendPaginated(res, records, total, page, limit);
  } catch (e) {
    sendError(res, 'Failed to fetch attendance', 500);
  }
};

export const markAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId, date, status, checkIn, checkOut, notes } = req.body;
    if (!employeeId || !date) { sendError(res, 'employeeId and date are required', 400); return; }

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    const record = await Attendance.findOneAndUpdate(
      { employeeId, date: dateObj },
      {
        employeeId,
        date: dateObj,
        status: status || 'Present',
        checkIn: checkIn ? new Date(checkIn) : undefined,
        checkOut: checkOut ? new Date(checkOut) : undefined,
        notes,
        markedBy: req.user!.id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await record.populate('employeeId', 'name email');
    sendSuccess(res, record, 'Attendance marked', 200);
  } catch (e: any) {
    if (e.code === 11000) { sendError(res, 'Attendance already marked for this date', 409); return; }
    sendError(res, 'Failed to mark attendance', 500);
  }
};

export const updateAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, checkIn, checkOut, notes } = req.body;
    const update: Record<string, any> = {};
    if (status) update.status = status;
    if (checkIn !== undefined) update.checkIn = checkIn ? new Date(checkIn) : undefined;
    if (checkOut !== undefined) update.checkOut = checkOut ? new Date(checkOut) : undefined;
    if (notes !== undefined) update.notes = notes;
    update.markedBy = req.user!.id;

    const record = await Attendance.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('employeeId', 'name email')
      .populate('markedBy', 'name');

    if (!record) { sendError(res, 'Attendance record not found', 404); return; }
    sendSuccess(res, record, 'Attendance updated');
  } catch (e) {
    sendError(res, 'Failed to update attendance', 500);
  }
};

export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);

    const existing = await Attendance.findOne({ employeeId, date: today });
    if (existing?.checkIn) { sendError(res, 'Already checked in today', 400); return; }

    // ── Enforce attendance method ──
    if (req.user!.organizationId) {
      const settings = await getOrgAttendanceSettings(req.user!.organizationId.toString());

      if (settings.activeMethod === 'geo') {
        const { lat, lng } = req.body;
        if (lat == null || lng == null) {
          sendError(res, 'Location coordinates are required for geo-based check-in', 400); return;
        }
        const { lat: officeLat, lng: officeLng, radius, name } = settings.geo || {};
        if (!officeLat || !officeLng) {
          sendError(res, 'Office location not configured. Contact HR.', 400); return;
        }
        const dist = haversineMetres(+lat, +lng, officeLat, officeLng);
        if (dist > radius) {
          sendError(res, `You are ${Math.round(dist)}m from ${name || 'office'}. Must be within ${radius}m to check in.`, 403); return;
        }
      }

      if (settings.activeMethod === 'face') {
        if (!req.body.faceVerified) {
          sendError(res, 'Face verification is required to check in.', 403); return;
        }
      }

      if (settings.activeMethod === 'biometric') {
        sendError(res, 'Manual check-in is disabled. Please use the biometric terminal.', 403); return;
      }
    }

    const record = await Attendance.findOneAndUpdate(
      { employeeId, date: today },
      { $set: { employeeId, date: today, checkIn: now, status: 'Present', markedBy: employeeId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('employeeId', 'name email');
    sendSuccess(res, record, 'Checked in successfully');
  } catch { sendError(res, 'Failed to check in', 500); }
};

export const checkOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const record = await Attendance.findOne({ employeeId, date: today });
    if (!record) { sendError(res, 'No check-in found for today', 400); return; }
    if (record.checkOut) { sendError(res, 'Already checked out today', 400); return; }

    // ── Enforce attendance method ──
    if (req.user!.organizationId) {
      const settings = await getOrgAttendanceSettings(req.user!.organizationId.toString());

      if (settings.activeMethod === 'geo') {
        const { lat, lng } = req.body;
        if (lat == null || lng == null) {
          sendError(res, 'Location coordinates are required for geo-based check-out', 400); return;
        }
        const { lat: officeLat, lng: officeLng, radius, name } = settings.geo || {};
        if (!officeLat || !officeLng) {
          sendError(res, 'Office location not configured. Contact HR.', 400); return;
        }
        const dist = haversineMetres(+lat, +lng, officeLat, officeLng);
        if (dist > radius) {
          sendError(res, `You are ${Math.round(dist)}m from ${name || 'office'}. Must be within ${radius}m to check out.`, 403); return;
        }
      }

      if (settings.activeMethod === 'face') {
        if (!req.body.faceVerified) {
          sendError(res, 'Face verification is required to check out.', 403); return;
        }
      }

      if (settings.activeMethod === 'biometric') {
        sendError(res, 'Manual check-out is disabled. Please use the biometric terminal.', 403); return;
      }
    }

    record.checkOut = new Date();
    await record.save();
    await record.populate('employeeId', 'name email');
    sendSuccess(res, record, 'Checked out successfully');
  } catch { sendError(res, 'Failed to check out', 500); }
};

export const getTodayStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = req.user!.id;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const record = await Attendance.findOne({ employeeId, date: today });
    sendSuccess(res, record || null, 'Today status fetched');
  } catch { sendError(res, 'Failed', 500); }
};

export const getAttendanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId, month, year } = req.query;
    const y = parseInt(year as string) || new Date().getFullYear();
    const m = parseInt(month as string) || new Date().getMonth() + 1;

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);

    const filter: Record<string, any> = { date: { $gte: start, $lte: end } };
    const role = req.user!.role;
    if (role === 'engineer' || role === 'sales') {
      filter.employeeId = req.user!.id;
    } else if (employeeId) {
      filter.employeeId = employeeId;
    }

    const agg = await Attendance.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const summary: Record<string, number> = {
      Present: 0, Absent: 0, 'Half Day': 0, Leave: 0, Holiday: 0,
    };
    for (const item of agg) {
      summary[item._id] = item.count;
    }

    sendSuccess(res, summary, 'Summary fetched');
  } catch (e) {
    sendError(res, 'Failed to fetch summary', 500);
  }
};
