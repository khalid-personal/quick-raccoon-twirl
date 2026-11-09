import { v4 as uuidv4 } from 'uuid';
import { StaffUser } from '../types';

export const MOCK_ADMIN_EMAIL = 'admin@agency.com';
export const MOCK_STAFF_EMAIL = 'staff@agency.com';
export const MOCK_STAFF_ID = uuidv4();
export const PLACEHOLDER_ADMIN_EMAIL = MOCK_ADMIN_EMAIL;
export const PLACEHOLDER_STAFF_EMAIL = MOCK_STAFF_EMAIL;
export const PLACEHOLDER_STAFF_ID = MOCK_STAFF_ID;

export const SEED_STAFF_USERS: StaffUser[] = [
    {
        id: uuidv4(),
        email: MOCK_ADMIN_EMAIL,
        role: 'admin',
        is_approved: true,
        created_at: new Date().toISOString(),
    },
    {
        id: MOCK_STAFF_ID,
        email: MOCK_STAFF_EMAIL,
        role: 'staff',
        is_approved: true,
        created_at: new Date().toISOString(),
    },
    // Mock pending user (registered via /signup but not yet approved)
    {
        id: uuidv4(),
        email: 'pending@agency.com',
        role: 'staff',
        is_approved: false,
        created_at: new Date().toISOString(),
    },
];