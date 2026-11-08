// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentLedgerSummary from '../PaymentLedgerSummary';
import StatCards from '../page/StatCards';
import { filterPaymentLedger, type PaymentStatusFilter } from '@/lib/payment-ledger';
import type { Payment } from '@/lib/types';
vi.mock('@/hooks/use-reduced-motion', () => ({ usePrefersReducedMotion: () => true }));

const payments = (['succeeded', 'pending', 'failed', 'refunded'] as const).map((status, index): Payment => ({
  id: String(index), status, amount: 3750, currency: 'SAR', payer_type: 'foreign-agency',
  payer_foreign_agency_id: 'foreign', payee_local_agency_id: 'local', candidate_ids: [],
  created_at: '2026-11-07', updated_at: '2026-11-07',
}));

function Ledger() {
  const [status, setStatus] = useState<PaymentStatusFilter>('all');
  return <><PaymentLedgerSummary payments={payments} status={status} onStatusChange={setStatus} />
    <ul data-testid="ledger">{filterPaymentLedger(payments, { status }).map(payment => <li key={payment.id}>{payment.status}</li>)}</ul></>;
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('interactive status summaries', () => {
  it('keeps empty local scopes in final ETB and warns about non-ETB records instead of converting them', async () => {
    await act(async () => root.render(<PaymentLedgerSummary payments={[]} source="candidate" status="all" onStatusChange={vi.fn()} />));
    expect(container.textContent).toContain('Local transfers · ETB final');
    expect(container.textContent).toContain('0.00 ETB');
    expect(container.textContent).not.toContain('USD estimate');
    await act(async () => root.render(<PaymentLedgerSummary payments={[{ ...payments[0], currency: 'USD', payer_type: 'candidate' }]} source="candidate" status="all" onStatusChange={vi.fn()} />));
    expect(container.textContent).toContain('0.00 ETB');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('review USD');
  });
  it('filters and restores ledger rows when each status tile is clicked', async () => {
    await act(async () => root.render(<Ledger />));
    for (const [label, status] of [['Settled', 'succeeded'], ['Pending', 'pending'], ['Failed', 'failed'], ['Refunded', 'refunded']]) {
      const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes(label))!;
      await act(async () => button.click());
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(container.querySelector('[data-testid="ledger"]')?.textContent).toBe(status);
      await act(async () => button.click());
      expect(container.querySelectorAll('[data-testid="ledger"] li')).toHaveLength(4);
    }
  });
  it('makes shared portal stat cards keyboard-focusable filter buttons when wired', async () => {
    function Cards() {
      const [pending, setPending] = useState(false);
      return <><StatCards items={[{ label: 'Pending approval', value: 1, active: pending, onClick: () => setPending(!pending) }]} /><p data-testid="filter">{pending ? 'pending' : 'all'}</p></>;
    }
    await act(async () => root.render(<Cards />));
    const button = container.querySelector('button')!;
    await act(async () => button.click());
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-testid="filter"]')?.textContent).toBe('pending');
  });
});
