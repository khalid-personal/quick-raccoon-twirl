// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { demoActorIdentity, resolveActorIdentity } from '../demo-identities';
import { demoSessionUser, effectiveAuthUser } from '../auth-identities';
import { generateDemoDataset } from '../demo-dataset';
import { bootDemo, loadDemoData } from '../demo-loader';
import { migrateDemoIdentities } from '../demo-identity-migration';
import {
  getApprovalLogs, getCandidates, getNotifications, getPayments, getStaffUsers,
  saveApprovalLogs, saveNotifications, savePayments, saveStaffUsers,
} from '../data-store';
import { DEMO_KEY_PREFIX, VIEW_AS_KEY } from '../demo-mode';
import { paymentProvenance } from '../payment-provenance';
import { getEvidenceNotifications } from '../evidence-notifications';
import { loadReconciliationEvents } from '../bank-statement-store';

const now = new Date('2026-11-07T12:00:00Z').getTime();
const demo = generateDemoDataset(now);
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1'); });

describe('stable fictional staff and payment identity', () => {
  it('names every agency manager and employee with agency-associated reserved addresses', () => {
    expect(demoSessionUser()).toMatchObject({ id: 'demo-superadmin', email: 'superadmin1@dawm.test', user_metadata: { full_name: 'superadmin1' } });
    demo.staffUsers.forEach(user => {
      const identity = demoActorIdentity(user.id)!;
      expect(identity.name?.split(' ')).toHaveLength(2);
      expect(user.email).toBe(identity.email);
      expect(identity.agencyId).toBe(user.local_agency_id ?? user.foreign_agency_id);
      expect(user.email).toMatch(/\.test$/);
      expect(user.email).not.toMatch(/manager\.|demo-agency|demo-partner/);
    });
    expect(resolveActorIdentity('real-id', 'demo.superadmin@dawm.test')).toEqual({ id: 'real-id', email: 'demo.superadmin@dawm.test' });
    expect(resolveActorIdentity('demo-superadmin', 'actual@company.org')).toEqual({ id: 'demo-superadmin', email: 'actual@company.org' });
  });
  it('switches the demo user menu and payment actor without replacing a live authenticated account', () => {
    const actual = demoSessionUser();
    const manager = demo.staffUsers.find(user => user.role === 'local-agency')!;
    const target = { role: manager.role, userId: manager.id, label: 'manager.l1@demo-agency.example.test', localAgencyId: manager.local_agency_id };
    const preview = effectiveAuthUser(actual, target, true, demo.candidates, demo.staffUsers)!;
    expect(preview).toMatchObject({ id: manager.id, email: manager.email, user_metadata: { full_name: demoActorIdentity(manager.id)!.name } });
    expect(effectiveAuthUser(actual, target, false, demo.candidates, demo.staffUsers)).toBe(actual);
    expect(effectiveAuthUser(actual, null, true, demo.candidates, demo.staffUsers)).toBe(actual);
    const candidate = demo.candidates[0];
    expect(effectiveAuthUser(actual, { role: 'candidate', label: candidate.tracking_code, trackingCode: candidate.tracking_code }, true, demo.candidates, demo.staffUsers))
      .toMatchObject({ id: candidate.id, email: candidate.email, user_metadata: { full_name: `${candidate.first_name} ${candidate.last_name}` } });
    const payment = demo.payments.find(item => item.payer_candidate_id === candidate.id)!;
    expect(paymentProvenance(payment, demo.logs, demo.payments, demo.candidates).initiator)
      .toMatchObject({ id: candidate.id, email: candidate.email, name: `${candidate.first_name} ${candidate.last_name}` });
  });
  it('repairs existing isolated sessions in place while preserving identities, permissions, references and history', () => {
    loadDemoData();
    const candidates = getCandidates();
    const staff = getStaffUsers();
    const manager = staff.find(user => user.id === 'demo-usr-l1-mgr')!;
    const oldEmail = 'manager.l1@demo-agency.example.test';
    saveStaffUsers(staff.map(user => user.id === manager.id ? { ...user, email: oldEmail, is_approved: false } : user));
    const payments = getPayments();
    const payment = payments.find(item => item.payee_local_agency_id === manager.local_agency_id)!;
    savePayments(payments.map(item => item.id === payment.id ? {
      ...item, status: 'refunded', amount: 73, recorded_by: { id: manager.id, email: oldEmail },
    } : item));
    const logs = getApprovalLogs();
    saveApprovalLogs([...logs, { id: 'historical-log', actor_id: manager.id, actor_email: oldEmail, target_type: 'Payment', target_id: payment.id, action: 'Updated', description: 'Original historical note', timestamp: '2026-10-01T10:00:00Z' }]);
    saveNotifications([{ id: 'old-notification', type: 'payment', read: true, recipient_id: manager.id, link: `/admin/payments?case=${payment.id}`, message: 'DEMO / synthetic · Receipt overdue', created_at: '2026-10-01T10:00:00Z' }]);
    const caseKey = `${DEMO_KEY_PREFIX}dawm_bank_statement:${manager.local_agency_id}:cases`;
    const cases = loadReconciliationEvents(manager.local_agency_id!);
    localStorage.setItem(caseKey, JSON.stringify(cases.map(event => ({ ...event, owner: oldEmail }))));
    localStorage.setItem('dawm_staff_users', '[{"id":"real-account","email":"actual@company.org"}]');
    sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify({ role: manager.role, userId: manager.id, label: oldEmail }));
    sessionStorage.setItem('dawm_demo_version', '11');
    bootDemo();
    expect(getCandidates().map(candidate => [candidate.id, candidate.first_name, candidate.last_name, candidate.tracking_code, candidate.passport_number]))
      .toEqual(candidates.map(candidate => [candidate.id, candidate.first_name, candidate.last_name, candidate.tracking_code, candidate.passport_number]));
    expect(getStaffUsers().find(user => user.id === manager.id)).toMatchObject({ email: manager.email, is_approved: false, role: manager.role });
    expect(getPayments().find(item => item.id === payment.id)).toMatchObject({
      amount: 73, status: 'refunded', provider_reference: payment.provider_reference,
      recorded_by: { id: manager.id, email: manager.email },
    });
    expect(getApprovalLogs().find(log => log.id === 'historical-log')).toMatchObject({ description: 'Original historical note', timestamp: '2026-10-01T10:00:00Z', actor_email: manager.email });
    expect(getNotifications()[0]).toMatchObject({ id: 'old-notification', read: true, recipient_id: manager.id });
    expect(getNotifications()[0].message).toContain(payment.provider_reference);
    expect(getNotifications()[0].message).not.toMatch(/^DEMO/);
    expect(getNotifications()[0].message).toContain('not real bank proof');
    expect(loadReconciliationEvents(manager.local_agency_id!).map(event => event.id)).toEqual(cases.map(event => event.id));
    expect(loadReconciliationEvents(manager.local_agency_id!).every(event => event.owner === manager.email)).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(VIEW_AS_KEY)!)).toMatchObject({ userId: manager.id, label: manager.email });
    expect(localStorage.getItem('dawm_staff_users')).toBe('[{"id":"real-account","email":"actual@company.org"}]');
    const snapshot = JSON.stringify([getStaffUsers(), getPayments(), getApprovalLogs(), getNotifications()]);
    migrateDemoIdentities();
    expect(JSON.stringify([getStaffUsers(), getPayments(), getApprovalLogs(), getNotifications()])).toBe(snapshot);
    sessionStorage.removeItem('dawm_demo_session');
    migrateDemoIdentities();
    expect(localStorage.getItem('dawm_staff_users')).toBe('[{"id":"real-account","email":"actual@company.org"}]');
  });
  it('heads reminders with candidate names, agency and reference while retaining truthful evidence disclosure', () => {
    loadDemoData();
    const manager = getStaffUsers().find(user => user.role === 'local-agency')!;
    const reminders = getEvidenceNotifications(manager.id);
    expect(reminders.length).toBeGreaterThan(0);
    const agency = demo.localAgencies.find(item => item.id === manager.local_agency_id)!;
    reminders.forEach(reminder => {
      expect(reminder.message).toContain(agency.name);
      expect(reminder.message).toMatch(/TRK-D\d{4}/);
      expect(reminder.message).not.toMatch(/^DEMO|^Practice/);
      expect(reminder.message).toContain('Practice / synthetic evidence, not real bank proof');
    });
  });
});
