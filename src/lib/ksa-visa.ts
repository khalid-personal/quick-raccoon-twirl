import type { Candidate, ClearanceRecord, ClearanceStepKey, VisaRecord } from './types';
import { MINISTRY_STAGE_MESSAGE } from './ministry-candidates';

type Actor = { id: string; email: string };
export const getVisaServiceInfo = async (): Promise<{ modes: Record<'visa' | ClearanceStepKey, 'live' | 'sandbox'>; providerName: string } | null> => null;
export const getVisaServiceModes = async () => (await getVisaServiceInfo())?.modes ?? null;
export const getKsaServiceModes = getVisaServiceModes;

export const verifyVisa = async (_candidate: Candidate, _visaNumber: string, _actor: Actor): Promise<VisaRecord> => { throw new Error(MINISTRY_STAGE_MESSAGE); };
export const checkClearanceStep = async (_candidate: Candidate, _step: ClearanceStepKey, _reference: string, _actor: Actor): Promise<ClearanceRecord> => { throw new Error(MINISTRY_STAGE_MESSAGE); };
export const clearCandidate = async (_candidate: Candidate, _actor: Actor): Promise<ClearanceRecord> => { throw new Error(MINISTRY_STAGE_MESSAGE); };
export const simulateMinistryQrIssuance = async (_candidate: Candidate, _actor: Actor): Promise<NonNullable<ClearanceRecord['labour_ministry']>> => { throw new Error(MINISTRY_STAGE_MESSAGE); };

export const isVisaValid = (candidate: Candidate): boolean => {
  const visa = candidate.visa;
  return !!visa && visa.status === 'validated' && (!visa.expiry_date || Date.parse(visa.expiry_date) >= Date.now());
};
export const clearanceBlockers = (candidate: Candidate): string[] => [
  ...(!isVisaValid(candidate) ? ['Visa reference pending'] : []),
  ...(candidate.clearance?.enjaz?.status !== 'completed' ? ['Enjaz pending'] : []),
  ...(candidate.clearance?.tasheer?.status !== 'completed' ? ['Tasheer pending'] : []),
];
export const isCleared = (candidate: Candidate): boolean => {
  const ministry = candidate.clearance?.labour_ministry;
  return clearanceBlockers(candidate).length === 0 && ministry?.status === 'cleared'
    && ministry.mode === 'live' && !ministry.simulated && !!ministry.certificate_no;
};
const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
};
export const buildClearanceCsv = (candidates: Candidate[]): string => [
  'tracking_code,visa_reference,visa_status,enjaz_reference,enjaz_status,tasheer_reference,tasheer_status,ministry_reference,ministry_status',
  ...candidates.map(candidate => [candidate.tracking_code, candidate.visa?.visa_number, candidate.visa?.status,
    candidate.clearance?.enjaz?.reference, candidate.clearance?.enjaz?.status, candidate.clearance?.tasheer?.reference,
    candidate.clearance?.tasheer?.status, candidate.clearance?.labour_ministry?.certificate_no, candidate.clearance?.labour_ministry?.status].map(csvCell).join(',')),
].join('\n');
export const printClearanceCertificate = (_candidate: Candidate, _agencyName: string): never => {
  throw new Error('Certificates are held by the ministry. Use the ministry reference.');
};
