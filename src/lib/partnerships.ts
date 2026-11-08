import { getConfig, getForeignAgencies, getLocalAgencies } from './data-store';
import type { AgencyPartnership, Candidate, ForeignAgency, LocalAgency, ProfileSubmission } from './types';

export const getPartnerships = (): AgencyPartnership[] => getConfig().agencyPartnerships ?? [];

export const foreignPartnersOf = (localId: string | undefined, partnerships = getPartnerships(), foreigns: ForeignAgency[] = getForeignAgencies()): ForeignAgency[] =>
  partnerships.filter(p => p.local_agency_id === localId).map(p => foreigns.find(f => f.id === p.foreign_agency_id)).filter((f): f is ForeignAgency => !!f);

export const localPartnersOf = (foreignId: string | undefined, partnerships = getPartnerships(), locals: LocalAgency[] = getLocalAgencies()): LocalAgency[] =>
  partnerships.filter(p => p.foreign_agency_id === foreignId).map(p => locals.find(l => l.id === p.local_agency_id)).filter((l): l is LocalAgency => !!l);

export const submissionTo = (candidate: Pick<Candidate, 'profile_submissions'>, foreignId: string | undefined): ProfileSubmission | undefined =>
  candidate.profile_submissions?.find(s => s.foreign_agency_id === foreignId);
