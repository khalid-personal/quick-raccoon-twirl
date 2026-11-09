// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const source = vi.hoisted(() => ({ verified: new Set<string>(), payments: [
  { id: 'a-receipt', status: 'succeeded', candidate_ids: ['a'], payee_local_agency_id: 'local-a' },
  { id: 'b-receipt', status: 'succeeded', candidate_ids: ['b'], payee_local_agency_id: 'local-b' },
] }));
vi.mock('@/hooks/use-portal-data', () => ({ usePortalData: () => ({
  candidates: [{ id: 'a', local_agency_id: 'local-a', created_at: new Date().toISOString() }, { id: 'b', local_agency_id: 'local-b', created_at: new Date().toISOString() }],
  stages: [], payments: source.payments,
}) }));
vi.mock('@/lib/payment-review-clearance', () => ({ verifiedPaymentIds: () => source.verified }));
import RecentOperations from '../RecentOperations';
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); source.verified.clear();
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = () => act(async () => root.render(<MemoryRouter><RecentOperations localAgencyId="local-a" paymentPath="/admin/payments" activity={[
  { id: 'registration', timestamp: '2026-11-08', actor: 'staff', description: 'Candidate registered', action: 'Created' },
  { id: 'upload', timestamp: '2026-11-08', actor: 'staff', description: 'Passport document uploaded', action: 'Created' },
]} /></MemoryRouter>));
it('keeps current insight totals agency-scoped and does not equate no issues with verified payment', async () => {
  await render();
  const insights = container.querySelector('[aria-label="Current operational insights"]')!;
  expect(insights.textContent).toContain('0 / 1');
  expect(insights.textContent).not.toContain('All received receipts checked');
  source.verified.add('a-receipt');
  await act(async () => window.dispatchEvent(new Event('bank-statement-changed')));
  expect(insights.textContent).toContain('All received receipts checked');
  expect(insights.textContent).toContain('1 / 1');
});
it('filters real document actions without fabricating successful payment activity', async () => {
  await render();
  const documents = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.startsWith('Documents'))!;
  await act(async () => documents.click());
  expect(documents.getAttribute('aria-pressed')).toBe('true');
  expect(container.textContent).toContain('Passport document uploaded');
  expect(container.textContent).not.toContain('Candidate registered');
  await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent?.startsWith('Payments'))!.click());
  expect(container.textContent).toContain('No recorded activity for this topic');
});
