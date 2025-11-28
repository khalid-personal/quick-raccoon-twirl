import { v4 as uuidv4 } from 'uuid';
import { AttendanceRecord } from '../types';
import { getAttendanceRecords, saveAttendanceRecords } from '../data-store';
import { recordApprovalLog } from './log-management';

// POST /api/attendance/check-in
export const checkIn = async (staffId: string, staffEmail: string): Promise<AttendanceRecord> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const records = getAttendanceRecords();

    // Check if the staff member is already checked in
    const lastRecord = records
        .filter(r => r.staff_id === staffId)
        .sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime())[0];

    if (lastRecord && !lastRecord.check_out_time) {
        throw new Error("You are already checked in.");
    }

    const newRecord: AttendanceRecord = {
        id: uuidv4(),
        staff_id: staffId,
        staff_email: staffEmail,
        check_in_time: new Date().toISOString(),
        check_out_time: undefined,
    };

    records.push(newRecord);
    saveAttendanceRecords(records);

    await recordApprovalLog(staffId, staffEmail, 'AttendanceRecord', newRecord.id, 'Created', `Checked in at ${newRecord.check_in_time}`);

    return newRecord;
};

// PATCH /api/attendance/check-out
export const checkOut = async (staffId: string, staffEmail: string): Promise<AttendanceRecord> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const records = getAttendanceRecords();

    const lastRecordIndex = records.findIndex(
        r => r.staff_id === staffId && !r.check_out_time
    );

    if (lastRecordIndex === -1) {
        throw new Error("You are not currently checked in.");
    }

    const updatedRecord = {
        ...records[lastRecordIndex],
        check_out_time: new Date().toISOString(),
    };

    records[lastRecordIndex] = updatedRecord;
    saveAttendanceRecords(records);

    await recordApprovalLog(staffId, staffEmail, 'AttendanceRecord', updatedRecord.id, 'Updated', `Checked out at ${updatedRecord.check_out_time}`);

    return updatedRecord;
};

// GET /api/attendance/:staffId
export const getStaffAttendanceHistory = async (staffId: string): Promise<AttendanceRecord[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getAttendanceRecords()
        .filter(r => r.staff_id === staffId)
        .sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime());
};

// GET /api/attendance/all (Admin only)
export const getAllAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getAttendanceRecords()
        .sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime());
};