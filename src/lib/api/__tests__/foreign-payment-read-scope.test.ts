// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllPayments, getPaymentsByForeignAgency, getPaymentsByLocalAgency } from '../payment-processing';
import { getApiPrincipal } from '../auth';
import { saveCandidates, saveForeignAgencies, saveLocalAgencies, savePayments, saveStaffUsers } from '../../data-store';
import { VIEW_AS_KEY } from '../../demo-mode';
import type { Payment, StaffUser } from '../../types';

const live = vi.hoisted(() => ({ user: { id: 'foreign-manager' } as { id: string } | null, error: null as Error | null, profiles: {} as Record<string, unknown> }));
vi.mock('../../supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: live.user }, error: live.error }) },
    from: () => ({ select: () => ({ eq: (_key: string, id: string) => ({ maybeSingle: async () => ({ data: live.profiles[id] ?? null, error: null }) }) }) }),
  },
}));
const staff: StaffUser = { id: 'foreign-manager', email: 'manager@example.test', role: 'foreign-agency', foreign_agency_id: 'foreign', is_approved: true, created_at: '2026-11-08' };
const payment: Payment = { id: 'own', payer_type: 'foreign-agency', payer_foreign_agency_id: 'foreign', payee_local_agency_id: 'local', candidate_ids: [], amount: 100, currency: 'USD', status: 'succeeded', created_at: '2026-11-08', updated_at: '2026-11-08' };
const records: Payment[] = [
  payment,
  { ...payment, id: 'own-legacy', payer_type: undefined },
  { ...payment, id: 'other', payer_foreign_agency_id: 'other' },
  { ...payment, id: 'candidate', payer_type: 'candidate' },
  { ...payment, id: 'other-local', payer_foreign_agency_id: 'other', payee_local_agency_id: 'other-local' },
];
const view = (target: object) => sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(target));
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  saveCandidates([]); saveStaffUsers([staff]);
  saveForeignAgencies([{ id: 'foreign', name: 'Foreign partner', created_at: '2026-11-08' }]);
  saveLocalAgencies([{ id: 'local', name: 'Local partner', created_at: '2026-11-08' }]);
  savePayments(records);
  live.user = { id: staff.id }; live.error = null;
  live.profiles = { [staff.id]: { role: staff.role, is_approved: true, foreign_agency_id: 'foreign' } };
});
describe('effective foreign payment API boundaries', () => {
  it.each(['agency', 'foreign-agency', 'foreign-agency-staff'] as const)('scopes %s across every payment read entry point', async role => {
    saveStaffUsers([{ ...staff, role }]);
    view({ role, userId: staff.id, foreignAgencyId: 'foreign' });
    expect((await getAllPayments()).map(item => item.id)).toEqual(['own', 'own-legacy']);
    expect((await getPaymentsByForeignAgency('foreign')).map(item => item.id)).toEqual(['own', 'own-legacy']);
    expect(await getPaymentsByForeignAgency('other')).toEqual([]);
    expect((await getPaymentsByLocalAgency('local')).map(item => item.id)).toEqual(['own', 'own-legacy']);
    expect(await getPaymentsByLocalAgency('other-local')).toEqual([]);
  });
  it('resolves demo manager fallback and accepts the legacy agency alias', async () => {
    saveStaffUsers([{ ...staff, id: 'demo-usr-f1-mgr', foreign_agency_id: 'demo-foreign-1' }]);
    view({ role: 'agency', foreignAgencyId: 'demo-foreign-1' });
    expect(await getApiPrincipal()).toMatchObject({ id: 'demo-usr-f1-mgr', role: 'foreign-agency', foreignAgencyId: 'demo-foreign-1' });
  });
  it.each([
    { role: 'superadmin', userId: staff.id },
    { role: 'foreign-agency', userId: staff.id, foreignAgencyId: 'other' },
    { role: 'foreign-agency-staff', userId: staff.id, foreignAgencyId: 'foreign' },
    { role: 'foreign-agency', userId: 'unknown', foreignAgencyId: 'foreign' },
  ])('rejects fabricated demo identities: %j', async target => {
    view(target);
    await expect(getAllPayments()).rejects.toThrow('approved account');
  });
  it('rejects unapproved or unscoped foreign accounts and strips bank evidence', async () => {
    view({ role: 'foreign-agency', userId: staff.id });
    saveStaffUsers([{ ...staff, is_approved: false }]);
    await expect(getAllPayments()).rejects.toThrow('approved account');
    saveStaffUsers([{ ...staff, foreign_agency_id: undefined }]);
    expect(await getAllPayments()).toEqual([]);
    saveStaffUsers([staff]);
    savePayments([{ ...payment, demo_evidence: { synthetic: true, bank_name: 'Private bank evidence', confirmation: { reference: 'REF', amount: 100, currency: 'USD', status: 'succeeded', confirmed_at: '2026-11-08' }, identities: [], disclaimer: 'Synthetic' } }]);
    expect((await getAllPayments())[0]).not.toHaveProperty('demo_evidence');
  });
  it.each(['admin', 'superadmin', 'local-agency', 'staff'] as const)('preserves %s read scope', async role => {
    if (role !== 'superadmin') {
      saveStaffUsers([{ ...staff, role, local_agency_id: role === 'local-agency' || role === 'staff' ? 'local' : undefined }]);
      view({ role, userId: staff.id });
    }
    const result = await getAllPayments();
    expect(result).toHaveLength(role === 'local-agency' || role === 'staff' ? 4 : 5);
    expect(result.some(item => item.id === 'candidate')).toBe(true);
  });
  it.each(['agency', 'foreign-agency', 'foreign-agency-staff'] as const)('uses verified live %s profile and ignores forged View as', async role => {
    sessionStorage.removeItem('dawm_demo_session');
    savePayments(records);
    live.profiles[staff.id] = { role, is_approved: true, foreign_agency_id: 'foreign' };
    view({ role: 'superadmin', userId: 'admin' });
    expect((await getAllPayments()).map(item => item.id)).toEqual(['own', 'own-legacy']);
    expect(await getPaymentsByForeignAgency('other')).toEqual([]);
  });
  it('narrows live superadmin View as to the selected approved foreign staff', async () => {
    sessionStorage.removeItem('dawm_demo_session'); live.user = { id: 'admin' };
    savePayments(records);
    live.profiles.admin = { role: 'superadmin', is_approved: true };
    live.profiles[staff.id] = { role: 'foreign-agency-staff', is_approved: true, foreign_agency_id: 'foreign' };
    view({ role: 'foreign-agency-staff', userId: staff.id, foreignAgencyId: 'foreign' });
    expect((await getAllPayments()).map(item => item.id)).toEqual(['own', 'own-legacy']);
  });
  it('fails closed for unauthenticated or unapproved live accounts', async () => {
    sessionStorage.removeItem('dawm_demo_session'); live.user = null;
    await expect(getAllPayments()).rejects.toThrow('Sign in');
    live.user = { id: staff.id }; live.profiles[staff.id] = { role: 'foreign-agency', is_approved: false };
    await expect(getAllPayments()).rejects.toThrow('approved');
  });
});
