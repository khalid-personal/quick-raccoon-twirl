import { isForeignPayment, minimumPerCandidate, contractCountryOf } from './currency';
import type { Candidate, Payment } from './types';

export const contractWasSent = (candidate: Candidate): boolean =>
  candidate.work_contract_record ? ['sent', 'received'].includes(candidate.work_contract_record.status) : candidate.external_status?.work_contract === true;

export function foreignContractPayment(candidate: Candidate, payments: Payment[]): { paid: boolean; detail: string } {
  const receipts = payments.filter(payment => isForeignPayment(payment) && payment.candidate_ids.includes(candidate.id)
    && payment.payer_foreign_agency_id === candidate.foreign_agency_id && payment.payee_local_agency_id === candidate.local_agency_id);
  const minimum = minimumPerCandidate(contractCountryOf(candidate));
  const settled = receipts.filter(payment => payment.status === 'succeeded' && Number.isFinite(payment.amount) && payment.amount > 0
    && payment.candidate_ids.length === new Set(payment.candidate_ids).size);
  if (!settled.length) return { paid: false, detail: receipts.some(payment => payment.status === 'pending')
    ? 'A transfer is pending. Record a successful receipt before treating the candidate as paid.'
    : 'No successful foreign-to-local receipt is recorded for this candidate. The responsible foreign agency needs to make payment after sending the work contract.' };
  if (!minimum) return { paid: false, detail: 'Confirm the contract country and currency before verifying the foreign agency payment.' };
  const amount = settled.filter(payment => payment.currency.trim().toUpperCase() === minimum.currency)
    .reduce((sum, payment) => sum + payment.amount / payment.candidate_ids.length, 0);
  return { paid: amount >= minimum.amount - 0.01, detail: amount >= minimum.amount - 0.01
    ? 'A successful receipt covers the contract payment for this candidate.'
    : `Recorded receipts cover ${amount.toLocaleString()} ${minimum.currency} for this candidate; ${minimum.amount.toLocaleString()} ${minimum.currency} is required. Follow up with the responsible foreign agency.` };
}
