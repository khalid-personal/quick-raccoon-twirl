import { describe, expect, it } from 'vitest';
import { filterPaymentLedger, summarizeLocalTransfers, summarizePaymentReceipts } from '../payment-ledger';
import type { Payment } from '../types';

const payment = (id: string, status: Payment['status'], currency = 'SAR', amount = 3750): Payment => ({
  id, status, currency, amount, payer_type: 'foreign-agency', payer_foreign_agency_id: 'foreign-1',
  payee_local_agency_id: 'local-1', candidate_ids: ['candidate-1'], created_at: '2026-11-07T10:00:00Z',
  updated_at: '2026-11-07T10:00:00Z', provider_reference: `reference-${id}`,
});

describe('payment ledger filtering and currency summary', () => {
  it('sums final local ETB records without converting foreign or non-ETB candidate receipts', () => {
    const candidate = { ...payment('local', 'succeeded', ' etb ', 300.25), payer_type: 'candidate' as const };
    const summary = summarizeLocalTransfers([candidate, { ...candidate, id: 'second', amount: 100.5 }, { ...candidate, id: 'pending', status: 'pending' }, { ...candidate, id: 'failed', status: 'failed' }, { ...candidate, id: 'refund', status: 'refunded' }, payment('foreign', 'succeeded', 'ETB', 9000), { ...candidate, id: 'usd', currency: 'USD', amount: 100 }]);
    expect(summary).toEqual({ amount: 400.75, count: 2, otherCurrencies: ['USD'] });
    expect(summarizeLocalTransfers([])).toEqual({ amount: 0, count: 0, otherCurrencies: [] });
  });
  const payments = [payment('paid', 'succeeded'), payment('pending', 'pending'), payment('failed', 'failed'), payment('refund', 'refunded')];
  it.each(['succeeded', 'pending', 'failed', 'refunded'] as const)('filters %s rather than only updating the selected tile', status => {
    expect(filterPaymentLedger(payments, { status })).toEqual(payments.filter(item => item.status === status));
  });
  it('combines status, date and reference filters and restores all rows', () => {
    expect(filterPaymentLedger(payments, { status: 'succeeded', search: 'REFERENCE-PAID', from: '2026-11-07', to: '2026-11-07' })).toHaveLength(1);
    expect(filterPaymentLedger(payments, { from: '2026-11-08' })).toHaveLength(0);
    expect(filterPaymentLedger(payments, { status: 'all' })).toHaveLength(4);
  });
  it('adds foreign currencies in USD once and excludes unsettled or refunded payments and candidate fees', () => {
    const summary = summarizePaymentReceipts([
      ...payments, payment('usd', 'succeeded', 'USD', 900), payment('aed', 'succeeded', 'AED', 3672.5),
      { ...payment('candidate', 'succeeded', 'ETB', 500), payer_type: 'candidate' },
    ]);
    expect(summary.foreignUsd).toBeCloseTo(2900, 6);
    expect(summary.convertedCount).toBe(3);
    expect(summary.originalTotals).toEqual({ SAR: 3750, USD: 900, AED: 3672.5, ETB: 500 });
    expect(summary.rates.SAR).toBeCloseTo(1 / 3.75);
  });
  it('reports unsupported foreign currencies instead of treating them as USD or zero-value receipts', () => {
    const summary = summarizePaymentReceipts([payment('unknown', 'succeeded', 'XYZ', 900)]);
    expect(summary.convertedCount).toBe(0);
    expect(summary.excludedForeignTotals).toEqual({ XYZ: 900 });
  });
});
