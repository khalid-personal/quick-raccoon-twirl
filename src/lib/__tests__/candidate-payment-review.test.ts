import { describe, expect, it } from 'vitest';
import { generateDemoDataset } from '../demo-dataset';
import { candidatePaymentReview } from '../candidate-payment-review';
import type { Payment, CandidateStage } from '../types';
const candidate = { ...generateDemoDataset(Date.parse('2026-11-07')).candidates[0], id: 'c1', local_agency_id: 'local-a' };
const stages: CandidateStage[] = [1, 3, 2, 4].map(id => ({ id: `stage-${id}`, candidate_id: candidate.id, stage_id: id, status: id === 1 ? 'In Progress' : 'Pending', updated_at: '2026-11-07' }));
const payment: Payment = { id: 'p', amount: 100, currency: 'ETB', status: 'succeeded', stage_id: 1, provider_reference: 'REF', payer_type: 'candidate', payer_foreign_agency_id: '', payee_local_agency_id: 'local-a', candidate_ids: ['c1'], created_at: '2026-11-07', updated_at: '2026-11-07' };
const row = { amount: 100, currency: 'ETB', reference: 'REF', date: '2026-11-07', description: 'Credit' };
describe('candidate financial review flags', () => {
  it('is settled only when reached fees and bank references match; missing, short and wrong-currency proof stays pending', () => {
    const result = (lines: typeof row[]) => candidatePaymentReview([candidate], stages, [payment], { 1: 100 }, new Map([['local-a', { name: 'Statement', lines }]])).get('c1');
    expect(result([row])).toBe('settled');
    expect(result([])).toBe('pending');
    expect(result([{ ...row, amount: 80 }])).toBe('pending');
    expect(result([{ ...row, currency: 'USD' }])).toBe('pending');
    expect(result([{ ...row, reference: 'OTHER' }])).toBe('pending');
    expect(candidatePaymentReview([candidate], stages, [{ ...payment, amount: 80 }], { 1: 100 }, new Map([['local-a', { name: 'Statement', lines: [{ ...row, amount: 80 }] }]])).get('c1')).toBe('pending');
  });
});
