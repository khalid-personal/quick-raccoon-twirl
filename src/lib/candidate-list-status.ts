import { isCleared } from './ksa-visa';
import type { CandidateSummary } from './types';

export interface CandidateListStatusCounts {
  inProgress: number;
  pendingQr: number;
  completed: number;
  failed: number;
  total: number;
}
export type CandidateListStatus = 'inProgress' | 'pendingQr' | 'completed' | 'failed';
export const isCandidateListStatus = (value: string): value is CandidateListStatus => ['inProgress', 'pendingQr', 'completed', 'failed'].includes(value);
export const candidateListStatus = (candidate: CandidateSummary): CandidateListStatus => {
  const ministryStatus = candidate.clearance?.labour_ministry?.status;
  if (candidate.overall_status === 'Blocked' || ministryStatus === 'rejected' || ministryStatus === 'error') return 'failed';
  if (candidate.overall_status === 'Completed') return 'completed';
  if (candidate.clearance?.local_ready_at && !isCleared(candidate)) return 'pendingQr';
  return 'inProgress';
};

export const summarizeCandidateListStatuses = (candidates: CandidateSummary[]): CandidateListStatusCounts => {
  const counts: CandidateListStatusCounts = { inProgress: 0, pendingQr: 0, completed: 0, failed: 0, total: candidates.length };

  candidates.forEach(candidate => {
    counts[candidateListStatus(candidate)] += 1;
  });

  return counts;
};
