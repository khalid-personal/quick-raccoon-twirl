// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { PageMemoryProvider, usePageMemory, useReturnToPrevious } from '@/hooks/use-page-memory';
const auth = vi.hoisted(() => ({ user: { id: 'admin' }, userRole: 'superadmin', isDemo: true, viewAs: null }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
function List() {
  const [section, setSection] = usePageMemory('section', 'command');
  return <><button onClick={() => setSection('finance')}>{section}</button><Link to="/admin/candidate/1">Profile</Link></>;
}
function Profile() { const goBack = useReturnToPrevious('/admin'); return <button onClick={goBack}>Back</button>; }
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  auth.user.id = 'admin';
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 2400, configurable: true });
  vi.spyOn(window, 'scrollTo').mockImplementation((_x, y) => { Object.defineProperty(window, 'scrollY', { value: y, configurable: true }); });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
const render = () => root.render(<MemoryRouter initialEntries={['/admin']}><PageMemoryProvider><Routes><Route path="/admin" element={<List />} /><Route path="/admin/candidate/1" element={<Profile />} /></Routes></PageMemoryProvider></MemoryRouter>);
describe('portal navigation memory', () => {
  it('restores the selected section and scroll after profile → back', async () => {
    await act(async () => render());
    await act(async () => container.querySelector('button')!.click());
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true }); window.dispatchEvent(new Event('scroll'));
    await act(async () => container.querySelector('a')!.click());
    expect(window.scrollY).toBe(0);
    await act(async () => container.querySelector('button')!.click());
    expect(container.querySelector('button')!.textContent).toBe('finance');
    expect(window.scrollY).toBe(640);
  });
  it('does not share remembered controls with another account', async () => {
    await act(async () => render());
    await act(async () => container.querySelector('button')!.click());
    auth.user.id = 'other-admin'; await act(async () => render());
    expect(container.querySelector('button')!.textContent).toBe('command');
  });
});
