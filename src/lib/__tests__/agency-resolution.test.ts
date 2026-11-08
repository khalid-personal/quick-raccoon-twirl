// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getApprovalLogs, getConfig, getCandidates, saveCandidates, saveLocalAgencies, saveForeignAgencies, savePayments, saveConfig, saveCandidateStages, savePaymentStatuses } from '../data-store';
import { saveBankStatement } from '../bank-statement-store';
import { agencyIsSuspended, amountDiscrepancies, appealAgencyCase, autoResolveVerifiedAgencyCases, decideAgencyCase, escalateAmountDiscrepancy, getAgencyResolutionCases, requireAgencyOperations } from '../agency-resolution';
import { generateDemoDataset } from '../demo-dataset';
import { createCandidate, updateCandidateDetails } from '../api/candidate-crud';
import { initiatePayment } from '../api/payment-processing';
import { sendProfileToForeignAgency } from '../api/tracking-queries';
import type { Payment } from '../types';
import { minimumPerCandidate } from '../currency';

const admin = { id: 'superadmin', email: 'superadmin@example.test', role: 'superadmin' };
const local = { id: 'local-admin', email: 'local@example.test', role: 'local-agency', localAgencyId: 'local' };
const foreign = { id: 'foreign-admin', email: 'foreign@example.test', role: 'foreign-agency', foreignAgencyId: 'foreign' };
const demo = generateDemoDataset(Date.parse('2026-11-07'));
const candidate = { ...demo.candidates[0], local_agency_id: 'local', foreign_agency_id: 'foreign', external_status: { ...demo.candidates[0].external_status, work_contract: false, destination_country: 'Saudi Arabia' } };
const payment: Payment = { id: 'p', amount: 100, currency: 'ETB', provider_reference: 'REF', payer_type: 'candidate', candidate_ids: [candidate.id], payer_foreign_agency_id: '', payee_local_agency_id: 'local', status: 'succeeded', created_at: '2026-11-07', updated_at: '2026-11-07' };
const statement = (amount: number, reference = 'REF', currency = 'ETB') => ({ name: 'statement.csv', uploadedAt: '2026-11-07', lines: [{ amount, reference, currency, date: '2026-11-07', description: 'Credit' }] });
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  saveCandidates([candidate]); saveLocalAgencies([{ id: 'local', name: 'Local agency', created_at: '2026-11-07' }]);
  saveForeignAgencies([{ id: 'foreign', name: 'Foreign agency', created_at: '2026-11-07' }]);
  savePayments([payment]); saveBankStatement('local', statement(80), 'candidate');
});
describe('agency resolution and operational restrictions', () => {
  it('automatically audits and clears corrected cases only after required stage and bank checks pass', async () => {
    saveConfig({ ...getConfig(), stageFees: { 1: 100 } });
    savePayments([{ ...payment, stage_id: 1 }]);
    saveCandidateStages([{ ...demo.stages.find(stage => stage.stage_id === 1)!, candidate_id: candidate.id, status: 'Completed' }]);
    savePaymentStatuses([{ candidateId: candidate.id, stageId: 1, isPaid: true }]);
    const record = await escalateAmountDiscrepancy('bank:p', 'Review bank shortage', '2026-11-08', admin);
    expect(await autoResolveVerifiedAgencyCases(admin)).toBe(0);
    saveBankStatement('local', statement(100), 'candidate');
    expect(await autoResolveVerifiedAgencyCases(admin)).toBe(1);
    expect(getAgencyResolutionCases().find(item => item.id === record.id)).toMatchObject({ state: 'resolved', holdActive: false });
    expect(getApprovalLogs().some(log => log.description.includes('Automatic green clearance'))).toBe(true);
    expect(await autoResolveVerifiedAgencyCases(admin)).toBe(0);
  });
  it('never automatically lifts an agency suspension when corrected proof is supplied', async () => {
    saveConfig({ ...getConfig(), stageFees: { 1: 100 } }); savePayments([{ ...payment, stage_id: 1 }]);
    saveCandidateStages([{ ...demo.stages.find(stage => stage.stage_id === 1)!, candidate_id: candidate.id, status: 'Completed' }]);
    savePaymentStatuses([{ candidateId: candidate.id, stageId: 1, isPaid: true }]);
    const record = await escalateAmountDiscrepancy('bank:p', 'Review bank shortage', '2026-11-08', admin);
    await decideAgencyCase(record.id, 'suspend', 'Pause new business until appeal review', admin);
    saveBankStatement('local', statement(100), 'candidate');
    expect(await autoResolveVerifiedAgencyCases(admin)).toBe(0);
    expect(agencyIsSuspended('local', 'local')).toBe(true);
    expect(getAgencyResolutionCases()[0].state).toBe('suspended');
  });
  it('surfaces malformed restriction storage rather than returning an all-clear state', () => {
    localStorage.setItem('demo:dawm-agency-resolution', JSON.stringify([{ id: 'invalid', issue: {}, events: [] }]));
    expect(() => requireAgencyOperations('local', 'local')).toThrow('invalid');
  });
  it('rejects concurrent duplicate escalations and stale decisions without losing the applied history', async () => {
    const results = await Promise.allSettled([escalateAmountDiscrepancy('bank:p', 'Review bank shortage', '2026-11-08', admin), escalateAmountDiscrepancy('bank:p', 'Another reviewer checking', '2026-11-08', admin)]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(getAgencyResolutionCases()).toHaveLength(1);
    const record = getAgencyResolutionCases()[0];
    const decisions = await Promise.allSettled([decideAgencyCase(record.id, 'suspend', 'Pause new business for review', admin), decideAgencyCase(record.id, 'request-follow-up', 'Request further bank evidence', admin)]);
    expect(decisions.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(getAgencyResolutionCases()[0].events.map(event => event.action)).toEqual(['escalated', 'suspend']);
  });
  it('rejects evidence changes while an audit request is still pending', async () => {
    const record = await escalateAmountDiscrepancy('bank:p', 'Review bank shortage', '2026-11-08', admin);
    const decision = decideAgencyCase(record.id, 'suspend', 'Pause new business for review', admin);
    saveBankStatement('local', statement(100), 'candidate');
    await expect(decision).rejects.toThrow('changed');
    expect(agencyIsSuspended('local', 'local')).toBe(false);
  });
  it('detects foreign contract amount gaps and enforces foreign holds separately', async () => {
    const minimum = minimumPerCandidate('Saudi Arabia')!;
    saveCandidates([{ ...candidate, external_status: { ...candidate.external_status, work_contract: true } }]);
    const foreignPayment = { ...payment, amount: minimum.amount / 2, currency: minimum.currency, payer_type: 'foreign-agency' as const, payer_foreign_agency_id: 'foreign' };
    savePayments([foreignPayment]);
    expect(amountDiscrepancies().find(issue => issue.id === 'contract:p')).toMatchObject({ kind: 'underpayment', agencyType: 'foreign', basis: 'contract' });
    savePayments([{ ...foreignPayment, amount: minimum.amount * 2 }]);
    expect(amountDiscrepancies().find(issue => issue.id === 'contract:p')?.kind).toBe('overpayment');
    const record = await escalateAmountDiscrepancy('contract:p', 'Review the excess contract allocation', '2026-11-08', admin);
    await decideAgencyCase(record.id, 'suspend', 'Pause new assignments during review', admin);
    expect(agencyIsSuspended('foreign', 'foreign')).toBe(true);
    expect(agencyIsSuspended('local', 'local')).toBe(false);
    await expect(sendProfileToForeignAgency(candidate.id, candidate.tracking_code, 'foreign', admin.id, admin.email)).rejects.toThrow('suspended');
    await expect(initiatePayment('foreign', [candidate.id], admin.id, admin.email)).rejects.toThrow('suspended');
    await appealAgencyCase(record.id, 'A contract addendum explains the additional services', '', foreign);
    expect(agencyIsSuspended('foreign', 'foreign')).toBe(true);
  });
  it('detects confirmed short/over reference matches, not pending, currency or ambiguous reference matches', () => {
    expect(amountDiscrepancies()[0]).toMatchObject({ kind: 'underpayment', agencyType: 'local', agencyId: 'local', basis: 'bank' });
    saveBankStatement('local', statement(120), 'candidate');
    expect(amountDiscrepancies()[0].kind).toBe('overpayment');
    saveBankStatement('local', statement(80, 'OTHER'), 'candidate');
    expect(amountDiscrepancies()).toEqual([]);
    saveBankStatement('local', statement(80, 'REF', 'USD'), 'candidate');
    expect(amountDiscrepancies()).toEqual([]);
    saveBankStatement('local', statement(80), 'candidate'); savePayments([{ ...payment, status: 'pending' }]);
    expect(amountDiscrepancies()).toEqual([]);
  });
  it('enforces reason, deadline and superadmin permissions; escalation does not automatically suspend', async () => {
    await expect(escalateAmountDiscrepancy('bank:p', 'Check bank credit', '2026-11-08', local)).rejects.toThrow('superadmin');
    await expect(escalateAmountDiscrepancy('bank:p', 'short', '2026-11-08', admin)).rejects.toThrow('10 characters');
    await expect(escalateAmountDiscrepancy('bank:p', 'Check bank credit', '2026-02-30', admin)).rejects.toThrow('valid');
    const record = await escalateAmountDiscrepancy('bank:p', 'Check bank credit', '2026-11-08', admin);
    expect(record).toMatchObject({ state: 'escalated', holdActive: false });
    expect(agencyIsSuspended('local', 'local')).toBe(false);
    await expect(escalateAmountDiscrepancy('bank:p', 'Check bank credit', '2026-11-08', admin)).rejects.toThrow('already');
    expect(getApprovalLogs().some(log => log.description.includes('Snapshot:'))).toBe(true);
  });
  it('keeps suspension active during appeals, rejects other agencies and restores only through explicit audited reinstatement', async () => {
    const record = await escalateAmountDiscrepancy('bank:p', 'Check bank credit', '2026-11-08', admin);
    await decideAgencyCase(record.id, 'suspend', 'Restrict new business pending evidence review', admin);
    expect(() => requireAgencyOperations('local', 'local')).toThrow('suspended');
    await expect(appealAgencyCase(record.id, 'We have the original bank proof', '', foreign)).rejects.toThrow('Only this agency');
    await expect(appealAgencyCase(record.id, 'We have the original bank proof', 'javascript:alert(1)', local)).rejects.toThrow('HTTPS');
    await appealAgencyCase(record.id, 'Explain fee withheld by bank', 'https://example.test/evidence.pdf', local);
    expect(getAgencyResolutionCases()[0]).toMatchObject({ state: 'appealed', holdActive: true });
    await expect(decideAgencyCase(record.id, 'resolve', 'All proof was reviewed and corrected', admin)).rejects.toThrow('Reinstate');
    await expect(decideAgencyCase(record.id, 'reinstate', 'All proof was reviewed and corrected', local)).rejects.toThrow('superadmin');
    await decideAgencyCase(record.id, 'reject-appeal', 'Proof does not explain the reference-linked shortage', admin);
    expect(agencyIsSuspended('local', 'local')).toBe(true);
    await appealAgencyCase(record.id, 'Second appeal with bank confirmation', '', local);
    await decideAgencyCase(record.id, 'reinstate', 'Bank confirmation reviewed; fee explains difference', admin);
    expect(agencyIsSuspended('local', 'local')).toBe(false);
    expect(getAgencyResolutionCases()[0].state).toBe('resolved');
    expect(getAgencyResolutionCases()[0].events.map(event => event.action)).toEqual(['escalated', 'suspend', 'appeal', 'reject-appeal', 'appeal', 'reinstate']);
    expect(getAgencyResolutionCases()[0].events.every(event => !!event.auditId)).toBe(true);
  });
  it('prevents suspension from stale or corrected evidence and preserves other cases when one is lifted', async () => {
    const first = await escalateAmountDiscrepancy('bank:p', 'Check bank credit', '2026-11-08', admin);
    saveBankStatement('local', statement(100), 'candidate');
    await expect(decideAgencyCase(first.id, 'suspend', 'Check the discrepancy before decisions', admin)).rejects.toThrow('changed');
    saveBankStatement('local', statement(80), 'candidate');
    await decideAgencyCase(first.id, 'suspend', 'Review short bank credit and source', admin);
    savePayments([payment, { ...payment, id: 'p2', provider_reference: 'REF2' }]);
    saveBankStatement('local', { ...statement(80), lines: [...statement(80).lines, { ...statement(70).lines[0], reference: 'REF2' }] }, 'candidate');
    const second = await escalateAmountDiscrepancy('bank:p2', 'Second credit has missing amount', '2026-11-08', admin);
    await decideAgencyCase(second.id, 'suspend', 'Second case also requires operations pause', admin);
    await decideAgencyCase(first.id, 'reinstate', 'First case explanation accepted', admin);
    expect(agencyIsSuspended('local', 'local')).toBe(true);
  });
  it('restricts new business while allowing candidate support updates and keeps demo/live cases separate', async () => {
    const record = await escalateAmountDiscrepancy('bank:p', 'Check bank credit', '2026-11-08', admin);
    await decideAgencyCase(record.id, 'suspend', 'Pause new business pending review', admin);
    await expect(createCandidate(candidate, admin.id, admin.email)).rejects.toThrow('suspended');
    await expect(initiatePayment('foreign', [candidate.id], admin.id, admin.email)).rejects.toThrow('suspended');
    await expect(sendProfileToForeignAgency(candidate.id, candidate.tracking_code, 'foreign', admin.id, admin.email)).rejects.toThrow('suspended');
    await expect(updateCandidateDetails(candidate.id, { phone_number: 'updated-support-contact' }, admin.id, admin.email)).resolves.toMatchObject({ phone_number: 'updated-support-contact' });
    saveConfig({ ...getConfig(), localAgencies: [{ id: 'other', name: 'Other', created_at: '2026-11-07' }] });
    await expect(updateCandidateDetails(candidate.id, { local_agency_id: 'other' }, admin.id, admin.email)).rejects.toThrow('suspended');
    expect(getCandidates()[0].local_agency_id).toBe('local');
    sessionStorage.removeItem('dawm_demo_session');
    expect(getAgencyResolutionCases()).toEqual([]);
    expect(agencyIsSuspended('local', 'local')).toBe(false);
  });
  it('escalates candidate fee gaps for follow-up without permitting suspension based on candidate debt alone', async () => {
    savePayments([{ ...payment, stage_id: 1, amount: 80 }]);
    saveBankStatement('local', statement(80), 'candidate');
    saveConfig({ ...getConfig(), stageFees: { 1: 100 } });
    const issue = amountDiscrepancies().find(issue => issue.basis === 'stage-fee')!;
    expect(issue.kind).toBe('underpayment');
    const record = await escalateAmountDiscrepancy(issue.id, 'Follow up with candidate fee evidence', '2026-11-08', admin);
    await expect(decideAgencyCase(record.id, 'suspend', 'Suspend for candidate balance', admin)).rejects.toThrow('Candidate fee debt alone');
    await decideAgencyCase(record.id, 'request-follow-up', 'Ask candidate and agency for outstanding fee explanation', admin);
    expect(agencyIsSuspended('local', 'local')).toBe(false);
  });
});
