import type { Candidate, CandidateStage } from './types';
import { prefillCandidateRegion, REGION_NOT_SET } from './ethiopia-regions';
import { calculateOverallStatus } from './utils-data';

export type DashboardSelection = {
  kind: 'all' | 'local-agency' | 'foreign-agency' | 'region' | 'city' | 'coc' | 'status' | 'stage' | 'deployed' | 'active';
  name: string;
  id?: string;
  region?: string;
  stageId?: number;
};

export const candidateRegion = (candidate: Candidate) => prefillCandidateRegion(candidate).home_region || REGION_NOT_SET;
export const candidateCity = (candidate: Candidate) => candidate.home_city?.trim() || 'City not recorded';

export const groupCandidates = (candidates: Candidate[], valueOf: (candidate: Candidate) => string) => {
  const groups = new Map<string, number>();
  candidates.forEach(candidate => {
    const value = valueOf(candidate);
    groups.set(value, (groups.get(value) ?? 0) + 1);
  });
  return [...groups].map(([name, count]) => ({ name, count })).sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));
};

export const selectDashboardCandidates = (candidates: Candidate[], stages: CandidateStage[], selection: DashboardSelection, localAgencyId?: string) => {
  return candidates.filter(candidate => {
    if (localAgencyId && candidate.local_agency_id !== localAgencyId) return false;
    switch (selection.kind) {
      case 'local-agency': return candidate.local_agency_id === selection.id;
      case 'foreign-agency': return candidate.foreign_agency_id === selection.id;
      case 'coc': return candidate.coc_facility_id === selection.id;
      case 'region': return candidateRegion(candidate) === selection.name;
      case 'city': return candidateCity(candidate) === selection.name && (!selection.region || candidateRegion(candidate) === selection.region);
      case 'stage': return stages.some(stage => stage.candidate_id === candidate.id && stage.stage_id === selection.stageId && stage.status !== 'Pending');
      case 'status': return calculateOverallStatus(stages.filter(stage => stage.candidate_id === candidate.id)) === selection.name;
      case 'deployed': return calculateOverallStatus(stages.filter(stage => stage.candidate_id === candidate.id)) === 'Completed';
      case 'active': return calculateOverallStatus(stages.filter(stage => stage.candidate_id === candidate.id)) !== 'Completed';
      default: return true;
    }
  });
};