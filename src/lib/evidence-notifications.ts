import { getLocalAgencies, getStaffUsers } from './data-store';
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
  if (!user) return [];
  const agencies = getLocalAgencies().filter(agency => user.role === 'superadmin' || agency.id === user.local_agency_id);
  const read = new Set(readIds());
  return buildEvidenceReminders(user, agencies.map(agency => ({
    agencyId: agency.id, events: loadReconciliationEvents(agency.id),
  }))).map(notification => ({ ...notification, read: read.has(notification.id) }));
};

export const markEvidenceNotificationsRead = (ids: string[]): void => {
  localStorage.setItem(readKey(), JSON.stringify([...new Set([...readIds(), ...ids])]));
  window.dispatchEvent(new CustomEvent('notifications-changed'));
};
