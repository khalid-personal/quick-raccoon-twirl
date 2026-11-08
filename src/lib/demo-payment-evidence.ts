import type { Candidate, Payment } from './types';
import type { BankStatement, PaymentStatementSource } from './bank-statement-store';

export const demoBankName = (source: PaymentStatementSource) =>
  source === 'foreign' ? 'Gulf Meridian Demo Bank' : 'Nile Horizon Demo Bank';

export function withDemoPaymentEvidence(payment: Payment, candidates: Candidate[]): Payment {
  if (!payment.candidate_ids.length || payment.candidate_ids.some(id => !candidates.some(candidate => candidate.id === id))) throw new Error('Every demo receipt must link to a recorded candidate identity.');
  const source = payment.payer_type === 'foreign-agency' || payment.payer_foreign_agency_id ? 'foreign' : 'candidate';
  return { ...payment, demo_evidence: {
    synthetic: true, bank_name: demoBankName(source),
    confirmation: { reference: payment.provider_reference || payment.receipt_number || payment.id, amount: payment.amount,
      currency: payment.currency, status: payment.status, confirmed_at: payment.updated_at },
    identities: payment.candidate_ids.map(id => {
      const candidate = candidates.find(candidate => candidate.id === id)!;
      return { candidate_id: id, name: `${candidate.first_name} ${candidate.last_name}`, tracking_code: candidate.tracking_code, passport_number: candidate.passport_number };
    }),
    disclaimer: 'DEMO ONLY. Not bank-authenticated or fraud-free certified.',
  } };
}

export function withDemoStatementOriginal(statement: BankStatement, accountName: string, source: PaymentStatementSource): BankStatement {
  if (!statement.synthetic) throw new Error('Original demo statement generation requires synthetic evidence.');
  const dates = statement.lines.map(line => line.date).sort();
  const totals = new Map<string, number>();
  statement.lines.forEach(line => totals.set(line.currency, (totals.get(line.currency) ?? 0) + line.amount));
  return { ...statement, name: `${demoBankName(source)} · DEMO / SYNTHETIC · ${accountName} statement`,
    demo_original: { synthetic: true, bank_name: demoBankName(source), account_name: accountName, period_start: dates[0] ?? '',
      period_end: dates.at(-1) ?? '', balances: [...totals].map(([currency, total]) => ({ currency, opening_balance: 0, total_credits: Math.round(total * 1000) / 1000, total_debits: 0, closing_balance: Math.round(total * 1000) / 1000 })), complete: true } };
}
