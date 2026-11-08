import { describe, expect, it } from 'vitest';
import { localFeeRows } from '../local-payment-evidence';
import type { Candidate, CandidateStage, Payment } from '../types';

const candidate: Candidate = { id: 'c', first_name: 'Test', last_name: 'Candidate', dob: '1995-01-01', passport_number: 'P1', tracking_code: 'TRK1', country_of_origin: 'Ethiopia', marital_status: 'Single', email: 'test@example.test', created_at: '2026-01-01', updated_at: '2026-01-01', payment_status: 'unpaid', local_agency_id: 'local-a' };
const stages: CandidateStage[] = [1, 3, 2, 4].map(id => ({ id: `s${id}`, stage_id: id, candidate_id: candidate.id, status: id === 1 ? 'In Progress' : 'Pending', updated_at: '2026-01-01' }));
const payment = (over: Partial<Payment> = {}): Payment => ({ id: 'p', stage_id: 1, amount: 60, currency: 'ETB', status: 'succeeded', payer_type: 'candidate', payer_candidate_id: 'c', candidate_ids: ['c'], payer_foreign_agency_id: '', payee_local_agency_id: 'local-a', created_at: '2026-01-01', updated_at: '2026-01-01', ...over });
const rows = (receipts: Payment[]) => localFeeRows([candidate], stages, receipts, { 1: 100, 3: 100 });
describe('local stage fee evidence', () => {
  it('sums only settled ETB receipts and shows short, covered and excess fees', () => {
    expect(rows([payment()])[0]).toMatchObject({ received: 60, status: 'short' });
    expect(rows([payment(), payment({ id: 'p2', amount: 40 }), payment({ id: 'pending', amount: 200, status: 'pending' })])[0]).toMatchObject({ received: 100, status: 'paid' });
    expect(rows([payment({ amount: 101 })])[0].status).toBe('over');
    for (const status of ['pending', 'failed', 'refunded'] as const) expect(rows([payment({ status })])[0]).toMatchObject({ status, received: 0 });
  });
  it('keeps agencies, foreign transfers, unallocated group receipts and future stages separate', () => {
    const result = rows([payment({ payee_local_agency_id: 'local-b' }), payment({ payer_type: 'foreign-agency', payer_foreign_agency_id: 'foreign-a' }), payment({ candidate_ids: ['c', 'other'] })]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ status: 'unpaid', payments: [], received: 0 });
  });
  it('never treats other currencies as ETB', () => {
    expect(rows([payment({ currency: 'USD' })])[0]).toMatchObject({ received: 0, status: 'wrong-currency' });
  });
});
