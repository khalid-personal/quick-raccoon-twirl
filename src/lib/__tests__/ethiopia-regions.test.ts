import { describe, expect, it } from 'vitest';
import { prefillCandidateRegion, REGION_NOT_SET, resolveEthiopianRegion } from '../ethiopia-regions';
import { candidateCity, candidateRegion, groupCandidates, selectDashboardCandidates } from '../dashboard-drilldown';
import { generateDemoDataset } from '../demo-dataset';
import type { Candidate } from '../types';

describe('Ethiopian home-region lookup', () => {
  it('resolves common cities and normalizes alternate spellings', () => {
    expect(resolveEthiopianRegion('Addis Ababa')).toBe('Addis Ababa');
    expect(resolveEthiopianRegion('Nazrēt')).toBe('Oromia');
    expect(resolveEthiopianRegion('Gonder')).toBe('Amhara');
    expect(resolveEthiopianRegion('Awasa')).toBe('Sidama');
    expect(resolveEthiopianRegion('Debre Birhan')).toBe('Amhara');
    expect(resolveEthiopianRegion('Nekemtē')).toBe('Oromia');
    expect(resolveEthiopianRegion('Dilla')).toBe('South Ethiopia');
  });

  it('uses an explicit region and preserves unknown cities as unrecorded', () => {
    expect(resolveEthiopianRegion('Unknown town', 'Tigray')).toBe('Tigray');
    expect(resolveEthiopianRegion('Unknown town')).toBe(REGION_NOT_SET);
  });
  it('prefills missing regions without overwriting manual values or inventing unknown origins', () => {
    expect(prefillCandidateRegion({ home_city: 'Bahir Dar', country_of_origin: 'Ethiopia' })).toMatchObject({ home_region: 'Amhara' });
    expect(prefillCandidateRegion({ home_city: 'Adama', home_region: 'Somali' }).home_region).toBe('Somali');
    expect(prefillCandidateRegion({ home_city: 'Unknown town' })).not.toHaveProperty('home_region');
    expect(prefillCandidateRegion({ home_city: 'Adama', country_of_origin: 'Kenya' })).not.toHaveProperty('home_region');
  });

  it('fills region values for all cities used by existing demo candidates', () => {
    const data = generateDemoDataset(Date.parse('2026-07-19T12:00:00Z'), 'priority');
    expect(data.candidates.every(candidate => !!candidate.home_region && candidate.home_region !== REGION_NOT_SET)).toBe(true);
  });
});

describe('dashboard origin and agency drill-downs', () => {
  const candidates = [
    { id: 'one', home_city: 'Adama', country_of_origin: 'Ethiopia', local_agency_id: 'local-1', foreign_agency_id: 'foreign-1' },
    { id: 'two', home_city: 'Adama', country_of_origin: 'Ethiopia', local_agency_id: 'local-1', foreign_agency_id: 'foreign-2' },
    { id: 'three', home_city: 'Jimma', country_of_origin: 'Ethiopia', local_agency_id: 'local-2', foreign_agency_id: 'foreign-1' },
    { id: 'four', home_city: 'Bahir Dar', country_of_origin: 'Ethiopia', local_agency_id: 'local-1' },
  ] as Candidate[];
  it('ranks regions and drills into city counts and exact candidate records', () => {
    expect(groupCandidates(candidates, candidateRegion)[0]).toEqual({ name: 'Oromia', count: 3 });
    const region = selectDashboardCandidates(candidates, [], { kind: 'region', name: 'Oromia' });
    expect(groupCandidates(region, candidateCity)[0]).toEqual({ name: 'Adama', count: 2 });
    expect(selectDashboardCandidates(candidates, [], { kind: 'city', name: 'Adama', region: 'Oromia' }).map(candidate => candidate.id)).toEqual(['one', 'two']);
  });
  it('keeps agency drill-downs scoped by ID and local ownership', () => {
    expect(selectDashboardCandidates(candidates, [], { kind: 'foreign-agency', id: 'foreign-1', name: 'Agency' }, 'local-1').map(candidate => candidate.id)).toEqual(['one']);
    expect(selectDashboardCandidates(candidates, [], { kind: 'local-agency', id: 'local-2', name: 'Agency' }).map(candidate => candidate.id)).toEqual(['three']);
  });
});
