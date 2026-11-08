// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createMatchedDemoEvidence, overridePaymentEvidence, simulateMatchingDeposit } from '../evidence-review';
import { getApprovalLogs, getConfig, getPayments, getPaymentStatuses, saveCandidates, saveConfig, savePayments, savePaymentStatuses } from '../../data-store';
import { loadBankStatement, loadReconciliationEvents, saveBankStatement } from '../../bank-statement-store';
import { activeEvidenceOverride, evidenceReviewStatus, matchPaymentEvidence } from '../../payment-evidence-status';
import { reconcile } from '../../bank-reconciliation';
import type { Payment } from '../../types';
import { generateDemoDataset } from '../../demo-dataset';
import { paymentEvidenceComparison } from '../../payment-evidence-pdf';

const actor = { id: 'superadmin', email: 'finance@example.test', role: 'superadmin' };
const payment: Payment = { id: 'demo-pay-1', amount: 100, currency: 'ETB', status: 'succeeded', payer_type: 'candidate', provider_reference: 'REF-1', receipt_number: 'RECEIPT-1', payer_foreign_agency_id: '', payee_local_agency_id: 'local-a', candidate_ids: ['demo-cand-1'], created_at: '2026-11-07', updated_at: '2026-11-07' };
const line = { amount: 80, currency: 'ETB', reference: 'REF-1', date: '2026-11-07', description: 'Synthetic credit' };
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  savePayments([payment]); savePaymentStatuses([{ candidateId: 'demo-cand-1', stageId: 1, isPaid: false }]);
  saveBankStatement('local-a', { name: 'DEMO / test statement', synthetic: true, lines: [line] }, 'candidate');
});
describe('audited payment evidence actions', () => {
  it('creates a complete named synthetic statement, confirmation and unchanged candidate identity for pending demo money', async () => {
    const candidate = { ...generateDemoDataset(Date.now()).candidates[0], id: 'demo-cand-1', local_agency_id: 'local-a' };
    saveCandidates([candidate]); savePayments([{ ...payment, stage_id: 1, status: 'pending' }]); saveConfig({ ...getConfig(), stageFees: { 1: 100 } });
    await createMatchedDemoEvidence(payment.id, 'candidate', actor);
    const updated = getPayments()[0], statement = loadBankStatement('local-a', 'candidate')!;
    expect(updated).toMatchObject({ status: 'succeeded', amount: 100, currency: 'ETB', demo_evidence: { synthetic: true, bank_name: 'Nile Horizon Demo Bank', confirmation: { status: 'succeeded', reference: 'REF-1', amount: 100 } } });
    expect(updated.demo_evidence?.identities).toEqual([{ candidate_id: candidate.id, name: `${candidate.first_name} ${candidate.last_name}`, tracking_code: candidate.tracking_code, passport_number: candidate.passport_number }]);
    expect(statement.name).toContain('Nile Horizon Demo Bank');
    expect(statement.demo_original).toMatchObject({ synthetic: true, complete: true, balances: [{ currency: 'ETB', opening_balance: 0, total_credits: 100, total_debits: 0, closing_balance: 100 }] });
    const match = matchPaymentEvidence(updated, getPayments(), statement);
    const comparison = paymentEvidenceComparison({ payment: updated, statement, match });
    expect(comparison.checks.every(check => check.status === 'match')).toBe(true);
    expect(comparison.warnings.some(warning => warning.startsWith('MISSING PROOF'))).toBe(false);
    expect(comparison.warnings.join(' ')).toContain('not a fraud-free');
    expect(getPaymentStatuses()[0].isPaid).toBe(true);
    expect(getApprovalLogs().at(-1)?.description).toContain('DEMO ONLY');
    expect(loadReconciliationEvents('local-a').at(-1)?.action).toBe('review');
  });
  it('rejects complete evidence generation outside demo, for uploaded evidence, missing identity and failed histories', async () => {
    const before = getPayments();
    await expect(createMatchedDemoEvidence(payment.id, 'candidate', { ...actor, role: 'staff' })).rejects.toThrow('superadmin');
    sessionStorage.removeItem('dawm_demo_session');
    await expect(createMatchedDemoEvidence(payment.id, 'candidate', actor)).rejects.toThrow('demo-only');
    sessionStorage.setItem('dawm_demo_session', '1');
    await expect(createMatchedDemoEvidence(payment.id, 'candidate', actor)).rejects.toThrow('identity');
    saveBankStatement('local-a', { name: 'Uploaded', lines: [line] }, 'candidate');
    await expect(createMatchedDemoEvidence(payment.id, 'candidate', actor)).rejects.toThrow('Uploaded');
    expect(getPayments()).toEqual(before);
    savePayments([{ ...payment, status: 'failed' }]);
    await expect(createMatchedDemoEvidence(payment.id, 'candidate', actor)).rejects.toThrow('Failed/refunded');
  });
  it('auto-matches the stored agency/source statement but keeps shortages pending', () => {
    const match = matchPaymentEvidence(payment, getPayments(), loadBankStatement('local-a', 'candidate'));
    expect(match?.status).toBe('short');
    expect(evidenceReviewStatus(payment, match)).toBe('pending');
    expect(evidenceReviewStatus({ ...payment, status: 'failed' }, match)).toBe('failed');
    expect(matchPaymentEvidence(payment, getPayments(), loadBankStatement('local-a', 'foreign'))).toBeUndefined();
  });
  it('accepts and revokes an exception with actor, reason, prior state and immutable evidence audit', async () => {
    const match = reconcile([payment], [line]).matches[0];
    const evidence = { payment, line, statementName: 'DEMO / test statement', explanation: 'Short deposit' };
    const input = { caseId: payment.id, source: 'candidate' as const, decision: 'accept' as const, note: 'Fee confirmed by finance', evidence, match };
    await overridePaymentEvidence('local-a', input, actor);
    const events = loadReconciliationEvents('local-a');
    expect(events[0].override).toMatchObject({ actorId: actor.id, priorStatus: 'pending', decision: 'accept' });
    expect(events[0].evidence.line).toEqual(line);
    expect(getApprovalLogs()[0].description).toContain('Fee confirmed by finance');
    expect(getApprovalLogs()[0].actor_id).toBe(actor.id);
    expect(activeEvidenceOverride(events, payment.id, payment, match)).toBeDefined();
    expect(activeEvidenceOverride(events, payment.id, { ...payment, amount: 200 }, match)).toBeUndefined();
    expect(evidenceReviewStatus(payment, match)).toBe('pending');
    expect(getPayments()).toEqual([payment]);
    expect(getPaymentStatuses()[0].isPaid).toBe(false);
    expect(loadReconciliationEvents('local-a').at(-1)?.action).toBe('resolve');
    await overridePaymentEvidence('local-a', { ...input, decision: 'revoke', note: 'New review needed' }, actor);
    expect(activeEvidenceOverride(loadReconciliationEvents('local-a'), payment.id, payment, match)).toBeUndefined();
    expect(getApprovalLogs()).toHaveLength(2);
  });
  it('rejects unsigned, unauthorized and reasonless overrides without recording success', async () => {
    const input = { caseId: payment.id, source: 'candidate' as const, decision: 'accept' as const, note: 'Review', evidence: { payment, statementName: 'Test', explanation: '' } };
    await expect(overridePaymentEvidence('local-a', input, { ...actor, role: 'staff' })).rejects.toThrow('superadmin');
    await expect(overridePaymentEvidence('local-a', input, { ...actor, id: '' })).rejects.toThrow('superadmin');
    await expect(overridePaymentEvidence('local-a', { ...input, note: ' ' }, actor)).rejects.toThrow('reason');
    expect(loadReconciliationEvents('local-a')).toEqual([]);
    expect(getApprovalLogs()).toEqual([]);
  });
  it('simulates a matching row only for settled demo payments and preserves all other rows', async () => {
    const other = { ...line, reference: 'OTHER', amount: 50 };
    saveBankStatement('local-a', { name: 'DEMO / test', synthetic: true, lines: [line, other] }, 'candidate');
    await simulateMatchingDeposit(payment.id, 'candidate', actor);
    const statement = loadBankStatement('local-a', 'candidate')!;
    expect(statement.lines).toHaveLength(2);
    expect(statement.lines).toContainEqual(other);
    const match = matchPaymentEvidence(payment, getPayments(), statement);
    expect(evidenceReviewStatus(payment, match)).toBe('settled');
    expect(getApprovalLogs()[0].description).toContain('simulated matching deposit');
    expect(getPayments()).toEqual([payment]);
    expect(getPaymentStatuses()[0].isPaid).toBe(false);
  });
  it('never changes live, uploaded, wrong-source or unsettled evidence', async () => {
    sessionStorage.removeItem('dawm_demo_session');
    await expect(simulateMatchingDeposit(payment.id, 'candidate', actor)).rejects.toThrow('demo-only');
    sessionStorage.setItem('dawm_demo_session', '1');
    await expect(simulateMatchingDeposit(payment.id, 'foreign', actor)).rejects.toThrow('source');
    saveBankStatement('local-a', { name: 'Uploaded statement', lines: [line] }, 'candidate');
    await expect(simulateMatchingDeposit(payment.id, 'candidate', actor)).rejects.toThrow('uploaded statements');
    savePayments([{ ...payment, status: 'pending' }]);
    await expect(simulateMatchingDeposit(payment.id, 'candidate', actor)).rejects.toThrow('settled demo');
    expect(loadBankStatement('local-a', 'candidate')?.lines).toEqual([line]);
  });
  it('does not simulate a shared reference and overwrite another payment’s evidence', async () => {
    savePayments([payment, { ...payment, id: 'demo-other-payment' }]);
    await expect(simulateMatchingDeposit(payment.id, 'candidate', actor)).rejects.toThrow('duplicate payment reference');
    expect(loadBankStatement('local-a', 'candidate')?.lines).toEqual([line]);
  });
});
