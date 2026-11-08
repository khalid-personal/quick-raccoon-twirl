// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCandidates, initializeDataStore, saveCandidates } from '../../data-store';
import { attachCandidatePassport, createCandidate, updateCandidateDetails } from '../candidate-crud';
import { getApiPrincipal } from '../auth';
import { parsePassportMrz } from '../../passport-mrz';
import { generateDemoDataset } from '../../demo-dataset';
vi.mock('../auth', () => ({ getApiPrincipal: vi.fn() }));

describe('passport registration persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    initializeDataStore();
    sessionStorage.setItem('dawm_demo_session', '1');
    saveCandidates(generateDemoDataset(Date.parse('2026-11-08')).candidates.slice(0, 1));
    vi.mocked(getApiPrincipal).mockResolvedValue({ id: 'super', role: 'superadmin', localAgencyId: null, foreignAgencyId: null });
  });
  it('attaches scanned passport metadata without creating or replacing a ministry identity', async () => {
    const candidate = getCandidates()[0];
    const scanned = parsePassportMrz('P<USAERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36USA7408122F1204159ZE184226B<<<<<10')!;
    saveCandidates([{ ...candidate, passport_number: scanned.passport_number! }]);
    const updated = await attachCandidatePassport({ data: {
      ...scanned,
      first_name: scanned.first_name!, last_name: scanned.last_name!, dob: scanned.dob!,
      passport_number: scanned.passport_number!, gender: scanned.gender!,
    }, imageUrl: 'data:image/png;base64,ABC', screeningReport: { status: 'review', findings: ['Check identity'], scanned_at: '2026-11-08' } });
    expect(getCandidates()).toHaveLength(1);
    expect(updated).toMatchObject({
      id: candidate.id, tracking_code: candidate.tracking_code, first_name: candidate.first_name, country_of_origin: candidate.country_of_origin,
      passport_nationality: 'United States', passport_issuing_country: 'United States',
      passport_expiry_date: '2012-04-15', passport_document_type: 'P',
    });
    expect(updated.passport_identity?.first_name).toBe(scanned.first_name);
  });
  it('rejects all manual candidate creation without modifying stored records', async () => {
    const candidate = getCandidates()[0];
    const before = { ...localStorage };
    await expect(createCandidate({
      ...candidate, tracking_code: ` ${candidate.tracking_code.toLowerCase()} `,
      email: 'new@example.test', passport_number: 'new-passport',
    }, 'test-operator', 'operator@example.test')).rejects.toThrow('ministry');
    expect({ ...localStorage }).toEqual(before);
  });
  it('rejects ambiguous, unknown, blocked and cross-agency passport uploads without creating records', async () => {
    const candidate = getCandidates()[0];
    const scan = { data: { first_name: candidate.first_name, last_name: candidate.last_name, dob: candidate.dob, passport_number: candidate.passport_number, gender: 'female' as const },
      imageUrl: 'data:image/png;base64,ABC', screeningReport: { status: 'clear' as const, findings: [], scanned_at: '2026-11-08' } };
    const before = { ...localStorage };
    await expect(attachCandidatePassport({ ...scan, data: { ...scan.data, passport_number: 'UNKNOWN' } })).rejects.toThrow('no new record');
    await expect(attachCandidatePassport({ ...scan, screeningReport: { ...scan.screeningReport, status: 'blocked' } })).rejects.toThrow('screened passport');
    vi.mocked(getApiPrincipal).mockResolvedValue({ id: 'local', role: 'local-agency', localAgencyId: 'another-agency', foreignAgencyId: null });
    await expect(attachCandidatePassport(scan)).rejects.toThrow('not assigned');
    expect({ ...localStorage }).toEqual(before);
    vi.mocked(getApiPrincipal).mockResolvedValue({ id: 'super', role: 'superadmin', localAgencyId: null, foreignAgencyId: null });
    saveCandidates([candidate, { ...candidate, id: 'duplicate' }]);
    await expect(attachCandidatePassport(scan)).rejects.toThrow('Several records');
    expect(getCandidates()).toHaveLength(2);
  });
  it('protects ministry identity, Labor ID and local assignment while leaving contact support editable', async () => {
    const candidate = { ...getCandidates()[0], elmis: { candidate_id: 'MIN-1', labor_id: 'LAB-1', mode: 'live' as const, status: 'verified' as const, checked_at: '2026-11-08' } };
    saveCandidates([candidate]);
    await expect(updateCandidateDetails(candidate.id, { first_name: 'Changed' }, 'operator', 'operator@test.test')).rejects.toThrow('through ELMIS');
    await expect(updateCandidateDetails(candidate.id, { local_agency_id: 'another' }, 'operator', 'operator@test.test')).rejects.toThrow('ministry record');
    await expect(updateCandidateDetails(candidate.id, { elmis: { ...candidate.elmis, labor_id: 'OTHER' } }, 'operator', 'operator@test.test')).rejects.toThrow('Labor ID');
    await expect(updateCandidateDetails(candidate.id, { phone_number: 'support-contact' }, 'operator', 'operator@test.test')).resolves.toMatchObject({ phone_number: 'support-contact' });
  });
});
