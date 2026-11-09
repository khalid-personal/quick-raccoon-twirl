// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AgencyAssignmentNetwork from '../AgencyAssignmentNetwork';
import type { Candidate } from '@/lib/types';
vi.mock('../CandidateAvatar', () => ({ default: ({ candidate }: { candidate: Candidate }) => <span role="img" aria-label={`${candidate.first_name} ${candidate.last_name}`} /> }));
let root: Root, container: HTMLDivElement;
beforeEach(() => { Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true }); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const candidate: Candidate = { id: 'person-1', first_name: 'Hana', last_name: 'Tadesse', dob: '1998-01-01', passport_number: 'SYN-1', tracking_code: 'TRK-1', country_of_origin: 'Ethiopia', marital_status: 'Single', email: 'hana@example.test', home_city: 'Adama', created_at: '2026-01-01', updated_at: '2026-01-01', payment_status: 'unpaid', local_agency_id: 'local-1', foreign_agency_id: 'foreign-1' };
it('visualizes assigned candidates consistently for local and foreign agencies and opens roster links', async () => {
  await act(async () => root.render(<MemoryRouter><AgencyAssignmentNetwork candidates={[candidate, { ...candidate, id: 'retired-person', local_agency_id: 'retired-local', foreign_agency_id: undefined }]} localAgencies={[{ id: 'local-1', name: 'Local partner', created_at: '' }]} foreignAgencies={[{ id: 'foreign-1', name: 'Foreign partner', created_at: '' }]} /></MemoryRouter>));
  expect(container.querySelector('svg[role="img"]')?.getAttribute('aria-label')).toContain('50%');
  const local = container.querySelector<HTMLButtonElement>('[aria-label="Explore Local partner, 1 assigned candidates"]')!;
  await act(async () => local.click());
  expect(container.querySelector('a')?.getAttribute('href')).toBe('/admin/candidate/person-1');
  const foreignTab = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Foreign agencies')!;
  await act(async () => foreignTab.click());
  expect(container.querySelector('[aria-label="Explore Foreign partner, 1 assigned candidates"]')).not.toBeNull();
  expect(container.querySelector('a')).toBeNull();
  expect(container.textContent).not.toContain('retired-local');
});
