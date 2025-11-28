import { StaffUser, UserRole } from '../types';
import { getStaffUsers, saveStaffUsers } from '../data-store';
import { v4 as uuidv4 } from 'uuid';
import { recordApprovalLog } from './log-management';

// Get all staff users (admin, staff, viewer)
export const getAllStaffUsers = async (): Promise<StaffUser[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getStaffUsers();
};

// POST: Create a new staff user (Admin bypasses signup)
export const createStaffUser = async (
    email: string, 
    pin: string, 
    role: Exclude<UserRole, 'candidate'>,
    foreignAgencyId?: string, // Changed to ID
    localAgencyId?: string, // Changed to ID
    actorId?: string, 
    actorEmail?: string 
): Promise<StaffUser> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const users = getStaffUsers();
    const lowerEmail = email.toLowerCase();

    if (users.some(u => u.email.toLowerCase() === lowerEmail)) {
        throw new Error(`Email '${email}' is already registered.`);
    }
    
    // NOTE: In a real Supabase app, we would call:
    // await supabase.auth.admin.createUser({ email, password: pin, user_metadata: { role } });
    
    const newUser: StaffUser = {
        id: uuidv4(),
        email: email,
        role: role,
        is_approved: true, // Directly approved by admin creation
        created_at: new Date().toISOString(),
        foreign_agency_id: foreignAgencyId, // Changed
        local_agency_id: localAgencyId, // Changed
    };

    saveStaffUsers([...users, newUser]);

    // --- LOGGING ---
    if (actorId && actorEmail) {
        let description = `Created new staff user: ${email} with role '${role}'.`;
        if (foreignAgencyId) description += ` Associated with foreign agency ID: '${foreignAgencyId}'.`;
        if (localAgencyId) description += ` Associated with local agency ID: '${localAgencyId}'.`;
        await recordApprovalLog(actorId, actorEmail, 'StaffUser', newUser.id, 'Created', description);
    }
    // --- END LOGGING ---

    return newUser;
};

// Update a staff user's role and approval status
export const updateUserRole = async (
    userId: string, 
    role: Exclude<UserRole, 'candidate'>, 
    isApproved: boolean,
    actorId: string, 
    actorEmail: string 
): Promise<StaffUser> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const users = getStaffUsers();
    const index = users.findIndex(u => u.id === userId);

    if (index === -1) {
        throw new Error('User not found.');
    }

    const oldUser = users[index];

    const updatedUser = {
        ...oldUser,
        role,
        is_approved: isApproved,
    };

    users[index] = updatedUser;
    saveStaffUsers(users);

    // --- LOGGING ---
    let description = `Updated role for ${oldUser.email} from '${oldUser.role}' to '${role}'.`;
    if (oldUser.is_approved !== isApproved) {
        description += ` Approval status changed to '${isApproved ? 'Approved' : 'Pending'}'.`;
    }
    await recordApprovalLog(actorId, actorEmail, 'StaffUser', userId, 'Updated', description);
    // --- END LOGGING ---

    return updatedUser;
};

// NEW: Update staff user credentials (email and password/pin) and agency associations
export const updateUserCredentials = async (
    userId: string, 
    newEmail: string, 
    newPin?: string, 
    newForeignAgencyId?: string, // Changed to ID
    newLocalAgencyId?: string, // Changed to ID
    actorId?: string, 
    actorEmail?: string 
): Promise<StaffUser> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const users = getStaffUsers();
    const index = users.findIndex(u => u.id === userId);

    if (index === -1) {
        throw new Error('User not found.');
    }
    
    const existingUser = users[index];

    // Check for duplicate email if changing
    if (newEmail.toLowerCase() !== existingUser.email.toLowerCase() && users.some(u => u.email.toLowerCase() === newEmail.toLowerCase())) {
        throw new Error(`Email '${newEmail}' is already registered.`);
    }

    const updatedUser = {
        ...existingUser,
        email: newEmail,
        foreign_agency_id: newForeignAgencyId, // Changed
        local_agency_id: newLocalAgencyId, // Changed
        // NOTE: In a real Supabase app, we would call:
        // await supabase.auth.admin.updateUserById(userId, { email: newEmail, password: newPin });
        // Since we are mocking, we just update the email in the mock store.
        // The PIN change is purely simulated here.
    };

    users[index] = updatedUser;
    saveStaffUsers(users);
    
    // --- LOGGING ---
    if (actorId && actorEmail) {
        let description = `Updated credentials for user ID ${userId}.`;
        if (newEmail !== existingUser.email) description += ` Email changed from '${existingUser.email}' to '${newEmail}'.`;
        if (newPin) description += ` PIN reset.`;
        if (newForeignAgencyId !== existingUser.foreign_agency_id) description += ` Foreign agency ID changed from '${existingUser.foreign_agency_id || 'N/A'}' to '${newForeignAgencyId || 'N/A'}'.`;
        if (newLocalAgencyId !== existingUser.local_agency_id) description += ` Local agency ID changed from '${existingUser.local_agency_id || 'N/A'}' to '${newLocalAgencyId || 'N/A'}'.`;
        await recordApprovalLog(actorId, actorEmail, 'StaffUser', userId, 'Updated', description);
    }
    // --- END LOGGING ---

    return updatedUser;
};

// NEW: Get count of unapproved staff users
export const getUnapprovedStaffCount = async (): Promise<number> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const users = getStaffUsers();
    return users.filter(u => !u.is_approved).length;
};