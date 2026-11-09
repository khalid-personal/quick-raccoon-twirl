// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { CandidateQuickViewProvider, CandidateName, CandidateWorkspaceLink } from '../CandidateQuickViewProvider';
import { saveCandidates } from '@/lib/data-store';
import { generateDemoDataset } from '@/lib/demo-dataset';
import type { CandidateWorkspaceOptions } from '@/pages/AdminCandidateDetail';
const auth = vi.hoisted(() => ({ user: { id: 'admin' }, userRole: 'superadmin', viewAs: null, isDemo: true }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
vi.mock('@/pages/AdminCandidateDetail', () => ({
  default: function WorkspaceProfile({ workspace }: { workspace: CandidateWorkspaceOptions }) {
    const [draft, setDraft] = useState('');
    return <div><p>{workspace.candidateId} · {workspace.tab}</p><textarea aria-label={`Draft ${workspace.candidateId}`} value={draft} onChange={event => setDraft(event.target.value)} /><button onClick={() => workspace.onTabChange('documents')}>Open documents</button><button onClick={workspace.onMinimize}>Return to list</button></div>;
  },
}));
const candidates = generateDemoDataset(Date.parse('2026-11-07')).candidates.slice(0, 2);
function List() { const location = useLocation(); return <><p data-testid="route">{location.pathname}{location.search}</p><p data-testid="return">{location.state?.candidateReturnTo}</p>{candidates.map(candidate => <CandidateName key={candidate.id} candidateId={candidate.id}>{candidate.first_name}</CandidateName>)}<CandidateWorkspaceLink candidateId={candidates[0].id} tab="timeline" stageId={3} to={`/admin/candidate/${candidates[0].id}`}>Training follow-up</CandidateWorkspaceLink></>; }
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  localStorage.clear(); sessionStorage.clear(); saveCandidates(candidates); auth.user.id = 'admin'; auth.userRole = 'superadmin';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
const render = () => root.render(<MemoryRouter initialEntries={['/admin']}><CandidateQuickViewProvider><List /></CandidateQuickViewProvider></MemoryRouter>);
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === label)!;
describe('candidate multitasking workspace', () => {
  it.each([['superadmin', '/admin'], ['local-agency', '/local-agency'], ['foreign-agency-staff', '/agency']])('opens mobile candidates directly in the %s portal with return context', async (role, base) => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    auth.userRole = role;
    await act(async () => render());
    await act(async () => button(candidates[0].first_name).click());
    expect(container.querySelector('[data-testid="route"]')?.textContent).toBe(`${base}/candidate/${candidates[0].id}?tab=profile`);
    expect(container.querySelector('[data-testid="return"]')?.textContent).toBe('/admin');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[aria-label="Candidate workspace dock"]')).toBeNull();
  });
  it('preserves mobile stage deep links instead of creating a popup', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    await act(async () => render());
    await act(async () => container.querySelector<HTMLAnchorElement>('a')!.click());
    expect(container.querySelector('[data-testid="route"]')?.textContent).toContain('?tab=timeline&stage=3');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('opens profiles without navigating, preserves draft/section through minimize and switches bottom tabs', async () => {
    await act(async () => render());
    await act(async () => button(candidates[0].first_name).click());
    expect(document.body.style.overflow).toBe('clip');
    expect(document.querySelector<HTMLElement>('[role="dialog"]')?.style.resize).toBe('both');
    expect(button('Minimize to list').className).toContain('text-yellow-600');
    expect(container.querySelector('[data-testid="route"]')?.textContent).toBe('/admin');
    const draft = document.querySelector<HTMLTextAreaElement>(`textarea[aria-label="Draft ${candidates[0].id}"]`)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(draft, 'Unsaved candidate update');
      draft.dispatchEvent(new Event('input', { bubbles: true }));
      button('Open documents').click();
    });
    await act(async () => button('Minimize to list').click());
    expect(document.body.style.overflow).not.toBe('clip');
    expect(document.body.style.pointerEvents).not.toBe('none');
    await act(async () => button(candidates[1].first_name).click());
    expect(document.body.style.overflow).toBe('clip');
    expect(document.querySelectorAll('[role="tablist"][aria-label="Open candidate profiles"] [role="tab"]')).toHaveLength(2);
    const tabs = document.querySelectorAll<HTMLButtonElement>('[role="tablist"][aria-label="Open candidate profiles"] [role="tab"]');
    await act(async () => tabs[0].click());
    expect(document.body.style.overflow).toBe('clip');
    const panel = document.getElementById(tabs[0].getAttribute('aria-controls')!)!;
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id);
    await act(async () => tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    await act(async () => tabs[0].click());
    expect(draft.value).toBe('Unsaved candidate update');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(`${candidates[0].id} · documents`);
    expect(container.querySelector('[data-testid="route"]')?.textContent).toBe('/admin');
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Close active candidate tab"]')!.click());
    expect(document.querySelectorAll('[role="tablist"][aria-label="Open candidate profiles"] [role="tab"]')).toHaveLength(1);
  });
  it('deduplicates open candidates and discards profile drafts on account switch', async () => {
    await act(async () => render());
    await act(async () => button(candidates[0].first_name).click());
    await act(async () => button('Minimize to list').click());
    await act(async () => button(candidates[0].first_name).click());
    expect(document.querySelectorAll('[role="tablist"][aria-label="Open candidate profiles"] [role="tab"]')).toHaveLength(1);
    auth.user.id = 'other'; await act(async () => render());
    expect(document.querySelectorAll('[role="tablist"][aria-label="Open candidate profiles"] [role="tab"]')).toHaveLength(0);
    expect(document.querySelector('textarea')).toBeNull();
  });
});
