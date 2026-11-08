import type { ViewAsTarget } from '../auth-context';
import type { UserRole } from '../types';
import { demoSessionUser, effectiveAuthUser } from '../auth-identities';
import { getCandidates, getForeignAgencies, getLocalAgencies, getStaffUsers } from '../data-store';
import { isDemoMode, VIEW_AS_KEY } from '../demo-mode';
import { supabase } from '../supabase';

export interface ApiPrincipal {
  id: string;
  role: UserRole;
  foreignAgencyId: string | null;
  localAgencyId: string | null;
  candidateId?: string | null;
}

export const isForeignAgencyRole = (role: string | null) =>
  ['agency', 'foreign-agency', 'foreign-agency-staff'].includes(role ?? '');

const sameRole = (a: string, b: string) => a === b
  || ['agency', 'foreign-agency'].includes(a) && ['agency', 'foreign-agency'].includes(b);

const perspective = (): ViewAsTarget | null => {
  try { return JSON.parse(sessionStorage.getItem(VIEW_AS_KEY) ?? 'null'); }
  catch { throw new Error('Invalid account perspective.'); }
};

export async function getApiPrincipal(): Promise<ApiPrincipal> {
  const target = perspective();
  if (isDemoMode()) {
    const actual = demoSessionUser();
    if (!target) return { id: actual.id, role: 'superadmin', foreignAgencyId: null, localAgencyId: null };
    const staff = getStaffUsers();
    const candidates = getCandidates();
    const effective = effectiveAuthUser(actual, target, true, candidates, staff);
    const member = staff.find(item => item.id === effective?.id && item.is_approved);
    const candidate = target.role === 'candidate' ? candidates.find(item => item.id === effective?.id) : undefined;
    if (candidate && (!target.trackingCode || candidate.tracking_code === target.trackingCode)) {
      return { id: candidate.id, role: 'candidate', foreignAgencyId: null, localAgencyId: candidate.local_agency_id ?? null, candidateId: candidate.id };
    }
    if (!member || !sameRole(member.role, target.role)
      || target.foreignAgencyId && target.foreignAgencyId !== member.foreign_agency_id
      || target.localAgencyId && target.localAgencyId !== member.local_agency_id) {
      throw new Error('Choose an approved account in its own agency.');
    }
    return { id: member.id, role: member.role, foreignAgencyId: member.foreign_agency_id ?? null, localAgencyId: member.local_agency_id ?? null };
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Sign in before reading agency records.');
  const profileFor = async (id: string): Promise<ApiPrincipal> => {
    const { data, error } = await supabase.from('profiles')
      .select('role,is_approved,foreign_agency_id,local_agency_id,candidate_id').eq('id', id).maybeSingle();
    if (error || !data?.is_approved) throw new Error('An approved account is required.');
    return { id, role: data.role as UserRole, foreignAgencyId: data.foreign_agency_id ?? null, localAgencyId: data.local_agency_id ?? null, candidateId: data.candidate_id ?? null };
  };
  const actual = await profileFor(user.id);
  if (!target || actual.role !== 'superadmin') return actual;
  if (target.userId) {
    const selected = await profileFor(target.userId);
    if (!sameRole(selected.role, target.role)
      || target.foreignAgencyId && selected.foreignAgencyId !== target.foreignAgencyId
      || target.localAgencyId && selected.localAgencyId !== target.localAgencyId) throw new Error('Account perspective does not match its agency.');
    return selected;
  }
  if (['agency', 'foreign-agency'].includes(target.role) && getForeignAgencies().some(item => item.id === target.foreignAgencyId)) {
    return { id: actual.id, role: target.role, foreignAgencyId: target.foreignAgencyId!, localAgencyId: null };
  }
  if (target.role === 'local-agency' && getLocalAgencies().some(item => item.id === target.localAgencyId)) {
    return { id: actual.id, role: target.role, foreignAgencyId: null, localAgencyId: target.localAgencyId! };
  }
  throw new Error('Choose an approved account for this perspective.');
}
