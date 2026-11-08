// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PortalWalkthrough from '../PortalWalkthrough';
import { readWalkthrough, startWalkthrough, walkthroughSteps } from '@/lib/portal-walkthrough';
import { saveCandidates, saveCandidateStages } from '@/lib/data-store';
import { generateDemoDataset } from '@/lib/demo-dataset';

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ userRole: 'superadmin', user: { id: 'demo-superadmin' } }) }));
let root: Root, container: HTMLDivElement;
function RouteTarget() {
  const location = useLocation();
  return <main><h1>Current feature</h1><p data-testid="route">{location.pathname}{location.search}</p><section data-tour="registration">Ministry intake</section><section data-tour="workload-manager">My tasks</section></main>;
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  saveCandidates(generateDemoDataset(Date.parse('2026-11-07')).candidates.slice(0, 1)); saveCandidateStages([]);
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
const render = async () => { await act(async () => root.render(<MemoryRouter initialEntries={['/guide']}><RouteTarget /><PortalWalkthrough /></MemoryRouter>)); };
const click = async (label: string) => {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === label || button.getAttribute('aria-label') === label)!;
  expect(button, `Available buttons: ${[...container.querySelectorAll('button')].map(button => button.textContent).join(', ')}`).toBeDefined();
  await act(async () => button.click());
};
it('moves one step at a time with explicit instructions and checks, and opens the correct payment tab', async () => {
  const recordsBefore = { ...localStorage };
  await render();
  await act(async () => startWalkthrough(false));
  expect(container.textContent).toContain('Choose the dashboard view');
  expect(container.textContent).toContain('Do this now');
  expect(container.textContent).toContain('Before you continue');
  expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1');
  await click('Next step');
  expect(container.textContent).toContain('Start with My tasks');
  expect(container.querySelector('[data-testid="route"]')?.textContent).toBe('/admin/tasks');
  await click('Next step');
  expect(container.textContent).toContain('Understand ministry intake');
  await click('Next step');
  expect(container.querySelector('[data-testid="route"]')?.textContent).toBe('/admin/candidate/demo-cand-0001');
  await click('Next step');
  expect(container.textContent).toContain('Check registration payment');
  expect(container.querySelector('[data-testid="route"]')?.textContent).toContain('?tab=payments');
  await click('Previous');
  expect(readWalkthrough()?.index).toBe(3);
  expect({ ...localStorage }).toEqual(recordsBefore);
});
it('pauses and resumes at the saved step, then finishes without changing candidate records', async () => {
  await render();
  await act(async () => startWalkthrough(false));
  await click('Next step');
  await click('Exit walkthrough');
  expect(readWalkthrough()).toMatchObject({ index: 1, active: false, completed: false, returnTo: '/guide' });
  await act(async () => startWalkthrough(true));
  expect(container.textContent).toContain('Start with My tasks');
  const count = walkthroughSteps('superadmin').length;
  for (let index = 1; index < count - 1; index++) await click('Next step');
  await click('Finish walkthrough');
  expect(readWalkthrough()).toMatchObject({ completed: true, active: false });
  expect(container.querySelector('[data-testid="route"]')?.textContent).toBe('/guide');
});
it('keeps foreign guides receipt-only, adds workload, and does not route non-superadmins to case decisions', () => {
  for (const role of ['agency', 'foreign-agency', 'foreign-agency-staff'] as const) {
    const steps = walkthroughSteps(role);
    expect(steps.some(step => step.path === '/agency/tasks')).toBe(true);
    expect(steps.find(step => step.path.startsWith('/agency/payments'))?.path).toBe('/agency/payments?tab=ledger');
    expect(steps.every(step => step.instructions.length > 0 && step.check.length > 0)).toBe(true);
  }
  for (const role of ['admin', 'staff'] as const) expect(walkthroughSteps(role).some(step => step.path.includes('tab=resolution'))).toBe(false);
  for (const role of ['superadmin', 'admin', 'staff', 'local-agency', 'agency', 'foreign-agency', 'foreign-agency-staff', 'auditor', 'viewer'] as const) {
    expect(walkthroughSteps(role).some(step => step.path.endsWith('/tasks'))).toBe(true);
  }
  expect(walkthroughSteps('candidate', 'TRK-1').some(step => step.title.includes('document reminders'))).toBe(true);
});
