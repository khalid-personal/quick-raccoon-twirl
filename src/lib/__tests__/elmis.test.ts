// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getCandidates, initializeDataStore, saveCandidates } from '../data-store';
import { getElmisMode, verifyCandidateWithElmis } from '../elmis';
import type { Candidate } from '../types';

const candidate: Candidate = {
  id: 'candidate-elmis-test',
  first_name: 'Demo',
  last_name: 'Candidate',
  dob: '1995-01-01',
  passport_number: 'EP123456',
  tracking_code: 'TRK-ELMIS-1',
  country_of_origin: 'Ethiopia',
  marital_status: 'Single',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  payment_status: 'unpaid',
};

describe('ELMIS demo workflow', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('simulates and stores a clearly labeled sandbox verification', async () => {
    sessionStorage.setItem('dawm_demo_session', '1');
    initializeDataStore();
    saveCandidates([candidate]);

    expect(await getElmisMode()).toBe('sandbox');
    const result = await verifyCandidateWithElmis(candidate, { id: 'demo-user', email: 'demo@example.test' });

    expect(result).toMatchObject({ status: 'verified', mode: 'sandbox', registration_id: 'DEMO-ELMIS-TRK-ELMIS-1' });
    expect(result.message).toMatch(/no external ELMIS lookup/);
    expect(getCandidates().find(item => item.id === candidate.id)?.elmis).toEqual(result);
  });

  it('does not simulate ELMIS results in live mode', async () => {
    initializeDataStore();
    saveCandidates([candidate]);
    expect(await getElmisMode()).toBeNull();
    await expect(verifyCandidateWithElmis(candidate, { id: 'user', email: 'user@example.test' })).rejects.toThrow(/not configured/);
  });
});