// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import AgencyResolutionCenter from '../AgencyResolutionCenter';
import { saveCandidates, saveLocalAgencies, savePayments } from '@/lib/data-store';
import { saveBankStatement } from '@/lib/bank-statement-store';
import { getAgencyResolutionCases } from '@/lib/agency-resolution';
import { generateDemoDataset } from '@/lib/demo-dataset';
const auth = vi.hoisted(() => ({ user: { id: 'admin', email: 'admin@example.test' }, userRole: 'superadmin', userLocalAgencyId: null as string | null, userForeignAgencyId: null as string | null, isDemo: true, viewAs: null }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
let container: HTMLDivElement, root: Root, client: QueryClient;
const click = async (label: string) => act(async () => {
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === label)!.click();
  await new Promise(resolve => setTimeout(resolve, 150));
});
const input = async (id: string, value: string) => act(async () => {
  const field = document.querySelector(`[data-field="${id}"]`)!;
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
});
const render = async () => {
  await act(async () => root.render(<MemoryRouter><QueryClientProvider client={client}><AgencyResolutionCenter /></QueryClientProvider></MemoryRouter>));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
};
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  auth.userRole = 'superadmin'; auth.userLocalAgencyId = null; auth.user.id = 'admin';
  const candidate = { ...generateDemoDataset(Date.parse('2026-11-07')).candidates[0], local_agency_id: 'local' };
  saveCandidates([candidate]); saveLocalAgencies([{ id: 'local', name: 'Agency under review', created_at: '2026-11-07' }]);
  savePayments([{ id: 'p', amount: 100, currency: 'ETB', status: 'succeeded', payer_type: 'candidate', payer_foreign_agency_id: '', payee_local_agency_id: 'local', candidate_ids: [candidate.id], provider_reference: 'REF', created_at: '2026-11-07', updated_at: '2026-11-07' }]);
  saveBankStatement('local', { name: 'Bank statement', lines: [{ amount: 80, currency: 'ETB', reference: 'REF', description: 'Credit', date: '2026-11-07' }] }, 'candidate');
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
describe('guided agency resolution UI', () => {
  it('walks through explicit escalation, suspension and a scoped agency appeal', async () => {
    await render();
    await click('Investigate & escalate');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('1. Compare receipt / bank / contract');
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Suspend agency operations');
    await input('resolution-reason', 'Investigate bank credit amount shortage');
    await input('resolution-due', '2026-11-08');
    await click('Escalate amount discrepancy · audit logged');
    expect(getAgencyResolutionCases()[0]).toMatchObject({ state: 'escalated', holdActive: false });
    await input('resolution-reason', 'Pause new registrations pending the deposit explanation');
    await click('Suspend agency operations');
    expect(getAgencyResolutionCases()[0].holdActive).toBe(true);
    await act(async () => root.unmount());
    root = createRoot(container);
    auth.userRole = 'local-agency'; auth.userLocalAgencyId = 'local'; auth.user.id = 'local-user';
    await render();
    await click('Explain / appeal');
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Suspend agency operations');
    await input('resolution-reason', 'The bank deducted a fee and we have confirmation');
    await input('resolution-url', 'https://example.test/bank-confirmation.pdf');
    await click('Submit explanation / appeal');
    expect(getAgencyResolutionCases()[0]).toMatchObject({ state: 'appealed', holdActive: true });
  });
});
