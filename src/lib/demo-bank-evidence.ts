import { loadBankStatement, loadReconciliationEvents, saveBankStatement, type BankStatement, type PaymentStatementSource, type ReconciliationCaseEvent } from './bank-statement-store';
import { reconcile } from './bank-reconciliation';
import { getCandidates, getLocalAgencies, getPayments, getStaffUsers } from './data-store';
import { DEMO_KEY_PREFIX, isDemoMode } from './demo-mode';
import { isForeignPayment } from './currency';
import { evidenceToday, getEvidenceRequests } from './evidence-requests';
import type { Candidate, LocalAgency, Payment, StaffUser } from './types';
import { demoBankName } from './demo-payment-evidence';
import { paymentCandidateSummary } from './demo-identities';

const day = 86_400_000;
export const buildDemoBankEvidence = (
  agency: LocalAgency, candidates: Candidate[], payments: Payment[], staff: StaffUser[], now = new Date(),
): { source: PaymentStatementSource; statement: BankStatement; events: ReconciliationCaseEvent[] }[] => {
  const agencyCandidates = candidates.filter(candidate => candidate.local_agency_id === agency.id);
  const owner = staff.find(user => user.local_agency_id === agency.id && user.role === 'local-agency')?.email ?? agency.name;
  const statementOwner = staff.find(user => user.local_agency_id === agency.id && user.role === 'staff' && user.is_approved)?.email ?? owner;
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
          description: `DEMO / synthetic credit for ${paymentCandidateSummary(payment, candidates)}; ${agency.name}; ${payment.provider_reference || payment.receipt_number || payment.id}; not real bank proof`,
          reference: index % 23 === 4 ? `DEMO-WRONG-${payment.id}` : payment.provider_reference || payment.receipt_number || payment.id,
          amount: Math.round(payment.amount * (index % 23 === 1 ? 0.8 : index % 23 === 2 ? 1.15 : 1) * 100) / 100,
          currency: index % 23 === 5 ? (payment.currency === 'USD' ? 'EUR' : 'USD') : payment.currency,
        }];
      }),
    };
    const issues = reconcile(settled, statement.lines).matches.filter(match => match.status !== 'matched');
    const needsEvidence: { caseId: string; payment?: Payment; candidate?: Candidate; explanation: string }[] = [
      ...issues.map(match => ({ caseId: match.payment.id, payment: match.payment, explanation: match.explanation })),
      ...scoped.filter(payment => payment.status === 'pending').map(payment => ({
        caseId: payment.id, payment, explanation: 'Pending transfer: no settled bank deposit has been invented.',
      })),
      ...(source === 'candidate' ? agencyCandidates.filter(candidate => !scoped.some(payment => payment.candidate_ids.includes(candidate.id))).map(candidate => ({
        caseId: `candidate-evidence:${candidate.id}`, candidate, explanation: `No stage-fee receipt is recorded for ${candidate.first_name} ${candidate.last_name}. Request proof before claiming any deposit.`,
      })) : []),
    ];
    const events = needsEvidence.map(({ caseId, payment, candidate, explanation }, index): ReconciliationCaseEvent => ({
      id: `demo-evidence-${source}-${caseId}`,
      caseId,
      action: 'request-evidence',
      note: `DEMO / synthetic evidence request. ${explanation}`,
      actor: 'Demo finance seed (not a real operator)', owner: source === 'foreign' ? statementOwner : owner,
      submissionStart: date(-7),
      dueDate: date(index % 3 === 0 ? -2 : index % 3 === 1 ? 1 : 5),
      createdAt: new Date(now.getTime() - 7 * day).toISOString(),
      source, synthetic: true,
      evidence: { payment, statementName: statement.name, explanation, agencyName: agency.name,
        candidateIdentities: (candidate ? [candidate] : candidates.filter(item => payment?.candidate_ids.includes(item.id)))
          .map(item => ({ candidate_id: item.id, name: `${item.first_name} ${item.last_name}`, tracking_code: item.tracking_code })) },
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
    let events = loadReconciliationEvents(agency.id);
    const owner = staff.find(person => person.role === 'staff' && person.is_approved && person.local_agency_id === agency.id)?.email;
    const generated = (event: ReconciliationCaseEvent) => event.synthetic && event.action === 'request-evidence'
      && (event.id.startsWith('demo-evidence-') && event.actor === 'Demo finance seed (not a real operator)'
        || event.id.startsWith('demo-integrity-evidence-') && event.note.startsWith('DEMO'));
    const operatorCases = new Set(events.filter(event => !generated(event)).map(event => event.caseId));
    const seededRequests = new Set(getEvidenceRequests(events).filter(({ event }) => generated(event)
      && event.source === 'foreign' && !operatorCases.has(event.caseId)).map(({ event }) => event.id));
    if (owner && events.some(event => seededRequests.has(event.id) && event.owner !== owner)) {
      events = events.map(event => seededRequests.has(event.id) ? { ...event, owner } : event);
      localStorage.setItem(`${DEMO_KEY_PREFIX}dawm_bank_statement:${agency.id}:cases`, JSON.stringify(events));
    }
    if (localStorage.getItem(marker)) return;
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
