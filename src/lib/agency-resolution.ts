import { isDemoMode } from './demo-mode';
import { getCandidates, getCandidateStages, getLocalAgencies, getForeignAgencies, getPayments, getConfig } from './data-store';
import { localFeeRows } from './local-payment-evidence';
import { analyzeAgencyPayments } from './agency-payments';
import { isForeignPayment } from './currency';
import { loadBankStatement } from './bank-statement-store';
import { reconcile } from './bank-reconciliation';
import { recordApprovalLog } from './api/log-management';
import { currentVerifiedPaymentIds } from './payment-review-clearance';

export interface ResolutionActor { id: string; email: string; role: string; localAgencyId?: string | null; foreignAgencyId?: string | null; }
export interface AmountDiscrepancy {
  id: string; caseId: string; paymentId: string; recipientId: string; source: 'foreign' | 'candidate';
  agencyId: string; agencyType: 'local' | 'foreign'; kind: 'underpayment' | 'overpayment'; basis: 'bank' | 'contract' | 'stage-fee';
  explanation: string; snapshot: string;
}
export interface AgencyResolutionCase {
  id: string; issue: AmountDiscrepancy; state: 'escalated' | 'suspended' | 'appealed' | 'resolved';
  holdActive: boolean; dueDate: string; createdAt: string; updatedAt: string;
  events: { id: string; action: string; reason: string; actorId: string; actor: string; at: string; auditId: string; evidenceUrl?: string }[];
}
const storageKey = () => `${isDemoMode() ? 'demo:' : ''}dawm-agency-resolution`;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasStrings = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'string' && value[key].length > 0);
function isResolutionCase(value: unknown): value is AgencyResolutionCase {
  if (!isRecord(value) || !hasStrings(value, ['id', 'dueDate', 'createdAt', 'updatedAt'])
    || typeof value.holdActive !== 'boolean' || !['escalated', 'suspended', 'appealed', 'resolved'].includes(String(value.state))
    || !isRecord(value.issue) || !hasStrings(value.issue, ['id', 'caseId', 'paymentId', 'recipientId', 'agencyId', 'explanation', 'snapshot'])
    || !['foreign', 'candidate'].includes(String(value.issue.source)) || !['local', 'foreign'].includes(String(value.issue.agencyType))
    || !['underpayment', 'overpayment'].includes(String(value.issue.kind)) || !['bank', 'contract', 'stage-fee'].includes(String(value.issue.basis))
    || !Array.isArray(value.events) || !value.events.length) return false;
  return value.events.every(event => isRecord(event) && hasStrings(event, ['id', 'action', 'reason', 'actorId', 'actor', 'at', 'auditId'])
    && (event.evidenceUrl === undefined || typeof event.evidenceUrl === 'string'));
}
export function getAgencyResolutionCases(): AgencyResolutionCase[] {
  const raw = localStorage.getItem(storageKey());
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || !data.every(isResolutionCase)) throw new Error('Agency resolution records are invalid. Contact support; no restrictions were silently cleared.');
  return data;
}
function saveCases(cases: AgencyResolutionCase[]) {
  localStorage.setItem(storageKey(), JSON.stringify(cases));
  window.dispatchEvent(new Event('agency-resolution-changed'));
}
export function agencyIsSuspended(type: 'local' | 'foreign', id?: string): boolean {
  return !!id && getAgencyResolutionCases().some(record => record.holdActive && record.issue.agencyType === type && record.issue.agencyId === id);
}
export function requireAgencyOperations(type: 'local' | 'foreign', id?: string) {
  if (agencyIsSuspended(type, id)) throw new Error('Agency operations are suspended pending review. New registrations, agency assignments, profile sharing and foreign settlement are paused. Appeal from your agency notice; existing candidate support remains available.');
}
export function amountDiscrepancies(): AmountDiscrepancy[] {
  const payments = getPayments();
  const candidates = getCandidates();
  const issues: AmountDiscrepancy[] = [];
  getLocalAgencies().forEach(agency => {
    (['foreign', 'candidate'] as const).forEach(source => {
      const statement = loadBankStatement(agency.id, source);
      if (!statement) return;
      reconcile(payments.filter(payment => payment.status === 'succeeded' && payment.payee_local_agency_id === agency.id && isForeignPayment(payment) === (source === 'foreign')), statement.lines).matches.forEach(match => {
        if ((match.status !== 'short' && match.status !== 'over') || match.matchBasis !== 'reference' || match.currencyMismatch) return;
        issues.push({ id: `bank:${match.payment.id}`, caseId: match.payment.id, paymentId: match.payment.id, recipientId: agency.id, source,
          agencyId: agency.id, agencyType: 'local', kind: match.status === 'short' ? 'underpayment' : 'overpayment', basis: 'bank',
          explanation: `${match.explanation} Recipient agency is the review subject, not a proven cause.`,
          snapshot: JSON.stringify({ payment: match.payment, line: match.line }) });
      });
    });
  });
  analyzeAgencyPayments(candidates, payments, getCandidateStages()).rows.forEach(row => {
    if (!row.payment || (row.issue !== 'short' && row.issue !== 'over')) return;
    const id = `contract:${row.payment.id}`;
    if (issues.some(issue => issue.id === id)) return;
    issues.push({ id, caseId: row.payment.id, paymentId: row.payment.id, recipientId: row.localAgencyId, source: 'foreign', agencyId: row.foreignAgencyId, agencyType: 'foreign',
      kind: row.issue === 'short' ? 'underpayment' : 'overpayment', basis: 'contract',
      explanation: `${row.message} Contract-minimum allocation is a rule estimate; review actual allocations and legitimate excess before deciding responsibility.`,
      snapshot: JSON.stringify({ payment: row.payment, expected: row.expectedMin, currency: row.currency, candidates: row.payment.candidate_ids.map(id => candidates.find(candidate => candidate.id === id)?.external_status) }) });
  });
  localFeeRows(candidates, getCandidateStages(), payments, getConfig().stageFees ?? {}).forEach(row => {
    if (row.status !== 'short' && row.status !== 'over' || row.received <= 0) return;
    const payment = row.payments.find(payment => payment.status === 'succeeded');
    if (!payment || !row.candidate.local_agency_id) return;
    issues.push({ id: `fee:${row.candidate.id}:${row.stageId}`, caseId: payment.id, paymentId: payment.id, recipientId: row.candidate.local_agency_id, source: 'candidate',
      agencyId: row.candidate.local_agency_id, agencyType: 'local', kind: row.status === 'short' ? 'underpayment' : 'overpayment', basis: 'stage-fee',
      explanation: `${row.stageTitle}: ${row.received} ETB settled against ${row.expected} ETB required. The local agency should follow up, but candidate fee debt alone cannot justify an agency suspension.`,
      snapshot: JSON.stringify({ payments: row.payments, expected: row.expected, stage: row.stageId }) });
  });
  return issues;
}
const assertSuperadmin = (actor: ResolutionActor) => {
  if (actor.role !== 'superadmin' || !actor.id || !actor.email) throw new Error('A signed-in superadmin is required for this decision.');
};
const validDeadline = (date: string) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};
export async function escalateAmountDiscrepancy(issueId: string, reason: string, dueDate: string, actor: ResolutionActor): Promise<AgencyResolutionCase> {
  assertSuperadmin(actor);
  if (reason.trim().length < 10 || !validDeadline(dueDate)) throw new Error('Explain the escalation in at least 10 characters and choose a valid follow-up deadline.');
  const issue = amountDiscrepancies().find(issue => issue.id === issueId);
  if (!issue) throw new Error('The amount discrepancy is no longer present. Recheck current evidence.');
  const cases = getAgencyResolutionCases();
  const existing = cases.find(record => record.issue.id === issueId && record.state !== 'resolved');
  if (existing) throw new Error('This discrepancy already has an open resolution case.');
  const at = new Date().toISOString();
  const audit = await recordApprovalLog(actor.id, actor.email, 'Payment', issue.paymentId, 'Updated', `Amount discrepancy escalation requested: ${issue.kind}, ${issue.basis}. Agency under review: ${issue.agencyType}:${issue.agencyId}. Reason: ${reason.trim()}. Follow-up: ${dueDate}. Snapshot: ${issue.snapshot}`);
  if (getAgencyResolutionCases().some(record => record.issue.id === issueId && record.state !== 'resolved')) throw new Error('Another review opened this case. Refresh before continuing.');
  if (amountDiscrepancies().find(item => item.id === issueId)?.snapshot !== issue.snapshot) throw new Error('The evidence changed during escalation. Refresh and review the current amount gap.');
  const record: AgencyResolutionCase = { id: crypto.randomUUID(), issue, state: 'escalated', holdActive: false, dueDate, createdAt: at, updatedAt: at,
    events: [{ id: crypto.randomUUID(), action: 'escalated', reason: reason.trim(), actorId: actor.id, actor: actor.email, at, auditId: audit.id }] };
  saveCases([...getAgencyResolutionCases(), record]);
  return record;
}
export async function decideAgencyCase(id: string, action: 'suspend' | 'request-follow-up' | 'reject-appeal' | 'reinstate' | 'resolve', reason: string, actor: ResolutionActor): Promise<void> {
  assertSuperadmin(actor);
  if (reason.trim().length < 10) throw new Error('A decision explanation of at least 10 characters is required.');
  const record = getAgencyResolutionCases().find(record => record.id === id);
  if (!record || record.state === 'resolved') throw new Error('Open resolution case not found.');
  if (action === 'suspend') {
    if (record.issue.basis === 'stage-fee') throw new Error('Candidate fee debt alone cannot suspend an agency. Request a follow-up; investigate agency bank or contract evidence separately.');
    const current = amountDiscrepancies().find(issue => issue.id === record.issue.id);
    if (!current || current.snapshot !== record.issue.snapshot) throw new Error('Payment evidence changed. Resolve this case and investigate the current discrepancy before suspending.');
    if (record.holdActive) throw new Error('This case already has an active suspension.');
  }
  if (action === 'reject-appeal' && record.state !== 'appealed') throw new Error('There is no appeal awaiting decision.');
  if (action === 'reinstate' && !record.holdActive) throw new Error('There is no active suspension for this case.');
  if (action === 'resolve' && record.holdActive) throw new Error('Reinstate this case explicitly before closing it; suspension cannot be cleared silently.');
  const state = action === 'suspend' || action === 'reject-appeal' && record.holdActive ? 'suspended' : action === 'resolve' || action === 'reinstate' ? 'resolved' : 'escalated';
  const audit = await recordApprovalLog(actor.id, actor.email, 'Payment', record.issue.paymentId, 'Updated', `Agency resolution ${action} requested: ${record.issue.agencyType}:${record.issue.agencyId}. Previous ${record.state}, hold ${record.holdActive}. Reason: ${reason.trim()}. Case ${id}.`);
  if (getAgencyResolutionCases().find(item => item.id === id)?.events.at(-1)?.id !== record.events.at(-1)?.id) throw new Error('This case changed during review. Refresh before deciding again.');
  if (action === 'suspend' && amountDiscrepancies().find(item => item.id === record.issue.id)?.snapshot !== record.issue.snapshot) throw new Error('The evidence changed during review. Refresh before deciding again.');
  const at = new Date().toISOString();
  saveCases(getAgencyResolutionCases().map(item => item.id === id ? { ...item, state, holdActive: action === 'suspend' ? true : action === 'reinstate' ? false : item.holdActive, updatedAt: at,
    events: [...item.events, { id: crypto.randomUUID(), action, reason: reason.trim(), actorId: actor.id, actor: actor.email, at, auditId: audit.id }] } : item));
}
export async function appealAgencyCase(id: string, explanation: string, evidenceUrl: string, actor: ResolutionActor): Promise<void> {
  if (!actor.id || !actor.email || explanation.trim().length < 10) throw new Error('Sign in and explain your appeal in at least 10 characters.');
  const record = getAgencyResolutionCases().find(record => record.id === id);
  if (!record || record.state === 'resolved') throw new Error('Open resolution case not found.');
  const allowed = record.issue.agencyType === 'local' ? ['local-agency', 'staff'].includes(actor.role) && actor.localAgencyId === record.issue.agencyId
    : ['foreign-agency', 'foreign-agency-staff', 'agency'].includes(actor.role) && actor.foreignAgencyId === record.issue.agencyId;
  if (!allowed) throw new Error('Only this agency can submit its appeal.');
  if (evidenceUrl) {
    let url: URL;
    try { url = new URL(evidenceUrl); } catch { throw new Error('Supporting evidence must be a valid HTTPS link.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Supporting evidence must be a secure HTTPS link.');
  }
  const audit = await recordApprovalLog(actor.id, actor.email, 'Payment', record.issue.paymentId, 'Updated', `Agency appeal submission requested for case ${id}. Explanation: ${explanation.trim()}. Supporting evidence: ${evidenceUrl || 'Not linked'}. Suspension remains unchanged.`);
  if (getAgencyResolutionCases().find(item => item.id === id)?.events.at(-1)?.id !== record.events.at(-1)?.id) throw new Error('This case changed during submission. Refresh and check its latest decision.');
  const at = new Date().toISOString();
  saveCases(getAgencyResolutionCases().map(item => item.id === id ? { ...item, state: 'appealed', updatedAt: at, events: [...item.events, { id: crypto.randomUUID(), action: 'appeal', reason: explanation.trim(), evidenceUrl: evidenceUrl || undefined, actorId: actor.id, actor: actor.email, at, auditId: audit.id }] } : item));
}
export function agencyCaseName(issue: Pick<AmountDiscrepancy, 'agencyId' | 'agencyType'>) {
  return (issue.agencyType === 'local' ? getLocalAgencies() : getForeignAgencies()).find(agency => agency.id === issue.agencyId)?.name ?? 'Agency unavailable';
}
let automaticClearance: Promise<number> | undefined;
export function autoResolveVerifiedAgencyCases(actor: ResolutionActor): Promise<number> {
  assertSuperadmin(actor);
  if (!automaticClearance) automaticClearance = resolveVerifiedCases(actor).finally(() => { automaticClearance = undefined; });
  return automaticClearance;
}
async function resolveVerifiedCases(actor: ResolutionActor) {
  const verified = currentVerifiedPaymentIds();
  const ready = getAgencyResolutionCases().filter(record => record.state !== 'resolved' && !record.holdActive && verified.has(record.issue.paymentId));
  for (const record of ready) {
    await decideAgencyCase(record.id, 'resolve', 'Automatic green clearance: settled receipt, exact bank reference/amount/currency and required contract or completed stage-fee checks all pass. No agency hold was lifted.', actor);
  }
  return ready.length;
}
