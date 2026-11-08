import type { Candidate } from './types';

export interface StaffingFilters { workType: string; language: string }
export const candidateWorkType = (candidate: Pick<Candidate, 'occupation'>): string => {
  const recorded = candidate.occupation?.trim();
  if (!recorded) return 'Not recorded';
  return /^(house\s?maid|housekeeper|maid|domestic worker)$/i.test(recorded) ? 'Housemaid / housekeeper' : recorded;
};
export const filterStaffingCandidates = <T extends Candidate>(candidates: T[], filters: StaffingFilters): T[] =>
  candidates.filter(candidate =>
    (!filters.workType || candidateWorkType(candidate).toLowerCase() === filters.workType.toLowerCase())
    && (!filters.language || candidate.languages?.some(language => language.trim().toLowerCase() === filters.language.trim().toLowerCase())),
  );

export const fillStaffingSelection = (selected: string[], visible: Pick<Candidate, 'id'>[], target: number): string[] => {
  if (!Number.isInteger(target) || target < 1 || target > 500) throw new Error('Choose a worker count between 1 and 500.');
  const result = [...new Set(selected)];
  for (const candidate of visible) {
    if (result.length >= target) break;
    if (!result.includes(candidate.id)) result.push(candidate.id);
  }
  return result;
};
