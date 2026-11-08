import type { ReconciliationCaseEvent } from './bank-statement-store';
import type { Notification, StaffUser, UserRole } from './types';
import { currentVerifiedPaymentIds } from './payment-review-clearance';

export const validEvidenceDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value;

export type EvidenceRequestStatus = 'scheduled' | 'pending' | 'due-soon' | 'overdue';
export interface EvidenceRequest {
  event: ReconciliationCaseEvent;
  status: EvidenceRequestStatus;
}

export const evidenceToday = (now = new Date()): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Addis_Ababa' }).format(now);

export const getEvidenceRequests = (events: ReconciliationCaseEvent[], now = new Date(), verified = new Set<string>()): EvidenceRequest[] => {
  const open = new Map<string, ReconciliationCaseEvent>();
  [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach(event => {
    if (event.action === 'resolve') open.delete(event.caseId);
    else if (event.action === 'request-evidence' || event.action === 'escalate') open.set(event.caseId, event);
  });
  const today = evidenceToday(now);
  return [...open.values()].filter(event => validEvidenceDate(event.dueDate) && !verified.has(event.caseId)).map(event => {
    const days = (Date.parse(event.dueDate) - Date.parse(today)) / 86_400_000;
    const status: EvidenceRequestStatus = event.submissionStart && event.submissionStart > today ? 'scheduled'
      : days < 0 ? 'overdue' : days <= 2 ? 'due-soon' : 'pending';
    return { event, status };
  }).sort((a, b) => a.event.dueDate.localeCompare(b.event.dueDate));
};

export const EVIDENCE_STATUS_LABELS: Record<EvidenceRequestStatus, string> = {
  scheduled: 'Window not open', pending: 'Awaiting evidence', 'due-soon': 'Due soon', overdue: 'Overdue',
};

export const buildEvidenceReminders = (
  user: Pick<StaffUser, 'id' | 'email' | 'local_agency_id'> & { role: UserRole }, cases: { agencyId: string; events: ReconciliationCaseEvent[] }[], now = new Date(),
): Notification[] => cases.flatMap(({ agencyId, events }) => {
  const manager = user.role === 'local-agency' && user.local_agency_id === agencyId;
  const superadmin = user.role === 'superadmin';
  if (!manager && !superadmin && !(user.role === 'staff' && user.local_agency_id === agencyId)) return [];
  return getEvidenceRequests(events, now, currentVerifiedPaymentIds()).filter(({ event, status }) =>
    (status === 'overdue' || status === 'due-soon')
    && (manager || superadmin || [user.id, user.email.toLowerCase()].includes(event.owner.trim().toLowerCase())),
  ).map(({ event, status }) => ({
    id: `evidence:${user.id}:${agencyId}:${event.id}:${status}`,
    type: 'payment',
    recipient_id: user.id,
    read: false,
    message: `${event.synthetic ? 'DEMO / synthetic · ' : ''}${EVIDENCE_STATUS_LABELS[status]}: ${event.evidence.payment?.receipt_number || event.caseId}. Evidence due ${event.dueDate}; owner ${event.owner}.`,
    link: `${manager ? '/local-agency/payments' : '/admin/payments'}?tab=discrepancies&agency=${encodeURIComponent(agencyId)}&case=${encodeURIComponent(event.caseId)}&source=${event.source ?? 'foreign'}`,
    created_at: new Date(`${event.dueDate}T00:00:00+03:00`).toISOString(),
  }));
});
