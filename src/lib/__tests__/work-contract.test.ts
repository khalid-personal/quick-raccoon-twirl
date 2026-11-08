// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getCandidates, initializeDataStore, saveCandidates } from '../data-store';
import { updateWorkContract } from '../work-contract';
import type { Candidate } from '../types';

const candidate: Candidate = {
  id: 'contract-candidate',
  first_name: 'Aster',
  last_name: 'Example',
  dob: '1995-01-01',
  passport_number: 'ET123456',
  tracking_code: 'TRK-ET-1234',
  country_of_origin: 'Ethiopia',
  marital_status: 'Single',
  gender: 'female',
  email: 'aster@example.test',
  professional_summary: 'Experienced household professional.',
  skills: ['Cooking', 'Cleaning'],
  languages: ['Amharic'],
  intro_video_url: 'https://example.test/intro.mp4',
  local_agency_id: 'local-1',
  foreign_agency_id: 'foreign-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  payment_status: 'unpaid',
};

describe('work contract handoff', () => {
  beforeEach(() => {
    sessionStorage.setItem('dawm_demo_session', '1');
    localStorage.clear();
    initializeDataStore();
    saveCandidates([candidate]);
  });

  it('lets the foreign agency send a secure link and the local agency confirm receipt', async () => {
    const sent = await updateWorkContract(candidate.id, 'send', { id: 'foreign-user', email: 'foreign@example.test' }, 'https://contracts.example.test/contract.pdf');
    expect(sent.status).toBe('sent');
    expect(sent.url).toBe('https://contracts.example.test/contract.pdf');
    expect(getCandidates()[0].external_status?.work_contract).not.toBe(true);
    const received = await updateWorkContract(candidate.id, 'receive', { id: 'local-user', email: 'local@example.test' });
    expect(received.status).toBe('received');
    expect(received.received_by).toBe('local@example.test');
    expect(getCandidates()[0].external_status?.work_contract).toBe(true);
  });

  it('rejects insecure contract links', async () => {
    await expect(updateWorkContract(candidate.id, 'send', { id: 'foreign-user', email: 'foreign@example.test' }, 'http://example.test/contract.pdf')).rejects.toThrow(/HTTPS/);
  });

  it('requires a complete candidate introduction before sending a contract', async () => {
    saveCandidates([{ ...candidate, intro_video_url: undefined }]);
    await expect(updateWorkContract(candidate.id, 'send', { id: 'foreign-user', email: 'foreign@example.test' }, 'https://contracts.example.test/contract.pdf')).rejects.toThrow(/introduction video/);
  });
});
