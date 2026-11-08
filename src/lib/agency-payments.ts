import { MIN_PAYMENT_USD, contractCountryOf, currencyForCountry, isEtb, isForeignPayment, minimumPerCandidate, toUsd } from './currency';
import type { Candidate, CandidateStage, Payment } from './types';
import { contractWasSent } from './foreign-contract-payment';

export type ReconIssue =
  | 'paid' | 'awaiting' | 'missing' | 'pending' | 'failed' | 'short' | 'over'
  | 'wrong-currency' | 'etb' | 'wrong-payee' | 'wrong-payer' | 'duplicate-reference';

export const ISSUE_LABEL: Record<ReconIssue, string> = {
  paid: 'Matched', awaiting: 'Awaiting payment', missing: 'Missing payment', pending: 'Pending settlement', failed: 'Failed, timed out or refunded',
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
    if (!contractWasSent(candidate) || !candidate.foreign_agency_id || !candidate.local_agency_id) return;
    if (localAgencyId && candidate.local_agency_id !== localAgencyId) return;
    const country = contractCountryOf(candidate);
    const min = minimumPerCandidate(country);
    if (!min) return;
    const contractAt = Date.parse(candidate.work_contract_record?.sent_at ?? stageDate(stages, candidate.id, 3) ?? candidate.created_at);
    const own = foreign.filter(payment => payment.candidate_ids.includes(candidate.id));
    const settled = own.filter(item => item.status === 'succeeded' && Number.isFinite(item.amount) && item.amount > 0
      && item.candidate_ids.length === new Set(item.candidate_ids).size
      && item.payer_foreign_agency_id === candidate.foreign_agency_id && item.payee_local_agency_id === candidate.local_agency_id
      && item.currency.trim().toUpperCase() === min.currency);
    const payment = settled[0] ?? own.find(item => item.status === 'succeeded') ?? own[own.length - 1];
    const base = { candidate, foreignAgencyId: candidate.foreign_agency_id, localAgencyId: candidate.local_agency_id, contractAt, country, currency: min.currency, expectedMin: min.amount, payment };
    const row = (issue: ReconIssue, message: string, received = 0, receivedUsd = 0): ReconRow => ({ ...base, issue, message, received, receivedUsd });

    if (!payment) {
      return rows.push(row('missing', 'No receipt recorded. Payment is the responsible foreign agency’s next step after sending the work contract.'));
    }
    const included = settled.includes(payment) ? settled : [payment];
    const received = included.reduce((sum, item) => sum + item.amount / Math.max(1, item.candidate_ids.length), 0);
    const receivedUsd = included.reduce((sum, item) => sum + (toUsd(item.amount, item.currency) ?? 0) / Math.max(1, item.candidate_ids.length), 0);
    if (payment.status === 'failed' || payment.status === 'timed-out' || payment.status === 'refunded') return rows.push(row('failed', `Payment is ${payment.status}.`));
    if (!Number.isFinite(payment.amount) || payment.amount <= 0 || payment.candidate_ids.length !== new Set(payment.candidate_ids).size) return rows.push(row('failed', 'Invalid payment amount or candidate allocation; correct the receipt before counting it.'));
    if (payment.status === 'pending') return rows.push(row('pending', 'Payment initiated but not yet settled.', received, receivedUsd));
    if (isEtb(payment.currency)) return rows.push(row('etb', 'Foreign agency payments cannot be made in ETB.', received, 0));
    if (min.currency !== payment.currency.toUpperCase()) return rows.push(row('wrong-currency', `Paid in ${payment.currency}; the contract currency is ${min.currency}.`, received, receivedUsd));
    if (payment.payee_local_agency_id !== candidate.local_agency_id) return rows.push(row('wrong-payee', 'Paid to a different local agency than the one managing the candidate.', received, receivedUsd));
    if (payment.payer_foreign_agency_id !== candidate.foreign_agency_id) return rows.push(row('wrong-payer', 'Paid by a different foreign agency than the one on the contract.', received, receivedUsd));
    if (received < min.amount) return rows.push(row('short', `Equals ${Math.round(receivedUsd)} USD against the ${MIN_PAYMENT_USD} USD minimum.`, received, receivedUsd));
    if (included.some(item => item.provider_reference && (referenceCount.get(item.provider_reference) ?? 0) > 1)) return rows.push(row('duplicate-reference', 'The bank reference appears on more than one payment.', received, receivedUsd));
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
