import { localFeeRows } from './local-payment-evidence';
import { reconcile } from './bank-reconciliation';
import type { BankStatement } from './bank-statement-store';
import type { Candidate, CandidateStage, Payment } from './types';
import { isForeignPayment } from './currency';

export const candidatePaymentReview = (candidates: Candidate[], stages: CandidateStage[], payments: Payment[], fees: Record<number, number>, statements: Map<string, BankStatement | null>): Map<string, 'pending' | 'settled'> => {
  const rows = localFeeRows(candidates, stages, payments, fees);
  const matchedIds = new Set<string>();
  statements.forEach((statement, agencyId) => {
    if (!statement) return;
    reconcile(payments.filter(payment => !isForeignPayment(payment) && payment.status === 'succeeded' && payment.payee_local_agency_id === agencyId), statement.lines)
      .matches.filter(match => match.status === 'matched').forEach(match => matchedIds.add(match.payment.id));
  });
  return new Map(candidates.map(candidate => {
    const own = rows.filter(row => row.candidate.id === candidate.id);
    const settled = own.length > 0 && own.every(row => row.status === 'paid'
      && row.payments.filter(payment => payment.status === 'succeeded').every(payment => matchedIds.has(payment.id)));
    return [candidate.id, settled ? 'settled' : 'pending'];
  }));
};
