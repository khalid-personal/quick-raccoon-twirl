// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DemoScenarioBar from '../DemoScenarioBar';
import CandidateChatLauncher from '../CandidateChatLauncher';
import { generateDemoDataset } from '@/lib/demo-dataset';

const state = vi.hoisted(() => ({ auth: { user: { id: 'super' }, userRole: 'superadmin', actualRole: 'superadmin', isDemo: true, isAuthenticated: true, userLocalAgencyId: null as string | null, userForeignAgencyId: null }, demo: true }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => state.auth }));
vi.mock('@/lib/demo-mode', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/demo-mode')>(), isDemoMode: () => state.demo }));
vi.mock('../IntegrityDemoScenarios', () => ({ default: () => <div>Protected scenario editor</div> }));
vi.mock('../AdminChatViewer', () => ({ default: () => <div>Existing conversation composer</div> }));
vi.mock('../CandidateChat', () => ({ default: () => <div>Candidate conversation composer</div> }));
vi.mock('@/lib/api/chat-launcher', () => ({ getCandidateChatInbox: vi.fn() }));
vi.mock('@/lib/api/candidate-crud', () => ({ getCandidateDetail: vi.fn() }));
import { getCandidateChatInbox } from '@/lib/api/chat-launcher';
import { getCandidateDetail } from '@/lib/api/candidate-crud';

let root: Root, container: HTMLDivElement, client: QueryClient;
beforeEach(() => {
  Object.assign(state.auth, { userRole: 'superadmin', actualRole: 'superadmin', isDemo: true, isAuthenticated: true, userLocalAgencyId: null }); state.demo = true;
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const candidate = generateDemoDataset(Date.parse('2026-11-08')).candidates[0];
  vi.mocked(getCandidateChatInbox).mockResolvedValue({ candidates: [candidate], threads: [], unread: 0 });
  vi.mocked(getCandidateDetail).mockResolvedValue({ ...candidate, stages: [], medical_results: [], documents: [], chat_messages: [] });
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
const render = async () => {
  await act(async () => root.render(<QueryClientProvider client={client}><DemoScenarioBar /><CandidateChatLauncher /></QueryClientProvider>));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
};
const click = async (label: string) => {
  const button = Array.from(container.querySelectorAll('button')).find(button => button.getAttribute('aria-label') === label || button.textContent?.includes(label));
  expect(button).toBeTruthy();
  await act(async () => button!.click());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
};
it('shows top scenarios only to an actual demo superadmin, including View As', async () => {
  state.auth.userRole = 'local-agency';
  await render(); await click('Switch scenario');
  expect(container.textContent).toContain('Protected scenario editor');
  state.demo = false; await render();
  expect(container.textContent).not.toContain('Switch scenario');
  state.demo = true; state.auth.actualRole = 'local-agency'; await render();
  expect(container.textContent).not.toContain('Switch scenario');
});
it('opens new chat and the existing composer, then resets on agency switch', async () => {
  await render(); await click('Open candidate chats'); await click('New chat');
  expect(container.querySelector('input[aria-label="Search candidates for chat"]')).toBeTruthy();
  const candidate = generateDemoDataset(Date.parse('2026-11-08')).candidates[0];
  await click(candidate.first_name);
  expect(container.textContent).toContain('Existing conversation composer');
  await click('Minimize chats');
  expect(document.body.style.overflow).not.toBe('hidden');
  await click('Open candidate chats');
  expect(container.textContent).toContain('Existing conversation composer');
  state.auth.userLocalAgencyId = 'different-agency'; await render();
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});
it('locks while chat or scenario is visible, provides resize controls, and releases on close or unmount', async () => {
  await render(); await click('Open candidate chats'); await click('Switch scenario');
  const windows = [...container.querySelectorAll<HTMLElement>('[role="dialog"]')];
  expect(windows).toHaveLength(2);
  windows.forEach(window => {
    expect(window.style.resize).toBe('both');
    expect(window.style.overflow).toBe('auto');
    expect(window.querySelector('[aria-label="Resize window"]')).toBeTruthy();
  });
  expect(container.querySelector('[aria-label="Close chats"]')?.className).toContain('text-red-600');
  expect(container.querySelector('[aria-label="Close scenario menu"]')?.className).toContain('text-red-600');
  expect(document.body.style.overflow).toBe('hidden');
  await click('Minimize chats');
  expect(document.body.style.overflow).toBe('hidden');
  await click('Close scenario menu');
  expect(document.body.style.overflow).not.toBe('hidden');
  await click('Open candidate chats');
  await act(async () => root.render(null));
  expect(document.body.style.overflow).not.toBe('hidden');
});
it('hides chat for read-only roles and shows loading failures explicitly', async () => {
  state.auth.userRole = 'auditor'; await render();
  expect(container.querySelector('[data-tour="chat-launcher"]')).toBeNull();
  state.auth.userRole = 'local-agency';
  vi.mocked(getCandidateChatInbox).mockRejectedValue(new Error('Account unavailable'));
  await render(); await click('Open candidate chats');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not load candidate chats');
});
