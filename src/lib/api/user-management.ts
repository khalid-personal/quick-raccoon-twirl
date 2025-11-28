import { StaffUser, UserRole } from '../types';
import { getStaffUsers, saveStaffUsers } from '../data-store';
import { v4 as uuidv4 } from 'uuid';

// Get all staff users (admin, staff, viewer)
export const getAllStaffUsers = async (): Promise<StaffUser[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getStaffUsers();
};

// POST: Create a new staff user (Admin bypasses signup)
export const createStaffUser = async (email: string, pin: string, role: Exclude<UserRole, 'candidate'>): Promise<StaffUser> => {
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

    saveStaffUsers([...users, newUser]);
    return newUser;
};

// Update a staff user's role and approval status
export const updateUserRole = async (userId: string, role: Exclude<UserRole, 'candidate'>, isApproved: boolean): Promise<StaffUser> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const users = getStaffUsers();
    const index = users.findIndex(u => u.id === userId);

    if (index === -1) {
        throw new Error('User not found.');
    }

    const updatedUser = {
        ...users[index],
        role,
        is_approved: isApproved,
    };

    users[index] = updatedUser;
    saveStaffUsers(users);
    return updatedUser;
};

// NEW: Update staff user credentials (email and password/pin)
export const updateUserCredentials = async (userId: string, newEmail: string, newPin?: string): Promise<StaffUser> => {
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
    
    // If the current user is being updated, we need to force a re-auth/refresh to pick up the new email/role.
    // In a real app, Supabase handles this via the auth listener. Here, we rely on the query invalidation.
    
    return updatedUser;
};