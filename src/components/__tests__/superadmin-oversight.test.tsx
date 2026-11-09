// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StaffTasksPage from '@/pages/StaffTasksPage';
import { getApiPrincipal } from '@/lib/api/auth';
import { getConfig, saveConfig, saveCandidates, saveCandidateStages, saveStaffUsers, saveLocalAgencies, savePayments, savePaymentStatuses } from '@/lib/data-store';
import { generateDemoDataset } from '@/lib/demo-dataset';

const auth = vi.hoisted(() => ({ userRole: 'superadmin', user: { id: 'manager', email: 'manager@test.test' }, viewAs: null, userLocalAgencyId: 'a' }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
vi.mock('@/lib/api/auth', () => ({ getApiPrincipal: vi.fn() }));
vi.mock('@/components/PortalWorkQueue', () => ({ default: () => <section aria-label="My tasks">Investigation tasks</section> }));
let container: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  auth.userRole = 'superadmin';
  const candidates = generateDemoDataset().candidates.slice(0, 2).map((candidate, index) => ({ ...candidate, local_agency_id: index ? 'b' : 'a' }));
  saveCandidates(candidates);
  saveCandidateStages(candidates.map(candidate => ({ id: `stage:${candidate.id}`, candidate_id: candidate.id, stage_id: 1, status: 'Pending', updated_at: '2026-11-07', assigned_staff_id: 'staff' })));
  saveLocalAgencies([{ id: 'a', name: 'Agency A', created_at: '2026-11-07' }, { id: 'b', name: 'Agency B', created_at: '2026-11-07' }]);
  saveStaffUsers([{ id: 'staff', email: 'staff@a.test', role: 'staff', is_approved: true, local_agency_id: 'a', created_at: '2026-11-07' }]);
  savePayments([]); savePaymentStatuses([]); saveConfig({ ...getConfig(), stageFees: {} });
  vi.mocked(getApiPrincipal).mockResolvedValue({ id: 'manager', role: 'local-agency', localAgencyId: 'a', foreignAgencyId: null });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
const render = async () => {
  await act(async () => root.render(<MemoryRouter><QueryClientProvider client={client}><StaffTasksPage /></QueryClientProvider></MemoryRouter>));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 80)); });
};
it('shows superadmin agency flow and investigations without assignment or workload controls', async () => {
  await render();
  expect(container.querySelector('[aria-label="Agency flow oversight"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="Registration to deployment flow"]')?.children).toHaveLength(5);
  expect(container.textContent).toContain('Agency A');
  expect(container.textContent).toContain('Agency B');
  expect(container.textContent).toContain('Investigation tasks');
  expect(container.textContent).not.toContain('Workload balance');
  expect(container.textContent).not.toContain('Auto-populate');
  expect(container.querySelector('[aria-label^="Workload weight"]')).toBeNull();
});
it('keeps local agency balancing and current-stage assignment in the agency scope', async () => {
  auth.userRole = 'local-agency';
  await render();
  expect(container.querySelector('[aria-label="Agency flow oversight"]')).toBeNull();
  expect(container.textContent).toContain('Workload balance');
  expect(container.textContent).toContain('Balance agency work');
  expect(container.textContent).toContain('staff@a.test');
  expect(container.textContent).not.toContain('Agency B');
});
it('retains usable owner and hold counts after query data is serialized and restored', async () => {
  await render();
  const key = ['agency-flow-oversight', 'serializable-roster'];
  const restored: unknown = JSON.parse(JSON.stringify(client.getQueryData(key)));
  await act(async () => { client.setQueryData(key, restored); });
  expect(container.textContent).toContain('Agency A');
  expect(container.textContent).toContain('1 need an eligible owner');
  expect(container.querySelector('[aria-label="Agency flow oversight"]')).not.toBeNull();
});
