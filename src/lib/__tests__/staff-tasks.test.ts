import { describe, expect, it } from 'vitest';
import type { Candidate, CandidateStage, StaffUser } from '../types';
import { assignUnassignedStageTasks, getActiveStageTasks, rebalanceStageTasks } from '../staff-tasks';

const candidate = (id: string): Candidate => ({
  id,
  first_name: 'QA',
  last_name: id,
  dob: '1995-01-01',
  passport_number: `ET${id}`,
  tracking_code: `TRK-ET-${id.padStart(4, '0')}`,
  country_of_origin: 'Ethiopia',
  marital_status: 'Single',
  email: `${id}@example.test`,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-11-06T00:00:00.000Z',
  payment_status: 'unpaid',
});

const stage = (candidateId: string): CandidateStage => ({
  id: `stage-${candidateId}`,
  candidate_id: candidateId,
  stage_id: 2,
  status: 'In Progress',
  updated_at: '2026-11-06T00:00:00.000Z',
});

const staff = (id: string): StaffUser => ({
  id,
  email: `${id}@example.test`,
  role: 'staff',
  is_approved: true,
  created_at: '2026-01-01T00:00:00.000Z',
});

describe('staff task allocation', () => {
  it('creates one next-stage follow-up task per active candidate', () => {
    const candidates = [candidate('1'), candidate('2')];
    const tasks = getActiveStageTasks(candidates, candidates.map(item => stage(item.id)), Date.parse('2026-11-06T00:00:00Z'));
    expect(tasks).toHaveLength(2);
    expect(tasks.every(task => task.action === 'Follow up' && task.stageTitle === 'Medical Check')).toBe(true);
  });

  it('distributes unassigned tasks evenly by default and preserves existing owners', () => {
    const candidates = Array.from({ length: 5 }, (_, i) => candidate(String(i + 1)));
    const records = candidates.map(item => stage(item.id));
    records[0].assigned_staff_id = 'staff-a';
    const assigned = assignUnassignedStageTasks(candidates, records, [staff('staff-a'), staff('staff-b')]);
    const counts = assigned.reduce<Record<string, number>>((acc, item) => {
      acc[item.assigned_staff_id ?? 'unassigned'] = (acc[item.assigned_staff_id ?? 'unassigned'] ?? 0) + 1;
      return acc;
    }, {});
    expect(assigned[0].assigned_staff_id).toBe('staff-a');
    expect(counts['staff-a']).toBe(3);
    expect(counts['staff-b']).toBe(2);
    expect(assigned.every(item => !!item.follow_up_due_at)).toBe(true);
  });

  it('rebalances active tasks using admin workload weights', () => {
    const candidates = Array.from({ length: 6 }, (_, i) => candidate(String(i + 1)));
    const balanced = rebalanceStageTasks(candidates, candidates.map(item => stage(item.id)), [staff('staff-a'), staff('staff-b')], { 'staff-a': 2, 'staff-b': 1 });
    const a = balanced.filter(item => item.assigned_staff_id === 'staff-a').length;
    const b = balanced.filter(item => item.assigned_staff_id === 'staff-b').length;
    expect(a).toBe(4);
    expect(b).toBe(2);
  });
  it('respects agency boundaries and paused staff even when there is no eligible owner', () => {
    const candidates = [candidate('1'), candidate('2')].map(item => ({ ...item, local_agency_id: 'local-a' }));
    const records = candidates.map(item => stage(item.id));
    const foreignStaff = { ...staff('staff-b'), local_agency_id: 'local-b' };
    const paused = { ...staff('staff-a'), local_agency_id: 'local-a' };
    expect(rebalanceStageTasks(candidates, records, [foreignStaff, paused], { 'staff-a': 0 }).every(item => !item.assigned_staff_id)).toBe(true);
    const internal = staff('internal');
    expect(rebalanceStageTasks(candidates, records, [foreignStaff, internal]).every(item => item.assigned_staff_id === internal.id)).toBe(true);
  });
  it('preserves completed records and deadlines while honoring fractional weights', () => {
    const candidates = Array.from({ length: 6 }, (_, i) => candidate(String(i)));
    const complete = { ...stage('0'), id: 'completed-registration', stage_id: 1, status: 'Completed' as const, assigned_staff_id: 'historical-owner' };
    const active = candidates.map(item => ({ ...stage(item.id), follow_up_due_at: '2026-12-31T00:00:00Z' }));
    const balanced = rebalanceStageTasks(candidates, [complete, ...active], [staff('a'), staff('b')], { a: 0.5, b: 1 });
    expect(balanced[0]).toEqual(complete);
    expect(balanced.slice(1).filter(item => item.assigned_staff_id === 'a')).toHaveLength(2);
    expect(balanced.slice(1).every(item => item.follow_up_due_at === '2026-12-31T00:00:00Z')).toBe(true);
  });
});
