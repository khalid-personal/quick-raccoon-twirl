import { ALL_STAGES, type Candidate, type CandidateStage, type LocalAgency } from './types';

export const MINISTRY_INTAKE_MESSAGE = 'Candidates must come from the ministry through ELMIS. Manual candidate creation is unavailable. The official API connection is pending.';
export const normalizeIdentity = (value?: string) => (value ?? '').replace(/[\s-]/g, '').toUpperCase();

export function matchPassportCandidate(candidates: Candidate[], passportNumber: string): Candidate {
  const key = normalizeIdentity(passportNumber);
  if (!key) throw new Error('Review the scanned passport number before continuing.');
  const matches = candidates.filter(candidate => normalizeIdentity(candidate.passport_number) === key);
  if (!matches.length) throw new Error('No existing ministry candidate matches this passport. Ask the ministry to register or assign the candidate in ELMIS; no new record was created.');
  if (matches.length > 1) throw new Error('Several records use this passport. Resolve the identity warning before attaching the upload.');
  return matches[0];
}

export function candidateLaborId(candidate: Candidate, stages: CandidateStage[]): string | undefined {
  const registrationId = ALL_STAGES.find(stage => stage.slug === 'registration')?.id;
  return candidate.elmis?.labor_id || stages.find(stage => stage.candidate_id === candidate.id && stage.stage_id === registrationId)?.reference_id || undefined;
}

// The eventual server adapter must map the official API response to this internal model.
export function mergeMinistryCandidateFeed(existing: Candidate[], incoming: Candidate[], agencies: LocalAgency[]): Candidate[] {
  const next = existing.map(candidate => ({ ...candidate }));
  for (const candidate of incoming) {
    if (!normalizeIdentity(candidate.elmis?.candidate_id) || candidate.elmis?.mode !== 'live' || !normalizeIdentity(candidate.elmis.labor_id)
      || !normalizeIdentity(candidate.passport_number) || !candidate.local_agency_id || !agencies.some(agency => agency.id === candidate.local_agency_id)) {
      throw new Error('A ministry record needs its official candidate ID, Labor ID, passport and a known local agency.');
    }
    const keys = (item: Candidate) => [
      !!item.elmis?.candidate_id && normalizeIdentity(item.elmis.candidate_id) === normalizeIdentity(candidate.elmis?.candidate_id),
      !!item.elmis?.labor_id && normalizeIdentity(item.elmis.labor_id) === normalizeIdentity(candidate.elmis?.labor_id),
      normalizeIdentity(item.passport_number) === normalizeIdentity(candidate.passport_number),
    ].some(Boolean);
    const matches = next.filter(keys);
    if (matches.length > 1) throw new Error('Ministry identifiers match several existing records. Resolve the duplicate before syncing.');
    const prior = matches[0];
    if (prior?.elmis?.candidate_id && normalizeIdentity(prior.elmis.candidate_id) !== normalizeIdentity(candidate.elmis.candidate_id)) {
      throw new Error('A passport or Labor ID belongs to a different ministry candidate. Review the conflicting entries.');
    }
    if (!prior && next.some(item => item.id === candidate.id || normalizeIdentity(item.tracking_code) === normalizeIdentity(candidate.tracking_code))) {
      throw new Error('The ministry record conflicts with an existing record or tracking code.');
    }
    const merged: Candidate = prior ? { ...prior,
      first_name: candidate.first_name, last_name: candidate.last_name, dob: candidate.dob, gender: candidate.gender,
      passport_number: candidate.passport_number, local_agency_id: candidate.local_agency_id,
      home_city: candidate.home_city ?? prior.home_city, home_region: candidate.home_region ?? prior.home_region,
      elmis: candidate.elmis, last_synced_at: candidate.last_synced_at, updated_at: candidate.updated_at,
    } : { ...candidate };
    if (prior) next[next.indexOf(prior)] = merged;
    else next.push(merged);
  }
  return next;
}
