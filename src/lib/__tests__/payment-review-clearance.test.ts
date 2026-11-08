// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { verifiedPaymentIds } from '../payment-review-clearance';
import { generateDemoDataset } from '../demo-dataset';
import type { Payment, CandidateStage } from '../types';
import type { BankStatement } from '../bank-statement-store';
import { getEvidenceRequests } from '../evidence-requests';
const demo = generateDemoDataset(Date.parse('2026-11-07'));
const candidate = { ...demo.candidates[0], local_agency_id: 'local', foreign_agency_id: 'foreign', external_status: { work_contract: true, destination_country: 'Saudi Arabia' } };
const payment: Payment = { id: 'payment', amount: 500, currency: 'ETB', payer_type: 'candidate', payer_foreign_agency_id: '', payee_local_agency_id: 'local', candidate_ids: [candidate.id], stage_id: 1, status: 'succeeded', provider_reference: 'REF', created_at: '2026-11-07', updated_at: '2026-11-07' };
const stage: CandidateStage = { id: 'stage', candidate_id: candidate.id, stage_id: 1, status: 'Completed', notes: '', date: '2026-11-07', updated_at: '2026-11-07' };
const statement: BankStatement = { name: 'bank.csv', lines: [{ reference: 'REF', amount: 500, currency: 'ETB', date: '2026-11-07', description: 'Credit' }] };
const clear = (receipts = [payment], stages = [stage], bank: BankStatement | null = statement, flag = true) => verifiedPaymentIds(receipts, [candidate], stages, [{ candidateId: candidate.id, stageId: 1, isPaid: flag }], { 1: 500 }, () => bank);
describe('strict automatic receipt clearance', () => {
  it('uses Registration → Training → Medical → Deployment rather than numeric stage IDs', () => {
    const check = (id: number, previous: CandidateStage[]) => {
      const p = { ...payment, stage_id: id };
      return verifiedPaymentIds([p], [candidate], [...previous, { ...stage, id: `s${id}`, stage_id: id }],
        [{ candidateId: candidate.id, stageId: id, isPaid: true }], { [id]: 500 }, () => statement);
    };
    expect([...check(3, [stage])]).toEqual(['payment']); // Training does not require the later medical stage.
    expect(check(2, [stage]).size).toBe(0);
    expect([...check(2, [stage, { ...stage, id: 'training', stage_id: 3 }])]).toEqual(['payment']);
  });
  it('green-clears only complete, paid stage records with exact bank proof', () => {
    expect([...clear()]).toEqual(['payment']);
    expect(clear([payment], [{ ...stage, status: 'Pending' }]).size).toBe(0);
    expect(clear([payment], [stage], statement, false).size).toBe(0);
    expect(clear([payment], [stage], null).size).toBe(0);
  });
  it('does not mistake matching money for a confirmed reference or clear blocked scans', () => {
    expect(clear([payment], [stage], { ...statement, lines: [{ ...statement.lines[0], reference: 'WRONG' }] }).size).toBe(0);
    expect(clear([payment], [stage], { ...statement, scan_report: { status: 'blocked', findings: ['Blocked'], scanned_at: '2026-11-07' } }).size).toBe(0);
    expect(clear([payment, { ...payment, id: 'other', provider_reference: 'ref' }]).size).toBe(0);
  });
  it('rejects missing allocation, unsettled receipts and under/overpaid stages even when their bank rows match', () => {
    expect(clear([{ ...payment, stage_id: undefined }]).size).toBe(0);
    expect(clear([{ ...payment, status: 'pending' }]).size).toBe(0);
    for (const amount of [400, 600]) expect(clear([{ ...payment, amount }], [stage], { ...statement, lines: [{ ...statement.lines[0], amount }] }).size).toBe(0);
    expect(clear([payment], [{ ...stage, stage_id: 2 }]).size).toBe(0);
  });
  it('requires the contract allocation, payer and currency to pass for foreign money', () => {
    const foreign = { ...payment, stage_id: undefined, payer_type: 'foreign-agency' as const, payer_foreign_agency_id: 'foreign', amount: 3375, currency: 'SAR' };
    const check = (over: Partial<Payment>) => { const p = { ...foreign, ...over }; return clear([p], [], { ...statement, lines: [{ ...statement.lines[0], amount: p.amount, currency: p.currency }] }); };
    expect([...check({})]).toEqual(['payment']);
    expect(check({ amount: 2000 }).size).toBe(0);
    expect(check({ amount: 7000 }).size).toBe(0);
    expect(check({ payer_foreign_agency_id: 'other' }).size).toBe(0);
    expect(check({ currency: 'USD' }).size).toBe(0);
  });
  it('stops stale reminders only while all current checks pass; keeps historical request events intact', () => {
    const events = [{ id: 'event', caseId: payment.id, action: 'request-evidence' as const, actor: 'finance', owner: 'owner', note: 'Proof requested', dueDate: '2026-11-07', createdAt: '2026-11-01', evidence: { payment, statementName: '', explanation: '' } }];
    expect(getEvidenceRequests(events, new Date('2026-11-08'), clear())).toHaveLength(0);
    expect(getEvidenceRequests(events, new Date('2026-11-08'), clear([payment], [stage], null))).toHaveLength(1);
    expect(events).toHaveLength(1);
  });
});
