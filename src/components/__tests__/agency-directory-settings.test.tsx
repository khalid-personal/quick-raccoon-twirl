// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getConfig, saveConfig } from '@/lib/data-store';
import SuperadminSettings from '@/pages/SuperadminSettings';

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ userRole: 'superadmin', user: { id: 'admin', email: 'admin@example.test' }, isLoading: false }) }));
vi.mock('@/components/DemoDataCard', () => ({ default: () => null }));
vi.mock('@/components/MinistrySubmissionSettings', () => ({ default: () => null }));
vi.mock('@/components/ExternalSystemSimulator', () => ({ default: () => null }));

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 200)); });

beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('dawm_demo_session', '1');
  saveConfig({
    ...getConfig(),
    localAgencies: [{ id: 'local', name: 'Local partner', created_at: '2026-01-01' }],
    foreignAgencies: [{ id: 'foreign', name: 'Foreign partner', country_code: 'SA', created_at: '2026-01-01' }],
    agencyPartnerships: [],
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });

it('shows existing agencies read-only while keeping contracts editable and saveable', async () => {
  await act(async () => root.render(<MemoryRouter><QueryClientProvider client={client}><SuperadminSettings /></QueryClientProvider></MemoryRouter>));
  await flush();
  expect(container.textContent).toContain('ELMIS agency connection pending');
  expect(container.textContent).toContain('no agency data is being fetched or synchronized');
  expect(container.textContent).toContain('Local partner');
  expect(container.textContent).toContain('Foreign partner');
  expect(container.querySelector('[placeholder="Add new local agency"]')).toBeNull();
  expect(container.querySelector('[placeholder="Add new foreign agency"]')).toBeNull();
  expect(container.querySelector('[aria-label="Remove Foreign partner"]')).toBeNull();
  const contract = container.querySelector<HTMLInputElement>('[aria-label="Link Local partner and Foreign partner"]');
  expect(contract).not.toBeNull();
  await act(async () => contract!.click());
  const save = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Save All Settings'));
  await act(async () => save!.click());
  await flush();
  expect(getConfig().agencyPartnerships).toEqual([expect.objectContaining({ local_agency_id: 'local', foreign_agency_id: 'foreign' })]);
  expect(getConfig().localAgencies[0].name).toBe('Local partner');
  expect(getConfig().foreignAgencies[0].name).toBe('Foreign partner');
});
