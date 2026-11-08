// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CandidateStaffingBoard from '../CandidateStaffingBoard';
import { generateDemoDataset } from '@/lib/demo-dataset';
import type { CandidateSummary } from '@/lib/types';

const candidates: CandidateSummary[] = generateDemoDataset(new Date('2026-11-07').getTime()).candidates.slice(0, 3).map(candidate => ({
  ...candidate, overall_status: 'In Progress', progress_percent: 0, is_medical_paid: false, paid_stage_ids: [],
}));
let container: HTMLDivElement;
let root: Root;
const open = vi.fn();
const render = (visible = candidates, agencyId = 'foreign-1') => root.render(<CandidateStaffingBoard key={agencyId} agencyId={agencyId} candidates={visible} scopeCandidates={candidates} filters={{ workType: '', language: '' }} onFiltersChange={vi.fn()} onOpen={open} />);
const button = (text: string) => [...container.querySelectorAll('button')].find(element => element.textContent?.includes(text))!;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('dawm_staffing_draft:foreign-1', JSON.stringify({ target: 2, candidateIds: ['outside-agency'], savedAt: '2026-11-07' }));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  open.mockClear();
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('worker selection board interactions', () => {
  it('fills exactly the requested slots with portraits and retains picks across filters', async () => {
    await act(async () => render());
    expect(container.querySelectorAll('article')).toHaveLength(3);
    await act(async () => button('Fill available slots').click());
    expect(container.textContent).toContain('2 selected / 2 needed');
    expect(button('Fill available slots').disabled).toBe(true);
    await act(async () => render([candidates[2]]));
    expect(container.querySelectorAll('article')).toHaveLength(1);
    expect(container.textContent).toContain('2 selected / 2 needed');
    await act(async () => button('Save draft').click());
    const saved = JSON.parse(localStorage.getItem('dawm_staffing_draft:foreign-1')!);
    expect(saved.candidateIds).toEqual(candidates.slice(0, 2).map(candidate => candidate.id));
    expect(saved.candidateIds).not.toContain('outside-agency');
  });
  it('opens profiles, allows removal, and does not share drafts across agencies', async () => {
    await act(async () => render());
    await act(async () => button('Profile').click());
    expect(open).toHaveBeenCalledWith(candidates[0]);
    await act(async () => button('Fill available slots').click());
    const remove = container.querySelector<HTMLButtonElement>(`button[aria-label="Remove ${candidates[0].first_name} ${candidates[0].last_name} from shortlist"]`)!;
    await act(async () => remove.click());
    expect(container.textContent).toContain('1 selected / 2 needed');
    await act(async () => render(candidates, 'foreign-2'));
    expect(container.textContent).toContain('0 selected / 10 needed');
  });
});
