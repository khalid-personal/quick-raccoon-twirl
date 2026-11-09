// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const source = vi.hoisted(() => ({ fee: 0, held: false }));
vi.mock('@/hooks/use-portal-data', () => ({ usePortalData: () => ({
  candidates: [
    { id: 'a', first_name: 'Training', last_name: 'Candidate', tracking_code: 'A', local_agency_id: 'local-a', updated_at: '2026-11-08' },
    { id: 'b', first_name: 'Other', last_name: 'Agency', tracking_code: 'B', local_agency_id: 'local-b', updated_at: '2026-11-08' },
    { id: 'c', first_name: 'Practice', last_name: 'Clearance', tracking_code: 'C', local_agency_id: 'local-a', clearance: { local_ready_at: '2026-11-08', labour_ministry: { status: 'cleared', simulated: true } } },
    { id: 'd', first_name: 'Missing', last_name: 'Records', tracking_code: 'D', local_agency_id: 'local-a' },
  ],
  stages: ['a', 'b', 'c'].flatMap(candidate_id => [1, 3, 2, 4].map(stage_id => ({ id: `${candidate_id}-${stage_id}`, candidate_id, stage_id, status: candidate_id === 'c' || stage_id === 1 ? 'Completed' : 'Pending', updated_at: '2026-11-08', follow_up_due_at: '2099-01-01' }))),
  payments: [], paymentStatuses: [], stageFees: { 1: source.fee },
}) }));
vi.mock('@/lib/agency-resolution', () => ({ agencyIsSuspended: () => source.held }));
vi.mock('../CandidateQuickViewProvider', () => ({ CandidateWorkspaceLink: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a> }));
import JourneyRadar from '../JourneyRadar';
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); source.fee = 0; source.held = false;
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = () => act(async () => root.render(<MemoryRouter><JourneyRadar localAgencyId="local-a" /></MemoryRouter>));
const click = async (text: string) => act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes(text))!.click());
it('keeps scoped candidates in exclusive lanes and exposes actual stage follow-ups', async () => {
  await render();
  expect(container.querySelector('.journey-radar-core')?.textContent).toContain('3');
  expect(container.querySelector('.radar-node-1')?.textContent).toContain('1');
  await click('Training');
  expect(container.querySelector('a')?.textContent).toContain('Training Candidate');
  expect(container.textContent).not.toContain('Other Agency');
  await click('Ministry handoff');
  expect(container.querySelector('a')?.textContent).toContain('Practice clearance only');
  await click('Cleared journey');
  expect(container.textContent).toContain('No candidates in this lane');
});
it('does not skip an unpaid completed stage, and exposes agency holds through the priority lens', async () => {
  source.fee = 200; source.held = true;
  await render();
  expect(container.querySelector('.radar-node-0')?.textContent).toContain('2');
  expect(container.querySelector('a')?.textContent).toContain('Agency paused');
  await click('Priority lens');
  expect(container.querySelector('a')?.textContent).toContain('Agency paused');
  await click('Pause scan');
  expect(container.querySelector<HTMLElement>('.journey-radar-sweep')?.style.animationPlayState).toBe('paused');
});
