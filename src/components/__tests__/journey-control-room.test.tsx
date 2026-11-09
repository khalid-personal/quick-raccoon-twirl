// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminTrainingMap from '@/pages/AdminTrainingMap';
import type { Candidate, CandidateStage } from '@/lib/types';
const mocks = vi.hoisted(() => ({ role: 'superadmin', agency: 'local-1' as string | undefined, open: vi.fn() }));
const candidate: Candidate = { id: 'person-1', first_name: 'Hana', last_name: 'Tadesse', dob: '1998-01-01', passport_number: 'SYN-1', tracking_code: 'TRK-1', country_of_origin: 'Ethiopia', marital_status: 'Single', email: 'hana@example.test', home_city: 'Adama', local_agency_id: 'local-1', coc_facility_id: 'center-1', created_at: '2026-01-01', updated_at: '2026-01-01', payment_status: 'unpaid' };
const stages: CandidateStage[] = [{ id: 'training', candidate_id: candidate.id, stage_id: 3, status: 'Passed', date: '2026-01-02', updated_at: '2026-01-02' }];
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ userRole: mocks.role, user: { id: 'operator' }, userLocalAgencyId: mocks.agency }) }));
vi.mock('@/lib/data-store', () => ({
  getCandidates: () => [candidate, { ...candidate, id: 'outside', first_name: 'Other', local_agency_id: 'local-2' }],
  getCandidateStages: () => stages,
  getCocFacilities: () => [{ id: 'center-1', name: 'Assessment Center', city: 'Adama', created_at: '' }],
  getDocuments: () => [],
  getMedicalResults: () => [{ id: 'medical', candidate_id: candidate.id, exam_type: 'HIV', status: 'Passed', exam_date: '2026-01-03', location: { name: 'Medical Clinic', city: 'Hawassa' } }],
}));
vi.mock('@/components/CandidateQuickViewProvider', () => ({ useCandidateWorkspace: () => mocks.open }));
vi.mock('@/components/CandidateAvatar', () => ({ default: () => <span /> }));
vi.mock('@/components/CandidateQuickView', () => ({ default: () => null }));
vi.mock('@/components/DestinationTracker', () => ({ default: () => null }));
vi.mock('@/components/EmploymentJourneyHistory', () => ({ default: () => null }));
vi.mock('@/components/JourneyControlMap', () => ({ default: () => <div>Recorded map</div> }));
vi.mock('@/components/EditableGrid', () => ({ default: ({ items }: { items: Array<{ id: string; node: React.ReactNode }> }) => <>{items.map(item => <div key={item.id}>{item.node}</div>)}</> }));
let root: Root, container: HTMLDivElement, client: QueryClient;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  localStorage.clear(); sessionStorage.clear(); mocks.open.mockClear(); mocks.role = 'superadmin'; mocks.agency = 'local-1';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); vi.unstubAllGlobals(); });
const render = async () => {
  await act(async () => { root.render(<MemoryRouter><QueryClientProvider client={client}><AdminTrainingMap /></QueryClientProvider></MemoryRouter>); await new Promise(resolve => setTimeout(resolve, 30)); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
};
const click = async (name: string) => act(async () => { const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === name || item.getAttribute('aria-label') === name)!; button.click(); });
it('opens the precise medical source and keeps the inspector in sync with manual evidence replay', async () => {
  await render();
  const select = container.querySelector<HTMLSelectElement>('[aria-label="Select candidate journey"]')!;
  await act(async () => { select.value = candidate.id; select.dispatchEvent(new Event('change', { bubbles: true })); });
  const inspector = container.querySelector('[aria-label="Selected journey event"]')!;
  expect(inspector.textContent).toContain('Medical Clinic');
  await click('Open medical record');
  expect(mocks.open).toHaveBeenCalledWith(candidate.id, { tab: 'timeline', stageId: 2 });
  await click('Previous recorded event');
  expect(inspector.textContent).toContain('Training status');
  expect(inspector.textContent).not.toContain('HIV · Passed');
  expect(container.textContent).toContain('Stage progress is read-only');
});
it('scopes the room to local assignments and never exposes unassigned records when an agency ID is missing', async () => {
  mocks.role = 'local-agency';
  await render();
  expect(container.textContent).toContain('Hana');
  expect(container.textContent).not.toContain('Other Tadesse');
  await act(async () => root.unmount());
  root = createRoot(container); mocks.agency = undefined;
  await render();
  expect(container.querySelectorAll('.journey-ledger-row')).toHaveLength(0);
  expect(container.querySelector('[aria-label="Select candidate journey"]')?.textContent).not.toContain('Hana');
});
