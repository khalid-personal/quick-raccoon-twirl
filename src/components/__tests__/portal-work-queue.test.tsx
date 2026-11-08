// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PortalWorkQueue from '../PortalWorkQueue';
import { getApiPrincipal } from '@/lib/api/auth';
import { generateDemoDataset } from '@/lib/demo-dataset';
import { getCandidates, getCandidateStages, saveCandidates, saveCandidateStages, saveConfig, getConfig, saveDocuments } from '@/lib/data-store';

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ userRole: 'candidate', user: { id: 'candidate-account' } }) }));
vi.mock('@/lib/api/auth', () => ({ getApiPrincipal: vi.fn() }));
let root: Root, container: HTMLDivElement, client: QueryClient;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  const candidate = generateDemoDataset(Date.parse('2026-11-08')).candidates[0];
  saveCandidates([candidate]); saveCandidateStages([{ id: 'active', candidate_id: candidate.id, stage_id: 1, status: 'Pending', updated_at: '2026-11-08' }]);
  saveDocuments([]); saveConfig({ ...getConfig(), stageFees: {} });
  vi.mocked(getApiPrincipal).mockResolvedValue({ id: candidate.id, candidateId: candidate.id, role: 'candidate', localAgencyId: null, foreignAgencyId: null });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
const render = async () => {
  await act(async () => { root.render(<QueryClientProvider client={client}><MemoryRouter><PortalWorkQueue /></MemoryRouter></QueryClientProvider>); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
};
it('renders document-only candidate reminders and links to the existing uploader without changing any records', async () => {
  const before = { ...localStorage };
  await render();
  expect(container.textContent).toContain('Your document reminders');
  expect(container.textContent).toContain('not a staff assignment');
  expect(container.querySelector('a')?.getAttribute('href')).toBe(`/track/${getCandidates()[0].tracking_code}#my-documents`);
  expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  expect({ ...localStorage }).toEqual(before);
  expect(getCandidateStages()[0].status).toBe('Pending');
});
it('surfaces authorization failures rather than showing a success-shaped empty task list', async () => {
  vi.mocked(getApiPrincipal).mockRejectedValue(new Error('Account unavailable'));
  await render();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not load your tasks');
  expect(container.textContent).not.toContain('No outstanding');
});
