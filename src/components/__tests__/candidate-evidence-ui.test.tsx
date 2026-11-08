// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../ui/tooltip';
import CandidateList from '../CandidateList';
import TimelineEditor from '../TimelineEditor';
import PaymentEvidenceOverview from '../PaymentEvidenceOverview';
import AvatarActivity from '../AvatarActivity';
import CandidateStatusSummary from '../CandidateStatusSummary';
import LocalPaymentEvidence from '../LocalPaymentEvidence';
import { getConfig, saveCandidates, saveCandidateStages, saveConfig, saveLocalAgencies, savePayments } from '@/lib/data-store';
import api from '@/lib/api';
import { generateDemoDataset } from '@/lib/demo-dataset';
import { reconcile } from '@/lib/bank-reconciliation';
import type { CandidateDetail, CandidateSummary, Payment } from '@/lib/types';

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'admin', email: 'admin@example.test' }, userRole: 'superadmin' }) }));
const demo = generateDemoDataset(Date.parse('2026-11-07'));
const candidate: CandidateSummary = { ...demo.candidates[0], overall_status: 'In Progress', progress_percent: 25, is_medical_paid: false, paid_stage_ids: [] };
const payment: Payment = { id: 'p', amount: 100, currency: 'ETB', status: 'succeeded', payer_type: 'candidate', payer_foreign_agency_id: '', payee_local_agency_id: 'local', candidate_ids: [candidate.id], provider_reference: 'REF', created_at: '2026-11-07', updated_at: '2026-11-07' };
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); sessionStorage.clear();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('visual evidence and candidate shortcuts', () => {
  it('makes each summary total selectable and toggles the selected total off', async () => {
    const select = vi.fn();
    const candidates = [candidate, { ...candidate, id: 'complete', overall_status: 'Completed' as const }, { ...candidate, id: 'qr', clearance: { local_ready_at: '2026-11-07' } }, { ...candidate, id: 'failed', overall_status: 'Blocked' as const }];
    await act(async () => root.render(<CandidateStatusSummary candidates={candidates} active={null} onSelect={select} />));
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons).toHaveLength(4);
    for (const [index, status] of ['inProgress', 'pendingQr', 'completed', 'failed'].entries()) {
      await act(async () => buttons[index].click());
      expect(select).toHaveBeenLastCalledWith(status);
    }
    await act(async () => root.render(<CandidateStatusSummary candidates={candidates} active="pendingQr" onSelect={select} />));
    const selected = container.querySelector<HTMLButtonElement>('[aria-pressed="true"]')!;
    expect(selected.textContent).toContain('Pending ministry QR1');
    await act(async () => selected.click());
    expect(select).toHaveBeenLastCalledWith(null);
  });
  it('shows missing proof as unknown, not a zero deposit or a match', async () => {
    await act(async () => root.render(<PaymentEvidenceOverview evidence={{ caseId: 'p', payment, source: 'candidate' }} statementName="No statement" />));
    expect(container.textContent).toContain('No matching entry found');
    expect(container.textContent).toContain('Cannot compare');
    expect(container.textContent).not.toContain('Payment and bank-file details match');
    expect(container.querySelector('[aria-label="Payment route"]')).not.toBeNull();
  });
  it('visually distinguishes short deposits, equal-amount reference mismatches and currency mismatches', async () => {
    for (const [amount, reference, currency, title] of [[80, 'REF', 'ETB', 'Uploaded file shows less than the payment record'], [100, 'OTHER', 'ETB', 'The deposit needs a reference check'], [100, 'REF', 'USD', 'Check the currency first']] as const) {
      const match = reconcile([payment], [{ amount, reference, currency, description: 'Bank credit', date: '2026-11-07' }]).matches[0];
      await act(async () => root.render(<PaymentEvidenceOverview evidence={{ caseId: 'p', payment, source: 'candidate', match }} statementName="Test" />));
      expect(container.textContent).toContain(title);
      expect(container.textContent).not.toContain('Payment and bank-file details match');
      if (currency === 'USD') expect(container.textContent).toContain('Cannot compare');
    }
  });
  it('replaces repetitive origin with profile, passport and integrity buttons and a progress bar', async () => {
    await act(async () => root.render(<MemoryRouter><TooltipProvider><CandidateList candidates={[candidate]} basePath="/admin/candidate" sortBy="first_name" direction="asc" onSort={vi.fn()} /></TooltipProvider></MemoryRouter>));
    expect(container.querySelector('button[aria-label="View passport"]')).not.toBeNull();
    expect(container.querySelector(`a[aria-label="Open profile for ${candidate.first_name} ${candidate.last_name}"]`)?.getAttribute('href')).toBe(`/admin/candidate/${candidate.id}`);
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(container.querySelector('thead')?.textContent).not.toContain('Origin');
    expect(container.querySelector('[aria-label^="Candidate record checks:"]')).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="View passport"]')!.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('DEMO / synthetic record');
    expect(document.querySelector('img[src="generated"]')).toBeNull();
  });
  it('keeps candidate integrity flags stable when another duplicate is filtered out', async () => {
    const other = { ...candidate, id: 'other-candidate' };
    saveCandidates([candidate, other]);
    const render = (visible: CandidateSummary[]) => root.render(<MemoryRouter><TooltipProvider><CandidateList candidates={visible} basePath="/admin/candidate" sortBy="first_name" direction="asc" onSort={vi.fn()} /></TooltipProvider></MemoryRouter>);
    await act(async () => render([candidate, other]));
    const before = container.querySelector('[aria-label^="Candidate record checks:"]')!.getAttribute('aria-label');
    await act(async () => render([candidate]));
    expect(container.querySelector('[aria-label^="Candidate record checks:"]')!.getAttribute('aria-label')).toBe(before);
    expect(before).not.toContain('0 warnings');
  });
  it('opens the exact requested stage from a task deep link', async () => {
    const detail: CandidateDetail = { ...candidate, stages: demo.stages.filter(stage => stage.candidate_id === candidate.id), documents: [], medical_results: [], chat_messages: [] };
    await act(async () => root.render(<MemoryRouter initialEntries={[`/admin/candidate/${candidate.id}?tab=timeline&stage=3`]}><TimelineEditor candidateDetail={detail} refetch={vi.fn()} /></MemoryRouter>));
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe(`Training · ${candidate.tracking_code}`);
    const save = vi.spyOn(api, 'updateStageStatus').mockResolvedValue(detail.stages.find(stage => stage.stage_id === 3)!);
    await act(async () => {
      const notes = document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea[id$="-notes"]')!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(notes, 'Follow-up reviewed');
      notes.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(button => button.textContent?.trim() === 'Save Changes')!.click());
    expect(save).toHaveBeenCalled();
    save.mockRestore();
    await act(async () => root.render(<MemoryRouter initialEntries={[`/admin/candidate/${candidate.id}?tab=timeline&stage=3`]}><TimelineEditor candidateDetail={{ ...detail, stages: [...detail.stages] }} refetch={vi.fn()} /></MemoryRouter>));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('labels simulated activity clearly instead of claiming a real login', async () => {
    sessionStorage.setItem('dawm_demo_session', '1');
    await act(async () => root.render(<AvatarActivity id="demo-cand-0001" kind="candidate" />));
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toMatch(/^Demo simulated: (Online|Offline)$/);
    sessionStorage.removeItem('dawm_demo_session');
    await act(async () => root.render(<AvatarActivity id="real-candidate" kind="candidate" />));
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Activity unknown');
  });
  it('opens local agency fee review with visual money, action and investigation tabs', async () => {
    const local = demo.localAgencies[0];
    const own = { ...candidate, local_agency_id: local.id };
    saveCandidates([own]); saveLocalAgencies([local]);
    saveConfig({ ...getConfig(), stageFees: { 1: 100 } });
    savePayments([{ ...payment, amount: 80, stage_id: 1, payee_local_agency_id: local.id }]);
    saveCandidateStages([1, 3, 2, 4].map(id => ({ id: `s${id}`, candidate_id: own.id, stage_id: id, status: id === 1 ? 'In Progress' : 'Pending', updated_at: '2026-11-07' })));
    await act(async () => root.render(<MemoryRouter><TooltipProvider><LocalPaymentEvidence localAgencyId={local.id} /></TooltipProvider></MemoryRouter>));
    expect(container.textContent).toContain('Stage fee not fully covered');
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent?.startsWith('View full payment record'))!.click());
    const compiled = document.querySelector('[role="dialog"]')!;
    expect(compiled.querySelectorAll('section')).toHaveLength(4);
    expect(compiled.textContent).toContain('0/4 stages complete');
    const open = [...compiled.querySelectorAll('button')].find(button => button.textContent === 'Match bank proof')!;
    await act(async () => open.click());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('80 ETB');
    expect(dialog.textContent).toContain('Cannot compare');
    expect(dialog.querySelectorAll('[role="tab"]')).toHaveLength(3);
    await act(async () => [...dialog.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent?.startsWith('Next action'))!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
    await act(async () => [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Record a proof request'))!.click());
    expect(dialog.querySelector('[data-field="case-start"]')).not.toBeNull();
    expect(dialog.querySelector('label[for$="-case-due"]')?.textContent).toContain('(required)');
  });
});
