import { ALL_STAGES, type CandidateDetail } from './types';
import { blobDataUrl, getDocumentFile } from './document-files';
import { isDemoMode } from './demo-mode';
import { getConfig } from './data-store';
import { submissionDeadline } from './submission-policy';

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
export const safeDocumentUrl = (value?: string): string | undefined => {
  if (!value || value.includes('/placeholder') || value === 'generated') return undefined;
  if (/^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
};
export interface PackageDocument { id: string; title: string; stage: string; updatedAt: string; url?: string; filename: string; local: boolean; }
export const packageMinistryBrand = 'Ethiopian Ministry of Labor and Skills';
export function packageSubmissionWindow(): string {
  try {
    const window = submissionDeadline(getConfig());
    return `${window.start} through ${window.end} (Ethiopia dates); Deadline: ${window.end}; State: ${window.status}${window.status === 'expired' ? ' - deadline passed' : ''}; Source: ${window.source === 'ministry' ? 'configured ministry window' : 'default seven-day window (not ministry-issued)'}`;
  } catch {
    return 'Unavailable - invalid submission window; ask the superadmin to correct Settings. No valid deadline confirmed.';
  }
}
export function candidatePackageSummary(candidate: CandidateDetail) {
  return {
    name: `${candidate.first_name} ${candidate.last_name}`, trackingCode: candidate.tracking_code,
    updatedAt: candidate.updated_at, passport: candidate.passport_number,
    nationality: candidate.passport_nationality ?? candidate.country_of_origin,
    birthDate: candidate.dob, gender: candidate.gender ?? 'Not recorded',
    email: candidate.email, phone: candidate.phone_number ?? 'Not recorded',
    passportExpiry: candidate.passport_expiry_date ?? 'Not recorded',
    introduction: candidate.professional_summary ?? 'Not recorded',
    skills: candidate.skills?.join(', ') ?? 'Not recorded',
    city: candidate.home_city ?? 'Not recorded', occupation: candidate.occupation ?? 'Not recorded',
    languages: candidate.languages?.join(', ') ?? 'Not recorded',
    agencies: [candidate.local_agency_name, candidate.foreign_agency_name].filter(Boolean).join(' / ') || 'Not recorded',
    stages: ALL_STAGES.map(meta => {
      const stage = candidate.stages.find(stage => stage.stage_id === meta.id);
      return { title: meta.title, status: stage?.status ?? 'Not recorded', date: stage?.date ?? '', reference: stage?.reference_id ?? '', updatedAt: stage?.updated_at ?? '' };
    }),
    contract: candidate.work_contract_record?.status ?? 'not-sent',
    ministry: candidate.clearance?.labour_ministry?.simulated ? 'Simulated - not official' : candidate.clearance?.labour_ministry?.status ?? 'Not issued',
    flight: candidate.flight ? [candidate.flight.airline, candidate.flight.flight_number, candidate.flight.departure_airport, candidate.flight.arrival_airport, candidate.flight.departure_time, candidate.flight.arrival_time].filter(Boolean).join(' / ') : 'Not recorded',
    employer: candidate.work_contract_record?.status === 'received' && candidate.employer ? [candidate.employer.company, candidate.employer.contact_name, candidate.employer.phone, candidate.employer.address].filter(Boolean).join(' / ') : 'Available when the contract is received',
    returnDate: candidate.actual_return_date ?? candidate.expected_return_date ?? 'Not recorded',
  };
}
export function candidatePackageFields(candidate: CandidateDetail): [string, string][] {
  const summary = candidatePackageSummary(candidate);
  return [['Tracking code', summary.trackingCode], ['Last candidate update', summary.updatedAt], ['Date of birth', summary.birthDate], ['Gender', summary.gender], ['Email', summary.email], ['Phone', summary.phone], ['Passport', summary.passport], ['Passport expiry', summary.passportExpiry], ['Nationality', summary.nationality], ['Home city', summary.city], ['Occupation', summary.occupation], ['Introduction', summary.introduction], ['Skills', summary.skills], ['Languages', summary.languages], ['Agencies', summary.agencies], ['Contract', summary.contract], ['Ministry clearance', summary.ministry], ['Submission window', packageSubmissionWindow()], ['Flight', summary.flight], ['Employer', summary.employer], ['Return date', summary.returnDate]];
}
export async function candidatePackageDocuments(candidate: CandidateDetail): Promise<PackageDocument[]> {
  const documents: PackageDocument[] = [
    { id: 'passport', title: 'Passport', stage: 'Registration', filename: 'passport', url: safeDocumentUrl(candidate.passport_image_url), updatedAt: candidate.updated_at, local: !!candidate.passport_image_url?.startsWith('data:') },
    { id: 'contract', title: 'Work contract', stage: 'Deployment', filename: 'work-contract', url: candidate.work_contract_record && candidate.work_contract_record.status !== 'not-sent' ? safeDocumentUrl(candidate.work_contract_record.url) : undefined, updatedAt: candidate.work_contract_record?.received_at ?? '', local: !!candidate.work_contract_record?.url?.startsWith('data:') },
    { id: 'ministry', title: candidate.clearance?.labour_ministry?.simulated ? 'Ministry QR (DEMO - NOT OFFICIAL)' : 'Ministry QR', stage: 'Deployment', filename: 'ministry-qr.png', url: candidate.clearance?.labour_ministry?.status === 'cleared' ? safeDocumentUrl(candidate.clearance?.labour_ministry?.qr_image_url) : undefined, updatedAt: candidate.clearance?.labour_ministry?.issued_at ?? '', local: !!candidate.clearance?.labour_ministry?.qr_image_url?.startsWith('data:') },
  ];
  const medicalDocumentIds = new Set(candidate.medical_results.map(result => result.document_id).filter(Boolean));
  for (const doc of candidate.documents.filter(doc => doc.candidate_id === candidate.id && !medicalDocumentIds.has(doc.id) && !/bank[\s_-]*statement|medical[\s_-]*(result|report)/i.test(doc.file_name))) {
    const blob = await getDocumentFile(doc.id);
    documents.push({ id: doc.id, title: doc.file_name, filename: doc.file_name, stage: ALL_STAGES.find(stage => stage.id === doc.stage_id)?.title ?? 'General',
      updatedAt: doc.uploaded_at, url: blob ? await blobDataUrl(blob) : safeDocumentUrl(doc.public_url), local: !!blob });
  }
  return documents;
}
export function deploymentPackageHtml(candidate: CandidateDetail, documents: PackageDocument[]): string {
  const summary = candidatePackageSummary(candidate);
  const fields = candidatePackageFields(candidate);
  fields.unshift(['Record classification', isDemoMode() || candidate.clearance?.labour_ministry?.simulated ? 'DEMO - NOT OFFICIAL' : 'Personal record - not an official certificate']);
  documents = documents.map(doc => ({ ...doc, url: safeDocumentUrl(doc.url) }));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; object-src 'none'; base-uri 'none'; form-action 'none'"><title>Deployment package - ${escapeHtml(summary.trackingCode)}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:1000px;margin:32px auto;padding:20px;color:#152641}h1,h2{color:#263da0}table{width:100%;border-collapse:collapse}td,th{padding:12px;border:1px solid #dde5ef;text-align:left}li{padding:10px}a{color:#263da0}small{color:#526078}@media print{a{color:inherit}}</style></head><body><h1>Deployment package</h1><h2>${escapeHtml(summary.name)}</h2><p>Snapshot generated ${escapeHtml(new Date().toISOString())}. This is a candidate record, not an official clearance certificate. New updates require a fresh download.</p><table>${fields.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table><h2>Four-stage progress</h2><table><tr><th>Stage</th><th>Status</th><th>Date</th><th>Reference</th><th>Last update</th></tr>${summary.stages.map(stage => `<tr><td>${escapeHtml(stage.title)}</td><td>${escapeHtml(stage.status)}</td><td>${escapeHtml(stage.date)}</td><td>${escapeHtml(stage.reference)}</td><td>${escapeHtml(stage.updatedAt)}</td></tr>`).join('')}</table><h2>Documents and missing items</h2><ul>${documents.map(doc => `<li><strong>${escapeHtml(doc.stage)}: ${escapeHtml(doc.title)}</strong> - ${doc.url ? `<a href="${escapeHtml(doc.url)}" ${doc.local ? `download="${escapeHtml(doc.filename)}"` : 'target="_blank" rel="noopener noreferrer"'}>${doc.local ? 'Download embedded file' : 'Open online file (not embedded)'}</a>` : 'Missing original file - please ask your agency to upload it'}<br><small>${escapeHtml(doc.updatedAt || 'No upload date')}</small></li>`).join('')}</ul><p>Private staff notes, chats, audit details, medical result details and bank statements are excluded. Only files actually available are included; missing files are never fabricated. Keep this personal package secure.</p></body></html>`;
}
