// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { generateDemoDataset } from '@/lib/demo-dataset';
import { saveCandidates, savePayments, saveCandidateStages, saveDocuments, saveApprovalLogs, saveMedicalResults, saveIntegrityOverrides } from '@/lib/data-store';
vi.mock('../FindingInvestigation', () => ({ default: () => <button>Review issue</button> }));
import IntegrityCard from '../IntegrityCard';
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1');
  const candidates = generateDemoDataset(Date.parse('2026-11-07')).candidates.slice(0, 3).map((candidate, index) => ({ ...candidate, local_agency_id: index === 2 ? 'other' : 'own', passport_number: index === 2 ? 'UNIQUE' : 'SHARED', elmis: { status: 'mismatch' as const, mode: 'sandbox' as const, checked_at: '2026-11-07', mismatches: ['DEMO: pretend registration details differ'] } }));
  saveCandidates(candidates); savePayments([]); saveCandidateStages([]); saveDocuments([]); saveApprovalLogs([]); saveMedicalResults([]); saveIntegrityOverrides([]);
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it('provides scoped severity lenses and separates warning signals from unique candidate records', async () => {
  await act(async () => root.render(<MemoryRouter><IntegrityCard localAgencyId="own" /></MemoryRouter>));
  expect(container.textContent).toContain('2 candidate records');
  expect(container.textContent).toContain('warning signals · not unique records');
  expect(container.querySelector('a')?.getAttribute('href')).toBe('/admin/integrity?agency=own');
  const high = container.querySelector<HTMLButtonElement>('[data-severity="high"]')!;
  await act(async () => high.click());
  expect(high.getAttribute('aria-pressed')).toBe('true');
  expect(container.querySelectorAll('article')).toHaveLength(2);
  expect(Array.from(container.querySelectorAll('article')).every(article => article.textContent?.includes('high'))).toBe(true);
  expect(container.textContent).not.toContain('DEMO');
  expect(container.textContent).toContain('fictional registration');
  await act(async () => high.click());
  expect(high.getAttribute('aria-pressed')).toBe('false');
});
it('does not present an empty scope as fully verified or cleared', async () => {
  await act(async () => root.render(<MemoryRouter><IntegrityCard localAgencyId="missing" /></MemoryRouter>));
  expect(container.textContent).toContain('Awaiting records');
  expect(container.textContent).toContain('A score cannot be inferred');
  expect(container.querySelector('.record-check-dial')?.textContent).toContain('—');
  expect(container.querySelector<HTMLElement>('.record-check-dial')?.style.background).toContain('rgba(255, 255, 255,');
});
