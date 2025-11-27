import { StaffUser, UserRole } from '../types';
import { getStaffUsers, saveStaffUsers } from '../data-store';

// Get all staff users (admin, staff, viewer)
export const getAllStaffUsers = async (): Promise<StaffUser[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getStaffUsers();
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