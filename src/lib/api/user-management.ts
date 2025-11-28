import { StaffUser, UserRole, ApprovalAction } from '../types';
import { getStaffUsers, saveStaffUsers } from '../data-store';
import { v4 as uuidv4 } from 'uuid';
import { recordApprovalLog } from './log-management'; // NEW IMPORT

// Get all staff users (admin, staff, viewer)
export const getAllStaffUsers = async (): Promise<StaffUser[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getStaffUsers();
};

// NEW: Get count of unapproved staff users
export const getUnapprovedStaffCount = async (): Promise<number> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const users = getStaffUsers();
    return users.filter(u => !u.is_approved).length;
};

// POST: Create a new staff user (Admin bypasses signup)
export const createStaffUser = async (
    email: string, 
    pin: string, 
    role: Exclude<UserRole, 'candidate'>,
    actorId: string, // NEW
    actorEmail: string // NEW
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
    };

    users.push(newUser);
    saveStaffUsers(users);
    
    // --- LOGGING ---
    await recordApprovalLog(actorId, actorEmail, 'StaffUser', newUser.id, 'Created', `New staff user created and automatically approved with role: ${role}.`);
    // --- END LOGGING ---

    return newUser;
};

// Update a staff user's role and approval status
export const updateUserRole = async (
    userId: string, 
    role: Exclude<UserRole, 'candidate'>, 
    isApproved: boolean,
    actorId: string, // NEW
    actorEmail: string // NEW
): Promise<StaffUser> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const users = getStaffUsers();
    const index = users.findIndex(u => u.id === userId);

    if (index === -1) {
        throw new Error('User not found.');
    }

    const existingUser = users[index];
    const oldRole = existingUser.role;
    const oldApproval = existingUser.is_approved;

    const updatedUser = {
        ...existingUser,
        role,
        is_approved: isApproved,
    };

    users[index] = updatedUser;
    saveStaffUsers(users);
    
    // --- LOGGING ---
    let description = `Role changed from ${oldRole} to ${role}.`;
    let action: ApprovalAction = 'Updated';
    
    if (oldApproval !== isApproved) {
        action = isApproved ? 'Approved' : 'Rejected';
        description = `User approval status changed to ${isApproved ? 'Approved' : 'Rejected'}. ${description}`;
    } else if (oldRole !== role) {
        description = `User role changed from ${oldRole} to ${role}.`;
    } else {
        description = `User role/approval status updated (no change detected).`;
    }
    
    await recordApprovalLog(actorId, actorEmail, 'StaffUser', userId, action, description);
    // --- END LOGGING ---

    return updatedUser;
};

// NEW: Update staff user credentials (email and password/pin)
export const updateUserCredentials = async (
    userId: string, 
    newEmail: string, 
    newPin?: string,
    actorId?: string, // NEW
    actorEmail?: string // NEW
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
        // NOTE: In a real Supabase app, we would call:
        // await supabase.auth.admin.updateUserById(userId, { email: newEmail, password: newPin });
        // Since we are mocking, we just update the email in the mock store.
        // The PIN change is purely simulated here.
    };

    users[index] = updatedUser;
    saveStaffUsers(users);
    
    // --- LOGGING ---
    if (actorId && actorEmail) {
        let description = `Credentials updated for user ${existingUser.email}. Email changed to ${newEmail}.`;
        if (newPin) {
            description += " PIN was reset.";
        }
        await recordApprovalLog(actorId, actorEmail, 'StaffUser', userId, 'Updated', description);
    }
    // --- END LOGGING ---
    
    return updatedUser;
};