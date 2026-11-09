// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MedicalResultsEditor from '../MedicalResultsEditor';
import { generateDemoDataset } from '@/lib/demo-dataset';
import type { CandidateDetail } from '@/lib/types';

const demo = generateDemoDataset(Date.parse('2026-11-07'));
const candidate: CandidateDetail = { ...demo.candidates[0], gender: 'female', stages: [], medical_results: [], documents: [], chat_messages: [] };
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = async (detail = candidate) => act(async () => root.render(<MedicalResultsEditor candidateDetail={detail} refetch={vi.fn()} />));
it('shows awaiting-source states without any result, date or location editor', async () => {
  await render();
  expect(container.textContent).toContain('Pulled from the ministry');
  expect(container.textContent).toContain('Awaiting ministry location');
  expect(container.querySelectorAll('input,select,textarea,[role="combobox"]')).toHaveLength(0);
  expect(container.textContent).not.toContain('Save');
});
it('shows ministry result dates and medical facilities and updates when source props refresh', async () => {
  const record = { id: 'medical', candidate_id: candidate.id, exam_type: 'HIV', status: 'Passed' as const, exam_date: '2026-11-06', location: { name: 'Assessment clinic', city: 'Adama' } };
  await render({ ...candidate, medical_results: [record] });
  expect(container.textContent).toContain('Assessment clinic · Adama');
  expect(container.textContent).toContain('Passed');
  await render({ ...candidate, medical_results: [{ ...record, status: 'Failed' }] });
  expect(container.textContent).toContain('Failed');
});
it('omits pregnancy results for male candidates without deleting source evidence', async () => {
  await render({ ...candidate, gender: 'male' });
  expect(container.textContent).not.toContain('Pregnancy');
  expect(container.querySelectorAll('article')).toHaveLength(2);
});
