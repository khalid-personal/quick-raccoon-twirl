import type { AgencyPartnership, Candidate, ForeignAgency, LocalAgency, ProfileShare } from './types';

export const MAX_AGENCY_PARTNERS = 5;

// Older candidate records already express an agency relationship, so preserve those links until the network is explicitly configured.
export const normalizePartnerships = (partnerships: AgencyPartnership[] | undefined, candidates: Candidate[] = []): AgencyPartnership[] => {
  if (partnerships !== undefined) return partnerships;
  const pairs = new Map<string, AgencyPartnership>();
  candidates.forEach(candidate => {
    if (!candidate.local_agency_id || !candidate.foreign_agency_id) return;
    const key = `${candidate.local_agency_id}|${candidate.foreign_agency_id}`;
    if (!pairs.has(key)) pairs.set(key, { local_agency_id: candidate.local_agency_id, foreign_agency_id: candidate.foreign_agency_id, status: 'active', agreement_reference: 'Migrated from existing candidate assignments', started_at: candidate.created_at });
  });
  return [...pairs.values()];
};

export const validatePartnerships = (partnerships: AgencyPartnership[], locals: LocalAgency[], foreigns: ForeignAgency[]): string | null => {
  const localIds = new Set(locals.map(agency => agency.id));
  const foreignIds = new Set(foreigns.map(agency => agency.id));
  const pairs = new Set<string>();
  const localCounts = new Map<string, number>();
  const foreignCounts = new Map<string, number>();
  for (const item of partnerships) {
    if (!localIds.has(item.local_agency_id) || !foreignIds.has(item.foreign_agency_id)) continue;
    const key = `${item.local_agency_id}|${item.foreign_agency_id}`;
    if (pairs.has(key)) return 'Each local/foreign agency pair can only have one partnership contract.';
    pairs.add(key);
    localCounts.set(item.local_agency_id, (localCounts.get(item.local_agency_id) ?? 0) + 1);
    foreignCounts.set(item.foreign_agency_id, (foreignCounts.get(item.foreign_agency_id) ?? 0) + 1);
  }
  if ([...localCounts.values()].some(count => count > MAX_AGENCY_PARTNERS)) return `A local agency can have at most ${MAX_AGENCY_PARTNERS} foreign-agency contracts.`;
  if ([...foreignCounts.values()].some(count => count > MAX_AGENCY_PARTNERS)) return `A foreign agency can have at most ${MAX_AGENCY_PARTNERS} local-agency contracts.`;
  return null;
};

export const partnersForLocalAgency = (items: AgencyPartnership[], id: string) => items.filter(item => item.local_agency_id === id);
export const partnersForForeignAgency = (items: AgencyPartnership[], id: string) => items.filter(item => item.foreign_agency_id === id);

export const recordProfileShare = (candidate: Candidate, foreignAgencyId: string, sentBy: string, sentAt = new Date().toISOString()): Candidate => {
  const share: ProfileShare = { foreign_agency_id: foreignAgencyId, sent_at: sentAt, sent_by: sentBy };
  return { ...candidate, profile_shares: [...(candidate.profile_shares ?? []).filter(item => item.foreign_agency_id !== foreignAgencyId), share] };
};
