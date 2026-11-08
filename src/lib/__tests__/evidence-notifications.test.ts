// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDemoDataset } from '../demo-dataset';
import { ensureDemoBankEvidence } from '../demo-bank-evidence';
import { getNotifications, saveCandidates, saveLocalAgencies, savePayments, saveStaffUsers } from '../data-store';
import { getNotificationsForUser, markNotificationRead } from '../api/notifications';
import { evidenceNotificationScope, getEvidenceNotifications } from '../evidence-notifications';
import { recordReconciliationEvent } from '../bank-statement-store';

const now = new Date('2026-11-07T12:00:00Z');
const demo = generateDemoDataset(now.getTime());
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  vi.useFakeTimers(); vi.setSystemTime(now);
  saveCandidates(demo.candidates); savePayments(demo.payments); saveLocalAgencies(demo.localAgencies); saveStaffUsers(demo.staffUsers);
  ensureDemoBankEvidence();
});
afterEach(() => vi.useRealTimers());

describe('local evidence notification persistence', () => {
  it('deduplicates alarms and persists acknowledgments without changing synced notifications', async () => {
    const manager = demo.staffUsers.find(user => user.role === 'local-agency')!;
    const first = await getNotificationsForUser(manager.id);
    expect(first.length).toBeGreaterThan(0);
    expect(await getNotificationsForUser(manager.id)).toEqual(first);
    await markNotificationRead(first[0].id);
    expect((await getNotificationsForUser(manager.id)).find(item => item.id === first[0].id)?.read).toBe(true);
    expect(getNotifications()).toEqual([]);
  });
  it('stops alarms when resolved and never shows another agency’s cases', async () => {
    const manager = demo.staffUsers.find(user => user.role === 'local-agency')!;
    const first = getEvidenceNotifications(manager.id);
    expect(first.every(item => item.link.includes(`agency=${manager.local_agency_id}`))).toBe(true);
    const caseId = new URL(first[0].link, 'http://localhost').searchParams.get('case')!;
    recordReconciliationEvent(manager.local_agency_id!, {
      caseId, action: 'resolve', note: 'Resolved after checking actual proof.', actor: manager.email, owner: '', dueDate: '',
      evidence: { statementName: 'Demo', explanation: 'Reviewed' },
    });
    expect(getEvidenceNotifications(manager.id).some(item => item.id === first[0].id)).toBe(false);
    expect(getEvidenceNotifications('unknown-candidate')).toEqual([]);
  });
  it('supports authenticated superadmins missing from the staff cache and scoped role previews', async () => {
    const scope = { role: 'superadmin' as const, email: 'superadmin@example.test' };
    const notifications = await getNotificationsForUser('auth-superadmin-not-in-cache', scope);
    expect(notifications.length).toBeGreaterThan(0);
    expect(new Set(notifications.map(notification => new URL(notification.link, 'http://localhost').searchParams.get('agency'))).size).toBe(4);
    expect(await getNotificationsForUser('auth-superadmin-not-in-cache', { role: 'foreign-agency', email: scope.email })).toEqual([]);
    const manager = demo.staffUsers.find(user => user.role === 'local-agency')!;
    expect(getEvidenceNotifications(manager.id, evidenceNotificationScope('candidate', manager.email, manager.local_agency_id))).toEqual([]);
    expect(getEvidenceNotifications(manager.id, evidenceNotificationScope(null, manager.email, manager.local_agency_id))).toEqual([]);
  });
});
