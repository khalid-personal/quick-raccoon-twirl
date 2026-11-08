import { describe, expect, it } from 'vitest';
import { canInspectStaff, canInspectStaffDirectory } from '../entity-profile-access';
import type { StaffUser } from '../types';

const staff: StaffUser = { id: 'staff', email: 'staff@example.test', role: 'staff', is_approved: true, created_at: '2026-11-07', local_agency_id: 'local', foreign_agency_id: 'foreign' };
describe('profile access boundaries', () => {
  it('allows administrators and the same agency but denies unrelated or anonymous viewers', () => {
    expect(canInspectStaff({ role: 'superadmin' }, staff)).toBe(true);
    expect(canInspectStaff({ role: 'local-agency', localAgencyId: 'local' }, staff)).toBe(true);
    expect(canInspectStaff({ role: 'local-agency', localAgencyId: 'other' }, staff)).toBe(false);
    expect(canInspectStaff({ role: 'foreign-agency', foreignAgencyId: 'foreign' }, staff)).toBe(true);
    expect(canInspectStaff({ role: 'foreign-agency', foreignAgencyId: 'other' }, staff)).toBe(false);
    expect(canInspectStaff({ role: null, id: 'staff' }, staff)).toBe(false);
    expect(canInspectStaff({ role: 'candidate', id: 'staff' }, staff)).toBe(false);
  });
  it('allows staff to inspect themselves but not the whole staff directory', () => {
    expect(canInspectStaff({ role: 'staff', id: 'staff' }, staff)).toBe(true);
    expect(canInspectStaff({ role: 'staff', id: 'other' }, staff)).toBe(false);
    expect(canInspectStaffDirectory({ role: 'staff', id: 'staff' })).toBe(false);
    expect(canInspectStaffDirectory({ role: 'superadmin' })).toBe(true);
  });
});
