import { loadBankStatement, recordReconciliationEvent, saveBankStatement, type PaymentStatementSource, type ReconciliationCaseEvent } from '../bank-statement-store';
import { recordApprovalLog } from './log-management';
import { evidenceReviewStatus } from '../payment-evidence-status';
import { isDemoMode } from '../demo-mode';
import { getCandidates, getConfig, getLocalAgencies, getPayments, getPaymentStatuses, savePayments, savePaymentStatuses } from '../data-store';
import type { PaymentMatch } from '../bank-reconciliation';
import { isForeignPayment } from '../currency';
import { paymentReferences, paymentsWithReusedReferences } from '../bank-reconciliation';
import { withDemoPaymentEvidence, withDemoStatementOriginal } from '../demo-payment-evidence';

interface Actor { id: string; email: string; role: string; }
const requireSuperadmin = (actor: Actor) => {
  if (actor.role !== 'superadmin' || !actor.id || !actor.email) throw new Error('A signed-in superadmin is required.');
};
export const overridePaymentEvidence = async (
  agencyId: string, input: { caseId: string; source: PaymentStatementSource; decision: 'accept' | 'revoke'; note: string; match?: PaymentMatch; evidence: ReconciliationCaseEvent['evidence'] }, actor: Actor,
) => {
  requireSuperadmin(actor);
  if (!agencyId || !input.caseId || !input.note.trim()) throw new Error('Agency, case and an override reason are required.');
  const priorStatus = evidenceReviewStatus(input.evidence.payment, input.match);
  const audit = await recordApprovalLog(actor.id, actor.email, 'Payment', input.evidence.payment?.id ?? input.caseId, 'Updated',
    `Evidence override ${input.decision}: ${priorStatus}. Reason: ${input.note.trim()}. Bank evidence and payment settlement unchanged. Snapshot: ${JSON.stringify(input.evidence)}`);
  return recordReconciliationEvent(agencyId, { caseId: input.caseId, source: input.source, action: input.decision === 'accept' ? 'resolve' : 'review',
    note: input.note.trim(), actor: actor.email, owner: '', dueDate: '', evidence: input.evidence,
    synthetic: isDemoMode(), override: { decision: input.decision, actorId: actor.id, priorStatus, auditId: audit.id } });
};

export const simulateMatchingDeposit = async (paymentId: string, source: PaymentStatementSource, actor: Actor): Promise<void> => {
  requireSuperadmin(actor);
  if (!isDemoMode()) throw new Error('Bank deposit simulation is demo-only.');
  const payment = getPayments().find(item => item.id === paymentId);
  if (!payment?.id.startsWith('demo-') || payment.status !== 'succeeded' || !payment.payee_local_agency_id) throw new Error('Choose a settled demo payment with a local agency.');
  if (isForeignPayment(payment) !== (source === 'foreign')) throw new Error('The statement source must match the payment source.');
  const statement = loadBankStatement(payment.payee_local_agency_id, source);
  if (!statement?.synthetic) throw new Error('Only a synthetic demo statement can be changed; uploaded statements are preserved.');
  const reference = payment.provider_reference?.trim();
  if (!reference) throw new Error('The demo payment needs a recorded transfer reference.');
  if (getPayments().some(item => item.id !== payment.id && item.status === 'succeeded'
    && item.payee_local_agency_id === payment.payee_local_agency_id && isForeignPayment(item) === isForeignPayment(payment)
    && item.provider_reference?.trim().toLowerCase() === reference.toLowerCase())) throw new Error('Resolve the duplicate payment reference before simulating a deposit.');
  const lines = statement.lines.filter(line => line.reference.toLowerCase() !== reference.toLowerCase()
    && line.reference !== `DEMO-WRONG-${payment.id}`);
  const line = { date: payment.created_at.slice(0, 10), reference, amount: payment.amount, currency: payment.currency,
    description: `DEMO / simulated matching credit for ${payment.id}; not real bank proof` };
  await recordApprovalLog(actor.id, actor.email, 'Payment', payment.id, 'Updated', `DEMO / simulated matching deposit. Previous linked rows: ${JSON.stringify(statement.lines.filter(row => !lines.includes(row)))}. New row: ${JSON.stringify(line)}.`);
  saveBankStatement(payment.payee_local_agency_id, { ...statement, lines: [...lines, line] }, source);
  recordReconciliationEvent(payment.payee_local_agency_id, { caseId: payment.id, action: 'resolve', note: 'DEMO / matching bank credit simulated. Bank-evidence request resolved; this is not real settlement proof.',
    actor: actor.email, owner: '', dueDate: '', source, synthetic: true, evidence: { payment, line, statementName: statement.name, explanation: 'Synthetic amount, currency and transfer reference match.' } });
};

export async function createMatchedDemoEvidence(paymentId: string, source: PaymentStatementSource, actor: Actor): Promise<void> {
  requireSuperadmin(actor);
  if (!isDemoMode()) throw new Error('Complete synthetic evidence is demo-only.');
  const prior = getPayments().find(payment => payment.id === paymentId);
  if (!prior?.id.startsWith('demo-') || !['pending', 'succeeded'].includes(prior.status)) throw new Error('Choose a pending or settled demo receipt. Failed/refunded history is not rewritten.');
  if (isForeignPayment(prior) !== (source === 'foreign')) throw new Error('Statement source does not match this payment.');
  if (!prior.payee_local_agency_id || !Number.isFinite(prior.amount) || prior.amount <= 0 || !prior.currency.trim()) throw new Error('Recorded receiving agency, positive amount and currency are required.');
  if (paymentsWithReusedReferences(getPayments().map(payment => payment.id === prior.id ? { ...payment, status: 'succeeded' } : payment)).has(prior.id)) throw new Error('Resolve reused payment references before generating evidence.');
  const agency = getLocalAgencies().find(agency => agency.id === prior.payee_local_agency_id);
  const stored = loadBankStatement(prior.payee_local_agency_id, source);
  if (stored && !stored.synthetic) throw new Error('Uploaded bank statements cannot be overwritten by demo generation.');
  if (stored?.scan_report && stored.scan_report.status !== 'clear') throw new Error('Remove the blocked/review-needed statement explicitly before generating demo proof.');
  const reference = prior.provider_reference || prior.receipt_number || `DEMO-TRANSFER-${prior.id}`;
  const updated = withDemoPaymentEvidence({ ...prior, provider: 'mock', provider_reference: reference, status: 'succeeded', updated_at: new Date().toISOString() }, getCandidates());
  const references = paymentReferences(updated).map(value => value.trim().toLowerCase());
  const line = { date: updated.updated_at.slice(0, 10), reference, amount: updated.amount, currency: updated.currency,
    description: `DEMO synthetic settled transfer for ${updated.demo_evidence!.identities.map(identity => `${identity.name} (${identity.tracking_code})`).join(', ')}. Not real-bank proof.` };
  const statement = withDemoStatementOriginal({ ...stored, name: '', synthetic: true,
    covered_candidate_ids: [...new Set([...(stored?.covered_candidate_ids ?? []), ...updated.candidate_ids])],
    lines: [...(stored?.lines ?? []).filter(row => !references.includes(row.reference.trim().toLowerCase()) && row.reference !== `DEMO-WRONG-${prior.id}`), line] }, agency?.name ?? prior.payee_local_agency_id, source);
  await recordApprovalLog(actor.id, actor.email, 'Payment', prior.id, 'Updated',
    `DEMO ONLY: generated complete synthetic confirmation, candidate identity snapshot and matching bank statement. Recorded status ${prior.status} → succeeded; amount/currency and candidate identity unchanged. Previous receipt ${JSON.stringify(prior)}. No real provider confirmation, bank authentication or fraud-free certification.`);
  if (JSON.stringify(getPayments().find(payment => payment.id === prior.id)) !== JSON.stringify(prior)
    || JSON.stringify(loadBankStatement(prior.payee_local_agency_id, source)) !== JSON.stringify(stored)) throw new Error('Evidence changed during generation. Refresh before retrying.');
  savePayments(getPayments().map(payment => payment.id === prior.id ? updated : payment));
  if (source === 'candidate' && updated.candidate_ids.length === 1 && updated.stage_id) {
    const expected = getConfig().stageFees?.[updated.stage_id];
    const receipts = getPayments().filter(payment => !isForeignPayment(payment) && payment.status === 'succeeded' && payment.stage_id === updated.stage_id && payment.candidate_ids.length === 1 && payment.candidate_ids[0] === updated.candidate_ids[0] && payment.payee_local_agency_id === updated.payee_local_agency_id);
    if (expected !== undefined && receipts.every(receipt => receipt.currency === 'ETB') && Math.abs(receipts.reduce((sum, receipt) => sum + receipt.amount, 0) - expected) <= 0.01) {
      savePaymentStatuses([...getPaymentStatuses().filter(flag => flag.candidateId !== updated.candidate_ids[0] || flag.stageId !== updated.stage_id),
        { candidateId: updated.candidate_ids[0], stageId: updated.stage_id, isPaid: true }]);
    }
  }
  saveBankStatement(updated.payee_local_agency_id, statement, source);
  recordReconciliationEvent(updated.payee_local_agency_id, { caseId: updated.id, source, action: 'review', actor: actor.email, owner: '', dueDate: '', synthetic: true,
    note: 'Complete fictional demo evidence generated. Re-evaluate all contract/stage checks; no agency suspension or unfinished stage was cleared.',
    evidence: { payment: updated, line, statementName: statement.name, explanation: 'Synthetic identity, confirmation and bank reference/amount/currency match. Not a fraud-free certification.' } });
  window.dispatchEvent(new Event('supabase-data-changed'));
}
