import { isForeignPayment, toUsd } from './currency';
import type { Payment } from './types';

export const PAYMENT_STATUS_LABELS: Record<Payment['status'], string> = {
  succeeded: 'Settled', pending: 'Pending', failed: 'Failed', refunded: 'Refunded',
};
export type PaymentStatusFilter = Payment['status'] | 'all';

export const summarizeLocalTransfers = (payments: Payment[]) => {
  const settled = payments.filter(payment => !isForeignPayment(payment) && payment.status === 'succeeded');
  const etb = settled.filter(payment => payment.currency.trim().toUpperCase() === 'ETB');
  const otherCurrencies = [...new Set(settled.filter(payment => payment.currency.trim().toUpperCase() !== 'ETB').map(payment => payment.currency.trim().toUpperCase()))];
  return { amount: etb.reduce((total, payment) => total + payment.amount, 0), count: etb.length, otherCurrencies };
};

export const filterPaymentLedger = (payments: Payment[], filters: { status?: PaymentStatusFilter; search?: string; from?: string; to?: string }): Payment[] => {
  const query = filters.search?.trim().toLowerCase() ?? '';
  return payments.filter(payment =>
    (!filters.status || filters.status === 'all' || payment.status === filters.status) &&
    (!filters.from || payment.created_at.slice(0, 10) >= filters.from) &&
    (!filters.to || payment.created_at.slice(0, 10) <= filters.to) &&
    [payment.provider_reference, payment.receipt_number, payment.payer_display_name, payment.payer_foreign_agency_id,
      payment.payer_candidate_id, payment.payee_local_agency_id, payment.id, payment.amount, payment.currency, payment.status]
      .join(' ').toLowerCase().includes(query),
  );
};

export const summarizePaymentReceipts = (payments: Payment[]) => {
  const originalTotals: Record<string, number> = {};
  const excludedForeignTotals: Record<string, number> = {};
  const rates: Record<string, number> = {};
  let foreignUsd = 0;
  let convertedCount = 0;
  for (const payment of payments) {
    if (payment.status !== 'succeeded') continue;
    const currency = payment.currency.trim().toUpperCase();
    originalTotals[currency] = (originalTotals[currency] ?? 0) + payment.amount;
    if (!isForeignPayment(payment)) continue;
    const usd = toUsd(payment.amount, currency);
    if (usd === null) {
      excludedForeignTotals[currency] = (excludedForeignTotals[currency] ?? 0) + payment.amount;
    } else {
      foreignUsd += usd;
      convertedCount += 1;
      const rate = toUsd(1, currency);
      if (rate !== null) rates[currency] = rate;
    }
  }
  return { foreignUsd, convertedCount, originalTotals, excludedForeignTotals, rates };
};
