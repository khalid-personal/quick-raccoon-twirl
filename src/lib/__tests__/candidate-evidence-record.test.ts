import { describe, expect, it } from 'vitest';
import { compileCandidateEvidence } from '../candidate-evidence-record';
import { ALL_STAGES, type CandidateStage, type Payment } from '../types';
import { generateDemoDataset } from '../demo-dataset';
const candidate = { ...generateDemoDataset(Date.parse('2026-11-07')).candidates[0], local_agency_id: 'local' };
const stages: CandidateStage[] = ALL_STAGES.map(meta => ({ id: `s${meta.id}`, stage_id: meta.id, candidate_id: candidate.id, status: 'Completed', updated_at: '2026-11-07' }));
const fees = { 1: 100, 3: 100, 2: 100, 4: 100 };
const flags = ALL_STAGES.map(meta => ({ candidateId: candidate.id, stageId: meta.id, isPaid: true }));
const payment = (id: string, stageId: number, amount = 100): Payment => ({ id, stage_id: stageId, amount, currency: 'ETB', status: 'succeeded', payer_type: 'candidate', payer_foreign_agency_id: '', candidate_ids: [candidate.id], payee_local_agency_id: 'local', provider_reference: id, created_at: '2026-11-07', updated_at: '2026-11-07' });
describe('compiled candidate evidence', () => {
  it('compiles exactly four canonical stages and requires work, fees, bank matches and confirmations', () => {
    const payments = ALL_STAGES.map(meta => payment(`p${meta.id}`, meta.id));
    const statement = { name: 'statement.csv', uploadedAt: '2026-11-07', lines: payments.map(receipt => ({ date: receipt.created_at, amount: receipt.amount, currency: receipt.currency, reference: receipt.id, description: 'Credit' })) };
    const record = compileCandidateEvidence(candidate, stages, payments, flags, fees, statement);
    expect(record.rows.map(row => row.meta.id)).toEqual([1, 3, 2, 4]);
    expect(record).toMatchObject({ expected: 400, received: 400, completed: 4, cleared: 4, status: 'settled' });
    expect(compileCandidateEvidence(candidate, stages, payments, flags, fees, null).status).toBe('pending');
    expect(compileCandidateEvidence(candidate, stages.map(stage => ({ ...stage, status: 'Pending' })), payments, flags, fees, statement).cleared).toBe(0);
    expect(compileCandidateEvidence(candidate, stages, payments, [], fees, statement).cleared).toBe(0);
  });
  it('does not offset stage underpayment with another stage excess or allocate shared/foreign/wrong agency receipts', () => {
    const receipts = [payment('short', 1, 80), payment('over', 3, 120), { ...payment('shared', 2), candidate_ids: [candidate.id, 'other'] }, { ...payment('wrong-agency', 2), payee_local_agency_id: 'other' }, { ...payment('foreign', 2), payer_type: 'foreign-agency' as const, payer_foreign_agency_id: 'foreign' }, { ...payment('pending', 4), status: 'pending' as const }];
    const record = compileCandidateEvidence(candidate, stages, receipts, flags, fees, null);
    expect(record.received).toBe(200); expect(record.unallocated).toHaveLength(1);
    expect(record.foreignReceipts.map(payment => payment.id)).toEqual(['foreign']);
    expect(record.rows[0].feeCovered).toBe(false);
    expect(record.rows[1].received).toBe(120);
    expect(record.status).toBe('pending');
  });
  it('retains future stages without calling them completed and never converts USD into ETB fees', () => {
    const record = compileCandidateEvidence(candidate, stages.map(stage => ({ ...stage, status: 'Pending' })), [{ ...payment('usd', 1), currency: 'USD' }], flags, fees, null);
    expect(record.rows).toHaveLength(4);
    expect(record.received).toBe(0);
    expect(record.completed).toBe(0);
    expect(record.rows[0].feeCovered).toBe(false);
  });
  it('keeps blocked or review-needed statement scans out of final green flags', () => {
    const receipts = ALL_STAGES.map(meta => payment(`p${meta.id}`, meta.id));
    const statement = { name: 'statement.csv', lines: receipts.map(receipt => ({ date: receipt.created_at, amount: receipt.amount, currency: receipt.currency, reference: receipt.id, description: 'Credit' })),
      scan_report: { status: 'blocked' as const, findings: ['Unsafe upload'], scanned_at: '2026-11-07' } };
    expect(compileCandidateEvidence(candidate, stages, receipts, flags, fees, statement).status).toBe('pending');
  });
  it('flags reused receipt references and refuses to green-clear an out-of-order stage', () => {
    const receipts = ALL_STAGES.map(meta => payment(`p${meta.id}`, meta.id));
    const statement = { name: 'Bank', lines: receipts.map(receipt => ({ date: receipt.created_at, amount: receipt.amount, currency: receipt.currency, reference: receipt.id, description: 'Credit' })) };
    const skipped = compileCandidateEvidence(candidate, stages.map(stage => stage.stage_id === 3 ? { ...stage, status: 'Pending' } : stage), receipts, flags, fees, statement);
    expect(skipped.rows.find(row => row.meta.id === 2)?.cleared).toBe(false);
    const otherCandidateReceipt = { ...payment('other', 1), candidate_ids: ['another'], receipt_number: 'p1' };
    const ambiguous = compileCandidateEvidence(candidate, stages, [...receipts, otherCandidateReceipt], flags, fees, statement);
    expect(ambiguous.status).toBe('pending');
    expect(ambiguous.rows[0].bankMatched).toBe(false);
  });
});
