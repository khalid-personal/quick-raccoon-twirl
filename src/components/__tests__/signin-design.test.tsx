// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AuthPage from '@/pages/AuthPage';
import Signup from '@/pages/Signup';
import AuthPasswordInput from '@/components/AuthPasswordInput';

const auth = vi.hoisted(() => ({ isAuthenticated: false, isLoading: false, userRole: 'staff', candidateTrackingCode: null,
  login: vi.fn(), signup: vi.fn(), loginAsDevelopmentUser: vi.fn() }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
vi.mock('@/lib/auth', () => ({ useAuth: () => auth }));
vi.mock('@/components/LandingExperience', () => ({ CursorGlow: () => null, WorkflowIllustration: () => <p>Illustrative connectivity</p> }));
vi.mock('@/components/ThemeToggle', () => ({ default: () => <button>Theme</button> }));
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  auth.isAuthenticated = false; auth.isLoading = false; auth.userRole = 'staff';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = async (path = '/login') => act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/login" element={<AuthPage />} /><Route path="/signup" element={<Signup />} /><Route path="/viewer" element={<p>Viewer workspace</p>} /><Route path="/auditor" element={<p>Auditor workspace</p>} /></Routes></MemoryRouter>));
it('aligns both sign-in modes in the shared themed card and provides accessible PIN reveal controls', async () => {
  await render();
  expect(container.querySelector('.dawm-auth')).not.toBeNull();
  expect(container.querySelectorAll('.auth-login-tab')).toHaveLength(2);
  expect(container.querySelector('.auth-role-guide')?.textContent).toContain('approved email and PIN');
  expect(container.querySelector<HTMLDetailsElement>('.auth-dev-disclosure')?.open).toBe(false);
  expect(container.querySelector('#staff-pin')?.getAttribute('type')).toBe('password');
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show PIN"]')!.click());
  expect(container.querySelector('#staff-pin')?.getAttribute('type')).toBe('text');
  await act(async () => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent?.includes('Candidate Login'))!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
  expect(container.querySelector('#candidate-pin')?.getAttribute('type')).toBe('password');
  expect(container.querySelector('#identifier')?.getAttribute('autocomplete')).toBe('username');
  expect(container.textContent).toContain('Sign in to your journey');
  expect(container.querySelector('.auth-role-guide')?.textContent).toContain('tracking code and agency-provided PIN');
  expect(container.querySelector('.auth-dev-tools')).not.toBeNull();
  expect(container.querySelector('.auth-demo-card .landing-workflow')).toBeNull();
});
it('honors the candidate sign-in URL and sends supported review roles to their own workspace', async () => {
  await render('/login?tab=candidate');
  expect(container.querySelector('#candidate-pin')).not.toBeNull();
  await act(async () => root.unmount()); root = createRoot(container);
  auth.isAuthenticated = true; auth.userRole = 'auditor';
  await render('/login');
  expect(container.textContent).toBe('Auditor workspace');
});
it('carries the access palette and secure new-PIN autocomplete into staff registration', async () => {
  await render('/signup');
  expect(container.querySelector('.dawm-auth .auth-access-card')).not.toBeNull();
  expect(container.querySelector('#pin')?.getAttribute('autocomplete')).toBe('new-password');
  expect(container.querySelector('#pin')?.getAttribute('minlength')).toBe('6');
  expect(container.textContent).toContain('Approval is required');
});
it('preserves the entered PIN while revealing it and disables both controls during submission', async () => {
  await act(async () => root.render(<AuthPasswordInput value="123456" readOnly />));
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
  expect(container.querySelector('input')?.value).toBe('123456');
  expect(container.querySelector('input')?.type).toBe('text');
  await act(async () => root.render(<AuthPasswordInput value="123456" readOnly disabled />));
  expect(container.querySelector('input')?.disabled).toBe(true);
  expect(container.querySelector('button')?.disabled).toBe(true);
});
