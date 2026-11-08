import { reconcile, type PaymentMatch } from './bank-reconciliation';
import { isForeignPayment } from './currency';
import type { Payment } from './types';
import type { BankStatement, ReconciliationCaseEvent } from './bank-statement-store';

export type EvidenceReviewStatus = 'settled' | 'pending' | 'failed';
export const evidenceReviewStatus = (payment?: Payment, match?: PaymentMatch): EvidenceReviewStatus => {
  if (payment?.status === 'failed' || payment?.status === 'timed-out' || payment?.status === 'refunded') return 'failed';
  return payment?.status === 'succeeded' && match?.status === 'matched' ? 'settled' : 'pending';
};
export const matchPaymentEvidence = (payment: Payment, payments: Payment[], statement: BankStatement | null): PaymentMatch | undefined =>
  statement ? reconcile(payments.filter(item => item.payee_local_agency_id === payment.payee_local_agency_id
    && item.status === 'succeeded' && isForeignPayment(item) === isForeignPayment(payment)), statement.lines)
    .matches.find(match => match.payment.id === payment.id) : undefined;

export const activeEvidenceOverride = (events: ReconciliationCaseEvent[], caseId: string, payment?: Payment, match?: PaymentMatch) => {
  const event = events.filter(event => event.caseId === caseId && event.override).at(-1);
  if (event?.override?.decision !== 'accept') return undefined;
  return JSON.stringify(event.evidence.payment) === JSON.stringify(payment)
    && JSON.stringify(event.evidence.line) === JSON.stringify(match?.line) ? event : undefined;
};
