import type { ApiPrincipal } from './api/auth';
import type { AgencyResolutionCase, AmountDiscrepancy } from './agency-resolution';
import { analyzeIntegrity, applyOverrides, scopeIntegrityFindings, type Finding, type IntegrityInput, type Severity } from './integrity';
import { getActiveStageTasks } from './staff-tasks';
import type { IntegrityOverride, StaffUser } from './types';
import { contractWasSent, foreignContractPayment } from './foreign-contract-payment';
import { EVIDENCE_STATUS_LABELS, getEvidenceRequests } from './evidence-requests';
import type { ReconciliationCaseEvent } from './bank-statement-store';
import { isForeignPayment } from './currency';

export interface PortalTask {
  id: string;
  title: string;
  detail: string;
  path: string;
  category: 'Record review' | 'Suspicious activity' | 'Statement upload' | 'Payment check' | 'Agency reply' | 'Account approval' | 'Contract follow-up' | 'Document reminder' | 'Tracking';
  severity: Severity;
  dueAt?: string;
  finding?: Finding;
}

export function portalTaskPath(role: ApiPrincipal['role']): string {
  if (role === 'local-agency') return '/local-agency/tasks';
  if (['agency', 'foreign-agency', 'foreign-agency-staff'].includes(role)) return '/agency/tasks';
  if (role === 'auditor') return '/auditor/tasks';
  if (role === 'viewer') return '/viewer/tasks';
  return '/admin/tasks';
}

export function buildPortalTasks(principal: ApiPrincipal, input: IntegrityInput, staff: StaffUser[], overrides: IntegrityOverride[], cases: AgencyResolutionCase[], differences: AmountDiscrepancy[] = [],
  statementRequests: { agencyId: string; events: ReconciliationCaseEvent[] }[] = [], verified = new Set<string>()): PortalTask[] {
  if (principal.role === 'local-agency' && !principal.localAgencyId
    || ['agency', 'foreign-agency', 'foreign-agency-staff'].includes(principal.role) && !principal.foreignAgencyId) throw new Error('Your approved agency assignment is required before loading tasks.');
  if (principal.role === 'viewer') return [{ id: 'tracking-follow-up', title: 'Follow up on a tracking code',
    detail: 'Use a tracking code shared with you to review public progress. Your account does not grant access to private records.',
    path: '/viewer', category: 'Tracking', severity: 'low' }];
  const candidates = input.candidates.filter(candidate => {
    if (principal.role === 'candidate') return candidate.id === principal.candidateId;
    if (principal.role === 'local-agency') return !!principal.localAgencyId && candidate.local_agency_id === principal.localAgencyId;
    if (['agency', 'foreign-agency', 'foreign-agency-staff'].includes(principal.role)) return !!principal.foreignAgencyId
      && candidate.foreign_agency_id === principal.foreignAgencyId
      && (principal.role !== 'foreign-agency-staff' || input.stages.some(stage => stage.candidate_id === candidate.id && stage.foreign_assigned_staff_id === principal.id));
    if (principal.role === 'staff') return (!principal.localAgencyId || candidate.local_agency_id === principal.localAgencyId)
      && (candidate.assigned_staff_id === principal.id || input.stages.some(stage => stage.candidate_id === candidate.id && stage.assigned_staff_id === principal.id));
    return true;
  });
  if (principal.role === 'candidate') {
    return getActiveStageTasks(candidates, input.stages, input.now, { fees: input.stageFees ?? {}, payments: input.payments, statuses: input.paymentStatuses })
      .filter(task => ['Pending', 'In Progress'].includes(task.stage.status) && !(input.documents ?? []).some(document => document.candidate_id === task.candidate.id && document.stage_id === task.stage.stage_id && document.scan_report?.status !== 'blocked'))
      .map(task => ({ id: `document:${task.stage.id}`, title: `Check documents for ${task.stageTitle}`,
        detail: 'Ask your agency which document is needed, then upload it to this stage. This is a helpful reminder, not a staff assignment or a payment request.',
        path: `/track/${encodeURIComponent(task.candidate.tracking_code)}#my-documents`, category: 'Document reminder', severity: 'low' }));
  }
  const ids = new Set(candidates.map(candidate => candidate.id));
  const tasks: PortalTask[] = [];
  if (principal.role === 'staff' || principal.role === 'local-agency') {
    const email = staff.find(person => person.id === principal.id)?.email.toLowerCase();
    statementRequests.filter(group => group.agencyId === principal.localAgencyId).forEach(group => {
      getEvidenceRequests(group.events, input.now === undefined ? new Date() : new Date(input.now), verified)
        .filter(({ event }) => event.source !== 'candidate' && (!event.evidence.payment || isForeignPayment(event.evidence.payment))
          && (principal.role === 'local-agency' || [principal.id.toLowerCase(), email].includes(event.owner.trim().toLowerCase())))
        .forEach(({ event, status }) => tasks.push({
          id: `statement:${group.agencyId}:${event.id}`, title: 'Upload the requested bank statement',
          detail: `${EVIDENCE_STATUS_LABELS[status]} · ${event.evidence.payment?.provider_reference || event.evidence.payment?.receipt_number || event.caseId}. Submission window ${event.submissionStart ?? event.createdAt.slice(0, 10)} through ${event.dueDate}, ending at midnight Addis Ababa time. Upload the original statement CSV in Payments and have its candidate, reference, amount and currency reviewed. ${event.synthetic ? 'DEMO / synthetic request.' : ''}`,
          path: `${principal.role === 'local-agency' ? '/local-agency/payments' : '/admin/payments'}?tab=discrepancies&agency=${encodeURIComponent(group.agencyId)}&case=${encodeURIComponent(event.caseId)}&source=${event.source ?? 'foreign'}`,
          category: 'Statement upload', severity: status === 'overdue' ? 'high' : status === 'due-soon' ? 'medium' : 'low', dueAt: `${event.dueDate}T23:59:59+03:00`,
        }));
    });
  }
  const isForeign = ['agency', 'foreign-agency', 'foreign-agency-staff'].includes(principal.role);
  const profileBase = isForeign ? '/agency/candidate' : principal.role === 'local-agency' ? '/local-agency/candidate' : '/admin/candidate';
  if (!isForeign) {
    const findings = scopeIntegrityFindings(applyOverrides(analyzeIntegrity(input), overrides).active, input.candidates, input.payments,
      principal.localAgencyId ?? undefined, staff).filter(finding => {
      if (finding.candidateId) return ids.has(finding.candidateId);
      if (principal.role !== 'staff') return true;
      return finding.actor === principal.id || !!finding.paymentId && input.payments.some(payment => payment.id === finding.paymentId && payment.candidate_ids.some(id => ids.has(id)));
    });
    const grouped = new Map<string, typeof findings>();
    findings.forEach(finding => {
      const key = finding.candidateId ?? finding.paymentId ?? finding.actor ?? finding.id;
      grouped.set(key, [...(grouped.get(key) ?? []), finding]);
    });
    grouped.forEach((group, key) => {
      const candidate = candidates.find(item => item.id === group[0].candidateId);
      const severity = (['critical', 'high', 'medium', 'low'] as const).find(value => group.some(finding => finding.severity === value))!;
      const priorityFinding = group.find(finding => finding.severity === severity)!;
      const suspicious = group.some(finding => /^(duplicate-passport|duplicate-identity|duplicate-payment-reference|duplicate-receipt|self-approval|payment-edits|bulk-stage-changes|after-hours-activity|repeated-deletions|frequent-overrides|candidate-deletions)$/.test(finding.rule));
      tasks.push({ id: `review:${key}`, title: candidate ? `Review ${candidate.first_name} ${candidate.last_name}` : group[0].title,
        detail: `${candidate ? `${candidate.tracking_code} · ` : ''}${group.length} warning${group.length === 1 ? '' : 's'}: ${group.slice(0, 2).map(finding => finding.title).join('; ')}. Check the evidence; a warning does not prove wrongdoing.`,
        path: principal.role === 'auditor' ? '/auditor' : principal.role === 'local-agency' ? candidate ? `${profileBase}/${candidate.id}` : '/local-agency/payments' : `/admin/integrity${principal.localAgencyId ? `?agency=${encodeURIComponent(principal.localAgencyId)}` : ''}`,
        category: principal.role === 'superadmin' && suspicious ? 'Suspicious activity' : 'Record review', severity, ...(principal.role === 'superadmin' ? { finding: priorityFinding } : {}) });
    });
  }
  if (['superadmin', 'admin', 'staff', 'local-agency'].includes(principal.role)) {
    differences.filter(difference => {
      const payment = input.payments.find(item => item.id === difference.paymentId);
      if (!payment) return false;
      if (principal.role === 'local-agency' || principal.localAgencyId) return payment.payee_local_agency_id === principal.localAgencyId
        && (principal.role !== 'staff' || payment.candidate_ids.some(id => ids.has(id)));
      return principal.role !== 'staff' || payment.candidate_ids.some(id => ids.has(id));
    }).forEach(difference => {
      const payment = input.payments.find(item => item.id === difference.paymentId)!;
      tasks.push({ id: `payment:${difference.id}`, title: difference.kind === 'underpayment' ? 'Check a short payment' : 'Check an extra payment amount',
        detail: `${payment.provider_reference || payment.receipt_number || payment.id} · ${difference.explanation} Check the candidate and reference before deciding.`,
        path: `${principal.role === 'local-agency' ? '/local-agency/payments' : '/admin/payments'}?tab=discrepancies&source=${difference.source}&agency=${encodeURIComponent(difference.recipientId)}`,
        category: 'Payment check', severity: 'high' });
    });
  }
  cases.filter(record => record.state !== 'resolved' && (principal.role === 'superadmin'
    || principal.role === 'local-agency' && record.issue.agencyType === 'local' && record.issue.agencyId === principal.localAgencyId
    || isForeign && record.issue.agencyType === 'foreign' && record.issue.agencyId === principal.foreignAgencyId))
    .forEach(record => tasks.push({ id: `case:${record.id}`, title: record.state === 'appealed' ? 'Review the agency reply' : record.holdActive ? 'Follow up on a paused agency' : 'Follow up on a payment difference',
      detail: `Check the receipt and case history before replying or deciding. ${record.state === 'appealed' ? 'An explanation has been received.' : 'A reply or review is still needed.'}`,
      path: principal.role === 'superadmin' ? '/admin/payments?tab=resolution' : isForeign ? '/agency' : '/local-agency',
      category: 'Agency reply', severity: record.holdActive ? 'high' : 'medium', dueAt: record.dueDate }));
  if (principal.role === 'superadmin') {
    staff.filter(person => !person.is_approved || person.profile_edit_pending).forEach(person => tasks.push({
      id: `approval:${person.id}`, title: person.profile_edit_pending ? 'Review a profile change' : 'Review an account request',
      detail: `${person.email} · Check the account and agency before approving access.`,
      path: person.profile_edit_pending ? '/admin/profile-approvals' : '/admin/users', category: 'Account approval', severity: 'medium',
    }));
  }
  if (principal.role === 'local-agency' || isForeign) {
    candidates.filter(candidate => principal.role === 'local-agency' ? candidate.work_contract_record?.status === 'sent'
      : !candidate.work_contract_record || candidate.work_contract_record.status === 'not-sent' || candidate.work_contract_record.status === 'rejected')
      .forEach(candidate => tasks.push({ id: `contract:${candidate.id}`, title: `${principal.role === 'local-agency' ? 'Check contract receipt' : 'Review contract preparation'}: ${candidate.first_name} ${candidate.last_name}`,
        detail: `${candidate.tracking_code} · ${principal.role === 'local-agency' ? 'Open the shared contract, check the candidate and acknowledge receipt only after it arrives.' : 'Review the introduction and current stage before coordinating a contract. Local-stage and payment gates still apply.'}`,
        path: `${profileBase}/${candidate.id}?tab=contract`, category: 'Contract follow-up', severity: 'low' }));
  }
  if (!['candidate', 'viewer', 'auditor'].includes(principal.role)) {
    candidates.filter(contractWasSent).forEach(candidate => {
      const payment = foreignContractPayment(candidate, input.payments);
      if (payment.paid) return;
      const agency = staff.find(person => ['agency', 'foreign-agency'].includes(person.role) && person.foreign_agency_id === candidate.foreign_agency_id);
      tasks.push({ id: `contract-payment:${candidate.id}`, title: `${isForeign ? 'Make contract payment' : 'Follow up with the foreign agency'}: ${candidate.first_name} ${candidate.last_name}`,
        detail: `${candidate.tracking_code} · ${payment.detail} Responsible foreign agency: ${agency?.email ?? candidate.foreign_agency_id ?? 'Not assigned; correct the agency assignment first'}. This is not a candidate stage-fee request.`,
        path: isForeign ? `/agency/candidate/${candidate.id}?tab=payments` : `${profileBase}/${candidate.id}?tab=contract`,
        category: 'Payment check', severity: 'high' });
    });
  }
  const rank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return tasks.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || a.id.localeCompare(b.id));
}
