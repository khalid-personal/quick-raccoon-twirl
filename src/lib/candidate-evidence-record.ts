import { ALL_STAGES, type Candidate, type CandidateStage, type Payment, type PaymentStatus } from './types';
import { isForeignPayment } from './currency';
import { isStageComplete } from './candidate-stage-normalization';
import { paymentsWithReusedReferences, reconcile, type PaymentMatch } from './bank-reconciliation';
import type { BankStatement } from './bank-statement-store';

export const compileCandidateEvidence = (candidate: Candidate, stages: CandidateStage[], payments: Payment[], flags: PaymentStatus[], fees: Record<number, number>, statement: BankStatement | null) => {
  const local = payments.filter(payment => !isForeignPayment(payment) && payment.payee_local_agency_id === candidate.local_agency_id);
  const matches = new Map<string, PaymentMatch>(statement && (!statement.scan_report || statement.scan_report.status === 'clear') ? reconcile(local.filter(payment => payment.status === 'succeeded'), statement.lines).matches.map(match => [match.payment.id, match]) : []);
  const ambiguous = paymentsWithReusedReferences(local);
  const rows = ALL_STAGES.map((meta, index) => {
    const stage = stages.find(stage => stage.candidate_id === candidate.id && stage.stage_id === meta.id);
    const receipts = local.filter(payment => payment.stage_id === meta.id && payment.candidate_ids.length === 1 && payment.candidate_ids[0] === candidate.id);
    const settled = receipts.filter(payment => payment.status === 'succeeded');
    const expected = fees[meta.id] ?? meta.fee_amount ?? 0;
    const received = settled.filter(payment => payment.currency.toUpperCase() === 'ETB').reduce((sum, payment) => sum + payment.amount, 0);
    const wrongCurrency = settled.some(payment => payment.currency.toUpperCase() !== 'ETB');
    const feeCovered = !wrongCurrency && received + 0.01 >= expected;
    const paymentRecorded = expected <= 0 || flags.some(flag => flag.candidateId === candidate.id && flag.stageId === meta.id && flag.isPaid);
    const bankMatched = expected <= 0 && !settled.length || settled.length > 0 && settled.every(payment => !ambiguous.has(payment.id) && matches.get(payment.id)?.status === 'matched');
    const completed = !!stage && isStageComplete(stage.status);
    const prerequisitesComplete = ALL_STAGES.slice(0, index).every(meta => stages.some(prior => prior.candidate_id === candidate.id && prior.stage_id === meta.id && isStageComplete(prior.status)));
    return { meta, stage, receipts, expected, received, feeCovered, paymentRecorded, bankMatched, completed, matches,
      cleared: completed && prerequisitesComplete && feeCovered && paymentRecorded && bankMatched && Math.abs(received - expected) <= 0.01 };
  });
  const receipts = rows.flatMap(row => row.receipts);
  const unallocated = local.filter(payment => payment.candidate_ids.includes(candidate.id) && (!ALL_STAGES.some(stage => stage.id === payment.stage_id) || payment.candidate_ids.length !== 1));
  const foreignReceipts = payments.filter(payment => isForeignPayment(payment) && payment.candidate_ids.includes(candidate.id) && payment.payee_local_agency_id === candidate.local_agency_id);
  return { candidate, rows, receipts, unallocated, foreignReceipts, expected: rows.reduce((sum, row) => sum + row.expected, 0),
    received: rows.reduce((sum, row) => sum + row.received, 0), completed: rows.filter(row => row.completed).length,
    cleared: rows.filter(row => row.cleared).length, status: rows.every(row => row.cleared) && !unallocated.length ? 'settled' as const : 'pending' as const };
};
export type CandidateEvidenceRecord = ReturnType<typeof compileCandidateEvidence>;
