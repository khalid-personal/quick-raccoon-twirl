// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { buildEvidenceReminders, getEvidenceRequests } from '../evidence-requests';
import { loadReconciliationEvents, recordReconciliationEvent, type ReconciliationCaseEvent } from '../bank-statement-store';
import type { StaffUser } from '../types';

const now = new Date('2026-11-07T12:00:00Z');
const request = (overrides: Partial<ReconciliationCaseEvent> = {}): ReconciliationCaseEvent => ({
  id: 'request-1', caseId: 'payment-1', action: 'request-evidence', note: 'Please supply a receipt.',
  actor: 'finance', owner: 'owner@example.test', submissionStart: '2026-11-01', dueDate: '2026-11-06',
  createdAt: '2026-11-01T12:00:00Z', source: 'candidate',
  evidence: { statementName: 'Bank records', explanation: 'Missing credit' }, ...overrides,
});
const staff = (role: StaffUser['role'], local_agency_id = 'local-1'): StaffUser => ({
  id: 'user-1', email: 'owner@example.test', role, local_agency_id, created_at: now.toISOString(), is_approved: true,
});
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe('evidence submission windows', () => {
  it('distinguishes scheduled, pending, due soon and overdue requests', () => {
    const events = [
      request(), request({ id: '2', caseId: '2', dueDate: '2026-11-08' }),
      request({ id: '3', caseId: '3', dueDate: '2026-11-12' }),
      request({ id: '4', caseId: '4', submissionStart: '2026-11-10', dueDate: '2026-11-12' }),
    ];
    expect(getEvidenceRequests(events, now).map(item => item.status)).toEqual(['overdue', 'due-soon', 'pending', 'scheduled']);
  });
  it('keeps the entire deadline day open in Addis Ababa time', () => {
    const event = request({ dueDate: '2026-11-07' });
    expect(getEvidenceRequests([event], new Date('2026-11-07T20:59:59Z'))[0].status).toBe('due-soon');
    expect(getEvidenceRequests([event], new Date('2026-11-07T21:00:00Z'))[0].status).toBe('overdue');
  });
  it('investigation notes do not erase pending requests; resolution stops reminders', () => {
    const events = [request(), request({ id: 'note', action: 'review', createdAt: '2026-11-03T12:00:00Z' })];
    expect(getEvidenceRequests(events, now)).toHaveLength(1);
    events.push(request({ id: 'resolved', action: 'resolve', createdAt: '2026-11-04T12:00:00Z' }));
    expect(getEvidenceRequests(events, now)).toHaveLength(0);
    expect(buildEvidenceReminders(staff('superadmin'), [{ agencyId: 'local-1', events }], now)).toHaveLength(0);
  });
  it('rejects impossible dates and reversed windows without saving', () => {
    const { id: _id, createdAt: _createdAt, ...input } = request();
    expect(() => recordReconciliationEvent('local-1', { ...input, dueDate: '2026-02-30' })).toThrow('valid due date');
    expect(() => recordReconciliationEvent('local-1', { ...input, submissionStart: '2026-11-10' })).toThrow('on or before');
    expect(loadReconciliationEvents('local-1')).toHaveLength(0);
  });
  it('preserves old requests that have only a due date', () => {
    expect(getEvidenceRequests([request({ submissionStart: undefined })], now)[0].status).toBe('overdue');
  });
});

describe('scoped, deduplicated in-portal alarms', () => {
  const cases = [{ agencyId: 'local-1', events: [request()] }, { agencyId: 'local-2', events: [request()] }];
  it('shows all agencies to superadmin and only the local manager’s agency', () => {
    expect(buildEvidenceReminders(staff('superadmin'), cases, now)).toHaveLength(2);
    const manager = buildEvidenceReminders(staff('local-agency'), cases, now);
    expect(manager).toHaveLength(1);
    expect(manager[0].link).toContain('/local-agency/payments?');
    expect(manager[0].link).toContain('source=candidate');
  });
  it('only alarms assigned staff; foreign agencies and candidates get none', () => {
    expect(buildEvidenceReminders(staff('staff'), cases, now)).toHaveLength(1);
    expect(buildEvidenceReminders({ ...staff('staff'), email: 'someone-else@example.test' }, cases, now)).toHaveLength(0);
    expect(buildEvidenceReminders(staff('foreign-agency'), cases, now)).toHaveLength(0);
  });
  it('uses stable IDs on every poll, and distinct IDs for a new overdue alarm', () => {
    const first = buildEvidenceReminders(staff('superadmin'), cases, now);
    expect(buildEvidenceReminders(staff('superadmin'), cases, now).map(item => item.id)).toEqual(first.map(item => item.id));
    const event = request({ dueDate: '2026-11-08' });
    const soon = buildEvidenceReminders(staff('superadmin'), [{ agencyId: 'local-1', events: [event] }], now);
    const late = buildEvidenceReminders(staff('superadmin'), [{ agencyId: 'local-1', events: [event] }], new Date('2026-11-09T12:00:00Z'));
    expect(soon[0].id).not.toBe(late[0].id);
  });
});
