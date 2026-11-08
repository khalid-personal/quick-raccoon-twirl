import { getCandidates, getLocalAgencies, getPayments, getStaffUsers } from './data-store';
import { loadReconciliationEvents } from './bank-statement-store';
import { buildEvidenceReminders } from './evidence-requests';
import { DEMO_KEY_PREFIX, isDemoMode } from './demo-mode';
import type { Notification, UserRole } from './types';

export interface EvidenceNotificationScope { role: UserRole; email: string; local_agency_id?: string }
export const evidenceNotificationScope = (role: UserRole | null, email?: string, localAgencyId?: string | null): EvidenceNotificationScope =>
  ({ role: role ?? 'viewer', email: email ?? '', local_agency_id: localAgencyId ?? undefined });

const readKey = () => `${isDemoMode() ? DEMO_KEY_PREFIX : ''}dawm_evidence_notifications_read`;
const readIds = (): string[] => JSON.parse(localStorage.getItem(readKey()) || '[]');

export const getEvidenceNotifications = (userId: string, scope?: EvidenceNotificationScope): Notification[] => {
  const user = scope ? { id: userId, ...scope } : getStaffUsers().find(item => item.id === userId);
  if (!user || !['superadmin', 'local-agency', 'staff'].includes(user.role)) return [];
  const agencies = getLocalAgencies().filter(agency => user.role === 'superadmin' || agency.id === user.local_agency_id);
  const candidates = getCandidates();
  const payments = getPayments();
  const read = new Set(readIds());
  return buildEvidenceReminders(user, agencies.map(agency => ({
    agencyId: agency.id, events: loadReconciliationEvents(agency.id).map(event => {
      const payment = payments.find(item => item.id === event.caseId) ?? event.evidence.payment;
      const affected = candidates.filter(candidate => payment?.candidate_ids.includes(candidate.id) || event.caseId === `candidate-evidence:${candidate.id}`);
      return { ...event, evidence: { ...event.evidence, payment, agencyName: agency.name,
        candidateIdentities: affected.length ? affected.map(candidate => ({
          candidate_id: candidate.id, name: `${candidate.first_name} ${candidate.last_name}`, tracking_code: candidate.tracking_code,
        })) : event.evidence.candidateIdentities } };
    }),
  }))).map(notification => ({ ...notification, read: read.has(notification.id) }));
};

export const markEvidenceNotificationsRead = (ids: string[]): void => {
  localStorage.setItem(readKey(), JSON.stringify([...new Set([...readIds(), ...ids])]));
  window.dispatchEvent(new CustomEvent('notifications-changed'));
};
