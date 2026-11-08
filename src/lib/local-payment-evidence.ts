import { ALL_STAGES, type Candidate, type CandidateStage, type Payment } from './types';
import { isForeignPayment } from './currency';

export type LocalFeeStatus = 'paid' | 'short' | 'over' | 'unpaid' | 'pending' | 'failed' | 'refunded' | 'wrong-currency';
export interface LocalFeeRow {
  candidate: Candidate;
  stageId: number;
  stageTitle: string;
  expected: number;
  received: number;
  status: LocalFeeStatus;
  payments: Payment[];
}
export const LOCAL_FEE_LABELS: Record<LocalFeeStatus, string> = {
  paid: 'Fee covered', short: 'Underpaid', over: 'Overpaid', unpaid: 'No settled receipt',
  pending: 'Payment pending', failed: 'Payment failed', refunded: 'Refunded', 'wrong-currency': 'Check currency',
};

export const localFeeRows = (
  candidates: Candidate[], stages: CandidateStage[], payments: Payment[], fees: Record<number, number>,
): LocalFeeRow[] => candidates.flatMap(candidate => {
  const own = stages.filter(stage => stage.candidate_id === candidate.id);
  const firstOpen = ALL_STAGES.find(meta => own.some(stage => stage.stage_id === meta.id && !['Completed', 'Passed', 'Issued'].includes(stage.status)));
  return ALL_STAGES.flatMap(meta => {
    const stage = own.find(stage => stage.stage_id === meta.id);
    const receipts = payments.filter(payment => !isForeignPayment(payment) && payment.stage_id === meta.id
      && payment.candidate_ids.length === 1 && payment.candidate_ids[0] === candidate.id
      && payment.payee_local_agency_id === candidate.local_agency_id);
    if (!stage || (stage.status === 'Pending' && meta.id !== firstOpen?.id && !receipts.length)) return [];
    const expected = fees[meta.id] ?? meta.fee_amount ?? 0;
    if (expected <= 0 && !receipts.length) return [];
    const settled = receipts.filter(payment => payment.status === 'succeeded');
    const received = settled.filter(payment => payment.currency.toUpperCase() === 'ETB').reduce((sum, payment) => sum + payment.amount, 0);
    const status: LocalFeeStatus = settled.some(payment => payment.currency.toUpperCase() !== 'ETB') ? 'wrong-currency'
      : received > expected + 0.01 ? 'over' : received >= expected - 0.01 && settled.length ? 'paid'
        : received > 0 ? 'short' : receipts.some(payment => payment.status === 'pending') ? 'pending'
          : receipts.some(payment => payment.status === 'failed') ? 'failed'
            : receipts.some(payment => payment.status === 'refunded') ? 'refunded' : 'unpaid';
    return [{ candidate, stageId: meta.id, stageTitle: meta.title, expected, received, status, payments: receipts }];
  });
});
