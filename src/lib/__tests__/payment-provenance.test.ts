import { describe, expect, it } from 'vitest';
import { paymentProvenance } from '../payment-provenance';
import type { ApprovalLog, Payment } from '../types';

const payment: Payment = {
  id: 'payment-1', amount: 1000, currency: 'USD', status: 'succeeded', payer_foreign_agency_id: 'foreign-1',
  payee_local_agency_id: 'local-1', candidate_ids: ['candidate-1'],
  created_at: '2026-11-07T10:00:00Z', updated_at: '2026-11-07T11:00:00Z', provider_reference: 'ref-1',
};
const event = (id: string, target_type: ApprovalLog['target_type'], target_id: string, description = 'Updated transaction'): ApprovalLog => ({
  id, target_type, target_id, description, action: 'Created', timestamp: '2026-11-07T10:00:00Z',
  actor_id: 'actor-1', actor_email: 'operator@example.test',
});

describe('payment origin and audit attribution', () => {
  it('keeps payment actions separate from contextual candidate events and unrelated logs', () => {
    const result = paymentProvenance(payment, [
      event('p', 'Payment', payment.id, 'Initiated payment of 1000 USD'),
      event('c', 'Candidate', 'candidate-1'), event('other', 'Payment', 'unrelated'),
    ], [payment]);
    expect(result.paymentEvents.map(item => item.id)).toEqual(['p']);
    expect(result.candidateEvents.map(item => item.id)).toEqual(['c']);
    expect(result.initiator?.email).toBe('operator@example.test');
  });
  it('does not identify a verifier or a candidate editor as the payment initiator', () => {
    const result = paymentProvenance(payment, [
      event('verified', 'Payment', payment.id, 'Verified stage payment'),
      event('candidate', 'Candidate', 'candidate-1'),
    ], [payment]);
    expect(result.initiator).toBeUndefined();
    expect(result.recorder?.id).toBe('actor-1');
  });
  it('preserves explicit initiator identity and links only shared-candidate or reference transfers', () => {
    const result = paymentProvenance({ ...payment, initiated_by: { id: 'candidate-user' } }, [], [
      payment, { ...payment, id: 'related' }, { ...payment, id: 'unrelated', candidate_ids: ['different'], provider_reference: 'different' },
    ]);
    expect(result.initiator?.id).toBe('candidate-user');
    expect(result.relatedPayments.map(item => item.id)).toEqual(['related']);
  });
});
