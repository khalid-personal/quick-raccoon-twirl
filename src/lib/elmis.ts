import type { Candidate, ElmisRecord } from './types';
import { getCandidates, saveCandidates } from './data-store';
import { isDemoMode } from './demo-mode';
import { recordApprovalLog } from './api/log-management';

export const getElmisMode = async (): Promise<'live' | 'sandbox' | null> => isDemoMode() ? 'sandbox' : null;

export const verifyCandidateWithElmis = async (candidate: Candidate, actor: { id: string; email: string }): Promise<ElmisRecord> => {
  if (!isDemoMode()) throw new Error('ELMIS verification is not configured.');
  const current = getCandidates().find(item => item.id === candidate.id);
  if (!current) throw new Error('Candidate not found.');

  const record: ElmisRecord = {
    status: 'verified',
    registration_id: `DEMO-ELMIS-${current.tracking_code}`,
    checked_at: new Date().toISOString(),
    mode: 'sandbox',
    message: 'Demo simulation only; no external ELMIS lookup was performed.',
  };
  saveCandidates(getCandidates().map(item => item.id === current.id ? { ...item, elmis: record } : item));
  await recordApprovalLog(actor.id, actor.email, 'Candidate', current.id, 'Updated', `Demo-only ELMIS verification simulated for ${current.tracking_code}; no external lookup was performed.`);
  return record;
};

const csvCell = (value: string): string => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const buildElmisCsv = (candidates: Candidate[]): string => [
  'tracking_code,first_name,last_name,passport_number,date_of_birth',
  ...candidates.map(candidate => [candidate.tracking_code, candidate.first_name, candidate.last_name, candidate.passport_number, candidate.dob].map(value => csvCell(value ?? '')).join(',')),
].join('\n');
