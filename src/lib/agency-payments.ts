import { MIN_PAYMENT_USD, contractCountryOf, currencyForCountry, isEtb, isForeignPayment, minimumPerCandidate, toUsd } from './currency';
import type { Candidate, CandidateStage, Payment } from './types';

const DAY = 86_400_000;

export type ReconIssue =
  | 'paid' | 'awaiting' | 'missing' | 'pending' | 'failed' | 'short' | 'over'
  | 'wrong-currency' | 'etb' | 'wrong-payee' | 'wrong-payer' | 'duplicate-reference';

export const ISSUE_LABEL: Record<ReconIssue, string> = {
  paid: 'Matched', awaiting: 'Awaiting payment', missing: 'Missing payment', pending: 'Pending settlement', failed: 'Failed or refunded',
  short: 'Short paid', over: 'Overpaid', 'wrong-currency': 'Wrong currency', etb: 'Paid in ETB', 'wrong-payee': 'Wrong local agency',
  'wrong-payer': 'Wrong foreign agency', 'duplicate-reference': 'Reference reused',
};

export const DISCREPANCIES: ReconIssue[] = ['missing', 'pending', 'failed', 'short', 'over', 'wrong-currency', 'etb', 'wrong-payee', 'wrong-payer', 'duplicate-reference'];
export const isDiscrepancy = (issue: ReconIssue) => DISCREPANCIES.includes(issue);

export interface ReconRow {
  candidate: Candidate;
  foreignAgencyId: string;
  localAgencyId: string;
  contractAt: number;
  country?: string;
  currency?: string;
  expectedMin?: number;
  received: number;
  receivedUsd: number;
  issue: ReconIssue;
  message: string;
  payment?: Payment;
}

export interface PairSummary {
  key: string;
  foreignAgencyId: string;
  localAgencyId: string;
  contracts: number;
  matched: number;
  awaiting: number;
  flagged: number;
  expectedUsd: number;
  receivedUsd: number;
}

export interface ReconSummary {
  rows: ReconRow[];
  pairs: PairSummary[];
  byIssue: Record<ReconIssue, number>;
  contracts: number;
  flagged: number;
  expectedUsd: number;
  receivedUsd: number;
}

const stageDate = (stages: CandidateStage[], candidateId: string, stageId: number) =>
  stages.find(stage => stage.candidate_id === candidateId && stage.stage_id === stageId)?.date;

// Compares each work contract with the foreign agency payments that should have reached the candidate's local agency.
export const analyzeAgencyPayments = (
  candidates: Candidate[], payments: Payment[], stages: CandidateStage[], now = Date.now(), localAgencyId?: string,
): ReconSummary => {
  const foreign = payments.filter(isForeignPayment);
  const referenceCount = new Map<string, number>();
  foreign.forEach(payment => { if (payment.provider_reference) referenceCount.set(payment.provider_reference, (referenceCount.get(payment.provider_reference) ?? 0) + 1); });

  const rows: ReconRow[] = [];
  candidates.forEach(candidate => {
    if (!candidate.external_status?.work_contract || !candidate.foreign_agency_id || !candidate.local_agency_id) return;
    if (localAgencyId && candidate.local_agency_id !== localAgencyId) return;
    const country = contractCountryOf(candidate);
    const min = minimumPerCandidate(country);
    if (!min) return;
    const contractAt = Date.parse(stageDate(stages, candidate.id, 3) ?? candidate.created_at);
    const own = foreign.filter(payment => payment.candidate_ids.includes(candidate.id));
    const payment = own.find(item => item.status === 'succeeded') ?? own[own.length - 1];
    const base = { candidate, foreignAgencyId: candidate.foreign_agency_id, localAgencyId: candidate.local_agency_id, contractAt, country, currency: min.currency, expectedMin: min.amount, payment };
    const row = (issue: ReconIssue, message: string, received = 0, receivedUsd = 0): ReconRow => ({ ...base, issue, message, received, receivedUsd });

    if (!payment) {
      const overdue = now - contractAt > 30 * DAY;
      return rows.push(row(overdue ? 'missing' : 'awaiting', overdue ? 'No payment received more than 30 days after the contract.' : 'Contract is recent; payment not yet due.'));
    }
    const shares = Math.max(1, payment.candidate_ids.length);
    const received = payment.amount / shares;
    const usd = toUsd(payment.amount, payment.currency);
    const receivedUsd = (usd ?? 0) / shares;
    if (payment.status === 'failed' || payment.status === 'refunded') return rows.push(row('failed', `Payment is ${payment.status}.`));
    if (payment.status === 'pending') return rows.push(row('pending', 'Payment initiated but not yet settled.', received, receivedUsd));
    if (isEtb(payment.currency)) return rows.push(row('etb', 'Foreign agency payments cannot be made in ETB.', received, 0));
    if (min.currency !== payment.currency.toUpperCase()) return rows.push(row('wrong-currency', `Paid in ${payment.currency}; the contract currency is ${min.currency}.`, received, receivedUsd));
    if (payment.payee_local_agency_id !== candidate.local_agency_id) return rows.push(row('wrong-payee', 'Paid to a different local agency than the one managing the candidate.', received, receivedUsd));
    if (payment.payer_foreign_agency_id !== candidate.foreign_agency_id) return rows.push(row('wrong-payer', 'Paid by a different foreign agency than the one on the contract.', received, receivedUsd));
    if (received < min.amount) return rows.push(row('short', `Equals ${Math.round(receivedUsd)} USD against the ${MIN_PAYMENT_USD} USD minimum.`, received, receivedUsd));
    if (payment.provider_reference && (referenceCount.get(payment.provider_reference) ?? 0) > 1) return rows.push(row('duplicate-reference', 'The bank reference appears on more than one payment.', received, receivedUsd));
    if (receivedUsd > MIN_PAYMENT_USD * 1.3) return rows.push(row('over', `Equals ${Math.round(receivedUsd)} USD, well above the ${MIN_PAYMENT_USD} USD minimum.`, received, receivedUsd));
    return rows.push(row('paid', 'Matches the contract.', received, receivedUsd));
  });

  const byIssue = Object.fromEntries((Object.keys(ISSUE_LABEL) as ReconIssue[]).map(issue => [issue, 0])) as Record<ReconIssue, number>;
  const pairMap = new Map<string, PairSummary>();
  rows.forEach(item => {
    byIssue[item.issue] += 1;
    const key = `${item.foreignAgencyId}|${item.localAgencyId}`;
    const pair = pairMap.get(key) ?? { key, foreignAgencyId: item.foreignAgencyId, localAgencyId: item.localAgencyId, contracts: 0, matched: 0, awaiting: 0, flagged: 0, expectedUsd: 0, receivedUsd: 0 };
    pair.contracts += 1;
    if (item.issue === 'paid') pair.matched += 1;
    else if (item.issue === 'awaiting') pair.awaiting += 1;
    else pair.flagged += 1;
    if (item.issue !== 'awaiting') pair.expectedUsd += MIN_PAYMENT_USD;
    pair.receivedUsd += item.receivedUsd;
    pairMap.set(key, pair);
  });
  const pairs = [...pairMap.values()].sort((a, b) => b.flagged - a.flagged || b.contracts - a.contracts);
  return {
    rows, pairs, byIssue, contracts: rows.length,
    flagged: rows.filter(item => isDiscrepancy(item.issue)).length,
    expectedUsd: pairs.reduce((sum, pair) => sum + pair.expectedUsd, 0),
    receivedUsd: pairs.reduce((sum, pair) => sum + pair.receivedUsd, 0),
  };
};
