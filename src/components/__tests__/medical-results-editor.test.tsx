// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MedicalResultsEditor from '../MedicalResultsEditor';
import { generateDemoDataset } from '@/lib/demo-dataset';
import type { CandidateDetail, MedicalResult, MedicalStatus } from '@/lib/types';

const mocks = vi.hoisted(() => ({ update: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { updateMedicalResult: mocks.update } }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
const demo = generateDemoDataset(Date.parse('2026-11-07'));
const candidate: CandidateDetail = { ...demo.candidates[0], gender: 'female', stages: [], medical_results: [], documents: [], chat_messages: [] };
const exam = (examType: string, status: MedicalStatus): MedicalResult => ({ id: examType, candidate_id: candidate.id, exam_type: examType, status, exam_date: '2026-11-06' });
let root: Root, container: HTMLDivElement;
const refetch = vi.fn();
const render = async (detail = candidate) => {
  await act(async () => root.render(<MedicalResultsEditor candidateDetail={detail} refetch={refetch} />));
};
const changeDate = async (examType: string, value: string) => {
  const input = container.querySelector<HTMLInputElement>(`[aria-label="${examType} medical exam"] input[type="date"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const save = async (examType: string) => {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === `Save ${examType}`)!;
  await act(async () => button.click());
};
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.clearAllMocks(); mocks.update.mockResolvedValue(undefined);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('medical compliance workspace', () => {
  it('shows missing results as awaiting records, not completed checks', async () => {
    await render();
    expect(container.textContent).toContain('0 / 3');
    expect(container.textContent).toContain('Keep medical checks moving');
    expect(container.querySelectorAll('[aria-label$="medical exam"]')).toHaveLength(3);
    expect(container.querySelector('[aria-label="Saved medical result totals"]')?.textContent).toContain('Awaiting result3');
    expect(container.textContent).toContain('Not recorded');
    expect(container.textContent).toContain('Training must be completed');
  });
  it('omits pregnancy exams for male candidates, including legacy results', async () => {
    await render({ ...candidate, gender: 'male', medical_results: [exam('HIV', 'Passed'), exam('Final Agency Medical', 'Passed'), exam('Pregnancy', 'Failed')] });
    expect(container.textContent).toContain('2 / 2');
    expect(container.textContent).toContain('Recorded checks complete');
    expect(container.querySelectorAll('[aria-label$="medical exam"]')).toHaveLength(2);
    expect(container.textContent).not.toContain('Pregnancy');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain('Passing these checks alone does not authorize a flight');
  });
  it('keeps a saved failed pregnancy result visibly blocking flight booking', async () => {
    await render({ ...candidate, medical_results: [exam('HIV', 'Passed'), exam('Pregnancy', 'Failed'), exam('Final Agency Medical', 'Passed')] });
    expect(container.textContent).toContain('2 / 3');
    expect(container.textContent).toContain('A result needs your attention');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Flight booking is blocked');
    expect(container.querySelector('[aria-label="Saved medical result totals"]')?.textContent).toContain('Needs review1');
  });
  it('saves the selected exam through the existing API and refreshes the saved summary', async () => {
    await render({ ...candidate, medical_results: [exam('HIV', 'Passed')] });
    await changeDate('HIV', '2026-11-07');
    expect(container.querySelector('[aria-label="HIV medical exam"]')?.textContent).toContain('Unsaved changes');
    expect(container.textContent).toContain('1 / 3');
    await save('HIV');
    expect(mocks.update).toHaveBeenCalledWith(candidate.id, 'HIV', 'Passed', '2026-11-07');
    expect(refetch).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalled();
    await render({ ...candidate, medical_results: [{ ...exam('HIV', 'Passed'), exam_date: '2026-11-07' }] });
    expect(container.querySelector('[aria-label="HIV medical exam"]')?.textContent).not.toContain('Unsaved changes');
    expect(container.textContent).toContain('Recorded exam date:');
  });
  it('retains another exam draft when a saved exam is refreshed and clears it on a candidate change', async () => {
    const detail = { ...candidate, medical_results: [exam('HIV', 'Passed'), exam('Pregnancy', 'Pending')] };
    await render(detail);
    await changeDate('Pregnancy', '2026-11-08');
    await changeDate('HIV', '2026-11-07');
    await save('HIV');
    await render({ ...detail, medical_results: [{ ...exam('HIV', 'Passed'), exam_date: '2026-11-07' }, exam('Pregnancy', 'Pending')] });
    expect(container.querySelector<HTMLInputElement>('[aria-label="Pregnancy medical exam"] input')?.value).toBe('2026-11-08');
    expect(container.querySelector('[aria-label="Pregnancy medical exam"]')?.textContent).toContain('Unsaved changes');
    await render({ ...candidate, id: 'another-candidate' });
    expect(container.querySelector<HTMLInputElement>('[aria-label="Pregnancy medical exam"] input')?.value).toBe('');
  });
  it('shows API errors without claiming a saved result or discarding the draft', async () => {
    mocks.update.mockRejectedValue(new Error('Training must be completed before recording medical results.'));
    await render();
    await changeDate('HIV', '2026-11-07');
    await save('HIV');
    expect(mocks.error).toHaveBeenCalledWith('Training must be completed before recording medical results.');
    expect(mocks.success).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>('[aria-label="HIV medical exam"] input')?.value).toBe('2026-11-07');
  });
});
