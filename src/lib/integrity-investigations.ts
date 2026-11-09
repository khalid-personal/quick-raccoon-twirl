import { getApiPrincipal } from './api/auth';
import { recordApprovalLog } from './api/log-management';
import { getApprovalLogs, getCandidates, getCandidateStages, getConfig, getDocuments, getIntegrityOverrides, getMedicalResults, getPayments, getPaymentStatuses, getStaffUsers } from './data-store';
import { resolveActorIdentity } from './demo-identities';
import { analyzeIntegrity, applyOverrides, type Finding } from './integrity';
import { MIN_OVERRIDE_REASON, overrideFinding } from './integrity-overrides';

export function investigationEscalated(findingId: string): boolean {
  return getApprovalLogs().some(log => log.target_type === 'Config' && log.target_id === `integrity-investigation:${findingId}` && log.action === 'Updated');
}

export async function decideIntegrityInvestigation(finding: Finding, action: 'escalate' | 'close', reason: string) {
  const principal = await getApiPrincipal();
  if (principal.role !== 'superadmin') throw new Error('Only a signed-in superadmin can decide an investigation.');
  const email = getStaffUsers().find(person => person.id === principal.id)?.email ?? resolveActorIdentity(principal.id, principal.id, getCandidates()).email;
  if (!email) throw new Error('The reviewer identity is unavailable. Reload your account before deciding.');
  if (reason.trim().length < MIN_OVERRIDE_REASON) throw new Error(`Provide at least ${MIN_OVERRIDE_REASON} characters explaining the evidence and decision.`);
  const active = applyOverrides(analyzeIntegrity({ candidates: getCandidates(), stages: getCandidateStages(), documents: getDocuments(), payments: getPayments(),
    paymentStatuses: getPaymentStatuses(), medicals: getMedicalResults(), logs: getApprovalLogs(), stageFees: getConfig().stageFees }), getIntegrityOverrides()).active;
  const current = active.find(item => item.id === finding.id);
  if (!current || current.detail !== finding.detail) throw new Error('The warning changed or is no longer active. Reload the evidence before deciding.');
  if (action === 'close') {
    await overrideFinding(current, reason, { id: principal.id, email });
  } else {
    await recordApprovalLog(principal.id, email, 'Config', `integrity-investigation:${finding.id}`, 'Updated',
      `Investigation escalated for ministry review: ${finding.title}. Evidence: ${finding.detail}. Reason: ${reason.trim()}. No outside notification or agency pause was triggered.`);
  }
  window.dispatchEvent(new CustomEvent('supabase-data-changed'));
}
