import { ALL_STAGES, type Candidate, type CandidateStage, type ChatMessage } from './types';

export type ExecutiveKpi = 'candidates' | 'deployed' | 'departure' | 'waiting' | 'messages';
export const EXECUTIVE_KPI_LABELS: Record<ExecutiveKpi, string> = {
  candidates: 'Total Candidates', deployed: 'Deployed', departure: 'Average time to departure',
  waiting: 'Average time waiting', messages: 'Unread Messages',
};
const DAY = 86_400_000;
const DONE = new Set(['Passed', 'Issued', 'Completed']);

export function executiveJourney(candidate: Candidate, stages: CandidateStage[], now: number) {
  const ordered = [...stages].sort((a, b) =>
    (ALL_STAGES.find(stage => stage.id === a.stage_id)?.ordinal ?? 0) - (ALL_STAGES.find(stage => stage.id === b.stage_id)?.ordinal ?? 0));
  const deployed = ordered.filter(stage => DONE.has(stage.status)).length === ALL_STAGES.length;
  const registered = Date.parse(candidate.created_at);
  const last = ordered[ordered.length - 1];
  const departureAt = deployed && last ? Date.parse(last.date || last.updated_at) : NaN;
  return {
    deployed, registrationAge: (now - registered) / DAY,
    departureDays: deployed ? Math.max(0, (departureAt - registered) / DAY) : null,
    departureAt: Number.isFinite(departureAt) ? new Date(departureAt).toISOString() : undefined,
    stage: ordered.find(stage => !DONE.has(stage.status)),
  };
}

export function executiveKpiRows(candidates: Candidate[], stages: CandidateStage[], messages: ChatMessage[], now: number) {
  const stagesById = new Map<string, CandidateStage[]>();
  stages.forEach(stage => stagesById.set(stage.candidate_id, [...(stagesById.get(stage.candidate_id) ?? []), stage]));
  const messagesById = new Map<string, ChatMessage[]>();
  messages.filter(message => message.sender === 'candidate' && !message.is_read_by_admin)
    .forEach(message => messagesById.set(message.candidate_id, [...(messagesById.get(message.candidate_id) ?? []), message]));
  return candidates.map(candidate => {
    const unread = (messagesById.get(candidate.id) ?? []).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return { candidate, ...executiveJourney(candidate, stagesById.get(candidate.id) ?? [], now),
      unread: unread.length, latestUnread: unread[0] };
  });
}

export type ExecutiveKpiRow = ReturnType<typeof executiveKpiRows>[number];
export function selectExecutiveKpiRows(rows: ExecutiveKpiRow[], metric: ExecutiveKpi) {
  if (metric === 'deployed' || metric === 'departure') return rows.filter(row => row.deployed);
  if (metric === 'waiting') return rows.filter(row => !row.deployed);
  if (metric === 'messages') return rows.filter(row => row.unread > 0);
  return rows;
}
