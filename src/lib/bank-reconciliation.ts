import type { Payment } from './types';
import { isForeignPayment } from './currency';

export const paymentReferences = (payment: Payment): string[] =>
  [payment.provider_reference, payment.receipt_number, payment.chechepay_receipt?.processor_reference, payment.chechepay_receipt?.transaction_reference]
    .filter((reference): reference is string => typeof reference === 'string' && !!reference.trim());

export function paymentsWithReusedReferences(payments: Payment[]): Set<string> {
  const owners = new Map<string, Set<string>>();
  for (const payment of payments.filter(payment => payment.status === 'succeeded')) {
    for (const reference of paymentReferences(payment)) {
      const key = `${payment.payee_local_agency_id}:${isForeignPayment(payment) ? 'foreign' : 'candidate'}:${reference.trim().toLowerCase()}`;
      owners.set(key, new Set([...(owners.get(key) ?? []), payment.id]));
    }
  }
  return new Set([...owners.values()].filter(ids => ids.size > 1).flatMap(ids => [...ids]));
}

export interface BankLine {
  date: string;
  description: string;
  reference: string;
  amount: number;
  currency: string;
}

export type MatchStatus = 'matched' | 'short' | 'over' | 'missing' | 'reference-mismatch' | 'currency-mismatch';

export interface PaymentMatch {
  payment: Payment;
  status: MatchStatus;
  line?: BankLine;
  difference: number;
  matchBasis: 'reference' | 'amount-date' | 'none';
  currencyMismatch: boolean;
  explanation: string;
  matchedReference?: string;
}

export interface Reconciliation {
  matches: PaymentMatch[];
  unrecognized: BankLine[];
}

export interface ReconciliationSummary {
  byPaymentId: Record<string, MatchStatus>;
  matched: number;
  short: number;
  over: number;
  missing: number;
  'reference-mismatch': number;
  'currency-mismatch': number;
  unrecognizedDeposits: number;
}

const splitCsv = (row: string): string[] => {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of row) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { cells.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
};

const number = (v: string): number => Number(v.replace(/[^0-9.-]/g, ''));

// Reads a bank statement export. Needs a header row with date, an amount (or credit) column and optionally
// description, reference and currency columns. Debits and zero rows are ignored; only credits count as deposits.
export const parseStatementCsv = (text: string, defaultCurrency = ''): BankLine[] => {
  const rows = text.split(/\r?\n/).filter(r => r.trim());
  if (rows.length < 2) throw new Error('The statement has no rows.');
  const header = splitCsv(rows[0]).map(h => h.toLowerCase());
  const find = (...names: string[]) => header.findIndex(h => names.some(n => h.includes(n)));
  const dateI = find('date');
  const amountI = find('credit', 'deposit', 'amount');
  if (dateI < 0 || amountI < 0) throw new Error('The statement needs a date column and an amount or credit column.');
  const descI = find('description', 'narrative', 'details', 'particular');
  const refI = find('reference', 'ref');
  const curI = find('currency', 'ccy');
  const lines: BankLine[] = [];
  for (const row of rows.slice(1)) {
    const cells = splitCsv(row);
    const amount = number(cells[amountI] ?? '');
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const date = new Date(cells[dateI] ?? '');
    lines.push({
      date: Number.isNaN(date.getTime()) ? (cells[dateI] ?? '') : date.toISOString().slice(0, 10),
      description: descI >= 0 ? cells[descI] ?? '' : '',
      reference: refI >= 0 ? cells[refI] ?? '' : '',
      amount,
      currency: (curI >= 0 ? cells[curI] : defaultCurrency).toUpperCase(),
    });
  }
  if (!lines.length) throw new Error('No deposits were found in the statement.');
  return lines;
};

const DAY = 86_400_000;
const TOLERANCE = 0.005;

// Matches each received payment to a deposit by its transfer reference, falling back to the same currency and
// amount within a week. A reference match with a different amount is flagged as short or over.
export const reconcile = (payments: Payment[], lines: BankLine[]): Reconciliation => {
  const used = new Set<number>();
  const matches: PaymentMatch[] = [];
  const ordered = [...payments].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const knownReferences = new Set(payments.flatMap(paymentReferences).map(reference => reference.trim().toLowerCase()));
  const referencedLines = new Set(lines.flatMap((line, index) => (line.reference.trim()
    ? knownReferences.has(line.reference.trim().toLowerCase())
    : line.description.toLowerCase().split(/\s+/).some(word => knownReferences.has(word))) ? [index] : []));

  for (const payment of ordered) {
    const references = paymentReferences(payment);
    const normalizedReferences = references.map(reference => reference.trim().toLowerCase());
    let idx = normalizedReferences.length ? lines.findIndex((line, index) => !used.has(index) && (line.reference.trim() ? normalizedReferences.includes(line.reference.trim().toLowerCase()) : normalizedReferences.some(reference => line.description.toLowerCase().split(/\s+/).includes(reference)))) : -1;
    let matchBasis: PaymentMatch['matchBasis'] = idx >= 0 ? 'reference' : 'none';
    if (idx < 0) {
      const at = new Date(payment.created_at).getTime();
      idx = lines.findIndex((l, i) => !used.has(i) && !referencedLines.has(i) && l.currency.toUpperCase() === payment.currency.toUpperCase()
        && Math.abs(l.amount - payment.amount) <= payment.amount * TOLERANCE && Math.abs(new Date(l.date).getTime() - at) <= 7 * DAY);
      if (idx >= 0) matchBasis = 'amount-date';
    }
    if (idx < 0) {
      matches.push({ payment, status: 'missing', difference: -payment.amount, matchBasis, currencyMismatch: false, explanation: 'No unused deposit matches the transfer reference or the same currency and amount within seven days. This is an evidence gap, not proof that funds were never deposited.' });
      continue;
    }
    used.add(idx);
    const line = lines[idx];
    const matchedReference = matchBasis === 'reference' ? references.find(reference => line.reference.trim() ? reference.trim().toLowerCase() === line.reference.trim().toLowerCase() : line.description.toLowerCase().split(/\s+/).includes(reference.trim().toLowerCase())) : undefined;
    const sameCurrency = !!line.currency && line.currency.toUpperCase() === payment.currency.toUpperCase();
    const difference = Math.round((line.amount - payment.amount) * 100) / 100;
    const status: MatchStatus = !sameCurrency ? 'currency-mismatch' : difference < 0 ? 'short' : difference > 0 ? 'over' : matchBasis !== 'reference' ? 'reference-mismatch' : 'matched';
    const explanation = !sameCurrency
      ? `The deposit currency (${line.currency || 'not supplied'}) does not confirm the recorded currency (${payment.currency}). A numeric variance is not comparable across currencies; obtain bank currency or conversion evidence.`
      : status === 'matched'
        ? 'Deposit linked by transfer reference. Recorded amount and currency match the imported credit exactly to currency precision.'
        : status === 'reference-mismatch'
          ? 'Amount and date suggest this deposit, but the receipt transfer reference is absent or different from the statement reference. This is a proposed association, not a verified match.'
          : `Deposit linked by ${matchBasis === 'reference' ? 'transfer reference' : 'amount/date proximity (reference not confirmed)'}. The bank credit is ${Math.abs(difference).toLocaleString()} ${payment.currency} ${difference < 0 ? 'below' : 'above'} the recorded receipt amount. Fees, split deposits, or recording errors require supporting evidence; no cause is confirmed.`;
    matches.push({ payment, status, line, difference, matchBasis, currencyMismatch: !sameCurrency, explanation, matchedReference });
  }
  return { matches, unrecognized: lines.filter((_, i) => !used.has(i)) };
};

export const summarizeReconciliation = (result: Reconciliation): ReconciliationSummary => {
  const counts = { matched: 0, short: 0, over: 0, missing: 0, 'reference-mismatch': 0, 'currency-mismatch': 0 };
  const byPaymentId: Record<string, MatchStatus> = {};
  result.matches.forEach(match => {
    counts[match.status] += 1;
    byPaymentId[match.payment.id] = match.status;
  });
  return { ...counts, byPaymentId, unrecognizedDeposits: result.unrecognized.length };
};
