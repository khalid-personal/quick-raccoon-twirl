// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentEvidenceDocuments from '../PaymentEvidenceDocuments';
import { reconcile } from '@/lib/bank-reconciliation';
import type { Payment } from '@/lib/types';
import { saveCandidates } from '@/lib/data-store';
import { generateDemoDataset } from '@/lib/demo-dataset';

const payment: Payment = { id: 'p1', amount: 100, currency: 'ETB', provider_reference: 'REF', status: 'succeeded',
  payer_foreign_agency_id: 'foreign', payee_local_agency_id: 'local', candidate_ids: ['c1'], created_at: '2026-11-07', updated_at: '2026-11-07' };
const statement = { name: 'Imported statement', synthetic: true,
  lines: [{ amount: 100, currency: 'ETB', reference: 'OTHER', date: '2026-11-07', description: 'Actual description' }] };
const match = reconcile([payment], statement.lines).matches[0];
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  saveCandidates([{ ...generateDemoDataset(Date.parse('2026-11-07')).candidates[0], id: 'c1', first_name: 'Chala', last_name: 'Hailu', tracking_code: 'TRK-C1', passport_number: 'EP123' }]);
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
describe('unified inline paired evidence', () => {
  it('expands clean transaction cards without raw metadata or unrelated statement entries', async () => {
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
    expect(inline.textContent).not.toContain('Actual description');
    expect(inline.textContent).not.toContain('Candidate ids');
    expect(inline.querySelectorAll('dt')).toHaveLength(6);
    expect([...inline.querySelectorAll('dt')].map(field => field.textContent)).toEqual(['Transaction ID', 'Amount', 'Currency', 'Transaction ID', 'Amount', 'Currency']);
    expect(container.textContent).toContain('Transaction ID: Mismatch');
    const identity = container.querySelector('[aria-label="Candidate linked to this transaction"]')!;
    expect(identity.textContent).toContain('Chala Hailu');
    expect(identity.textContent).toContain('TRK-C1 · Passport EP123');
    expect(identity.textContent).toContain('Practice evidence');
    expect(container.querySelector('details')?.open).toBe(false);
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
    expect(container.textContent).toContain('Transaction ID: Mismatch');
  });
  it('uses the existing candidate profile rather than stale confirmation identities and keeps amounts truthful', async () => {
    const receipt = { ...payment, amount: 276.3, currency: 'KWD', demo_evidence: { synthetic: true as const, bank_name: 'Practice bank',
      confirmation: { reference: 'REF', amount: 276.3, currency: 'KWD', status: 'succeeded' as const, confirmed_at: '2026-11-07' },
      identities: [{ candidate_id: 'c1', name: 'Old Name', tracking_code: 'OLD-TRACK', passport_number: 'OLD-PASSPORT' }], disclaimer: 'Practice only' } };
    const bank = { ...statement, covered_candidate_ids: ['c1', 'unrelated'], lines: [
      { ...statement.lines[0], reference: 'REF', amount: 221.04, currency: 'KWD' },
      { ...statement.lines[0], reference: 'UNRELATED', amount: 999, currency: 'USD' },
    ] };
    await act(async () => root.render(<PaymentEvidenceDocuments payment={receipt} statement={bank} match={reconcile([receipt], bank.lines).matches[0]} />));
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'View comparison')!.click());
    expect(container.textContent).toContain('Chala Hailu');
    expect(container.textContent).not.toContain('Old Name');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('differs from the current candidate profile');
    const cards = container.querySelectorAll('article');
    expect(cards[0].textContent).toContain('276.30');
    expect(cards[1].textContent).toContain('221.04');
    expect(cards[1].textContent).not.toContain('UNRELATED');
    expect(container.querySelector('[aria-label="Evidence comparison checks"]')?.textContent).toContain('Amount: Mismatch');
    expect(container.querySelector('[aria-label="Evidence comparison checks"]')?.textContent).toContain('Transaction ID: Match');
    expect([...cards].some(card => card.textContent?.includes('Covered candidate ids') || card.textContent?.includes('Synthetictrue'))).toBe(false);
  });
  it('does not invent bank values or candidate identity when evidence is missing', async () => {
    await act(async () => root.render(<PaymentEvidenceDocuments payment={{ ...payment, candidate_ids: ['missing'] }} statement={null} />));
    expect(container.textContent).toContain('no longer available');
    expect(container.textContent).toContain('Transaction ID: Missing proof');
    expect(container.textContent).toContain('Bank: Not recorded');
    expect(container.textContent).not.toContain('Chala Hailu');
  });
  it('explains a reference found in the bank description without inventing a bank transaction ID', async () => {
    const bank = { ...statement, lines: [{ ...statement.lines[0], reference: '', description: 'Credit REF' }] };
    await act(async () => root.render(<PaymentEvidenceDocuments payment={{ ...payment, candidate_ids: ['c1', 'missing'] }} statement={bank} match={reconcile([payment], bank.lines).matches[0]} />));
    expect(container.textContent).toContain('Transaction ID: Match');
    expect(container.textContent).toContain('Reference found in bank description');
    expect(container.textContent).toContain('Candidates covered by this transfer');
    expect(container.textContent).toContain('Chala Hailu');
    expect(container.textContent).toContain('no longer available');
  });
});
