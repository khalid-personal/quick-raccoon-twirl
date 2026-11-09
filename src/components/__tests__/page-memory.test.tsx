// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { PageMemoryProvider, usePageMemory, useReturnToPrevious } from '@/hooks/use-page-memory';
const auth = vi.hoisted(() => ({ user: { id: 'admin' }, userRole: 'superadmin', isDemo: true, viewAs: null }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
function List() {
  const navigate = useNavigate();
  const [section, setSection] = usePageMemory('section', 'command');
  return <><button onClick={() => setSection('finance')}>{section}</button><Link to="/admin/candidate/1">Profile</Link>
    <button aria-label="Tour section" onClick={() => navigate('/admin?section=finance', { state: { walkthroughScrollY: window.scrollY } })}>Tour section</button>
    <button aria-label="Tour profile" onClick={() => navigate('/admin/candidate/1?tab=payments', { state: { walkthroughScrollY: window.scrollY } })}>Tour profile</button></>;
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
  it('preserves tour scroll across dashboard sections and profile routes without resetting to zero', async () => {
    await act(async () => render());
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    vi.mocked(window.scrollTo).mockClear();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Tour section"]')!.click());
    expect(window.scrollY).toBe(640);
    expect(window.scrollTo).not.toHaveBeenCalledWith(0, 0);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Tour profile"]')!.click());
    expect(window.scrollY).toBe(640);
    expect(window.scrollTo).not.toHaveBeenCalledWith(0, 0);
  });
  it('restores the latest saved position on Back rather than an old tour navigation position', async () => {
    await act(async () => render());
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Tour section"]')!.click());
    Object.defineProperty(window, 'scrollY', { value: 720, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Tour profile"]')!.click());
    await act(async () => container.querySelector('button')!.click());
    expect(window.scrollY).toBe(720);
  });
});
