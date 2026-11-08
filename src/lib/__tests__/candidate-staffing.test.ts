import { describe, expect, it } from 'vitest';
import { candidateWorkType, fillStaffingSelection, filterStaffingCandidates } from '../candidate-staffing';
import { generateDemoDataset } from '../demo-dataset';

const candidates = generateDemoDataset(new Date('2026-11-07').getTime()).candidates;
describe('foreign worker selection', () => {
  it('treats housemaids and housekeepers as one job filter without inventing missing jobs', () => {
    expect(candidateWorkType({ occupation: 'Housekeeper' })).toBe('Housemaid / housekeeper');
    expect(candidateWorkType({ occupation: 'house maid' })).toBe('Housemaid / housekeeper');
    expect(candidateWorkType({})).toBe('Not recorded');
    expect(candidates.every(candidate => candidate.occupation && candidate.languages?.length)).toBe(true);
  });
  it('combines job and language filters case-insensitively', () => {
    const language = candidates.find(candidate => candidate.occupation === 'Housekeeper')!.languages![0];
    const result = filterStaffingCandidates(candidates, { workType: 'housemaid / housekeeper', language: language.toLowerCase() });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(candidate => candidate.occupation === 'Housekeeper' && candidate.languages?.includes(language))).toBe(true);
    expect(filterStaffingCandidates(candidates, { workType: '', language: '' })).toHaveLength(candidates.length);
  });
  it('fills only open slots and keeps prior selection when filters change', () => {
    const picked = candidates.slice(0, 4).map(candidate => candidate.id);
    const result = fillStaffingSelection(picked, candidates.slice(2, 20), 10);
    expect(result).toHaveLength(10);
    expect(result.slice(0, 4)).toEqual(picked);
    expect(new Set(result).size).toBe(10);
    expect(fillStaffingSelection(result, candidates, 10)).toEqual(result);
  });
  it('rejects invalid requested worker counts', () => {
    for (const value of [0, -1, 1.5, 501, NaN]) expect(() => fillStaffingSelection([], candidates, value)).toThrow('between 1 and 500');
  });
});
