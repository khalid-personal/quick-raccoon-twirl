import type { Candidate, Payment } from './types';

// Payments from a foreign agency are made in the currency of the country where the work contract originates.
// USD is only the regulated baseline; the amount is converted at these (mostly pegged) reference rates.
export const MIN_PAYMENT_USD = 900;

interface CountryCurrency { currency: string; perUsd: number }

const COUNTRY_CURRENCY: Record<string, CountryCurrency> = {
  'saudi arabia': { currency: 'SAR', perUsd: 3.75 },
  'united arab emirates': { currency: 'AED', perUsd: 3.6725 },
  qatar: { currency: 'QAR', perUsd: 3.64 },
  kuwait: { currency: 'KWD', perUsd: 0.307 },
  bahrain: { currency: 'BHD', perUsd: 0.376 },
  oman: { currency: 'OMR', perUsd: 0.3845 },
  jordan: { currency: 'JOD', perUsd: 0.709 },
  lebanon: { currency: 'USD', perUsd: 1 },
  egypt: { currency: 'EGP', perUsd: 48 },
};

const ALIASES: Record<string, string> = { ksa: 'saudi arabia', uae: 'united arab emirates', sa: 'saudi arabia', ae: 'united arab emirates', qa: 'qatar', kw: 'kuwait', bh: 'bahrain', om: 'oman', jo: 'jordan', lb: 'lebanon', eg: 'egypt' };

const lookup = (country?: string): CountryCurrency | null => {
  const key = (country ?? '').trim().toLowerCase();
  return COUNTRY_CURRENCY[ALIASES[key] ?? key] ?? null;
};

export const contractCountryOf = (c: Pick<Candidate, 'external_status'>): string | undefined => c.external_status?.destination_country;

export const currencyForCountry = (country?: string): string | null => lookup(country)?.currency ?? null;

export const isEtb = (currency?: string): boolean => ['ETB', 'BIRR'].includes((currency ?? '').trim().toUpperCase());

export const isForeignPayment = (payment: Payment): boolean =>
  payment.payer_type === 'foreign-agency' || (!payment.payer_type && !!payment.payer_foreign_agency_id);

const round = (n: number, currency: string) => (currency === 'KWD' || currency === 'BHD' || currency === 'OMR' || currency === 'JOD' ? Math.round(n * 1000) / 1000 : Math.round(n * 100) / 100);

export const minimumPerCandidate = (country?: string): { amount: number; currency: string } | null => {
  const info = lookup(country);
  return info ? { amount: round(MIN_PAYMENT_USD * info.perUsd, info.currency), currency: info.currency } : null;
};

export const toUsd = (amount: number, currency: string): number | null => {
  if (currency.toUpperCase() === 'USD') return amount;
  const info = Object.values(COUNTRY_CURRENCY).find(v => v.currency === currency.toUpperCase());
  return info ? amount / info.perUsd : null;
};

export type ForeignPaymentIssue = 'etb' | 'wrong-currency' | 'below-minimum';

// Checks a foreign-to-local payment against the contract country of its candidates.
export const checkForeignPayment = (p: Pick<Payment, 'amount' | 'currency' | 'candidate_ids'>, candidates: Candidate[]): { issue: ForeignPaymentIssue; message: string } | null => {
  if (isEtb(p.currency)) return { issue: 'etb', message: 'Foreign agency payments cannot be made in ETB; they must be in the contract country currency.' };
  const covered = candidates.filter(c => p.candidate_ids.includes(c.id));
  const currencies = new Set(covered.map(c => currencyForCountry(contractCountryOf(c))).filter(Boolean));
  if (currencies.size > 0 && !currencies.has(p.currency.toUpperCase())) {
    return { issue: 'wrong-currency', message: `Paid in ${p.currency} but the work contract currency is ${[...currencies].join('/')}.` };
  }
  const usd = toUsd(p.amount, p.currency);
  if (usd !== null && p.candidate_ids.length > 0 && usd / p.candidate_ids.length < MIN_PAYMENT_USD - 0.01) {
    return { issue: 'below-minimum', message: `Equals ${Math.round(usd / p.candidate_ids.length)} USD per candidate, below the ${MIN_PAYMENT_USD} USD minimum.` };
  }
  return null;
};
