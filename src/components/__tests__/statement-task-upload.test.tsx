// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BankReconciliation } from '@/components/BankReconciliation';
import { recordReconciliationEvent } from '@/lib/bank-statement-store';

vi.mock('@/lib/payment-review-clearance', () => ({ currentVerifiedPaymentIds: () => new Set<string>() }));
vi.mock('@/components/DocumentScanInput', () => ({ default: ({ id }: { id: string }) => <input type="file" id={id} /> }));
vi.mock('@/components/PaymentEvidenceReview', () => ({ default: ({ allowActions }: { allowActions: boolean }) => <div data-review-actions={String(allowActions)} /> }));
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  localStorage.clear(); sessionStorage.clear();
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });
const request = (owner = 'STAFF@A.TEST', submissionStart = '2026-11-06') => recordReconciliationEvent('a', {
  caseId: 'payment-1', action: 'request-evidence', note: 'Upload the original statement', actor: 'reviewer', owner,
  dueDate: '2026-11-10', submissionStart, source: 'foreign', evidence: { statementName: 'Bank file', explanation: 'Original required' },
});
const render = async (agencyId = 'a', allowActions = false) => act(async () => root.render(
  <MemoryRouter initialEntries={['/admin/payments?case=payment-1']}><BankReconciliation agencyId={agencyId} payments={[]} allowActions={allowActions}
    statementUploader={{ id: 'staff-a', email: 'staff@a.test' }} /></MemoryRouter>,
));
it('lets an assigned staff member submit a statement without granting reviewer actions and withdraws upload after resolution', async () => {
  request();
  await render();
  expect(container.querySelector('input[type="file"]')).not.toBeNull();
  expect(container.querySelector('[data-review-actions]')?.getAttribute('data-review-actions')).toBe('false');
  await act(async () => { recordReconciliationEvent('a', { caseId: 'payment-1', action: 'resolve', note: 'Reviewed and resolved', actor: 'reviewer', owner: '', dueDate: '', evidence: { statementName: 'Bank file', explanation: 'Resolved' } }); });
  expect(container.querySelector('input[type="file"]')).toBeNull();
});
it('does not grant uploads for other owners, another agency or a future submission window', async () => {
  request('other-staff');
  await render();
  expect(container.querySelector('input[type="file"]')).toBeNull();
  await act(async () => { request('staff-a', '2026-11-09'); });
  expect(container.querySelector('input[type="file"]')).toBeNull();
  await act(async () => { vi.setSystemTime(new Date('2026-11-09T00:00:00Z')); window.dispatchEvent(new Event('bank-statement-changed')); });
  expect(container.querySelector('input[type="file"]')).not.toBeNull();
  await render('b');
  expect(container.querySelector('input[type="file"]')).toBeNull();
});
it('preserves the existing reviewer statement uploader without a staff request', async () => {
  await render('a', true);
  expect(container.querySelector('input[type="file"]')).not.toBeNull();
});
