import { getStaffUsers, saveStaffUsers } from '../data-store';
import type { StaffUser } from '../types';
import { recordApprovalLog } from './log-management';

export const updateStaffProfile = async (userId: string, patch: Partial<Pick<StaffUser, 'phone_number' | 'profile_image_url'>>): Promise<StaffUser> => {
  const users = getStaffUsers();
  const index = users.findIndex(user => user.id === userId);
  if (index < 0) throw new Error('Staff account not found.');
  users[index] = { ...users[index], ...patch };
  saveStaffUsers(users);
  return users[index];
};

export const requestStaffProfileEdit = async (userId: string, data: Partial<StaffUser>, actorEmail: string): Promise<StaffUser> => {
  const users = getStaffUsers();
  const index = users.findIndex(user => user.id === userId);
  if (index < 0) throw new Error('Staff account not found.');
  users[index] = { ...users[index], profile_edit_pending: true, profile_edit_data: data, profile_edit_requested_at: new Date().toISOString() };
  saveStaffUsers(users);
  await recordApprovalLog(userId, actorEmail, 'StaffUser', userId, 'Updated', 'Requested a profile change.');
  return users[index];
};

export const reviewStaffProfileEdit = async (userId: string, approved: boolean, actorId: string, actorEmail: string, reason?: string): Promise<StaffUser> => {
  const users = getStaffUsers();
  const index = users.findIndex(user => user.id === userId);
  if (index < 0) throw new Error('Staff account not found.');
  const current = users[index];
  const data = current.profile_edit_data ?? {};
  users[index] = approved
    ? { ...current, ...data, profile_edit_pending: false, profile_edit_approved_at: new Date().toISOString(), profile_edit_data: undefined }
    : { ...current, profile_edit_pending: false, profile_edit_rejected_at: new Date().toISOString(), profile_edit_rejection_reason: reason, profile_edit_data: undefined };
  saveStaffUsers(users);
  await recordApprovalLog(actorId, actorEmail, 'StaffUser', userId, approved ? 'Approved' : 'Rejected', approved ? 'Approved staff profile changes.' : `Rejected staff profile changes: ${reason ?? 'No reason provided'}`);
  return users[index];
};
