// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentEvidenceDocuments from '../PaymentEvidenceDocuments';
import { reconcile } from '@/lib/bank-reconciliation';
import type { Payment } from '@/lib/types';

const payment: Payment = { id: 'p1', amount: 100, currency: 'ETB', provider_reference: 'REF', status: 'succeeded',
  payer_foreign_agency_id: 'foreign', payee_local_agency_id: 'local', candidate_ids: ['c1'], created_at: '2026-11-07', updated_at: '2026-11-07' };
const statement = { name: 'Imported statement', synthetic: true,
  lines: [{ amount: 100, currency: 'ETB', reference: 'OTHER', date: '2026-11-07', description: 'Actual description' }] };
const match = reconcile([payment], statement.lines).matches[0];
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
describe('unified inline paired evidence', () => {
  it('expands both full records using one action without any receipt popup, with unique accessible IDs', async () => {
    const popup = vi.spyOn(window, 'open'), onReceipt = vi.fn();
    await act(async () => root.render(<><PaymentEvidenceDocuments payment={payment} statement={statement} match={match} onReceipt={onReceipt} /><PaymentEvidenceDocuments payment={payment} statement={statement} match={match} /></>));
    const buttons = [...container.querySelectorAll('button')].filter(button => button.textContent === 'View comparison');
    const ids = buttons.map(button => button.getAttribute('aria-controls'));
    expect(new Set(ids).size).toBe(2);
    expect(container.querySelectorAll('[hidden]')).toHaveLength(2);
    await act(async () => buttons[0].click());
    expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('[hidden]')).toHaveLength(1);
    const inline = document.getElementById(ids[0]!)!;
    expect(inline.querySelectorAll('article')).toHaveLength(2);
    expect(inline.textContent).toContain('Actual description');
    expect(inline.textContent).toContain('Candidate ids');
    expect(inline.textContent).toContain('DEMO / synthetic evidence');
    expect(container.textContent).toContain('Reference: Mismatch');
    expect(onReceipt).not.toHaveBeenCalled();
    expect(popup).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
  it('shows an explicit error if browser-local download fails', async () => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => { throw new Error('Download blocked'); });
    await act(async () => root.render(<PaymentEvidenceDocuments payment={payment} statement={statement} match={match} />));
    await act(async () => {
      [...container.querySelectorAll('button')].find(button => button.textContent === 'Download comparison PDF')!.click();
      await new Promise(resolve => setTimeout(resolve, 200));
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not download the comparison PDF');
    expect(container.textContent).toContain('Reference: Mismatch');
  });
});
