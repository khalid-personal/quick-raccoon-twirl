import { ALL_STAGES, type Candidate, type CandidateStage, type Payment, type PaymentStatus, type StageStatus } from './types';
import { isForeignPayment } from './currency';

export const stageIsComplete = (status: StageStatus): boolean => ['Passed', 'Issued', 'Completed'].includes(status);
export const requiredMedicalExams = (gender: Candidate['gender']): string[] => gender === 'male'
  ? ['HIV', 'Final Agency Medical'] : ['HIV', 'Pregnancy', 'Final Agency Medical'];

export function stageFeeCovered(candidate: Candidate, stageId: number, fees: Record<number, number>, statuses: PaymentStatus[], payments: Payment[]): boolean {
  const fee = fees[stageId] ?? ALL_STAGES.find(stage => stage.id === stageId)?.fee_amount ?? 0;
  if (!Number.isFinite(fee) || fee < 0) return false;
  if (fee === 0) return true;
  const receipts = payments.filter(payment => !isForeignPayment(payment) && payment.stage_id === stageId
    && payment.candidate_ids.includes(candidate.id));
  if (receipts.length) {
    const settled = receipts.filter(payment => payment.status === 'succeeded' && payment.currency.toUpperCase() === 'ETB'
      && !!candidate.local_agency_id && payment.payee_local_agency_id === candidate.local_agency_id
      && payment.candidate_ids.length === 1 && Number.isFinite(payment.amount) && payment.amount > 0);
    return settled.reduce((sum, payment) => sum + payment.amount, 0) >= fee - 0.01;
  }
  return statuses.some(payment => payment.candidateId === candidate.id && payment.stageId === stageId && payment.isPaid);
}

export function stageProgressBlockers(candidate: Candidate, stageId: number, status: StageStatus, stages: CandidateStage[],
  fees: Record<number, number>, statuses: PaymentStatus[], payments: Payment[]): string[] {
  const target = ALL_STAGES.find(stage => stage.id === stageId);
  if (!target) return ['Stage is not configured.'];
  if (status === 'Pending') return [];
  const blockers: string[] = [];
  for (const previous of ALL_STAGES.filter(stage => stage.ordinal < target.ordinal).sort((a, b) => a.ordinal - b.ordinal)) {
    const record = stages.find(stage => stage.candidate_id === candidate.id && stage.stage_id === previous.id);
    if (!record || !stageIsComplete(record.status)) blockers.push(`${previous.title} must be completed first.`);
    if (!stageFeeCovered(candidate, previous.id, fees, statuses, payments)) blockers.push(`${previous.title} payment is required before advancing. Await payment; later stages cannot start.`);
  }
  if (stageIsComplete(status) && !stageFeeCovered(candidate, stageId, fees, statuses, payments)) {
    const fee = fees[stageId] ?? target.fee_amount ?? 0;
    blockers.push(`${target.title} cannot be completed until its ${fee.toLocaleString()} ETB stage fee is paid.`);
  }
  return blockers;
}
