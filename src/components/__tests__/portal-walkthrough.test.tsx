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
  return <main><h1>Current feature</h1><p data-testid="route">{location.pathname}{location.search}</p><section data-tour="registration">Ministry intake</section><section data-tour="workload-manager">My tasks</section>
    <div data-tour="dashboard-agency-scope">Agency scope</div>
    <nav aria-label="Dashboard sections">{['Overview', 'Workforce', 'Payments', 'Document checks', 'Candidates'].map(label => <button key={label} role="tab" aria-label={label}>{label}</button>)}</nav>
    {['dash-overview-executive', 'dash-overview-integrity', 'dash-overview-resolution', 'dash-overview-presence', 'dash-portfolio-lifecycle',
      'dash-portfolio-workforce', 'dash-portfolio-mix', 'dash-finance-finance', 'dashboard-transfer-review', 'dash-compliance-foreign-payment-compliance',
      'dash-compliance-expiring', 'dashboard-documents', 'dash-candidates-filters', 'dash-candidates-candidates'].map(id => <section key={id} data-tour={id}>{id}</section>)}
  </main>;
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
const finishSubsteps = async () => {
  while ([...container.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Next substep')) await click('Next substep');
};
const nextStep = async () => { await finishSubsteps(); await click('Next step'); };
it('moves one step at a time with explicit instructions and checks, and opens the correct payment tab', async () => {
  const recordsBefore = { ...localStorage };
  await render();
  await act(async () => startWalkthrough(false));
  expect(container.textContent).toContain('Choose the dashboard view');
  expect(container.textContent).toContain('Do this now');
  expect(container.textContent).toContain('Substep 1 of 2');
  expect(container.textContent).not.toContain('Before you continue');
  expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1');
  await click('Next substep');
  expect(readWalkthrough()).toMatchObject({ index: 0, subIndex: 1 });
  expect(container.textContent).toContain('Before you continue');
  await click('Next step');
  for (const [title, section] of [['Overview', 'overview'], ['Workforce', 'portfolio'], ['Payments', 'finance'], ['Document checks', 'compliance'], ['Candidates', 'candidates']]) {
    expect(container.querySelector('[aria-label="Demo walkthrough"] h2')?.textContent).toBe(`Dashboard · ${title}`);
    expect(container.querySelector('[data-testid="route"]')?.textContent).toBe(`/admin?section=${section}`);
    expect(container.querySelector(`[role="tab"][aria-label="${title}"]`)?.classList.contains('portal-tour-highlight')).toBe(true);
    await nextStep();
  }
  expect(container.textContent).toContain('Start with My tasks');
  expect(container.querySelector('[data-testid="route"]')?.textContent).toBe('/admin/tasks');
  await nextStep();
  expect(container.textContent).toContain('Understand ministry intake');
  await nextStep();
  expect(container.querySelector('[data-testid="route"]')?.textContent).toBe('/admin/candidate/demo-cand-0001');
  await nextStep();
  expect(container.textContent).toContain('Check registration payment');
  expect(container.querySelector('[data-testid="route"]')?.textContent).toContain('?tab=payments');
  await click('Previous');
  expect(readWalkthrough()?.index).toBe(walkthroughSteps('superadmin').findIndex(step => step.title === 'Review the candidate identity'));
  expect({ ...localStorage }).toEqual(recordsBefore);
});
it('pauses and resumes at the saved step, then finishes without changing candidate records', async () => {
  await render();
  await act(async () => startWalkthrough(false));
  await nextStep();
  await click('Next substep');
  await click('Exit walkthrough');
  expect(readWalkthrough()).toMatchObject({ index: 1, subIndex: 1, active: false, completed: false, returnTo: '/guide' });
  await act(async () => startWalkthrough(true));
  expect(container.textContent).toContain('Dashboard · Overview');
  const count = walkthroughSteps('superadmin').length;
  expect(readWalkthrough()?.subIndex).toBe(1);
  for (let index = 1; index < count - 1; index++) await nextStep();
  await finishSubsteps();
  await click('Finish walkthrough');
  expect(readWalkthrough()).toMatchObject({ completed: true, active: false });
  expect(container.querySelector('[data-testid="route"]')?.textContent).toBe('/guide');
});
it('uses a larger bottom-left panel and follows a small highlighted control without covering it', async () => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.getAttribute('data-tour') === 'dashboard-agency-scope') return { left: 20, right: 140, top: 120, bottom: 160, width: 120, height: 40, x: 20, y: 120, toJSON: () => ({}) };
    return { left: 0, right: 480, top: 0, bottom: 420, width: 480, height: 420, x: 0, y: 0, toJSON: () => ({}) };
  });
  await render();
  await act(async () => startWalkthrough(false));
  const panel = container.querySelector<HTMLElement>('[aria-label="Demo walkthrough"]')!;
  expect(panel.className).toContain('max-w-[30rem]');
  expect(panel.style.left).toBe('156px');
  expect(panel.style.top).toBe('120px');
  await click('Next substep');
  expect(container.querySelector('[data-tour="dashboard-agency-scope"]')?.classList.contains('portal-tour-highlight')).toBe(false);
  expect(container.querySelector('[aria-label="Dashboard sections"]')?.classList.contains('portal-tour-highlight')).toBe(true);
  expect(panel.style.left).toBe('496px');
  await act(async () => { Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true }); window.dispatchEvent(new Event('resize')); });
  expect(panel.style.left).toBe('16px');
  expect(panel.style.bottom).toBe('88px');
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
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
  for (const role of ['superadmin', 'admin', 'staff', 'local-agency'] as const) {
    const steps = walkthroughSteps(role);
    const dashboard = steps.filter(step => step.title.startsWith('Dashboard ·'));
    expect(dashboard.map(step => step.title)).toEqual(['Dashboard · Overview', 'Dashboard · Workforce', 'Dashboard · Payments', 'Dashboard · Document checks', 'Dashboard · Candidates']);
    expect(dashboard.every(step => step.instructions.length === step.instructionSelectors?.length)).toBe(true);
    expect(steps.findIndex(step => step.path.endsWith('/tasks'))).toBeGreaterThan(steps.findIndex(step => step.title === 'Dashboard · Candidates'));
  }
});
