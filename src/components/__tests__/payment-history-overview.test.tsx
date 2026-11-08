// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentHistoryPage from '@/pages/PaymentHistoryPage';
import { PageMemoryProvider } from '@/hooks/use-page-memory';
import { saveCandidates, saveLocalAgencies, savePayments } from '@/lib/data-store';
import type { Payment } from '@/lib/types';
const mocks = vi.hoisted(() => ({
  auth: { userRole: 'superadmin', user: { id: 'admin' }, isDemo: true, viewAs: null, userLocalAgencyId: null, userForeignAgencyId: 'foreign', userLocalAgencyName: '', userForeignAgencyName: 'Foreign partner' },
  all: vi.fn(), foreign: vi.fn(), local: vi.fn(),
}));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/api', () => ({ default: { getAllPayments: mocks.all, getPaymentsByForeignAgency: mocks.foreign, getPaymentsByLocalAgency: mocks.local, getLocalAgencyList: async () => [{ id: 'local', name: 'Local partner', created_at: '2026-11-07' }] } }));
vi.mock('../AgencyPaymentReconciliation', () => ({ default: () => <p>Contract payment checks</p> }));
vi.mock('../BankReconciliation', () => ({ BankReconciliation: ({ agencyId, paymentSource, payments }: { agencyId: string; paymentSource: string; payments: Payment[] }) => <p>Bank comparison {agencyId} {paymentSource} {payments.map(payment => payment.id).join(',')}</p> }));
vi.mock('../AgencyResolutionCenter', () => ({ default: () => <p>Resolution inbox</p> }));
vi.mock('../PaymentEvidenceReview', () => ({ default: ({ evidence }: { evidence: { payment?: Payment } | null }) => evidence ? <p>Inspect {evidence.payment?.id}</p> : null }));
const base: Payment = { id: 'settled-foreign', amount: 100, currency: 'USD', status: 'succeeded', payer_type: 'foreign-agency', payer_foreign_agency_id: 'foreign', payee_local_agency_id: 'local', candidate_ids: [], created_at: '2026-11-05', updated_at: '2026-11-05' };
const payments: Payment[] = [base, { ...base, id: 'waiting', status: 'pending', amount: 50 }, { ...base, id: 'candidate-fee', payer_type: 'candidate', currency: 'ETB', amount: 300 }, { ...base, id: 'returned', status: 'refunded', amount: 20 }, { ...base, id: 'failed', status: 'failed', amount: 10 }];
let root: Root, container: HTMLDivElement, client: QueryClient;
const render = async (path = '/admin/payments') => {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={client}><PageMemoryProvider><PaymentHistoryPage /></PageMemoryProvider></QueryClientProvider></MemoryRouter>));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
};
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  localStorage.clear(); sessionStorage.clear();
  saveCandidates([]); savePayments(payments); saveLocalAgencies([{ id: 'local', name: 'Local partner', created_at: '2026-11-07' }]);
  mocks.auth.userRole = 'superadmin'; mocks.all.mockResolvedValue(payments); mocks.foreign.mockResolvedValue(payments.filter(payment => payment.payer_type === 'foreign-agency')); mocks.local.mockResolvedValue([]);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); vi.restoreAllMocks(); });
describe('payment history finance-first view', () => {
  it('shows foreign bank comparisons for all receiving agencies without requiring an agency selection', async () => {
    await render('/admin/payments?tab=discrepancies&source=foreign');
    expect(container.querySelector('[aria-label="Foreign transfer bank differences"]')?.textContent).toContain('Bank comparison local foreign settled-foreign');
    expect(container.textContent).toContain('Contract payment checks');
    expect(container.querySelector('[aria-label="Foreign transfer bank differences"]')?.textContent).not.toContain('candidate-fee');
    await act(async () => root.unmount()); root = createRoot(container); client.clear();
    await render('/admin/payments?tab=discrepancies&source=foreign&agency=local');
    expect(container.querySelector('[aria-label="Foreign transfer bank differences"]')).toBeNull();
    expect(container.textContent).toContain('Bank comparison local foreign settled-foreign');
  });
  it('uses compact static rail controls without changing source filtering', async () => {
    await render('/admin/payments?tab=ledger');
    const foreign = container.querySelector<HTMLButtonElement>('[aria-label="Foreign agency payments to local agencies · 4"]')!;
    const candidate = container.querySelector<HTMLButtonElement>('[aria-label="Candidate payments to local agencies · 1"]')!;
    for (const control of [foreign, candidate]) {
      expect(control.className).toContain('navigation-rail-item');
      expect(control.className).not.toContain('control-nav-shine');
      expect(control.querySelectorAll('svg')).toHaveLength(1);
      expect(control.querySelector('.navigation-rail-detail')).not.toBeNull();
      expect(control.className).not.toContain('min-h-28');
    }
    expect(foreign.style.getPropertyValue('--nav-color')).toBe('#7dd3fc');
    expect(candidate.style.getPropertyValue('--nav-color')).toBe('#6ee7b7');
    await act(async () => candidate.click());
    expect(container.textContent).toContain('Candidate payments received · ETB');
    expect(container.textContent).not.toContain('Foreign agency payments · estimated USD total');
    expect(candidate.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.querySelector('tbody')?.textContent).toContain('300 ETB');
    await act(async () => foreign.click());
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(container.querySelector('tbody')?.textContent).not.toContain('300 ETB');
  });
  it('shows final ETB money received in the candidate overview and drills down to local receipts', async () => {
    await render();
    const candidate = container.querySelector<HTMLButtonElement>('[aria-label="Candidate payments to local agencies · 1"]')!;
    await act(async () => candidate.click());
    const overview = container.querySelector('[aria-label="Finance overview"]')!;
    expect(overview.textContent).toContain('Candidate payments marked received · ETB');
    expect(overview.querySelector('h2')?.textContent).toBe('300.00 ETB');
    expect(overview.textContent).not.toContain('USD reference estimate');
    const explore = [...overview.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Explore settled local transfers'))!;
    await act(async () => explore.click());
    expect(candidate.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.querySelector('[aria-label="Payment overview"]')?.textContent).toContain('Candidate payments received · ETB');
  });
  it('opens an actionable overview, keeps currency sources separate and drills down to pending receipts', async () => {
    await render();
    expect(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Finance overview');
    expect(document.querySelector('table')).toBeNull();
    expect(container.textContent).toContain('$100.00');
    expect(container.textContent).toContain('300 ETB');
    expect(container.textContent).toContain('Oldest');
    const pending = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Waiting for confirmation'))!;
    await act(async () => pending.click());
    expect(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Payments list');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.querySelector('tbody')?.textContent).toContain('50 USD');
    expect(container.querySelector('tbody')?.textContent).not.toContain('100 USD');
  });
  it('preserves direct ledger links and routes the resolution anchor to its own tab', async () => {
    await render('/admin/payments?tab=ledger');
    expect(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Payments list');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    await act(async () => root.unmount()); root = createRoot(container); client.clear();
    await render('/admin/payments#resolution');
    expect(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Payment issues');
    expect(container.textContent).toContain('Resolution inbox');
  });
  it.each(['agency', 'foreign-agency', 'foreign-agency-staff'])('uses the %s outbound scope without audit or candidate collections', async role => {
    mocks.auth.userRole = role;
    // Deliberately return an overbroad API result to exercise the UI boundary too.
    mocks.foreign.mockResolvedValue([...payments, { ...base, id: 'outsider', payer_foreign_agency_id: 'other', amount: 999, currency: 'SAR' }, { ...base, id: 'own-sar', amount: 500, currency: 'SAR' }]);
    await render('/agency/payments?source=candidate&agency=other-local&tab=discrepancies#resolution');
    expect(mocks.foreign).toHaveBeenCalledWith('foreign');
    expect(container.querySelector('h1')?.textContent).toBe('Money sent');
    expect(container.textContent).toContain('100.00 USD · 500.00 SAR');
    expect(container.textContent).not.toContain('999');
    expect(container.textContent).not.toContain('300 ETB');
    expect(container.textContent).not.toContain('Candidate fee collections');
    expect(container.textContent).not.toContain('Money received');
    expect(container.textContent).not.toContain('estimated USD');
    expect(container.textContent).not.toContain('Bank records');
    expect(container.textContent).not.toContain('Payment issues');
    expect(container.textContent).not.toContain('Resolution inbox');
    expect([...container.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)).toEqual(['Money sent overview', 'Receipts']);
    const settled = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'View settled receipts')!;
    await act(async () => settled.click());
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.querySelector('tbody')?.textContent).not.toContain('300 ETB');
    expect(container.querySelector('tbody')?.querySelectorAll('button')).toHaveLength(2);
    await act(async () => container.querySelector<HTMLButtonElement>('tbody button')!.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Print receipt');
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('bank');
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Inspect');
  });
  it('retains admin bank review navigation without granting superadmin issue actions', async () => {
    mocks.auth.userRole = 'admin';
    await render();
    expect(container.textContent).toContain('Money received');
    expect(container.textContent).toContain('300 ETB');
    expect([...container.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)).toEqual(['Finance overview', 'Payments list', 'Bank records & checks']);
    expect(container.textContent).not.toContain('Resolution inbox');
  });
});
