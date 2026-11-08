import { getApiPrincipal } from './auth';
import { getCandidates, getCandidateStages, getChatMessages } from '../data-store';
import type { ApiPrincipal } from './auth';
import type { Candidate, CandidateStage, ChatMessage } from '../types';

export function candidateChatInbox(principal: ApiPrincipal, candidates: Candidate[], stages: CandidateStage[], messages: ChatMessage[]) {
  const allowed = candidates.filter(candidate => {
    if (principal.role === 'candidate') return candidate.id === principal.candidateId;
    if (principal.role === 'superadmin' || principal.role === 'admin') return !principal.localAgencyId || candidate.local_agency_id === principal.localAgencyId;
    if (principal.role === 'staff') return (!principal.localAgencyId || candidate.local_agency_id === principal.localAgencyId)
      && (candidate.assigned_staff_id === principal.id || stages.some(stage => stage.candidate_id === candidate.id && stage.assigned_staff_id === principal.id));
    if (principal.role === 'local-agency') return !!principal.localAgencyId && candidate.local_agency_id === principal.localAgencyId;
    if (['agency', 'foreign-agency', 'foreign-agency-staff'].includes(principal.role)) return !!principal.foreignAgencyId
      && (candidate.foreign_agency_id === principal.foreignAgencyId || candidate.profile_shares?.some(share => share.foreign_agency_id === principal.foreignAgencyId));
    return false;
  });
  const threads = allowed.flatMap(candidate => {
    const own = messages.filter(message => message.candidate_id === candidate.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (!own.length) return [];
    const unread = own.filter(message => principal.role === 'candidate'
      ? message.sender !== 'candidate' && !message.is_read_by_candidate : message.sender === 'candidate' && !message.is_read_by_admin).length;
    return [{ candidate, latest: own[0], unread }];
  }).sort((a, b) => b.latest.timestamp.localeCompare(a.latest.timestamp));
  return { candidates: allowed, threads, unread: threads.reduce((sum, thread) => sum + thread.unread, 0) };
}

export async function getCandidateChatInbox() {
  const principal = await getApiPrincipal();
  if (['viewer', 'auditor'].includes(principal.role)) throw new Error('Candidate chat is not available to read-only accounts.');
  return candidateChatInbox(principal, getCandidates(), getCandidateStages(), getChatMessages());
}
