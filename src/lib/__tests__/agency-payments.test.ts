import { describe, expect, it } from 'vitest';
import { generateDemoDataset } from '../demo-dataset';
import { analyzeAgencyPayments } from '../agency-payments';
import { minimumPerCandidate } from '../currency';
import { buildWhatsAppUrl, getExpiringContracts, whatsappDigits } from '../contract-expiry';
import type { Payment } from '../types';

const NOW = new Date('2026-07-19T12:00:00Z').getTime();
const data = generateDemoDataset(NOW, 'priority');

describe('foreign to local agency payment reconciliation', () => {
  const summary = analyzeAgencyPayments(data.candidates, data.payments, data.stages, NOW);

  it('matches most contracts and surfaces missing, pending and overpaid transfers', () => {
    expect(summary.contracts).toBeGreaterThan(200);
    expect(summary.byIssue.paid).toBeGreaterThan(summary.contracts / 2);
    expect(summary.byIssue.missing).toBeGreaterThan(0);
    expect(summary.byIssue.pending).toBeGreaterThan(0);
    expect(summary.byIssue.over).toBeGreaterThan(0);
    expect(summary.flagged).toBeGreaterThan(0);
    expect(summary.pairs.every(pair => pair.matched + pair.awaiting + pair.flagged === pair.contracts)).toBe(true);
  });

  it('flags short and wrong-currency transfers in the needs-attention scenario and can scope to one local agency', () => {
    const attention = generateDemoDataset(NOW, 'needs-attention');
    const result = analyzeAgencyPayments(attention.candidates, attention.payments, attention.stages, NOW);
    expect(result.byIssue.short + result.byIssue['wrong-currency']).toBeGreaterThan(0);
    const local = attention.localAgencies[0].id;
    const scoped = analyzeAgencyPayments(attention.candidates, attention.payments, attention.stages, NOW, local);
    expect(scoped.rows.length).toBeLessThan(result.rows.length);
    expect(scoped.rows.every(row => row.localAgencyId === local)).toBe(true);
  });

  it('flags payments even slightly below the contract-currency minimum', () => {
    const candidate = data.candidates.find(item =>
      item.external_status?.destination_country === 'Saudi Arabia'
      && item.external_status.work_contract
      && item.foreign_agency_id
      && item.local_agency_id,
    );
    if (!candidate) throw new Error('Expected a Saudi work-contract candidate in the demo dataset.');
    const minimum = minimumPerCandidate('Saudi Arabia');
    if (!minimum) throw new Error('Expected a payment minimum for Saudi Arabia.');
    const payment = data.payments.find(item =>
      item.candidate_ids.includes(candidate.id)
      && item.status === 'succeeded'
      && item.currency === minimum.currency,
    );
    if (!payment) throw new Error('Expected a succeeded Saudi-currency payment for the candidate.');

    const result = analyzeAgencyPayments(
      [candidate],
      [{ ...payment, amount: minimum.amount - 1, candidate_ids: [candidate.id] }],
      data.stages,
      NOW,
    );
    expect(result.rows[0]).toMatchObject({ issue: 'short', received: minimum.amount - 1, expectedMin: minimum.amount });
  });
  it('counts valid split receipts even when an unrelated wrong-payer receipt appears first', () => {
    const candidate = { ...data.candidates[0], foreign_agency_id: 'foreign', local_agency_id: 'local', work_contract_record: undefined,
      external_status: { work_contract: true, destination_country: 'Saudi Arabia' } };
    const minimum = minimumPerCandidate('Saudi Arabia')!;
    const payment: Payment = { id: 'p', payer_type: 'foreign-agency', payer_foreign_agency_id: 'foreign', payee_local_agency_id: 'local',
      candidate_ids: [candidate.id], amount: minimum.amount / 2, currency: minimum.currency, status: 'succeeded', created_at: '2026-07-19', updated_at: '2026-07-19' };
    const receipts = [{ ...payment, id: 'wrong', payer_foreign_agency_id: 'other' }, payment, { ...payment, id: 'p2' }];
    expect(analyzeAgencyPayments([candidate], receipts, [], NOW).rows[0]).toMatchObject({ issue: 'paid', received: minimum.amount, payment: { id: 'p' } });
    expect(analyzeAgencyPayments([candidate], [{ ...payment, status: 'timed-out' }], [], NOW).rows[0]).toMatchObject({ issue: 'failed', received: 0 });
    expect(analyzeAgencyPayments([candidate], [{ ...payment, candidate_ids: [candidate.id, candidate.id] }], [], NOW).rows[0].issue).toBe('failed');
  });
});

describe('contract expiry and WhatsApp reminders', () => {
  it('lists working candidates whose contracts end within six months, soonest first', () => {
    const expiring = getExpiringContracts(data.candidates, NOW);
    expect(expiring.length).toBeGreaterThan(5);
    expiring.forEach(item => {
      expect(item.daysLeft).toBeGreaterThanOrEqual(0);
      expect(item.monthsLeft).toBeLessThanOrEqual(6.1);
      expect(item.candidate.arrival).toBeDefined();
    });
    expect(expiring.map(item => item.daysLeft)).toEqual([...expiring.map(item => item.daysLeft)].sort((a, b) => a - b));
  });

  it('builds a wa.me link only for plausible numbers', () => {
    expect(whatsappDigits('+251 91 234 5678')).toBe('251912345678');
    expect(whatsappDigits('0912345678')).toBe('251912345678');
    expect(whatsappDigits('12')).toBeNull();
    expect(buildWhatsAppUrl('+966 50 123 4567', 'Hi there')).toBe('https://wa.me/966501234567?text=Hi%20there');
    expect(buildWhatsAppUrl('abc', 'x')).toBeNull();
  });
});

describe('diversified portfolio', () => {
  it('has many occupations and working candidates with varied tenure', () => {
    expect(new Set(data.candidates.map(candidate => candidate.occupation)).size).toBeGreaterThanOrEqual(8);
    const working = data.candidates.filter(candidate => candidate.arrival && candidate.return_status !== 'returned');
    expect(working.length).toBeGreaterThan(60);
    const tenures = working.map(candidate => Math.floor((NOW - Date.parse(candidate.arrival!.arrived_at)) / 86_400_000 / 90));
    expect(new Set(tenures).size).toBeGreaterThanOrEqual(4);
  });
});
