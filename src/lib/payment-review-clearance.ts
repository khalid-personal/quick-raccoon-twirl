import { ALL_STAGES, type Candidate, type CandidateStage, type Payment, type PaymentStatus } from './types';
import { analyzeAgencyPayments } from './agency-payments';
import { isForeignPayment } from './currency';
import { localFeeRows } from './local-payment-evidence';
import { isStageComplete } from './candidate-stage-normalization';
import { paymentsWithReusedReferences, reconcile } from './bank-reconciliation';
import { getCandidates, getCandidateStages, getConfig, getPayments, getPaymentStatuses } from './data-store';
import { loadBankStatement, type BankStatement } from './bank-statement-store';

export function verifiedPaymentIds(payments: Payment[], candidates: Candidate[], stages: CandidateStage[], flags: PaymentStatus[], fees: Record<number, number>, statementFor: (agencyId: string, source: 'foreign' | 'candidate') => BankStatement | null) {
  const verified = new Set<string>();
  const bankMatched = new Set<string>();
  const groups = new Map<string, Payment[]>();
  payments.filter(payment => payment.status === 'succeeded').forEach(payment => {
    const key = `${payment.payee_local_agency_id}:${isForeignPayment(payment) ? 'foreign' : 'candidate'}`;
    groups.set(key, [...groups.get(key) ?? [], payment]);
  });
  groups.forEach(group => {
    const first = group[0];
    const statement = statementFor(first.payee_local_agency_id, isForeignPayment(first) ? 'foreign' : 'candidate');
    if (statement && (!statement.scan_report || statement.scan_report.status === 'clear')) reconcile(group, statement.lines).matches.filter(match => match.status === 'matched').forEach(match => bankMatched.add(match.payment.id));
  });
  const contractRows = analyzeAgencyPayments(candidates, payments, stages).rows;
  const feesRows = localFeeRows(candidates, stages, payments, fees);
  const ambiguous = paymentsWithReusedReferences(payments);
  for (const payment of payments) {
    if (!bankMatched.has(payment.id) || !payment.candidate_ids.length || ambiguous.has(payment.id)) continue;
    const linked = payment.candidate_ids.map(id => candidates.find(candidate => candidate.id === id));
    if (linked.some(candidate => !candidate || candidate.local_agency_id !== payment.payee_local_agency_id)) continue;
    if (isForeignPayment(payment)) {
      if (linked.every(candidate => candidate && contractRows.some(row => row.candidate.id === candidate.id && row.payment?.id === payment.id && row.issue === 'paid'))) verified.add(payment.id);
    } else {
      const candidate = linked[0];
      if (linked.length !== 1 || !candidate || !ALL_STAGES.some(stage => stage.id === payment.stage_id)) continue;
      const row = feesRows.find(row => row.candidate.id === candidate.id && row.stageId === payment.stage_id);
      const stage = stages.find(stage => stage.candidate_id === candidate.id && stage.stage_id === payment.stage_id);
      if (row?.status === 'paid' && stage && isStageComplete(stage.status)
        && ALL_STAGES.slice(0, ALL_STAGES.findIndex(meta => meta.id === payment.stage_id)).every(meta => stages.some(previous => previous.candidate_id === candidate.id && previous.stage_id === meta.id && isStageComplete(previous.status)))
        && (row.expected <= 0 || flags.some(flag => flag.candidateId === candidate.id && flag.stageId === payment.stage_id && flag.isPaid))
        && row.payments.filter(receipt => receipt.status === 'succeeded').every(receipt => bankMatched.has(receipt.id))) verified.add(payment.id);
    }
  }
  return verified;
}
export function currentVerifiedPaymentIds() {
  return verifiedPaymentIds(getPayments(), getCandidates(), getCandidateStages(), getPaymentStatuses(), getConfig().stageFees ?? {}, loadBankStatement);
}
