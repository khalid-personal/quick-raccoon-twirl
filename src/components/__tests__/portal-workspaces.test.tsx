// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateQuickViewProvider, EntityProfileButton } from '../CandidateQuickViewProvider';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { getConfig, saveCandidates, saveConfig, saveForeignAgencies, saveLocalAgencies, savePayments, saveStaffUsers } from '@/lib/data-store';
import { generateDemoDataset } from '@/lib/demo-dataset';
const auth = vi.hoisted(() => ({ user: { id: 'super', email: 'super@example.test' }, userRole: 'superadmin', viewAs: null, isDemo: true, userLocalAgencyId: null as string | null, userForeignAgencyId: null }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
vi.mock('@/pages/AdminCandidateDetail', () => ({ default: () => <p>Candidate profile</p> }));
let container: HTMLDivElement, root: Root, client: QueryClient;
let mounts = 0;
function ContactForm({ save }: { save: (value: string) => void }) {
  const [draft, setDraft] = useState(() => { mounts++; return ''; });
  return <><input aria-label="Contact draft" value={draft} onChange={e => setDraft(e.target.value)} /><button onClick={() => save(draft)}>Save contact</button></>;
}
function Page() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Edit contact</button><EntityProfileButton kind="local-agency" entityId="local">Open local agency</EntityProfileButton><EntityProfileButton kind="staff-directory" entityId="all">Show all staff</EntityProfileButton><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle><span>Edit contact</span></DialogTitle><DialogDescription>A saved update remains saved; minimize keeps the draft.</DialogDescription><ContactForm save={value => { localStorage.setItem('saved-contact', value); setOpen(false); }} /></DialogContent></Dialog></>;
}
const render = async () => {
  await act(async () => root.render(<MemoryRouter><QueryClientProvider client={client}><CandidateQuickViewProvider><Page /></CandidateQuickViewProvider></QueryClientProvider></MemoryRouter>));
};
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === text)!;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1'); mounts = 0; auth.userRole = 'superadmin'; auth.userLocalAgencyId = null;
  const candidate = { ...generateDemoDataset(Date.parse('2026-11-07')).candidates[0], local_agency_id: 'local', foreign_agency_id: 'foreign' };
  saveCandidates([candidate]); saveLocalAgencies([{ id: 'local', name: 'Local partner', contact_email: 'local@example.test', created_at: '2026-11-07' }]);
  saveForeignAgencies([{ id: 'foreign', name: 'Foreign partner', created_at: '2026-11-07' }]); savePayments([]);
  saveConfig({ ...getConfig(), agencyPartnerships: [{ local_agency_id: 'local', foreign_agency_id: 'foreign', status: 'active', started_at: '2026-11-07' }] });
  saveStaffUsers([{ id: 'worker', email: 'worker@example.test', local_agency_id: 'local', role: 'staff', is_approved: true, created_at: '2026-11-07' }, { id: 'other', email: 'other@example.test', local_agency_id: 'other-local', role: 'staff', is_approved: true, created_at: '2026-11-07' }]);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
describe('organized portal windows', () => {
  it('minimizes an editing popup, opens an agency and restores the same draft before saving', async () => {
    await render();
    await act(async () => button('Edit contact').click());
    const input = document.querySelector<HTMLInputElement>('[aria-label="Contact draft"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Saved after multitasking');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector<HTMLButtonElement>('[aria-label="Minimize window"]')!.click();
    });
    expect(document.body.style.pointerEvents).not.toBe('none');
    expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull();
    await act(async () => button('Open local agency').click()); await flush();
    expect(document.querySelector('[role="tabpanel"][hidden=false]')).toBeNull();
    expect(document.body.textContent).toContain('Local partner');
    expect(document.body.textContent).toContain('Partner network');
    expect(document.body.textContent).toContain('Foreign partner');
    await act(async () => button('Edit contactMinimized').click());
    expect(input.value).toBe('Saved after multitasking'); expect(mounts).toBe(1);
    await act(async () => button('Save contact').click());
    expect(localStorage.getItem('saved-contact')).toBe('Saved after multitasking');
    expect(document.querySelector('input[aria-label="Contact draft"]')).toBeNull();
    expect(document.querySelector('[aria-label="Candidate workspace dock"]')?.textContent).toContain('Local partner');
  });
  it('opens staff directory and a staff profile in separate retained tabs', async () => {
    await render(); await act(async () => button('Show all staff').click()); await flush();
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('worker@example.test') && button.textContent?.includes('Approved'))!.click()); await flush();
    expect(document.querySelectorAll('[aria-label="Open candidate profiles"] [role="tab"]')).toHaveLength(2);
    expect(document.querySelector('[role="dialog"][data-state="open"]')?.textContent).toContain('staff · Approved');
  });
  it('restricts the directory to the viewing local agency and does not offer agency administration', async () => {
    auth.userRole = 'local-agency'; auth.userLocalAgencyId = 'local';
    await render(); await act(async () => button('Show all staff').click()); await flush();
    expect(document.querySelector('[role="dialog"][data-state="open"]')?.textContent).toContain('worker@example.test');
    expect(document.querySelector('[role="dialog"][data-state="open"]')?.textContent).not.toContain('other@example.test');
    expect(button('Open local agency')).toBeUndefined();
  });
});
