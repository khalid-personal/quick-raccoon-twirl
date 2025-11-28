import { v4 as uuidv4 } from 'uuid';
import { AttendanceRecord } from '../types';
import { MOCK_STAFF_ID, MOCK_STAFF_EMAIL } from './staff-users'; // Import MOCK_STAFF_ID and MOCK_STAFF_EMAIL

export const SEED_ATTENDANCE: AttendanceRecord[] = [
    {
        id: uuidv4(),
        staff_id: MOCK_STAFF_ID,
        staff_email: MOCK_STAFF_EMAIL,
        check_in_time: new Date(Date.now() - 2 * 86400000 - 8 * 3600000).toISOString(), // 2 days ago, 8am
        check_out_time: new Date(Date.now() - 2 * 86400000 - 17 * 3600000).toISOString(), // 2 days ago, 5pm
    },
    {
        id: uuidv4(),
        staff_id: MOCK_STAFF_ID,
        staff_email: MOCK_STAFF_EMAIL,
        check_in_time: new Date(Date.now() - 1 * 86400000 - 9 * 3600000).toISOString(), // 1 day ago, 9am
        check_out_time: new Date(Date.now() - 1 * 86400000 - 18 * 3600000).toISOString(), // 1 day ago, 6pm
    },
];