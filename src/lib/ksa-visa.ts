import { supabase } from './supabase';
import { getCandidates, saveCandidates } from './data-store';
import { recordApprovalLog } from './api/log-management';
import { isDemoMode } from './demo-mode';
import QRCode from 'qrcode';
import type { Candidate, ClearanceRecord, ClearanceStepKey, ClearanceStepStatus, VisaRecord, VisaStatus } from './types';

type Service = 'visa' | ClearanceStepKey;
type Mode = 'live' | 'sandbox';

interface Response {
  modes?: Record<Service, Mode>;
  visaProviderName?: string;
  mode?: Mode;
  status?: string;
  expiry_date?: string;
  occupation?: string;
  sponsor_name?: string;
  mismatches?: string[];
  reference?: string;
  message?: string;
  error?: string;
}

type Actor = { id: string; email: string };

const call = async (payload: Record<string, unknown>): Promise<Response> => {
  if (isDemoMode()) return { error: 'Demo clearance calls should use the local simulator.' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: 'Sign in required.' };
  try {
    const response = await fetch('/api/integrations/visa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      return { error: 'Live clearance verification is unavailable; the provider integration is not configured.' };
    }
    const body = (await response.json()) as Response;
    return response.ok ? body : { error: body.error ?? `Request failed (${response.status}).` };
  } catch {
    return { error: 'Live clearance verification is unavailable; the provider integration could not be reached.' };
  }
};

export const getVisaServiceInfo = async (): Promise<{ modes: Record<Service, Mode>; providerName: string } | null> => {
  if (isDemoMode()) return { modes: { visa: 'sandbox', enjaz: 'sandbox', tasheer: 'sandbox' }, providerName: 'DAWM demo simulation' };
  const result = await call({ action: 'status' });
  return result.modes ? { modes: result.modes, providerName: result.visaProviderName || 'Visa provider' } : null;
};

export const getVisaServiceModes = async (): Promise<Record<Service, Mode> | null> => (await getVisaServiceInfo())?.modes ?? null;
export const getKsaServiceModes = getVisaServiceModes;

const patchCandidate = (id: string, patch: Partial<Candidate>) => {
  const candidates = getCandidates();
  const index = candidates.findIndex(c => c.id === id);
  if (index === -1) throw new Error('Candidate not found.');
  candidates[index] = { ...candidates[index], ...patch, updated_at: new Date().toISOString() };
  saveCandidates(candidates);
  return candidates[index];
};

export const verifyVisa = async (candidate: Candidate, visaNumber: string, actor: Actor): Promise<VisaRecord> => {
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  const result: Response = isDemoMode()
    ? {
      status: 'validated', mode: 'sandbox', expiry_date: expiry.toISOString().slice(0, 10),
      occupation: candidate.occupation, sponsor_name: 'DAWM demo sandbox',
      message: 'Simulated in the demo sandbox; no external visa lookup was performed.',
    }
    : await call({ action: 'verify', service: 'visa', candidate_id: candidate.id, visa_number: visaNumber });
  if (result.error) throw new Error(result.error);
  const record: VisaRecord = {
    visa_number: visaNumber,
    status: (result.status as VisaStatus) ?? 'error',
    expiry_date: result.expiry_date,
    occupation: result.occupation,
    sponsor_name: result.sponsor_name,
    mismatches: result.mismatches,
    message: result.message,
    mode: result.mode ?? 'sandbox',
    source: isDemoMode() ? 'simulation' : 'lookup',
    checked_at: new Date().toISOString(),
  };
  patchCandidate(candidate.id, { visa: record });
  await recordApprovalLog(actor.id, actor.email, 'Candidate', candidate.id, 'Updated', `Visa provider check (${record.mode}) ${visaNumber}: ${record.status}.`);
  return record;
};

export const checkClearanceStep = async (candidate: Candidate, step: ClearanceStepKey, reference: string, actor: Actor): Promise<ClearanceRecord> => {
  const result: Response = isDemoMode()
    ? { status: 'completed', mode: 'sandbox', reference, message: 'Simulated in the demo sandbox; no external provider check was performed.' }
    : await call({ action: 'verify', service: step, candidate_id: candidate.id, reference });
  if (result.error) throw new Error(result.error);
  const status: ClearanceStepStatus = result.status === 'completed' ? 'completed' : result.status === 'rejected' ? 'rejected' : 'pending';
  const clearance: ClearanceRecord = {
    ...candidate.clearance,
    [step]: { status, reference, mode: result.mode ?? 'sandbox', message: result.message, updated_at: new Date().toISOString(), updated_by: actor.email },
  };
  // Clearance is only valid while every step is complete, so reopening a step voids the certificate.
  if (status !== 'completed') {
    delete clearance.certificate_no;
    delete clearance.cleared_at;
    delete clearance.cleared_by;
    delete clearance.labour_ministry;
  }
  patchCandidate(candidate.id, { clearance });
  await recordApprovalLog(actor.id, actor.email, 'Candidate', candidate.id, 'Updated', `${step === 'enjaz' ? 'Enjaz' : 'Tasheer'} ${reference} (${result.mode ?? 'sandbox'}): ${status}.`);
  return clearance;
};

export const isVisaValid = (candidate: Candidate): boolean => {
  const visa = candidate.visa;
  if (!visa || visa.status !== 'validated') return false;
  return !visa.expiry_date || new Date(visa.expiry_date).getTime() >= Date.now();
};

export const clearanceBlockers = (candidate: Candidate): string[] => {
  const blockers: string[] = [];
  if (!isVisaValid(candidate)) blockers.push('Visa not validated');
  if (candidate.clearance?.enjaz?.status !== 'completed') blockers.push('Enjaz pending');
  if (candidate.clearance?.tasheer?.status !== 'completed') blockers.push('Tasheer pending');
  return blockers;
};

const isSecureQrImage = (value?: string): boolean => {
  if (!value) return false;
  if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(value)) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
};

export const isCleared = (candidate: Candidate): boolean => {
  const ministry = candidate.clearance?.labour_ministry;
  return clearanceBlockers(candidate).length === 0
    && ministry?.status === 'cleared'
    && !ministry.simulated
    && !!ministry.certificate_no
    && isSecureQrImage(ministry.qr_image_url);
};

export const clearCandidate = async (candidate: Candidate, actor: Actor): Promise<ClearanceRecord> => {
  const blockers = clearanceBlockers(candidate);
  if (blockers.length) throw new Error(`Cannot clear yet: ${blockers.join(', ')}.`);
  const now = new Date();
  const clearance: ClearanceRecord = { ...candidate.clearance, local_ready_at: now.toISOString(), local_ready_by: actor.email };
  delete clearance.certificate_no;
  delete clearance.cleared_at;
  delete clearance.cleared_by;
  delete clearance.labour_ministry;
  patchCandidate(candidate.id, { clearance });
  await recordApprovalLog(actor.id, actor.email, 'Candidate', candidate.id, 'Updated', 'Local clearance checks passed; awaiting Labour Ministry confirmation and QR certificate.');
  return clearance;
};

export const simulateMinistryQrIssuance = async (candidate: Candidate, actor: Actor) => {
  if (!isDemoMode()) throw new Error('Ministry QR simulation is only available in the demo sandbox.');
  const current = getCandidates().find(item => item.id === candidate.id);
  if (!current) throw new Error('Candidate not found.');
  const blockers = clearanceBlockers(current);
  if (blockers.length) throw new Error(`Cannot issue a demo QR yet: ${blockers.join(', ')}.`);
  if (!current.clearance?.local_ready_at) throw new Error('Mark local clearance ready before simulating ministry issuance.');

  const certificateNo = `DEMO-ONLY-${current.tracking_code}`;
  const payload = [
    'DAWM DEMO CLEARANCE - NOT AN OFFICIAL CERTIFICATE',
    `Candidate: ${current.tracking_code}`,
    `Demo reference: ${certificateNo}`,
  ].join('\\n');
  const qrImageUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 256 });
  const issuedAt = new Date().toISOString();
  const clearance: ClearanceRecord = {
    ...current.clearance,
    labour_ministry: {
      status: 'cleared',
      mode: 'sandbox',
      simulated: true,
      certificate_no: certificateNo,
      qr_image_url: qrImageUrl,
      issued_at: issuedAt,
      message: 'Simulation only. This is not a Labour Ministry certificate.',
    },
  };
  patchCandidate(current.id, { clearance });
  await recordApprovalLog(actor.id, actor.email, 'Candidate', current.id, 'Updated', `Demo-only Labour Ministry QR simulated for ${current.tracking_code}; no official certificate was issued.`);
  return clearance.labour_ministry;
};

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const buildClearanceCsv = (candidates: Candidate[]): string => {
  const header = ['tracking_code', 'first_name', 'last_name', 'passport_number', 'visa_number', 'visa_status', 'visa_expiry', 'enjaz_ref', 'enjaz_status', 'tasheer_ref', 'tasheer_status', 'local_ready_at', 'ministry_status', 'ministry_certificate_no', 'ministry_issued_at'];
  const rows = candidates.map(c => [c.tracking_code, c.first_name, c.last_name, c.passport_number, c.visa?.visa_number, c.visa?.status ?? 'unchecked', c.visa?.expiry_date, c.clearance?.enjaz?.reference, c.clearance?.enjaz?.status ?? 'pending', c.clearance?.tasheer?.reference, c.clearance?.tasheer?.status ?? 'pending', c.clearance?.local_ready_at, c.clearance?.labour_ministry?.status, c.clearance?.labour_ministry?.certificate_no, c.clearance?.labour_ministry?.issued_at].map(csvCell).join(','));
  return [header.join(','), ...rows].join('\n');
};

export const printClearanceCertificate = (candidate: Candidate, agencyName: string) => {
  if (!isCleared(candidate)) throw new Error('The Labour Ministry has not issued a cleared certificate with its verification QR yet.');
  const esc = (v: unknown) => String(v ?? '—').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
  const c = candidate.clearance;
  const ministry = c?.labour_ministry;
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) throw new Error('Allow pop-ups to print the certificate.');
  win.document.write(`<!doctype html><title>Clearance ${esc(ministry?.certificate_no)}</title><style>body{font-family:Inter,system-ui,sans-serif;margin:48px;color:#111}h1{margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:24px}td{border:1px solid #ccc;padding:8px 12px}td:first-child{background:#f5f5f5;width:35%;font-weight:600}.mono{font-variant-numeric:tabular-nums}</style>
<h1>Digital Departure Clearance Certificate</h1><div>Labour Ministry verification · ${esc(agencyName)} · DAWM Portal</div>
<table>
<tr><td>Certificate No.</td><td class="mono">${esc(ministry?.certificate_no)}</td></tr>
<tr><td>Candidate</td><td>${esc(candidate.first_name)} ${esc(candidate.last_name)}</td></tr>
<tr><td>Tracking code</td><td class="mono">${esc(candidate.tracking_code)}</td></tr>
<tr><td>Passport</td><td class="mono">${esc(candidate.passport_number)}</td></tr>
<tr><td>Visa</td><td class="mono">${esc(candidate.visa?.visa_number)} (${esc(candidate.visa?.status)}, expires ${esc(candidate.visa?.expiry_date)}) [${esc(candidate.visa?.mode)}]</td></tr>
<tr><td>Enjaz</td><td class="mono">${esc(c?.enjaz?.reference)} (${esc(c?.enjaz?.status)})</td></tr>
<tr><td>Tasheer</td><td class="mono">${esc(c?.tasheer?.reference)} (${esc(c?.tasheer?.status)})</td></tr>
<tr><td>Issued</td><td>${esc(ministry?.issued_at ? new Date(ministry.issued_at).toLocaleString() : '')}</td></tr>
</table><section class="verification"><h2>Official verification</h2><img src="${esc(ministry?.qr_image_url)}" alt="Labour Ministry verification QR code" /><p>Scan the QR code to verify this certificate with the issuing authority.</p></section><style>.verification{margin-top:28px;display:flex;align-items:center;gap:20px}.verification img{width:150px;height:150px;object-fit:contain}.verification p{max-width:320px}</style><script>window.onload=()=>window.print()</script>`);
  win.document.close();
};
