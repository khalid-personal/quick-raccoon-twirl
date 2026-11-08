import { loadBankStatement, loadReconciliationEvents, saveBankStatement, type BankStatement, type PaymentStatementSource, type ReconciliationCaseEvent } from './bank-statement-store';
import { reconcile } from './bank-reconciliation';
import { getCandidates, getLocalAgencies, getPayments, getStaffUsers } from './data-store';
import { DEMO_KEY_PREFIX, isDemoMode } from './demo-mode';
import { isForeignPayment } from './currency';
import { evidenceToday } from './evidence-requests';
import type { Candidate, LocalAgency, Payment, StaffUser } from './types';
import { demoBankName } from './demo-payment-evidence';

const day = 86_400_000;
export const buildDemoBankEvidence = (
  agency: LocalAgency, candidates: Candidate[], payments: Payment[], staff: StaffUser[], now = new Date(),
): { source: PaymentStatementSource; statement: BankStatement; events: ReconciliationCaseEvent[] }[] => {
  const agencyCandidates = candidates.filter(candidate => candidate.local_agency_id === agency.id);
  const owner = staff.find(user => user.local_agency_id === agency.id && user.role === 'local-agency')?.email ?? agency.name;
  const date = (offset: number) => evidenceToday(new Date(now.getTime() + offset * day));
  return (['candidate', 'foreign'] as const).map(source => {
    const scoped = payments.filter(payment => payment.payee_local_agency_id === agency.id && isForeignPayment(payment) === (source === 'foreign'));
    const settled = scoped.filter(payment => payment.status === 'succeeded');
    const statement: BankStatement = {
      name: `${demoBankName(source)} · DEMO / SYNTHETIC · ${agency.name} statement`,
      synthetic: true,
      covered_candidate_ids: agencyCandidates.map(candidate => candidate.id),
      lines: settled.flatMap((payment, index) => {
        if (index % 23 === 3) return [];
        return [{
          date: payment.created_at.slice(0, 10),
          description: `DEMO / synthetic credit for ${payment.candidate_ids.join(', ')}; not real bank proof`,
          reference: index % 23 === 4 ? `DEMO-WRONG-${payment.id}` : payment.provider_reference || payment.receipt_number || payment.id,
          amount: Math.round(payment.amount * (index % 23 === 1 ? 0.8 : index % 23 === 2 ? 1.15 : 1) * 100) / 100,
          currency: index % 23 === 5 ? (payment.currency === 'USD' ? 'EUR' : 'USD') : payment.currency,
        }];
      }),
    };
    const issues = reconcile(settled, statement.lines).matches.filter(match => match.status !== 'matched');
    const needsEvidence: { caseId: string; payment?: Payment; explanation: string }[] = [
      ...issues.map(match => ({ caseId: match.payment.id, payment: match.payment, explanation: match.explanation })),
      ...scoped.filter(payment => payment.status === 'pending').map(payment => ({
        caseId: payment.id, payment, explanation: 'Pending transfer: no settled bank deposit has been invented.',
      })),
      ...(source === 'candidate' ? agencyCandidates.filter(candidate => !scoped.some(payment => payment.candidate_ids.includes(candidate.id))).map(candidate => ({
        caseId: `candidate-evidence:${candidate.id}`, explanation: `No stage-fee receipt is recorded for ${candidate.first_name} ${candidate.last_name}. Request proof before claiming any deposit.`,
      })) : []),
    ];
    const events = needsEvidence.map(({ caseId, payment, explanation }, index): ReconciliationCaseEvent => ({
      id: `demo-evidence-${source}-${caseId}`,
      caseId,
      action: 'request-evidence',
      note: `DEMO / synthetic evidence request. ${explanation}`,
      actor: 'Demo finance seed (not a real operator)', owner,
      submissionStart: date(-7),
      dueDate: date(index % 3 === 0 ? -2 : index % 3 === 1 ? 1 : 5),
      createdAt: new Date(now.getTime() - 7 * day).toISOString(),
      source, synthetic: true,
      evidence: { payment, statementName: statement.name, explanation },
    }));
    return { source, statement, events };
  });
};

export const ensureDemoBankEvidence = (): void => {
  if (!isDemoMode()) return;
  const candidates = getCandidates().filter(candidate => candidate.id.startsWith('demo-'));
  const payments = getPayments().filter(payment => payment.id.startsWith('demo-'));
  const staff = getStaffUsers();
  getLocalAgencies().filter(agency => agency.id.startsWith('demo-')).forEach(agency => {
    const marker = `${DEMO_KEY_PREFIX}bank_evidence_initialized:${agency.id}`;
    if (localStorage.getItem(marker)) return;
    let events = loadReconciliationEvents(agency.id);
    buildDemoBankEvidence(agency, candidates, payments, staff).forEach(({ source, statement, events: generated }) => {
      if (loadBankStatement(agency.id, source)) return;
      saveBankStatement(agency.id, statement, source);
      events = [...events, ...generated.filter(event => !events.some(existing => existing.caseId === event.caseId))];
    });
    localStorage.setItem(`${DEMO_KEY_PREFIX}dawm_bank_statement:${agency.id}:cases`, JSON.stringify(events));
    localStorage.setItem(marker, '1');
  });
  window.dispatchEvent(new CustomEvent('bank-statement-changed'));
};
