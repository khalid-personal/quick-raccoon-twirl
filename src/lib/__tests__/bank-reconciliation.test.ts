// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from 'vitest';
import { parseStatementCsv, paymentsWithReusedReferences, reconcile, summarizeReconciliation } from '../bank-reconciliation';
import { checkForeignPayment } from '../currency';
import type { Candidate, Payment } from '../types';
import { loadBankStatement, saveBankStatement, loadReconciliationEvents, recordReconciliationEvent } from '../bank-statement-store';

const pay = (over: Partial<Payment>): Payment => ({
  id: 'p', amount: 3375, currency: 'SAR', status: 'succeeded', payer_foreign_agency_id: 'f', payee_local_agency_id: 'l',
  candidate_ids: ['c1'], created_at: '2026-10-10T00:00:00Z', updated_at: '2026-10-10T00:00:00Z', provider_reference: 'SWIFT-1', ...over,
});

describe('bank reconciliation', () => {
  it('detects reused saved reference aliases across settled receipts, not aliases within one receipt or historical failures', () => {
    const first = pay({ receipt_number: 'SWIFT-1' });
    expect(paymentsWithReusedReferences([first])).toEqual(new Set());
    expect(paymentsWithReusedReferences([first, pay({ id: 'second', provider_reference: 'OTHER', receipt_number: 'swift-1' })])).toEqual(new Set(['p', 'second']));
    expect(paymentsWithReusedReferences([first, pay({ id: 'failed', status: 'failed' }), pay({ id: 'other-agency', payee_local_agency_id: 'other' })])).toEqual(new Set());
  });
  const csv = 'Date,Description,Reference,Credit,Currency\n2026-10-11,Incoming transfer,SWIFT-1,3375,SAR\n2026-10-12,Incoming,SWIFT-2,2000,SAR\n2026-10-13,Unknown deposit,X9,500,SAR\n';
  it('matches, flags short payments, missing payments and unknown deposits', () => {
    const lines = parseStatementCsv(csv);
    const r = reconcile([pay({}), pay({ id: 'p2', provider_reference: 'SWIFT-2', amount: 3375 }), pay({ id: 'p3', provider_reference: 'SWIFT-3', amount: 9999 })], lines);
    expect(r.matches.map(m => m.status)).toEqual(['matched', 'short', 'missing']);
    expect(r.unrecognized).toHaveLength(1);
    expect(summarizeReconciliation(r)).toMatchObject({ matched: 1, short: 1, over: 0, missing: 1, unrecognizedDeposits: 1 });
  });
  it('explains currency mismatches without calling them comparable variances', () => {
    const result = reconcile([pay({})], [{ date: '2026-10-11', description: '', reference: 'SWIFT-1', amount: 3375, currency: 'USD' }]);
    expect(result.matches[0]).toMatchObject({ currencyMismatch: true, matchBasis: 'reference' });
    expect(result.matches[0].explanation).toContain('not comparable');
  });
  it('discloses amount-date fallback and leaves missing evidence explicit', () => {
    const result = reconcile([pay({})], [{ date: '2026-10-11', description: '', reference: 'OTHER', amount: 3375, currency: 'SAR' }]);
    expect(result.matches[0].matchBasis).toBe('amount-date');
    expect(result.matches[0].status).toBe('reference-mismatch');
    expect(reconcile([pay({})], []).matches[0].explanation).toContain('evidence gap');
  });
  it('flags small amount differences and missing currency instead of accepting them silently', () => {
    const line = { date: '2026-10-11', description: '', reference: 'SWIFT-1', amount: 3374, currency: 'SAR' };
    expect(reconcile([pay({})], [line]).matches[0].status).toBe('short');
    expect(reconcile([pay({})], [{ ...line, amount: 3375, currency: '' }]).matches[0].status).toBe('currency-mismatch');
  });
  it('does not accept a receipt reference that is only a prefix of the bank reference', () => {
    const line = { date: '2026-10-11', description: 'SWIFT-1', reference: 'SWIFT-10', amount: 3375, currency: 'SAR' };
    expect(reconcile([pay({})], [line]).matches[0].status).toBe('reference-mismatch');
  });
  it('matches an exact saved ChechePay processor reference and discloses it', () => {
    const payment = pay({ amount: 500, currency: 'ETB', provider: 'chechepay', chechepay_receipt: { transaction_reference: 'SWIFT-1', processor_reference: 'PROCESSOR-1', amount: 500, currency: 'ETB', status: 'SUCCEEDED', verified_at: '2026-10-10' } });
    const line = { date: '2026-10-11', description: '', reference: 'PROCESSOR-1', amount: 500, currency: 'ETB' };
    expect(reconcile([payment], [line]).matches[0]).toMatchObject({ status: 'matched', matchedReference: 'PROCESSOR-1' });
  });
  it('matches saved receipt numbers without inventing references or default currencies', () => {
    const payment = pay({ provider_reference: undefined, receipt_number: 'RC-100' });
    expect(reconcile([payment], [{ date: '2026-10-11', description: '', reference: 'RC-100', amount: payment.amount, currency: 'sar' }]).matches[0]).toMatchObject({ status: 'matched', matchedReference: 'RC-100' });
  });
});

describe('foreign payment rules', () => {
  const c = { id: 'c1', external_status: { destination_country: 'Saudi Arabia' } } as Candidate;
  it('flags ETB, wrong currency and below minimum; accepts a valid SAR payment', () => {
    expect(checkForeignPayment(pay({ currency: 'ETB' }), [c])?.issue).toBe('etb');
    expect(checkForeignPayment(pay({ currency: 'AED' }), [c])?.issue).toBe('wrong-currency');
    expect(checkForeignPayment(pay({ amount: 2000 }), [c])?.issue).toBe('below-minimum');
    expect(checkForeignPayment(pay({}), [c])).toBeNull();
  });
});

describe('reconciliation case records', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  const review = {
    caseId: 'p', action: 'escalate' as const, actor: 'finance@example.test',
    note: 'Bank credit is short; request transfer advice.', owner: 'compliance@example.test', dueDate: '2026-12-01',
    evidence: { payment: pay({}), statementName: 'bank.csv', explanation: 'Credit below ledger value.' },
  };
  it('requires an owner, due date and rationale for escalation', () => {
    expect(() => recordReconciliationEvent('l', { ...review, owner: '' })).toThrow(/owner/);
    expect(() => recordReconciliationEvent('l', { ...review, note: '' })).toThrow(/note/);
    expect(loadReconciliationEvents('l')).toHaveLength(0);
  });
  it('persists evidence snapshots per agency and isolates demo records', () => {
    recordReconciliationEvent('l', review);
    expect(loadReconciliationEvents('l')[0].evidence.payment?.amount).toBe(3375);
    expect(loadReconciliationEvents('other')).toHaveLength(0);
    sessionStorage.setItem('dawm_demo_session', '1');
    expect(loadReconciliationEvents('l')).toHaveLength(0);
    recordReconciliationEvent('l', { ...review, action: 'resolve', note: 'Correction documented.' });
    expect(loadReconciliationEvents('l')[0].action).toBe('resolve');
    sessionStorage.clear();
    expect(loadReconciliationEvents('l')[0].action).toBe('escalate');
  });
  it('keeps candidate fee statements separate from foreign transfer statements', () => {
    saveBankStatement('l', { name: 'foreign.csv', lines: [] });
    saveBankStatement('l', { name: 'candidate.csv', lines: [] }, 'candidate');
    expect(loadBankStatement('l')?.name).toBe('foreign.csv');
    expect(loadBankStatement('l', 'candidate')?.name).toBe('candidate.csv');
  });
});
