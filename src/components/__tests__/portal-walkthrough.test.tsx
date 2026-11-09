// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PortalWalkthrough from '../PortalWalkthrough';
import { readWalkthrough, startWalkthrough, walkthroughSteps } from '@/lib/portal-walkthrough';
import { saveCandidates, saveCandidateStages } from '@/lib/data-store';
import { generateDemoDataset } from '@/lib/demo-dataset';
import { PageMemoryProvider } from '@/hooks/use-page-memory';
import { CandidateQuickViewProvider } from '../CandidateQuickViewProvider';
import { LayoutEditProvider, useLayoutEdit } from '@/lib/layout-edit';

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ userRole: 'superadmin', user: { id: 'demo-superadmin' } }) }));
let root: Root, container: HTMLDivElement;
function RouteTarget() {
  const location = useLocation();
  const { editing } = useLayoutEdit();
  return <main><h1>Current feature</h1><p data-testid="route">{location.pathname}{location.search}</p><section data-tour="registration">Ministry intake</section><section data-tour="workload-manager">My tasks</section>
    <button aria-label={editing ? 'Finish editing layout' : 'Edit layout'}>Layout</button>
    {editing && <div aria-label="Layout editor"><button aria-label="Resize Candidate totals">Full width</button>Editing layout</div>}
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
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ x: 100, y: 120, left: 100, top: 120, right: 500, bottom: 300, width: 400, height: 180, toJSON: () => ({}) });
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 2400, configurable: true });
  vi.spyOn(window, 'scrollTo').mockImplementation((_x, y) => { Object.defineProperty(window, 'scrollY', { value: y, configurable: true }); });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const render = async () => { await act(async () => root.render(<MemoryRouter initialEntries={['/guide']}><PageMemoryProvider><LayoutEditProvider><CandidateQuickViewProvider><RouteTarget /><PortalWalkthrough /></CandidateQuickViewProvider></LayoutEditProvider></PageMemoryProvider></MemoryRouter>)); };
const click = async (label: string) => {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === label || button.getAttribute('aria-label') === label)!;
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
  expect(container.textContent).toContain('Make the workspace yours');
  expect(document.querySelector('[data-tour="walkthrough-window-practice"]')?.getAttribute('data-state')).toBe('open');
  await nextStep();
  expect(container.textContent).toContain('Arrange dashboard panels');
  await nextStep();
  expect(container.textContent).toContain('Choose the dashboard view');
  expect(container.textContent).toContain('What to do');
  expect(container.textContent).toContain('Substep 1 of 2');
  expect(container.textContent).not.toContain('Before you continue');
  expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('3');
  await click('Next substep');
  expect(readWalkthrough()).toMatchObject({ index: 2, subIndex: 1 });
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
  await nextStep();
  await nextStep();
  await click('Next substep');
  await click('Exit walkthrough');
  expect(readWalkthrough()).toMatchObject({ index: 3, subIndex: 1, active: false, completed: false, returnTo: '/guide' });
  await act(async () => startWalkthrough(true));
  expect(container.textContent).toContain('Dashboard · Overview');
  const count = walkthroughSteps('superadmin').length;
  expect(readWalkthrough()?.subIndex).toBe(1);
  for (let index = 3; index < count - 1; index++) await nextStep();
  await finishSubsteps();
  await click('Finish walkthrough');
  expect(readWalkthrough()).toMatchObject({ completed: true, active: false });
  expect(container.querySelector('[data-testid="route"]')?.textContent).toBe('/guide');
});
it('automatically follows features with nearest-edge scrolling, contextual focus and a pause control', async () => {
  await render();
  await act(async () => startWalkthrough(false));
  await nextStep();
  await nextStep();
  const panel = container.querySelector<HTMLElement>('[aria-label="Demo walkthrough"]')!;
  expect(panel.className).toContain('max-w-[28rem]');
  expect(panel.className).toContain('bottom-[88px]');
  expect(panel.className).toContain('left-4');
  expect(container.textContent).not.toContain('Show feature');
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
  await click('Next substep');
  expect(container.querySelector('[data-tour="dashboard-agency-scope"]')?.classList.contains('portal-tour-highlight')).toBe(false);
  expect(container.querySelector('[aria-label="Dashboard sections"]')?.classList.contains('portal-tour-highlight')).toBe(true);
  expect(Element.prototype.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  expect(container.querySelector('.portal-tour-feature-tag')?.textContent).toContain('Dashboard sections');
  expect(container.querySelector('.portal-tour-focus-frame')).not.toBeNull();
  await click('Pause following');
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
  await click('Previous');
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  await click('Resume following');
  expect(Element.prototype.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  await act(async () => window.dispatchEvent(new Event('scroll')));
  expect(panel.style.top).toBe('');
  expect(panel.style.left).toBe('');
});
it('removes stale highlights when a feature is hidden and recovers without repeating the automatic scroll', async () => {
  await render();
  await act(async () => startWalkthrough(false));
  await nextStep();
  await nextStep();
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
  const target = container.querySelector<HTMLElement>('[data-tour="dashboard-agency-scope"]')!;
  await act(async () => { target.hidden = true; });
  expect(target.classList.contains('portal-tour-highlight')).toBe(false);
  expect(container.textContent).toContain('Locating this feature');
  await act(async () => { target.hidden = false; });
  expect(target.classList.contains('portal-tour-highlight')).toBe(true);
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
});
it('keeps page scroll through every substep and route transition while navigation memory is active', async () => {
  await render();
  await act(async () => startWalkthrough(false));
  Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
  window.dispatchEvent(new Event('scroll'));
  vi.mocked(window.scrollTo).mockClear();
  for (let index = 0; index < walkthroughSteps('superadmin').length - 1; index++) {
    await nextStep();
    expect(window.scrollY).toBe(640);
    expect(window.scrollTo).not.toHaveBeenCalledWith(0, 0);
  }
});
it('teaches window controls first for every role and layout controls only for dashboard roles', () => {
  for (const role of ['superadmin', 'admin', 'staff', 'local-agency', 'agency', 'foreign-agency', 'foreign-agency-staff', 'auditor', 'viewer', 'candidate'] as const) {
    const steps = walkthroughSteps(role, 'TRK-1');
    expect(steps[0].practiceWindow).toBe(true);
    expect(steps[0].instructionTitles).toEqual(['Open a window', 'Resize', 'Minimize', 'Restore', 'Close']);
    expect(steps.some(step => step.title === 'Arrange dashboard panels')).toBe(['superadmin', 'admin', 'staff', 'local-agency'].includes(role));
  }
});
it('restarts an older saved guide at the new opening lesson without navigating until resumed', async () => {
  sessionStorage.setItem('dawm_demo_walkthrough', JSON.stringify({ role: 'superadmin', index: 8, subIndex: 2, active: true, completed: false, returnTo: '/guide' }));
  await render();
  expect(container.querySelector('[aria-label="Demo walkthrough"]')).toBeNull();
  expect(readWalkthrough()).toMatchObject({ index: 0, subIndex: 0, active: false });
  await act(async () => startWalkthrough(true));
  expect(container.textContent).toContain('Make the workspace yours');
  expect(readWalkthrough()).toMatchObject({ index: 0, subIndex: 0, active: true, version: 2 });
});
it('automatically demonstrates resizing, minimizing, restoring and closing without changing records', async () => {
  const recordsBefore = { ...localStorage };
  await render();
  await act(async () => startWalkthrough(false));
  const popup = document.querySelector<HTMLElement>('[data-tour="walkthrough-window-practice"]')!;
  const input = popup.querySelector<HTMLInputElement>('input')!;
  input.value = 'Keep this note';
  await click('Next substep');
  expect(popup.querySelector('[aria-label="Resize window"]')?.classList.contains('portal-tour-highlight')).toBe(true);
  expect(parseFloat(popup.style.width)).toBe(464);
  await click('Next substep');
  expect(popup.dataset.state).toBe('closed');
  expect(document.querySelector('[aria-label="Candidate workspace dock"]')?.classList.contains('portal-tour-highlight')).toBe(true);
  await click('Next substep');
  expect(popup.dataset.state).toBe('open');
  expect(input.value).toBe('Keep this note');
  await click('Next substep');
  expect(document.querySelector('[data-tour="walkthrough-window-practice"]')).toBeNull();
  expect({ ...localStorage }).toEqual(recordsBefore);
});
it('automatically shows layout controls and returns to normal without saving a layout', async () => {
  const recordsBefore = { ...localStorage };
  await render();
  await act(async () => startWalkthrough(false));
  await nextStep();
  expect(container.querySelector('[aria-label="Layout editor"]')).not.toBeNull();
  await click('Next substep');
  expect(container.querySelector('[aria-label="Resize Candidate totals"]')?.classList.contains('portal-tour-highlight')).toBe(true);
  await finishSubsteps();
  expect(container.querySelector('[aria-label="Layout editor"]')).toBeNull();
  await click('Next step');
  expect(container.querySelector('[aria-label="Layout editor"]')).toBeNull();
  expect({ ...localStorage }).toEqual(recordsBefore);
});
it('respects reduced motion when following a feature', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  await render();
  await act(async () => startWalkthrough(false));
  await nextStep(); await nextStep();
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
  await click('Next substep');
  expect(Element.prototype.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
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
    expect(dashboard.every(step => step.instructions.length === step.instructionTitles?.length)).toBe(true);
    expect(steps.findIndex(step => step.path.endsWith('/tasks'))).toBeGreaterThan(steps.findIndex(step => step.title === 'Dashboard · Candidates'));
  }
});
