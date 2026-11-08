// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getPublicTrackingData, sendProfileToForeignAgency } from '../tracking-queries';
import { getCandidates, getCandidateStages, getCocFacilities, getForeignAgencies, initializeDataStore, saveCandidates } from '../../data-store';

describe('candidate journey tracking response', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); initializeDataStore(); });
  it('returns home region, assigned CoC details, and a work-contract destination', async () => {
    const center = getCocFacilities()[0];
    const candidate = { ...getCandidates()[0], home_city: 'Adama', home_region: undefined, coc_facility_id: center.id, external_status: { work_contract: true, destination_city: 'Riyadh', destination_country: 'Saudi Arabia' } };
    saveCandidates([candidate]);
    const response = await getPublicTrackingData(candidate.tracking_code);
    expect(response?.journey?.home).toMatchObject({ label: 'Adama' });
    expect(response?.journey?.home_region).toBe('Oromia');
    expect(response?.journey?.center).toMatchObject({ name: center.name, contact_email: center.contact_email, phone_number: center.phone_number });
    expect(response?.journey?.destination?.label).toContain('Riyadh');
    expect(response?.journey?.training_status).toBe(getCandidateStages().find(stage => stage.candidate_id === candidate.id && stage.stage_id === 3)?.status);
    expect(response?.journey?.training_status).toBeDefined();
    expect(response?.journey?.deployment_status).toBe(getCandidateStages().find(stage => stage.candidate_id === candidate.id && stage.stage_id === 4)?.status);
  });
  it('does not invent a home position or expose a destination before a contract', async () => {
    const candidate = { ...getCandidates()[0], home_city: 'Unknown town', external_status: { work_contract: false, destination_city: 'Riyadh', destination_country: 'Saudi Arabia' } };
    saveCandidates([candidate]);
    const response = await getPublicTrackingData(candidate.tracking_code);
    expect(response?.journey?.home).toBeUndefined();
    expect(response?.journey?.destination).toBeUndefined();
  });

  it('requires complete candidate introductions before profile sharing', async () => {
    const candidate = { ...getCandidates()[0], professional_summary: '', intro_video_url: '' };
    saveCandidates([candidate]);
    const agency = getForeignAgencies()[0];

    await expect(sendProfileToForeignAgency(candidate.id, candidate.tracking_code, agency.id, 'actor-1', 'actor@example.test'))
      .rejects.toThrow(/introduction video/);
  });
});