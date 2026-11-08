import type { Candidate } from './types';
import { isCleared, isVisaValid } from './ksa-visa';

export const departureRequirements = (candidate: Candidate) => [
  { key: 'visa', label: 'Valid visa', ready: isVisaValid(candidate) },
  { key: 'ticket', label: 'Issued ticket number recorded', ready: !!candidate.flight?.ticket_number?.trim() },
  { key: 'ministry-qr', label: 'Official ministry clearance QR', ready: isCleared(candidate) },
];

export const departureBlockers = (candidate: Candidate): string[] => departureRequirements(candidate).filter(requirement => !requirement.ready).map(requirement => requirement.label);