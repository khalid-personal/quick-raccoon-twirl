import { v4 as uuidv4 } from 'uuid';
import { AttendanceRecord } from '../types';
import { getAttendanceRecords, saveAttendanceRecords } from '../data-store';

// GET /api/staff/attendance/status/:staffId
export const getStaffAttendanceStatus = async (staffId: string): Promise<AttendanceRecord | null> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    const records = getAttendanceRecords().filter(r => r.staff_id === staffId);
    
    // Find the latest record that is checked in (no check_out_time)
    const latestRecord = records
        .sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime())
        .find(r => !r.check_out_time);
        
    return latestRecord || null;
};

// POST /api/staff/attendance/check-in
export const checkInStaff = async (staffId: string, staffEmail: string): Promise<AttendanceRecord> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const allRecords = getAttendanceRecords();
    
    // Check if already checked in
    const currentStatus = await getStaffAttendanceStatus(staffId);
    if (currentStatus) {
        throw new Error("Staff member is already checked in.");
    }

    const newRecord: AttendanceRecord = {
        id: uuidv4(),
        staff_id: staffId,
        staff_email: staffEmail,
        check_in_time: new Date().toISOString(),
    };

    allRecords.push(newRecord);
    saveAttendanceRecords(allRecords);
    return newRecord;
};

// PATCH /api/staff/attendance/check-out/:recordId
export const checkOutStaff = async (recordId: string): Promise<AttendanceRecord> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const allRecords = getAttendanceRecords();
    const index = allRecords.findIndex(r => r.id === recordId);

    if (index === -1) {
        throw new Error('Attendance record not found.');
    }
    
    if (allRecords[index].check_out_time) {
        throw new Error('Staff member is already checked out.');
    }

    const updatedRecord = {
        ...allRecords[index],
        check_out_time: new Date().toISOString(),
    };

    allRecords[index] = updatedRecord;
    saveAttendanceRecords(allRecords);
    return updatedRecord;
};

// GET /api/staff/attendance/history/:staffId
export const getStaffAttendanceHistory = async (staffId: string): Promise<AttendanceRecord[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const records = getAttendanceRecords().filter(r => r.staff_id === staffId);
    
    // Sort by check-in time, newest first
    return records.sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime());
};

// GET /api/admin/attendance/all
export const getAllAttendanceHistory = async (): Promise<AttendanceRecord[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const records = getAttendanceRecords();
    
    // Sort by check-in time, newest first
    return records.sort((a, b) => new Date(b.check_in_time).getTime() - new Date(a.check_in_time).getTime());
};