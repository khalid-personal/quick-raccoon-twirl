import { describe, expect, it } from 'vitest';
import { generateDemoDataset } from '../demo-dataset';
import { candidateLaborId, matchPassportCandidate, mergeMinistryCandidateFeed } from '../ministry-candidates';
import { analyzeIntegrity } from '../integrity';

const demo = generateDemoDataset(Date.parse('2026-11-08'));
const original = demo.candidates[0];
const feed = { ...original, id: 'official-import-row', first_name: 'MinistryName',
  elmis: { candidate_id: 'MIN-001', labor_id: 'LAB-001', status: 'verified' as const, mode: 'live' as const, checked_at: '2026-11-08' } };
describe('ministry candidate matching', () => {
  it('merges repeated official entries once, preserving profile ID, tracking and operational fields', () => {
    const result = mergeMinistryCandidateFeed([original], [feed, feed], demo.localAgencies);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: original.id, tracking_code: original.tracking_code, first_name: 'MinistryName',
      profile_image_url: original.profile_image_url, payment_status: original.payment_status, elmis: feed.elmis });
    expect(result[0].assigned_staff_id).toBe(original.assigned_staff_id);
    expect(mergeMinistryCandidateFeed(result, [feed], demo.localAgencies)).toEqual(result);
    expect(original.first_name).not.toBe('MinistryName');
    expect(candidateLaborId(result[0], [])).toBe('LAB-001');
  });
  it('accepts a new official identity with a known ministry-assigned agency, but rejects unknown agencies and collisions atomically', () => {
    const other = { ...feed, id: 'another', passport_number: 'OTHER-PASSPORT', tracking_code: 'TRK-OTHER',
      local_agency_id: demo.localAgencies[1].id, elmis: { ...feed.elmis, candidate_id: 'MIN-002', labor_id: 'LAB-002' } };
    expect(mergeMinistryCandidateFeed([original], [other], demo.localAgencies)).toHaveLength(2);
    expect(() => mergeMinistryCandidateFeed([original], [{ ...other, local_agency_id: 'unknown' }], demo.localAgencies)).toThrow('known local agency');
    const existing = mergeMinistryCandidateFeed([original], [feed], demo.localAgencies);
    const before = structuredClone(existing);
    expect(() => mergeMinistryCandidateFeed(existing, [{ ...other, passport_number: feed.passport_number }], demo.localAgencies)).toThrow('different ministry candidate');
    expect(existing).toEqual(before);
    expect(() => mergeMinistryCandidateFeed(existing, [{ ...other, elmis: { ...other.elmis, labor_id: feed.elmis.labor_id } }], demo.localAgencies)).toThrow('different ministry candidate');
    expect(() => mergeMinistryCandidateFeed([original, { ...original, id: 'duplicate' }], [feed], demo.localAgencies)).toThrow('several existing records');
  });
  it('never creates a candidate from a missing or ambiguous passport match', () => {
    expect(matchPassportCandidate([original], ` ${original.passport_number.toLowerCase()} `).id).toBe(original.id);
    expect(() => matchPassportCandidate([original], 'NO-MATCH')).toThrow('no new record');
    expect(() => matchPassportCandidate([original, { ...original, id: 'duplicate' }], original.passport_number)).toThrow('Several records');
  });
  it('keeps multiple identity discrepancy entries visible rather than treating a ministry feed as proof that conflicts cannot happen', () => {
    const findings = analyzeIntegrity({ candidates: [
      { ...feed, passport_identity: { first_name: 'Different', last_name: feed.last_name, dob: feed.dob, gender: feed.gender, passport_number: feed.passport_number } },
      { ...feed, id: 'duplicate', passport_number: 'OTHER' },
    ], stages: [], medicals: [], payments: [], paymentStatuses: [], logs: [] });
    expect(findings.filter(finding => finding.rule === 'duplicate-labor-id')).toHaveLength(2);
    expect(findings.filter(finding => finding.rule === 'passport-identity-mismatch')).toHaveLength(1);
  });
});
