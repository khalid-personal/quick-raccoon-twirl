import { v4 as uuidv4 } from 'uuid';
import { StaffUser } from '../types';
import { SEED_FOREIGN_AGENCIES } from './foreign-agencies';
import { SEED_LOCAL_AGENCIES } from './local-agencies';

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
    { // Mock admin for Al-Aman Recruitment (Foreign Agency)
        id: uuidv4(),
        email: 'admin@alaman.com',
        role: 'agency', // Role is 'agency'
        is_approved: true,
        created_at: new Date().toISOString(),
        foreign_agency_id: SEED_FOREIGN_AGENCIES[0].id, // Explicitly link to Al-Aman Recruitment by ID
    },
    { // Mock staff for Asia Star Agency (Foreign Agency)
        id: uuidv4(),
        email: 'staff@asiastar.com',
        role: 'agency', // Role is 'agency'
        is_approved: true,
        created_at: new Date().toISOString(),
        foreign_agency_id: SEED_FOREIGN_AGENCIES[2].id, // Explicitly link to Asia Star Agency by ID
    },
    { // NEW: Mock admin for Gulf Manpower Solutions (Foreign Agency)
        id: uuidv4(),
        email: 'admin@gulf.com',
        role: 'agency',
        is_approved: true,
        created_at: new Date().toISOString(),
        foreign_agency_id: SEED_FOREIGN_AGENCIES[1].id,
    },
    { // NEW: Mock admin for Middle East Connect (Foreign Agency)
        id: uuidv4(),
        email: 'admin@middleeast.com',
        role: 'agency',
        is_approved: true,
        created_at: new Date().toISOString(),
        foreign_agency_id: SEED_FOREIGN_AGENCIES[3].id,
    },
    { // Mock user for Local Agency X
        id: uuidv4(),
        email: 'admin@localagencyx.com',
        role: 'local-agency', // New role 'local-agency'
        is_approved: true,
        created_at: new Date().toISOString(),
        local_agency_id: SEED_LOCAL_AGENCIES.find(la => la.name === 'Local Agency X')!.id, // Linked to Local Agency X by ID
    },
    { // NEW: Mock user for NuraLink (Local Agency)
        id: uuidv4(),
        email: 'admin@nuralink.com',
        role: 'local-agency', // Role is 'local-agency'
        is_approved: true,
        created_at: new Date().toISOString(),
        local_agency_id: SEED_LOCAL_AGENCIES.find(la => la.name === 'NuraLink')!.id, // Linked to NuraLink by ID
    },
    { // NEW: Mock user for Local Agency Y
        id: uuidv4(),
        email: 'admin@localagencyy.com',
        role: 'local-agency',
        is_approved: true,
        created_at: new Date().toISOString(),
        local_agency_id: SEED_LOCAL_AGENCIES.find(la => la.name === 'Local Agency Y')!.id,
    },
    { // NEW: Mock user for Local Agency Z
        id: uuidv4(),
        email: 'admin@localagencyz.com',
        role: 'local-agency',
        is_approved: true,
        created_at: new Date().toISOString(),
        local_agency_id: SEED_LOCAL_AGENCIES.find(la => la.name === 'Local Agency Z')!.id,
    },
];