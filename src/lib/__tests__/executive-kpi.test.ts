// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { ALL_STAGES, type ChatMessage } from '../types';
import { generateDemoDataset } from '../demo-dataset';
import { executiveKpiRows, selectExecutiveKpiRows } from '../executive-kpi';
import { getExecutiveMetrics } from '../api/executive-metrics';
import { getConfig, saveConfig, saveCandidates, saveCandidateStages, saveChatMessages, saveLocalAgencies } from '../data-store';

afterEach(() => vi.restoreAllMocks());
it('matches summary totals and averages, groups unread candidate messages, and excludes future intake', async () => {
  localStorage.clear(); sessionStorage.clear();
  const now = Date.parse('2026-11-09T12:00:00Z'), day = 86_400_000;
  vi.spyOn(Date, 'now').mockReturnValue(now);
  const data = generateDemoDataset(now);
  const candidates = data.candidates.slice(0, 4).map((candidate, index) => ({ ...candidate, local_agency_id: 'own',
    created_at: new Date(now - [120, 60, 0, -1][index] * day).toISOString() }));
  const stages = candidates.slice(0, 2).flatMap((candidate, index) => ALL_STAGES.map(stage => ({
    id: `${candidate.id}-${stage.id}`, candidate_id: candidate.id, stage_id: stage.id, status: 'Completed' as const,
    date: new Date(Date.parse(candidate.created_at) + [90, 30][index] * day).toISOString(),
    created_at: candidate.created_at, updated_at: candidate.created_at,
  })));
  const messages: ChatMessage[] = [
    { id: 'one', candidate_id: candidates[2].id, sender: 'candidate', sender_name: 'Candidate', message: 'First unread', timestamp: '2026-11-08', is_read_by_admin: false, is_read_by_candidate: true },
    { id: 'two', candidate_id: candidates[2].id, sender: 'candidate', sender_name: 'Candidate', message: 'Latest unread', timestamp: '2026-11-09', is_read_by_admin: false, is_read_by_candidate: true },
    { id: 'staff', candidate_id: candidates[2].id, sender: 'staff', sender_name: 'Staff', message: 'Reply', timestamp: '2026-11-09', is_read_by_admin: false, is_read_by_candidate: false },
    { id: 'read', candidate_id: candidates[0].id, sender: 'candidate', sender_name: 'Candidate', message: 'Read', timestamp: '2026-11-09', is_read_by_admin: true, is_read_by_candidate: true },
  ];
  saveLocalAgencies([{ id: 'own', name: 'Own agency', created_at: '2026-01-01' }]);
  saveConfig({ ...getConfig(), stageFees: {}, stageFeesInitialized: true });
  saveCandidates(candidates); saveCandidateStages(stages); saveChatMessages(messages);
  const rows = executiveKpiRows(candidates, stages, messages, now);
  const metrics = await getExecutiveMetrics(undefined, undefined, 'own');
  expect(selectExecutiveKpiRows(rows, 'candidates')).toHaveLength(metrics.totals.candidates);
  const deployed = selectExecutiveKpiRows(rows, 'departure');
  expect(deployed).toHaveLength(metrics.totals.deployed);
  expect(Math.round(deployed.reduce((sum, row) => sum + row.departureDays!, 0) / deployed.length)).toBe(metrics.totals.avgDaysToDeploy);
  const waiting = selectExecutiveKpiRows(rows, 'waiting');
  expect(waiting).toHaveLength(metrics.totals.active);
  expect(Math.round(waiting.reduce((sum, row) => sum + row.registrationAge, 0) / waiting.length)).toBe(metrics.totals.avgDaysActive);
  const unread = selectExecutiveKpiRows(rows, 'messages');
  expect(unread).toHaveLength(1);
  expect(unread[0]).toMatchObject({ unread: 2, latestUnread: { id: 'two' } });
  expect(unread.reduce((sum, row) => sum + row.unread, 0)).toBe(metrics.totals.unreadMessages);
  expect(metrics.totals.newLast30).toBe(1);
  expect(candidates[0].created_at).toBe(rows[0].candidate.created_at);
});
