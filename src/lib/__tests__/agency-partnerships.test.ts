import { describe, expect, it } from 'vitest';
import { MAX_AGENCY_PARTNERS, normalizePartnerships, recordProfileShare, validatePartnerships } from '../agency-partnerships';
import { SEED_CONFIG } from '../seed/config';
import type { AgencyPartnership, Candidate, ForeignAgency, LocalAgency } from '../types';

const locals: LocalAgency[] = Array.from({ length: 7 }, (_, index) => ({ id: `l${index}`, name: `Local ${index}`, created_at: '' }));
const foreigns: ForeignAgency[] = Array.from({ length: 7 }, (_, index) => ({ id: `f${index}`, name: `Foreign ${index}`, created_at: '' }));
const link = (local: number, foreign: number): AgencyPartnership => ({ local_agency_id: `l${local}`, foreign_agency_id: `f${foreign}`, status: 'active', started_at: '' });
describe('agency partner contracts', () => {
  it('ships a reciprocal seed contract network within the five-partner cap', () => {
    const seedLinks = SEED_CONFIG.agencyPartnerships ?? [];
    expect(seedLinks.length).toBe(SEED_CONFIG.localAgencies.length * SEED_CONFIG.foreignAgencies.length);
    SEED_CONFIG.localAgencies.forEach(local => expect(seedLinks.filter(item => item.local_agency_id === local.id).length).toBeLessThanOrEqual(MAX_AGENCY_PARTNERS));
    SEED_CONFIG.foreignAgencies.forEach(foreign => expect(seedLinks.filter(item => item.foreign_agency_id === foreign.id).length).toBeLessThanOrEqual(MAX_AGENCY_PARTNERS));

  });

  it('does not fabricate ministry contracts from candidate assignments', () => {
    expect(normalizePartnerships(undefined)).toEqual([]);
    expect(normalizePartnerships([link(0, 0)])).toEqual([link(0, 0)]);
  });

  it('enforces a maximum of five contracts for each side and prevents duplicate pairs', () => {
    const fiveForLocal = Array.from({ length: MAX_AGENCY_PARTNERS }, (_, index) => link(0, index));
    expect(validatePartnerships(fiveForLocal, locals, foreigns)).toBeNull();
    expect(validatePartnerships([...fiveForLocal, link(0, 5)], locals, foreigns)).toMatch(/local agency/i);

    const fiveForForeign = Array.from({ length: MAX_AGENCY_PARTNERS }, (_, index) => link(index, 0));
    expect(validatePartnerships([...fiveForForeign, link(5, 0)], locals, foreigns)).toMatch(/foreign agency/i);
    expect(validatePartnerships([link(0, 0), link(0, 0)], locals, foreigns)).toMatch(/only have one/i);
  });

  it('records a profile delivery per foreign partner and updates a resend in place', () => {
    const candidate = { id: 'c1', profile_shares: [] } as unknown as Candidate;
    const first = recordProfileShare(candidate, 'f0', 'staff@example.test', '2026-01-01T10:00:00Z');
    const withSecondPartner = recordProfileShare(first, 'f1', 'staff@example.test', '2026-01-02T10:00:00Z');
    const resent = recordProfileShare(withSecondPartner, 'f0', 'owner@example.test', '2026-01-03T10:00:00Z');
    expect(resent.profile_shares).toHaveLength(2);
    expect(resent.profile_shares?.find(share => share.foreign_agency_id === 'f0')).toMatchObject({ sent_by: 'owner@example.test', sent_at: '2026-01-03T10:00:00Z' });
  });
});
