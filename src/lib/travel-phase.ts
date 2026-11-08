import type { Candidate, CandidateStage, Document } from './types';
import { findCity, resolveCandidateDestination } from './ethiopia';

export type TravelPhase = 'contract' | 'visa' | 'transit' | 'arrived' | 'returned' | 'failed';

export const PHASE_META: Record<TravelPhase, { label: string; color: string }> = {
  contract: { label: 'Contract received', color: '#f59e0b' },
  visa: { label: 'Visa issued', color: '#3b82f6' },
  transit: { label: 'In transit', color: '#8b5cf6' },
  arrived: { label: 'Arrived', color: '#10b981' },
  returned: { label: 'Returned home', color: '#b45309' },
  failed: { label: 'Deployment failed', color: '#ef4444' },
};

export interface TravelEntry {
  candidate: Candidate;
  phase: TravelPhase;
  destination: { lat: number; lon: number; label: string };
  returnOrigin?: { lat: number; lon: number; label: string };
}

// Candidates that have a mappable destination, with their colour-coded phase.
export const buildTravelEntries = (candidates: Candidate[], stages: CandidateStage[], documents: Document[]): TravelEntry[] => {
  const entries: TravelEntry[] = [];
  for (const candidate of candidates) {
    const contract = documents
      .filter(d => d.candidate_id === candidate.id && d.doc_kind === 'work_contract')
      .sort((x, y) => y.uploaded_at.localeCompare(x.uploaded_at))[0];
    const abroad = resolveCandidateDestination(candidate.external_status, contract?.extracted);
    const home = candidate.return_status === 'returned' ? findCity(candidate.home_city) : undefined;
    if (candidate.return_status === 'returned' && !home) continue;
    const destination = home ? { lat: home.lat, lon: home.lon, label: home.name } : abroad;
    if (!destination) continue;
    const deployment = stages.find(s => s.candidate_id === candidate.id && s.stage_id === 4)?.status;
    const phase: TravelPhase = candidate.return_status === 'returned' ? 'returned'
      : deployment === 'Failed' ? 'failed'
      : deployment === 'Completed' || candidate.arrival ? 'arrived'
      : deployment === 'In Progress' ? 'transit'
      : candidate.external_status?.visa ? 'visa'
      : 'contract';
    entries.push({ candidate, phase, destination, ...(phase === 'returned' && home && abroad ? { returnOrigin: abroad } : {}) });
  }
  return entries;
};
