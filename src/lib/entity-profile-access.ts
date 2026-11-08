import type { StaffUser, UserRole } from './types';

export interface ProfileViewer {
  role: UserRole | null;
  id?: string;
  localAgencyId?: string | null;
  foreignAgencyId?: string | null;
}
export function canInspectStaff(viewer: ProfileViewer, staff: StaffUser) {
  return viewer.role === 'superadmin' || viewer.role === 'admin' || !!viewer.role && viewer.role !== 'candidate' && viewer.id === staff.id
    || viewer.role === 'local-agency' && !!viewer.localAgencyId && viewer.localAgencyId === staff.local_agency_id
    || ['agency', 'foreign-agency', 'foreign-agency-staff'].includes(viewer.role ?? '') && !!viewer.foreignAgencyId && viewer.foreignAgencyId === staff.foreign_agency_id;
}
export function canInspectStaffDirectory(viewer: ProfileViewer) {
  return ['superadmin', 'admin', 'local-agency', 'agency', 'foreign-agency', 'foreign-agency-staff'].includes(viewer.role ?? '');
}
