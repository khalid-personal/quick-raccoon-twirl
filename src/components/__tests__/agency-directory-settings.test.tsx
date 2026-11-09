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
    agencyPartnerships: [{ local_agency_id: 'local', foreign_agency_id: 'foreign', status: 'active', started_at: '2026-01-01', agreement_reference: 'MIN-REF-42' }],
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });

it('shows ministry-owned agencies and partner contracts without edit actions while portal settings remain saveable', async () => {
  await act(async () => root.render(<MemoryRouter><QueryClientProvider client={client}><SuperadminSettings /></QueryClientProvider></MemoryRouter>));
  await flush();
  expect(container.querySelector('.portal-flow-guide')?.textContent).toContain('The connection is pending');
  expect(container.textContent).toContain('Agency constellation');
  expect(container.textContent).toContain('Local partner');
  expect(container.textContent).toContain('Foreign partner');
  expect(container.querySelector('[placeholder="Add new local agency"]')).toBeNull();
  expect(container.querySelector('[placeholder="Add new foreign agency"]')).toBeNull();
  expect(container.querySelector('[aria-label="Remove Foreign partner"]')).toBeNull();
  expect(container.querySelector<HTMLFieldSetElement>('[aria-label="Ministry CoC directory"]')?.disabled).toBe(true);
  expect(container.querySelector('#settings-countries')).toBeNull();
  expect(container.querySelector('#settings-origins')?.textContent).toContain('Ethiopian origin coverage');
  expect(container.textContent).not.toContain('External contract and visa status');
  expect(container.querySelector('.portal-flow-guide')?.textContent).toContain('Review scanned details before autofill');
  expect(container.textContent).not.toContain('Development Helpers');
  expect(container.querySelector('.settings-command-header')).not.toBeNull();
  expect(container.querySelector('[aria-label="Settings sections"]')).not.toBeNull();
  const contract = container.querySelector<HTMLInputElement>('[aria-label="Link Local partner and Foreign partner"]');
  expect(contract).toBeNull();
  expect(container.querySelector('#settings-partnerships input')).toBeNull();
  expect(container.querySelector('#settings-partnerships')?.textContent).toContain('MIN-REF-42');
  const save = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Save All Settings'));
  await act(async () => save!.click());
  await flush();
  expect(getConfig().agencyPartnerships).toEqual([expect.objectContaining({ local_agency_id: 'local', foreign_agency_id: 'foreign' })]);
  expect(getConfig().localAgencies[0].name).toBe('Local partner');
  expect(getConfig().foreignAgencies[0].name).toBe('Foreign partner');
});
