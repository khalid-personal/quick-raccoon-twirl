// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import MinistryClearanceConsole from '../MinistryClearanceConsole';
import JourneyControlMap from '../JourneyControlMap';
import AdminProfileApprovals from '@/pages/AdminProfileApprovals';
import Signup from '@/pages/Signup';
import { generateDemoDataset } from '@/lib/demo-dataset';
import { saveCandidates, saveCandidateStages } from '@/lib/data-store';
import type { UserRole } from '@/lib/types';
import type { JourneyControlEvent } from '@/lib/journey-control';

const auth = vi.hoisted(() => ({
  userRole: 'staff' as UserRole, user: { id: 'operator' }, viewAs: null,
  userLocalAgencyId: null as string | null, userForeignAgencyId: null as string | null,
  isLoading: false, isAuthenticated: false, signup: vi.fn().mockResolvedValue({ error: null }),
}));
const operations = vi.hoisted(() => ({
  getUsersWithPendingProfileUpdates: vi.fn(), approveStaffProfileUpdate: vi.fn().mockResolvedValue(undefined),
  rejectStaffProfileUpdate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
vi.mock('@/lib/auth', () => ({ useAuth: () => auth }));
vi.mock('@/lib/api', () => ({ default: operations }));
vi.mock('../CandidateQuickViewProvider', () => ({ useCandidateWorkspace: () => vi.fn() }));
vi.mock('../AnimatedNumber', () => ({ default: ({ value }: { value: number }) => <span>{value}</span> }));
vi.mock('../InteractiveMap', () => ({
  default: ({ children }: { children: (viewport: { u: number; w: number }) => ReactNode }) => <svg>{children({ u: 1, w: 100 })}</svg>,
  MapMarker: ({ children }: { children: ReactNode }) => <g>{children}</g>,
}));
const demo = generateDemoDataset(Date.parse('2026-11-07'));
let root: Root, container: HTMLDivElement, client: QueryClient;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks();
  auth.userRole = 'staff'; auth.userLocalAgencyId = null; auth.userForeignAgencyId = null;
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
const render = async (node: ReactNode) => act(async () => {
  root.render(<QueryClientProvider client={client}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);
  await new Promise(resolve => setTimeout(resolve, 30));
});
const button = (label: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.includes(label))!;
const fill = (selector: string, value: string) => {
  const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
it('renders location clusters without a selected event and keeps clustered counts accurate', async () => {
  const event: JourneyControlEvent = { id: 'one', candidateId: 'person', kind: 'medical', title: 'Clinic', status: 'Passed', point: { lat: 8.54, lon: 39.27, label: 'Adama clinic' }, precision: 'exact', source: 'Ministry', stageId: 2, tab: 'timeline', current: true };
  await render(<JourneyControlMap events={[event, { ...event, id: 'two', candidateId: 'person-2' }]} running={false} onSelect={vi.fn()} />);
  expect(container.textContent).toContain('2 candidates');
  expect(container.querySelectorAll('g[role="button"]')).toHaveLength(1);
});
it('scopes clearance records to direct and stage-assigned staff candidates', async () => {
  const people = demo.candidates.slice(0, 3).map((person, index) => ({ ...person, assigned_staff_id: index === 0 ? 'operator' : undefined }));
  saveCandidates(people);
  saveCandidateStages([{ id: 'stage', candidate_id: people[1].id, stage_id: 2, status: 'Passed', assigned_staff_id: 'operator', updated_at: '2026-01-01' }]);
  await render(<MinistryClearanceConsole />);
  expect(container.textContent).toContain(people[0].tracking_code);
  expect(container.textContent).toContain(people[1].tracking_code);
  expect(container.textContent).not.toContain(people[2].tracking_code);
  await act(async () => fill('input', people[1].tracking_code));
  expect(container.textContent).not.toContain(people[0].tracking_code);
  expect(container.textContent).toContain(people[1].tracking_code);
  expect(container.textContent).not.toContain('Verify visa');
});
it('filters source references without exposing candidates outside the local agency', async () => {
  auth.userRole = 'local-agency'; auth.userLocalAgencyId = 'local';
  const people = demo.candidates.slice(0, 2).map((person, index) => ({ ...person, local_agency_id: index ? 'other' : 'local', clearance: { labour_ministry: { status: 'cleared' as const, certificate_no: 'M1', mode: 'live' as const } } }));
  saveCandidates(people);
  await render(<MinistryClearanceConsole />);
  expect(container.textContent).not.toContain(people[1].tracking_code);
  await act(async () => button('QR reference issued').click());
  expect(container.textContent).toContain(people[0].tracking_code);
  await act(async () => button('Awaiting ministry').click());
  expect(container.textContent).toContain('No candidates match this view');
});
it('uses a themed approval dialog with a required rejection reason, not a native prompt', async () => {
  auth.userRole = 'superadmin';
  operations.getUsersWithPendingProfileUpdates.mockResolvedValue([{ id: 'staff', email: 'staff@example.test', profile_edit_data: { phone_number: '123' } }]);
  await render(<AdminProfileApprovals />);
  await render(<AdminProfileApprovals />);
  await act(async () => button('Reject').click());
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  const submit = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(item => item.textContent === 'Reject request')!;
  expect(submit.disabled).toBe(true);
  await act(async () => {
    const field = document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'Please review the contact');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => submit.click());
  expect(operations.rejectStaffProfileUpdate).toHaveBeenCalledWith('operator', 'staff', 'Please review the contact');
});
it('registers with only email and PIN while retaining account approval messaging', async () => {
  await render(<Signup />);
  expect(container.textContent).not.toContain('Authorization Code');
  expect(container.textContent).toContain('Approval is required');
  await act(async () => { fill('#email', 'new@example.test'); fill('#pin', '123456'); });
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(auth.signup).toHaveBeenCalledWith('new@example.test', '123456');
});
