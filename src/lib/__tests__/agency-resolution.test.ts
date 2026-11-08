// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getApprovalLogs, getConfig, saveCandidates, saveLocalAgencies, saveForeignAgencies, savePayments, saveConfig } from '../data-store';
import { saveBankStatement } from '../bank-statement-store';
import { agencyReviewEvidence, verifyAgencyUnderpayment, agencyIsSuspended, amountDiscrepancies, appealAgencyCase, autoResolveVerifiedAgencyCases, decideAgencyCase, escalateAmountDiscrepancy, getAgencyResolutionCases, requireAgencyOperations } from '../agency-resolution';
import { foreignUnderpaymentStatus, setForeignUnderpaymentRenewal } from '../foreign-underpayment-policy';
import { generateDemoDataset } from '../demo-dataset';
import { initiatePayment } from '../api/payment-processing';
import { sendProfileToForeignAgency } from '../api/tracking-queries';
import type { Payment } from '../types';
import { minimumPerCandidate } from '../currency';

const admin = { id: 'superadmin', email: 'superadmin@example.test', role: 'superadmin' };
const local = { id: 'local-admin', email: 'local@example.test', role: 'local-agency', localAgencyId: 'local' };
const foreign = { id: 'foreign-admin', email: 'foreign@example.test', role: 'foreign-agency', foreignAgencyId: 'foreign' };
const demo = generateDemoDataset(Date.parse('2026-11-07'));
const candidate = { ...demo.candidates[0], local_agency_id: 'local', foreign_agency_id: 'foreign', work_contract_record: undefined, external_status: { ...demo.candidates[0].external_status, work_contract: true, destination_country: 'Saudi Arabia' } };
const minimum = minimumPerCandidate('Saudi Arabia')!;
const payment: Payment = { id: 'p', amount: minimum.amount, currency: minimum.currency, provider_reference: 'REF', payer_type: 'foreign-agency', candidate_ids: [candidate.id], payer_foreign_agency_id: 'foreign', payee_local_agency_id: 'local', status: 'succeeded', created_at: '2026-11-07', updated_at: '2026-11-07' };
const statement = (amount = payment.amount * .8, reference = 'REF', currency = payment.currency, description = `Credit for ${candidate.tracking_code}`) =>
  ({ name: 'statement.csv', uploadedAt: '2026-11-07', lines: [{ amount, reference, currency, date: '2026-11-07', description }] });
const status = () => foreignUnderpaymentStatus('foreign', getAgencyResolutionCases(), getConfig());
const verify = async (id = 'bank:p') => {
  const issue = amountDiscrepancies().find(item => item.id === id)!;
  return verifyAgencyUnderpayment(id, agencyReviewEvidence(issue).snapshot, 'Checked candidate tracking code, credit and reference', '2026-11-08', admin);
};
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  saveCandidates([candidate]); saveLocalAgencies([{ id: 'local', name: 'Local agency', created_at: '2026-11-07' }]);
  saveForeignAgencies([{ id: 'foreign', name: 'Foreign agency', created_at: '2026-11-07' }]);
  savePayments([payment]); saveBankStatement('local', statement(), 'foreign');
});
describe('foreign agency resolution and ministry underpayment chances', () => {
  it('uses one chance only after exact candidate-linked evidence is verified, without suspending on the first warning', async () => {
    const record = await verify();
    expect(record).toMatchObject({ state: 'escalated', holdActive: false });
    expect(record.events.map(event => event.action)).toEqual(['verified-underpayment-warning']);
    expect(status()).toMatchObject({ used: 1, remaining: 2 });
    expect(agencyIsSuspended('foreign', 'foreign')).toBe(false);
    expect(agencyIsSuspended('local', 'local')).toBe(false);
    expect(getApprovalLogs().some(log => log.description.includes(candidate.tracking_code) && log.description.includes('reference REF'))).toBe(true);
    await expect(verify()).rejects.toThrow('already used');
    await decideAgencyCase(record.id, 'resolve', 'Explanation accepted and payment followed up', admin);
    await expect(verify()).rejects.toThrow('already used');
    expect(status().remaining).toBe(2);
  });
  it('pauses on the third distinct verified transfer and blocks new foreign settlement and profile sharing', async () => {
    const payments = [payment, { ...payment, id: 'p2', provider_reference: 'REF2' }, { ...payment, id: 'p3', provider_reference: 'REF3' }];
    savePayments(payments);
    saveBankStatement('local', { ...statement(), lines: payments.map(item => ({ ...statement().lines[0], reference: item.provider_reference! })) }, 'foreign');
    await verify('bank:p');
    expect(status().remaining).toBe(2);
    await verify('bank:p2');
    expect(status().remaining).toBe(1);
    const third = await verify('bank:p3');
    expect(third).toMatchObject({ state: 'suspended', holdActive: true });
    expect(status().remaining).toBe(0);
    expect(() => requireAgencyOperations('foreign', 'foreign')).toThrow('suspended');
    expect(() => requireAgencyOperations('local', 'local')).not.toThrow();
    await expect(initiatePayment('foreign', [candidate.id], admin.id, admin.email)).rejects.toThrow('suspended');
    await expect(sendProfileToForeignAgency(candidate.id, candidate.tracking_code, 'foreign', admin.id, admin.email)).rejects.toThrow('suspended');
  });
  it('lets the ministry pause sooner and release after an appeal without replenishing the two remaining chances', async () => {
    const record = await verify();
    await decideAgencyCase(record.id, 'suspend', 'Ministry pauses new activity pending explanation', admin);
    expect(status().remaining).toBe(2);
    await expect(appealAgencyCase(record.id, 'We have the original bank proof', '', local)).rejects.toThrow('Only this agency');
    await expect(appealAgencyCase(record.id, 'We have the original bank proof', 'javascript:alert(1)', foreign)).rejects.toThrow('HTTPS');
    await appealAgencyCase(record.id, 'Bank fees explain this transfer shortage', 'https://example.test/evidence.pdf', foreign);
    expect(agencyIsSuspended('foreign', 'foreign')).toBe(true);
    await expect(decideAgencyCase(record.id, 'resolve', 'All proof was reviewed and corrected', admin)).rejects.toThrow('Reinstate');
    await decideAgencyCase(record.id, 'reject-appeal', 'Proof does not explain the linked shortage', admin);
    expect(agencyIsSuspended('foreign', 'foreign')).toBe(true);
    await decideAgencyCase(record.id, 'reinstate', 'Bank confirmation reviewed; release explicitly approved', admin);
    expect(agencyIsSuspended('foreign', 'foreign')).toBe(false);
    expect(status().remaining).toBe(2);
    expect(getAgencyResolutionCases()[0].events.every(event => !!event.auditId)).toBe(true);
  });
  it('renews chances at the ministry date without clearing an active pause', async () => {
    const record = await verify();
    await decideAgencyCase(record.id, 'suspend', 'Ministry early pause for further review', admin);
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(tomorrow);
    await setForeignUnderpaymentRenewal(date, admin, now);
    expect(status().remaining).toBe(2);
    expect(foreignUnderpaymentStatus('foreign', getAgencyResolutionCases(), getConfig(), new Date(`${date}T00:00:00+03:00`)).remaining).toBe(3);
    expect(agencyIsSuspended('foreign', 'foreign')).toBe(true);
  });
  it.each(['shared', 'duplicate-payment', 'duplicate-bank', 'wrong-agency', 'unsafe-file', 'currency', 'pending', 'overpaid', 'wrong-candidate'] as const)('does not consume a chance for %s evidence', async kind => {
    const issue = amountDiscrepancies()[0], evidence = agencyReviewEvidence(issue);
    if (kind === 'shared') savePayments([{ ...payment, candidate_ids: [candidate.id, 'second'] }]);
    if (kind === 'duplicate-payment') savePayments([payment, { ...payment, id: 'second' }]);
    if (kind === 'duplicate-bank') saveBankStatement('local', { ...statement(), lines: [statement().lines[0], statement().lines[0]] }, 'foreign');
    if (kind === 'wrong-agency') saveCandidates([{ ...candidate, foreign_agency_id: 'different' }]);
    if (kind === 'unsafe-file') saveBankStatement('local', { ...statement(), scan_report: { status: 'review', findings: ['Inspect file'], scanned_at: '2026-11-07' } }, 'foreign');
    if (kind === 'currency') saveBankStatement('local', statement(undefined, 'REF', 'USD'), 'foreign');
    if (kind === 'pending') savePayments([{ ...payment, status: 'pending' }]);
    if (kind === 'overpaid') saveBankStatement('local', statement(payment.amount * 1.2), 'foreign');
    if (kind === 'wrong-candidate') saveBankStatement('local', statement(undefined, 'REF', payment.currency, 'TRK-SOMEONE-ELSE'), 'foreign');
    expect(agencyReviewEvidence(issue).canAutoPause).toBe(false);
    await expect(verifyAgencyUnderpayment(issue.id, evidence.snapshot, 'Attempting verification of changed evidence', '2026-11-08', admin)).rejects.toThrow();
    expect(status().remaining).toBe(3);
  });
  it('rejects concurrent duplicate confirmations and stale candidate evidence', async () => {
    const attempt = verify();
    saveCandidates([{ ...candidate, tracking_code: 'CHANGED-TRACKING' }]);
    await expect(attempt).rejects.toThrow('changed');
    saveCandidates([candidate]);
    const results = await Promise.allSettled([verify(), verify()]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(status()).toMatchObject({ used: 1, remaining: 2 });
  });
  it('requires role, reason and valid deadline; escalation alone consumes no chances', async () => {
    await expect(escalateAmountDiscrepancy('bank:p', 'Check bank credit', '2026-11-08', local)).rejects.toThrow('superadmin');
    await expect(escalateAmountDiscrepancy('bank:p', 'short', '2026-11-08', admin)).rejects.toThrow('10 characters');
    await expect(escalateAmountDiscrepancy('bank:p', 'Check bank credit', '2026-02-30', admin)).rejects.toThrow('valid');
    const record = await escalateAmountDiscrepancy('bank:p', 'Check bank credit', '2026-11-08', admin);
    expect(record.holdActive).toBe(false);
    expect(status().remaining).toBe(3);
    await expect(escalateAmountDiscrepancy('bank:p', 'Check bank credit', '2026-11-08', admin)).rejects.toThrow('already');
    saveBankStatement('local', statement(payment.amount), 'foreign');
    await expect(decideAgencyCase(record.id, 'suspend', 'Suspend despite corrected bank evidence', admin)).rejects.toThrow('changed');
    expect(await autoResolveVerifiedAgencyCases(admin)).toBe(1);
  });
  it('never clears a pause automatically, even when all corrected evidence matches', async () => {
    const record = await verify();
    await decideAgencyCase(record.id, 'suspend', 'Ministry early pause for review', admin);
    saveBankStatement('local', statement(payment.amount), 'foreign');
    expect(await autoResolveVerifiedAgencyCases(admin)).toBe(0);
    expect(agencyIsSuspended('foreign', 'foreign')).toBe(true);
  });
  it('keeps contract estimates separate from bank verification and candidate ChechePay statuses', async () => {
    savePayments([{ ...payment, amount: minimum.amount / 2 }]);
    const contract = amountDiscrepancies().find(issue => issue.id === 'contract:p')!;
    expect(contract).toMatchObject({ kind: 'underpayment', agencyType: 'foreign', basis: 'contract' });
    expect(agencyReviewEvidence(contract).canAutoPause).toBe(false);
    const record = await escalateAmountDiscrepancy(contract.id, 'Review contract minimum allocation', '2026-11-08', admin);
    await expect(decideAgencyCase(record.id, 'suspend', 'Pause solely for the estimated minimum', admin)).rejects.toThrow('Contract estimates');
    expect(status().remaining).toBe(3);
    saveConfig({ ...getConfig(), stageFees: { 1: 200 } });
    savePayments([{ ...payment, payer_type: 'candidate', payer_foreign_agency_id: '', stage_id: 1, amount: 100, currency: 'ETB' }]);
    saveBankStatement('local', statement(80, 'REF', 'ETB'), 'candidate');
    expect(amountDiscrepancies()).toEqual([]);
    expect(agencyIsSuspended('local', 'local')).toBe(false);
  });
  it('surfaces malformed restriction storage and keeps live and practice cases separate', async () => {
    await verify();
    sessionStorage.removeItem('dawm_demo_session');
    expect(getAgencyResolutionCases()).toEqual([]);
    sessionStorage.setItem('dawm_demo_session', '1');
    localStorage.setItem('demo:dawm-agency-resolution', JSON.stringify([{ id: 'invalid', issue: {}, events: [] }]));
    expect(() => requireAgencyOperations('foreign', 'foreign')).toThrow('invalid');
  });
});
