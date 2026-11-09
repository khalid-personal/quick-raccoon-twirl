// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ALL_STAGES } from '@/lib/types';
import { generateDemoDataset } from '@/lib/demo-dataset';
import { getConfig, saveConfig, getChatMessages, saveCandidates, saveCandidateStages, saveChatMessages, saveLocalAgencies } from '@/lib/data-store';
import ExecutiveKpiExplorer from '../ExecutiveKpiExplorer';
import type { ExecutiveKpi } from '@/lib/executive-kpi';

const now = Date.parse('2026-11-09T12:00:00Z'), day = 86_400_000;
const candidates = generateDemoDataset(now).candidates.slice(0, 9).map((candidate, index) => ({ ...candidate,
  first_name: `Person${index}`, local_agency_id: index === 8 ? 'other' : 'own', created_at: new Date(now - [10, 30, 31, 60, 90, 100, 120, 150, 40][index] * day).toISOString() }));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  saveConfig({ ...getConfig(), stageFees: {}, stageFeesInitialized: true });
  saveCandidates(candidates);
  saveLocalAgencies([{ id: 'own', name: 'Own agency', created_at: '2026-01-01' }]);
  saveCandidateStages(candidates.slice(0, 2).flatMap((candidate, index) => ALL_STAGES.map(stage => ({
    id: `${candidate.id}-${stage.id}`, candidate_id: candidate.id, stage_id: stage.id, status: 'Completed' as const,
    date: new Date(now - [5, 10][index] * day).toISOString(), created_at: candidate.created_at, updated_at: candidate.created_at,
  }))));
  saveChatMessages([{ id: 'unread', candidate_id: candidates[2].id, sender: 'candidate', sender_name: 'Candidate',
    message: 'Please check my documents', timestamp: new Date(now).toISOString(), is_read_by_admin: false, is_read_by_candidate: true },
    { id: 'outside', candidate_id: candidates[8].id, sender: 'candidate', sender_name: 'Other', message: 'Other agency private text',
      timestamp: new Date(now).toISOString(), is_read_by_admin: false, is_read_by_candidate: true }]);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = async (metric: ExecutiveKpi, localAgencyId = 'own') => act(async () => root.render(
  <MemoryRouter><ExecutiveKpiExplorer key={`${metric}-${localAgencyId}`} metric={metric} localAgencyId={localAgencyId} candidateBasePath="/local-agency/candidate" generatedAt={new Date(now).toISOString()} onClose={vi.fn()} /></MemoryRouter>));
const click = async (text: string) => {
  const button = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(button => button.textContent?.includes(text))!;
  expect(button).toBeTruthy(); await act(async () => button.click());
};
it('pages actual scoped candidates and supports exact registration-window lenses', async () => {
  await render('candidates');
  expect(document.querySelectorAll('article')).toHaveLength(6);
  expect(document.body.textContent).toContain('8 matching candidates');
  await click('Next candidates');
  expect(document.querySelectorAll('article')).toHaveLength(2);
  await click('New · last 30 days');
  expect(document.querySelectorAll('article')).toHaveLength(2);
  await click('Previous 30 days');
  expect(document.querySelectorAll('article')).toHaveLength(2);
  expect(document.body.textContent).not.toContain('Person8');
});
it('shows zero-day-capable duration averages and filters longest waits with follow-up links', async () => {
  await render('departure');
  expect(document.body.textContent).toContain('13 days');
  expect(document.querySelectorAll('article')).toHaveLength(2);
  await render('waiting');
  await click('90+ days');
  expect(document.querySelectorAll('article')).toHaveLength(4);
  expect(document.querySelector('article h3')?.textContent).toBe(`Person7 ${candidates[7].last_name}`);
  const link = document.querySelector<HTMLAnchorElement>('article a')!;
  expect(link.textContent).toContain('Open next follow-up');
  expect(link.getAttribute('href')).toBe(`/local-agency/candidate/${candidates[7].id}`);
});
it('reveals only unread candidate conversations in scope without marking messages read', async () => {
  const before = getChatMessages();
  await render('messages');
  expect(document.querySelectorAll('article')).toHaveLength(1);
  expect(document.body.textContent).toContain('Please check my documents');
  expect(document.body.textContent).not.toContain('Other agency private text');
  expect(document.querySelector('article a')?.textContent).toContain('Open conversation');
  expect(getChatMessages()).toEqual(before);
  await act(async () => { saveChatMessages([]); window.dispatchEvent(new Event('supabase-data-changed')); });
  expect(document.body.textContent).toContain('No unread candidate messages');
});
it('shows an unknown agency as empty rather than returning the whole roster', async () => {
  await render('candidates', 'unknown');
  expect(document.querySelectorAll('article')).toHaveLength(0);
  expect(document.body.textContent).toContain('No candidates match this view');
});
