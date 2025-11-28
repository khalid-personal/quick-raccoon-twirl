import { v4 as uuidv4 } from 'uuid';
import { ApprovalLog } from '../types';
import { SEED_STAFF_USERS, MOCK_ADMIN_EMAIL } from './staff-users'; // Import MOCK_ADMIN_EMAIL and SEED_STAFF_USERS

export const SEED_APPROVAL_LOGS: ApprovalLog[] = [
    {
        id: uuidv4(),
        timestamp: new Date(Date.now() - 7 * 86400000).toISOString(), // 7 days ago
        actor_id: SEED_STAFF_USERS.find(u => u.role === 'admin' && u.email === MOCK_ADMIN_EMAIL)!.id,
        actor_email: MOCK_ADMIN_EMAIL,
        target_type: 'StaffUser',
        target_id: SEED_STAFF_USERS.find(u => u.email === 'pending@agency.com')!.id,
        action: 'Rejected',
        description: "Initial rejection of pending@agency.com due to missing authorization code.",
    },
    {
        id: uuidv4(),
        timestamp: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days ago
        actor_id: SEED_STAFF_USERS.find(u => u.role === 'admin' && u.email === MOCK_ADMIN_EMAIL)!.id,
        actor_email: MOCK_ADMIN_EMAIL,
        target_type: 'StaffUser',
        target_id: SEED_STAFF_USERS.find(u => u.email === 'pending@agency.com')!.id,
        action: 'Approved',
        description: "Approved pending@agency.com after verification.",
    },
];