import { expect, it } from 'vitest';
import { buildPortalTasks, portalTaskPath } from '../portal-tasks';
import { generateDemoDataset } from '../demo-dataset';
import type { ApiPrincipal } from '../api/auth';
import type { IntegrityInput } from '../integrity';
import { analyzeIntegrity } from '../integrity';
import type { AmountDiscrepancy } from '../agency-resolution';

const demo = generateDemoDataset(Date.parse('2026-11-08'));
const a = { ...demo.candidates[0], local_agency_id: 'a', foreign_agency_id: 'f', assigned_staff_id: 'staff-a', work_contract_record: { status: 'sent' as const } };
const b = { ...demo.candidates[1], local_agency_id: 'b', foreign_agency_id: 'g' };
const stages = [a, b].map(candidate => ({ id: `stage:${candidate.id}`, candidate_id: candidate.id, stage_id: 1,
  status: 'Pending' as const, updated_at: '2026-11-08', assigned_staff_id: candidate === a ? 'staff-a' : 'staff-b', foreign_assigned_staff_id: candidate === a ? 'foreign-a' : 'foreign-b' }));
const input: IntegrityInput = { candidates: [a, b], stages, documents: [], payments: [], paymentStatuses: [], medicals: [], logs: [], stageFees: {} };
const principal = (role: ApiPrincipal['role']): ApiPrincipal => ({ id: role === 'staff' ? 'staff-a' : 'user', role, localAgencyId: role === 'staff' || role === 'local-agency' ? 'a' : null,
  foreignAgencyId: ['foreign-agency', 'foreign-agency-staff', 'agency'].includes(role) ? 'f' : null, candidateId: a.id });
it('gives administrators, agency managers, staff, auditors and viewers correctly scoped follow-ups', () => {
  for (const role of ['superadmin', 'admin', 'staff', 'local-agency', 'auditor'] as const) {
    const tasks = buildPortalTasks(principal(role), input, [], [], []);
    expect(tasks.length).toBeGreaterThan(0);
    if (role === 'staff' || role === 'local-agency') expect(tasks.some(task => task.detail.includes(b.tracking_code))).toBe(false);
    if (role === 'auditor') expect(tasks.every(task => task.path === '/auditor')).toBe(true);
    expect(portalTaskPath(role)).toMatch(/\/tasks$/);
  }
  const viewer = buildPortalTasks(principal('viewer'), input, [], [], []);
  expect(viewer).toHaveLength(1);
  expect(JSON.stringify(viewer)).not.toContain(a.tracking_code);
  for (const role of ['agency', 'foreign-agency'] as const) {
    const tasks = buildPortalTasks(principal(role), { ...input, candidates: [{ ...a, work_contract_record: { status: 'not-sent' } }, b] }, [], [], []);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].path).toContain('/agency/candidate/');
    expect(tasks[0].detail).toContain(a.tracking_code);
  }
});
it('candidate tasks are only soft current-stage document reminders and disappear after a usable upload', () => {
  const tasks = buildPortalTasks(principal('candidate'), input, [], [], []);
  expect(tasks).toHaveLength(1);
  expect(tasks[0]).toMatchObject({ category: 'Document reminder', severity: 'low' });
  expect(tasks[0].dueAt).toBeUndefined();
  expect(tasks[0].path).toBe(`/track/${a.tracking_code}#my-documents`);
  const documents = [{ id: 'file', candidate_id: a.id, stage_id: 1, file_name: 'identity.pdf', file_type: 'application/pdf', storage_key: 'file', uploaded_at: '2026-11-08' }];
  expect(buildPortalTasks(principal('candidate'), { ...input, documents }, [], [], [])).toEqual([]);
  expect(buildPortalTasks({ ...principal('candidate'), candidateId: 'unknown' }, input, [], [], [])).toEqual([]);
});
it('groups warnings by affected record, honors exceptions and does not mutate workflow data', () => {
  const before = structuredClone(input);
  const findings = analyzeIntegrity(input);
  const overrides = findings.map(finding => ({ id: finding.id, finding_id: finding.id, rule: finding.rule, severity: finding.severity,
    title: finding.title, reason: 'Authorized review', overridden_by_id: 'super', overridden_by_email: 'super@test.test', overridden_at: '2026-11-08' }));
  expect(buildPortalTasks(principal('admin'), input, [], overrides, [])).toEqual([]);
  expect(input).toEqual(before);
});
it('keeps multiple foreign-to-local short and extra payment entries in reviewer tasks but not foreign or candidate queues', () => {
  const payments = [
    { id: 'short', amount: 100, currency: 'ETB', payer_type: 'foreign-agency' as const, payer_foreign_agency_id: 'f',
      candidate_ids: [a.id], payee_local_agency_id: 'a', provider_reference: 'BANK-SHORT', status: 'succeeded' as const, created_at: '2026-11-08', updated_at: '2026-11-08' },
    { id: 'extra', amount: 200, currency: 'ETB', payer_type: 'foreign-agency' as const, payer_foreign_agency_id: 'g',
      candidate_ids: [b.id], payee_local_agency_id: 'b', provider_reference: 'BANK-EXTRA', status: 'succeeded' as const, created_at: '2026-11-08', updated_at: '2026-11-08' },
  ];
  const differences: AmountDiscrepancy[] = payments.map((payment, index) => ({
    id: `bank:${payment.id}`, caseId: payment.id, paymentId: payment.id, recipientId: payment.payee_local_agency_id,
    source: 'foreign', agencyType: 'local', agencyId: payment.payee_local_agency_id, kind: index ? 'overpayment' : 'underpayment',
    basis: 'bank', explanation: index ? 'Bank received more than recorded.' : 'Bank received less than recorded.', snapshot: '',
  }));
  const tasks = buildPortalTasks(principal('superadmin'), { ...input, payments }, [], [], [], differences).filter(task => task.category === 'Payment check');
  expect(tasks).toHaveLength(2);
  expect(tasks.map(task => task.detail).join(' ')).toContain('BANK-SHORT');
  expect(tasks.map(task => task.detail).join(' ')).toContain('BANK-EXTRA');
  expect(buildPortalTasks(principal('local-agency'), { ...input, payments }, [], [], [], differences).filter(task => task.category === 'Payment check')).toHaveLength(1);
  for (const role of ['candidate', 'foreign-agency', 'foreign-agency-staff', 'viewer'] as const) {
    expect(buildPortalTasks(principal(role), { ...input, payments }, [], [], [], differences).some(task => task.category === 'Payment check')).toBe(false);
  }
  expect(() => buildPortalTasks({ ...principal('local-agency'), localAgencyId: null }, input, [], [], [])).toThrow('agency assignment');
});
